import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Music, FolderHeart, Building2, Heart, Download, DollarSign,
  Settings, Shield, BarChart3, HelpCircle, Play, Video, ShoppingBag,
  CheckCircle, UserPlus, Share2, ChevronRight, Library, Edit3, UserCheck, ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import profileBanner from "@/assets/profile-banner.jpg";
import profileAvatar from "@/assets/profile-avatar.jpg";
import EditProfileSheet from "@/components/EditProfileSheet";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<"artist" | "fan">("artist");

  return (
    <div className="pb-4">
      {/* Role Toggle + Settings */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="w-8" />
        <div className="flex gap-1 p-1 rounded-full bg-card border border-border">
          {(["artist", "fan"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-5 py-1.5 rounded-full text-[11px] font-semibold transition-all capitalize ${
                role === r
                  ? "gradient-primary text-primary-foreground glow-primary"
                  : "text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {role === "artist" ? (
          <motion.div key="artist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ArtistProfile />
          </motion.div>
        ) : (
          <motion.div key="fan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FanProfile />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ArtistProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState("0");
  const [totalPlays, setTotalPlays] = useState("0");
  const [songCount, setSongCount] = useState("0");
  const [totalLikes, setTotalLikes] = useState("0");

  useEffect(() => {
    if (!user) return;
    // Fetch aggregated stats from songs
    (supabase as any)
      .from("songs")
      .select("plays")
      .eq("user_id", user.id)
      .then(({ data }: any) => {
        if (data) {
          const total = data.reduce((sum: number, s: any) => sum + (parseInt(s.plays) || 0), 0);
          setSongCount(String(data.length));
          if (total >= 1000) {
            setTotalPlays(`${(total / 1000).toFixed(1)}K`);
          } else {
            setTotalPlays(String(total));
          }
        }
      });

    // Fetch real follower count
    (supabase as any)
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", user.id)
      .then(({ count }: any) => {
        const c = count || 0;
        if (c >= 1000) {
          setFollowerCount(`${(c / 1000).toFixed(1)}K`);
        } else {
          setFollowerCount(String(c));
        }
      });

    // Fetch total likes across songs and videos
    const fetchLikes = async () => {
      let total = 0;
      for (const table of ["songs", "videos"] as const) {
        const { data } = await (supabase as any)
          .from(table)
          .select("likes_count")
          .eq("user_id", user.id);
        if (data) {
          total += data.reduce((sum: number, item: any) => sum + (item.likes_count || 0), 0);
        }
      }
      if (total >= 1000) {
        setTotalLikes(`${(total / 1000).toFixed(1)}K`);
      } else {
        setTotalLikes(String(total));
      }
    };
    fetchLikes();
  }, [user]);

  const tabs = [
    { id: "songs", label: "Songs", icon: Music, route: "/my-songs" },
    { id: "videos", label: "Videos", icon: Video, route: "/my-videos" },
    { id: "projects", label: "Projects", icon: FolderHeart, route: "/my-projects" },
    { id: "store", label: "Store", icon: ShoppingBag, route: "/my-store" },
  ];

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    setFollowerCount(prev => isFollowing ? "1.2K" : "1.2K");
    toast({
      title: isFollowing ? "Unfollowed" : "Following!",
      description: isFollowing ? "You unfollowed WHEUAT Artist" : "You're now following WHEUAT Artist",
    });
  };

  const handleContribute = () => {
    navigate("/my-projects");
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/artist/wheuat-artist`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link copied!",
      description: "Share this link on social media to gain followers",
    });
  };

  return (
    <>
      {/* Banner */}
      <div className="relative h-44 overflow-hidden">
        <img src={profileBanner} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      {/* Avatar & Info */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-3">
          <img src={profileAvatar} alt="Profile" className="w-20 h-20 rounded-full border-[3px] border-background object-cover" />
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-display font-bold text-foreground">WHEUAT Artist</h2>
              <CheckCircle className="w-4 h-4 text-primary fill-primary/20" />
            </div>
            <p className="text-xs text-muted-foreground">@wheuatartist · Independent</p>
          </div>
        </div>

        <button
          onClick={() => setShowEditProfile(true)}
          className="w-full mt-3 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all"
        >
          <Edit3 className="w-3.5 h-3.5" /> Edit Profile
        </button>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleFollow}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              isFollowing
                ? "bg-card border border-primary text-primary"
                : "gradient-primary text-primary-foreground glow-primary"
            }`}
          >
            {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {isFollowing ? "Following" : "Follow"}
          </button>
          <button
            onClick={handleContribute}
            className="flex-1 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all"
          >
            <DollarSign className="w-3.5 h-3.5" /> Contribute
          </button>
          <button
            onClick={handleShare}
            className="w-10 py-2.5 rounded-xl bg-card border border-border text-muted-foreground flex items-center justify-center hover:border-primary/30 transition-all"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Stats - Connected to real data */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: "Songs", value: songCount },
            { label: "Followers", value: followerCount },
            { label: "Plays", value: totalPlays },
            { label: "Likes", value: totalLikes },
          ].map((s) => (
            <div key={s.label} className="p-2.5 rounded-xl bg-card border border-border text-center">
              <p className="text-base font-display font-bold text-primary">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* PRO Badge */}
        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Pro Artist</p>
            <p className="text-[10px] text-muted-foreground">Legal Vault · Analytics · Verified Badge</p>
          </div>
          <span className="text-[10px] text-primary font-semibold">$7.99/mo</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Content Tabs */}
      <div className="mt-5 border-t border-border">
        <div className="grid grid-cols-4 px-4 gap-1.5 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.route)}
              className="flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-semibold transition-all text-muted-foreground bg-card border border-border hover:border-primary/30"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="flex flex-col gap-1.5">
          {[
          { icon: Library, label: "Library", sub: "3 playlists", action: () => navigate("/library") },
            { icon: Edit3, label: "News Feed", sub: "Submit article", action: () => navigate("/settings") },
            { icon: ShoppingBag, label: "Purchases", sub: "View history", action: () => navigate("/purchases") },
            { icon: Building2, label: "My Studios", sub: "Manage listings", action: () => navigate("/my-studios") },
            { icon: BarChart3, label: "Analytics", sub: "View insights", action: () => navigate("/analytics") },
            { icon: DollarSign, label: "Earnings", sub: "$1,247.00", action: () => navigate("/earnings") },
            { icon: Shield, label: "Legal Vault", sub: "PRO", action: () => navigate("/legal-vault") },
            { icon: HelpCircle, label: "Help & Support", sub: "", action: () => navigate("/help") },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
              {item.sub && <span className="text-[11px] text-muted-foreground">{item.sub}</span>}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <EditProfileSheet
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profileData={{ name: "WHEUAT Artist", email: "artist@wheuat.com", avatarUrl: profileAvatar, bannerUrl: profileBanner }}
        onSave={(data) => console.log("Profile updated:", data)}
      />
    </>
  );
};

const FanProfile = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4">
      <div className="flex flex-col items-center mb-6 mt-2">
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-2xl glow-primary mb-3">
          WU
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">WHEUAT Fan</h2>
        <p className="text-xs text-muted-foreground">Fan Account</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Following", value: "8" },
          { label: "Contributed", value: "$340" },
          { label: "Downloads", value: "5" },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
            <p className="text-lg font-display font-bold text-primary">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {[
          { icon: Library, label: "Library", count: "3 playlists", action: () => navigate("/library") },
          { icon: ShoppingBag, label: "Purchases", count: "View history", action: () => navigate("/purchases") },
          { icon: Heart, label: "Followed Artists", count: "8", action: () => navigate("/followed-artists") },
          { icon: FolderHeart, label: "Contributions", count: "$340", action: () => navigate("/my-projects") },
          { icon: Building2, label: "Saved Studios", count: "3", action: () => navigate("/studios") },
          { icon: Download, label: "Downloads", count: "5 songs", action: () => navigate("/my-store") },
          { icon: HelpCircle, label: "Help & Support", count: "", action: () => navigate("/help") },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
            {item.count && <span className="text-[11px] text-muted-foreground">{item.count}</span>}
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfilePage;
