import { useState, useEffect, useCallback } from "react";
import {
  User, Music, FolderHeart, Building2, Heart, Download, DollarSign,
  Settings, Shield, BarChart3, HelpCircle, Play, Video, ShoppingBag,
  CheckCircle, UserPlus, Share2, ChevronRight, Library, Edit3, UserCheck, ExternalLink, Crown, Lock, Rocket
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import profileBanner from "@/assets/profile-banner.jpg";
import profileAvatar from "@/assets/profile-avatar.jpg";
import EditProfileSheet from "@/components/EditProfileSheet";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import ArtistSearchBar from "@/components/ArtistSearchBar";
import FollowersSheet from "@/components/FollowersSheet";
import ProfileFeedSection from "@/components/ProfileFeedSection";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState("0");
  const [totalPlays, setTotalPlays] = useState("0");
  const [songCount, setSongCount] = useState("0");
  const [totalLikes, setTotalLikes] = useState("0");
  const [showFollowers, setShowFollowers] = useState(false);
  const [profileInfo, setProfileInfo] = useState<{ display_name: string; email: string; avatar_url: string | null; banner_url: string | null }>({
    display_name: "",
    email: "",
    avatar_url: null,
    banner_url: null,
  });
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro } = useProGate();

  useEffect(() => {
    if (!user) return;

    // Fetch profile info
    supabase
      .from("profiles")
      .select("display_name, email, avatar_url, banner_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfileInfo({
            display_name: data.display_name || user.email?.split("@")[0] || "",
            email: data.email || user.email || "",
            avatar_url: data.avatar_url,
            banner_url: data.banner_url,
          });
        }
      });

    (supabase as any)
      .from("songs")
      .select("plays")
      .eq("user_id", user.id)
      .then(({ data }: any) => {
        if (data) {
          const total = data.reduce((sum: number, s: any) => sum + (parseInt(s.plays) || 0), 0);
          setSongCount(String(data.length));
          setTotalPlays(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : String(total));
        }
      });

    (supabase as any)
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", user.id)
      .then(({ count }: any) => {
        const c = count || 0;
        setFollowerCount(c >= 1000 ? `${(c / 1000).toFixed(1)}K` : String(c));
      });

    const fetchLikes = async () => {
      const { count } = await (supabase as any)
        .from("likes")
        .select("id", { count: "exact", head: true })
        .in("content_type", ["song", "video", "post"])
        .in("content_id", 
          await (async () => {
            const [{ data: songs }, { data: videos }, { data: posts }] = await Promise.all([
              (supabase as any).from("songs").select("id").eq("user_id", user.id),
              (supabase as any).from("videos").select("id").eq("user_id", user.id),
              (supabase as any).from("posts").select("id").eq("user_id", user.id),
            ]);
            return [...(songs || []), ...(videos || []), ...(posts || [])].map((i: any) => i.id);
          })()
        );
      const total = count || 0;
      setTotalLikes(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : String(total));
    };
    fetchLikes();
  }, [user]);

  // Refetch likes when page regains focus (e.g. navigating back)
  const refetchLikes = useCallback(async () => {
    if (!user) return;
    const [{ data: songs }, { data: videos }, { data: posts }] = await Promise.all([
      (supabase as any).from("songs").select("id").eq("user_id", user.id),
      (supabase as any).from("videos").select("id").eq("user_id", user.id),
      (supabase as any).from("posts").select("id").eq("user_id", user.id),
    ]);
    const allIds = [...(songs || []), ...(videos || []), ...(posts || [])].map((i: any) => i.id);
    if (allIds.length === 0) { setTotalLikes("0"); return; }
    const { count } = await (supabase as any)
      .from("likes")
      .select("id", { count: "exact", head: true })
      .in("content_id", allIds);
    const total = count || 0;
    setTotalLikes(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : String(total));
  }, [user]);

  useEffect(() => {
    const onFocus = () => refetchLikes();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refetchLikes();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [refetchLikes]);

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    toast({ title: isFollowing ? "Unfollowed" : "Following!", description: isFollowing ? "You unfollowed this artist" : "You're now following this artist" });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/artist/wheuat-artist`);
    toast({ title: "Link copied!", description: "Share this link on social media" });
  };

  const proGatedNav = (featureName: string, route: string) => {
    if (isPro) {
      navigate(route);
    } else {
      requirePro(featureName);
    }
  };

  const contentTabs = [
    { id: "songs", label: "Songs", icon: Music, route: "/my-songs", pro: false },
    { id: "videos", label: "Videos", icon: Video, route: "/my-videos", pro: false },
    { id: "projects", label: "Projects", icon: FolderHeart, route: "/my-projects", pro: true },
    { id: "store", label: "Store", icon: ShoppingBag, route: "/my-store", pro: true },
  ];

  const quickActions = [
    { icon: Library, label: "Library", sub: "Playlists", action: () => navigate("/library"), pro: false },
    { icon: ShoppingBag, label: "Purchases", sub: "View history", action: () => navigate("/purchases"), pro: false },
    { icon: Edit3, label: "News Feed", sub: "Read & publish", action: () => navigate("/news-feed"), pro: false },
    { icon: Building2, label: "My Studios", sub: "Manage listings", action: () => proGatedNav("Studio Listings", "/my-studios"), pro: true },
    { icon: BarChart3, label: "Analytics", sub: "View insights", action: () => proGatedNav("Analytics", "/analytics"), pro: true },
    { icon: DollarSign, label: "Earnings", sub: "Revenue", action: () => proGatedNav("Earnings", "/earnings"), pro: true },
    { icon: Rocket, label: "My Boosts", sub: "Promotions", action: () => proGatedNav("Boosts", "/my-boosts"), pro: true },
    { icon: Shield, label: "Legal Vault", sub: "Documents", action: () => proGatedNav("Legal Vault", "/legal-vault"), pro: true },
    { icon: HelpCircle, label: "Help & Support", sub: "", action: () => navigate("/help"), pro: false },
  ];

  return (
    <div className="pb-4">
      {/* Settings */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-end">
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Artist Search */}
      <div className="px-4 pb-3">
        <ArtistSearchBar onSelectArtist={(artist) => {
          navigate(`/artist/${artist.user_id}`);
        }} />
      </div>

      {/* Banner */}
      <div className="relative h-44 overflow-hidden">
        {profileInfo.banner_url ? (
          <img src={profileInfo.banner_url} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <img src={profileBanner} alt="Banner" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      {/* Avatar & Info */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-3">
          {profileInfo.avatar_url ? (
            <img src={profileInfo.avatar_url} alt="Profile" className="w-20 h-20 rounded-full border-[3px] border-background object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full border-[3px] border-background bg-primary/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{(profileInfo.display_name || "?")[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-display font-bold text-foreground">{profileInfo.display_name || "Set Artist Name"}</h2>
              {isPro && <CheckCircle className="w-4 h-4 text-primary fill-primary/20" />}
            </div>
            
          </div>
        </div>

        <button onClick={() => setShowEditProfile(true)} className="w-full mt-3 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all">
          <Edit3 className="w-3.5 h-3.5" /> Edit Profile
        </button>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button onClick={handleFollow} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${isFollowing ? "bg-card border border-primary text-primary" : "gradient-primary text-primary-foreground glow-primary"}`}>
            {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {isFollowing ? "Following" : "Follow"}
          </button>
          <button onClick={() => navigate("/my-projects")} className="flex-1 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all">
            <DollarSign className="w-3.5 h-3.5" /> Contribute
          </button>
          <button onClick={handleShare} className="w-10 py-2.5 rounded-xl bg-card border border-border text-muted-foreground flex items-center justify-center hover:border-primary/30 transition-all">
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: "Songs", value: songCount },
            { label: "Followers", value: followerCount, action: () => setShowFollowers(true) },
            { label: "Plays", value: totalPlays },
            { label: "Likes", value: totalLikes },
          ].map((s) => (
            <button key={s.label} onClick={(s as any).action} className="p-2.5 rounded-xl bg-card border border-border text-center hover:border-primary/30 transition-all">
              <p className="text-base font-display font-bold text-primary">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </button>
          ))}
        </div>

        {/* PRO Badge / Upgrade */}
        {!isPro && (
          <button onClick={() => requirePro("PRO Subscription")} className="w-full mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3 hover:border-primary/40 transition-all">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center glow-primary">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Upgrade to PRO</p>
              <p className="text-[10px] text-muted-foreground">Unlock all features · $10/mo</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Content Tabs */}
      <div className="mt-5 border-t border-border">
        <div className="grid grid-cols-4 px-4 gap-1.5 pt-3">
          {contentTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.pro ? proGatedNav(tab.label, tab.route) : navigate(tab.route)}
              className="relative flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all text-muted-foreground bg-card border border-border hover:border-primary/30"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.pro && !isPro && (
                <span className="absolute -top-1 -right-1 text-[7px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full font-bold leading-none">PRO</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="flex flex-col gap-1.5">
          {quickActions.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
              {item.pro && !isPro && (
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">PRO</span>
              )}
              {item.sub && !item.pro && <span className="text-[11px] text-muted-foreground">{item.sub}</span>}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* My Posts */}
      {user && (
        <div className="px-4 mt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Feed</p>
          <ProfileFeedSection userId={user.id} isOwner={true} />
        </div>
      )}

      <EditProfileSheet
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profileData={{
          name: profileInfo.display_name,
          email: profileInfo.email,
          avatarUrl: profileInfo.avatar_url || profileAvatar,
          bannerUrl: profileInfo.banner_url || profileBanner,
        }}
        onSave={async (data) => {
          if (!user) return;
          const updates: any = { display_name: data.name, updated_at: new Date().toISOString() };
          
          if (data.avatarFile) {
            const ext = data.avatarFile.name.split(".").pop();
            const path = `avatars/${user.id}/${Date.now()}.${ext}`;
            const { data: uploadData } = await supabase.storage.from("media").upload(path, data.avatarFile);
            if (uploadData) {
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
              updates.avatar_url = urlData.publicUrl;
            }
          }
          
          if (data.bannerFile) {
            const ext = data.bannerFile.name.split(".").pop();
            const path = `banners/${user.id}/${Date.now()}.${ext}`;
            const { data: uploadData } = await supabase.storage.from("media").upload(path, data.bannerFile);
            if (uploadData) {
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
              updates.banner_url = urlData.publicUrl;
            }
          }
          
          await supabase.from("profiles").update(updates).eq("user_id", user.id);
          setProfileInfo(prev => ({
            ...prev,
            display_name: data.name,
            avatar_url: updates.avatar_url || prev.avatar_url,
            banner_url: updates.banner_url || prev.banner_url,
          }));
          toast({ title: "Profile updated!", description: "Your changes have been saved." });
        }}
      />

      {user && <FollowersSheet open={showFollowers} onClose={() => setShowFollowers(false)} userId={user.id} isOwner={true} />}
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default ProfilePage;
