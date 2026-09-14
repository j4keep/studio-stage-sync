import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Crown,
  DollarSign,
  Edit3,
  FolderHeart,
  Headphones,
  HelpCircle,
  Rocket,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Ticket,
  UserCheck,
  UserPlus,
  Video,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { userHasDealBusiness } from "@/lib/deals-api";
import profileBanner from "@/assets/profile-banner.jpg";
import profileAvatar from "@/assets/profile-avatar.jpg";
import EditProfileSheet from "@/components/EditProfileSheet";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import ArtistSearchBar from "@/components/ArtistSearchBar";
import FollowersSheet from "@/components/FollowersSheet";
import ProfileFeedSection from "@/components/ProfileFeedSection";
import BattleWinsSheet from "@/components/BattleWinsSheet";
import UserProjectsSheet from "@/components/UserProjectsSheet";
import { useSectionNotifications, type NotifSection } from "@/hooks/use-section-notifications";
import { getYajAiVoiceLabel } from "@/lib/yaj-ai-prefs";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { counts: notifCounts, clearSection } = useSectionNotifications();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState("0");
  const [winsCount, setWinsCount] = useState("0");
  const [projectsCount, setProjectsCount] = useState("0");
  const [totalViews, setTotalViews] = useState("0");
  const [showFollowers, setShowFollowers] = useState(false);
  const [showWins, setShowWins] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [profileInfo, setProfileInfo] = useState<{
    display_name: string;
    email: string;
    avatar_url: string | null;
    banner_url: string | null;
  }>({ display_name: "", email: "", avatar_url: null, banner_url: null });
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro } = useProGate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDealBusiness, setIsDealBusiness] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsDealBusiness(false);
      return;
    }
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(Boolean(data)));
    void userHasDealBusiness(user.id).then(setIsDealBusiness);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    void supabase
      .from("profiles")
      .select("display_name, avatar_url, banner_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setProfileInfo({
          display_name: data.display_name || user.email?.split("@")[0] || "",
          email: user.email || "",
          avatar_url: data.avatar_url,
          banner_url: data.banner_url,
        });
      });

    void (supabase as any)
      .from("battle_wins")
      .select("id", { count: "exact", head: true })
      .eq("winner_id", user.id)
      .then(({ count }: any) => {
        const c = count || 0;
        setWinsCount(c >= 1000 ? `${(c / 1000).toFixed(1)}K` : String(c));
      });

    const fetchProjectsCount = async () => {
      const [songs, videos, podcasts, posts, battles] = await Promise.all([
        (supabase as any).from("songs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        (supabase as any).from("videos").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        (supabase as any).from("podcasts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        (supabase as any).from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        (supabase as any).from("battles").select("id", { count: "exact", head: true }).eq("challenger_id", user.id),
      ]);
      const total = (songs.count || 0) + (videos.count || 0) + (podcasts.count || 0) + (posts.count || 0) + (battles.count || 0);
      setProjectsCount(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : String(total));
    };
    void fetchProjectsCount();

    void (supabase as any)
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", user.id)
      .then(({ count }: any) => {
        const c = count || 0;
        setFollowerCount(c >= 1000 ? `${(c / 1000).toFixed(1)}K` : String(c));
      });
  }, [user]);

  const refetchViews = useCallback(async () => {
    if (!user) return;
    const [{ data: songs }, { data: videos }, { data: podcasts }, { data: posts }, { data: battles }] = await Promise.all([
      (supabase as any).from("songs").select("plays").eq("user_id", user.id),
      (supabase as any).from("videos").select("views").eq("user_id", user.id),
      (supabase as any).from("podcasts").select("plays").eq("user_id", user.id),
      (supabase as any).from("posts").select("views").eq("user_id", user.id),
      (supabase as any).from("battles").select("views").eq("challenger_id", user.id),
    ]);
    let total = 0;
    (songs || []).forEach((s: any) => { total += parseInt(s.plays) || 0; });
    (videos || []).forEach((v: any) => { total += parseInt(v.views) || 0; });
    (podcasts || []).forEach((p: any) => { total += parseInt(p.plays) || 0; });
    (posts || []).forEach((p: any) => { total += p.views || 0; });
    (battles || []).forEach((b: any) => { total += b.views || 0; });
    setTotalViews(total >= 1000 ? `${(total / 1000).toFixed(1)}K` : String(total));
  }, [user]);

  useEffect(() => {
    void refetchViews();
    const onFocus = () => void refetchViews();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refetchViews();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetchViews]);

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    toast({
      title: isFollowing ? "Unfollowed" : "Following!",
      description: isFollowing ? "You unfollowed this artist" : "You're now following this artist",
    });
  };

  const handleShare = () => {
    void navigator.clipboard.writeText(`${window.location.origin}/artist/wheuat-artist`);
    toast({ title: "Link copied!", description: "Share this link on social media" });
  };

  const proGatedNav = (featureName: string, route: string) => {
    if (isPro) navigate(route);
    else requirePro(featureName);
  };

  const contentTabs = [
    { id: "videos", label: "Videos", icon: Video, route: "/my-videos", pro: false },
    { id: "projects", label: "Projects", icon: FolderHeart, route: "/my-projects", pro: true },
    { id: "store", label: "Store", icon: ShoppingBag, route: "/my-store", pro: true },
  ];

  const goSection = (section: NotifSection | null, route: string) => {
    if (section) void clearSection(section);
    navigate(route);
  };

  const quickActions = [
    { icon: Briefcase, label: "Professional Dashboard", sub: "Post and manage jobs, deals, listings and events", action: () => navigate("/pro"), pro: false, section: null as NotifSection | null },
    { icon: Sparkles, label: "YAJ AI Generator", sub: `Voice · ${getYajAiVoiceLabel()}`, action: () => navigate("/ask-yaj/settings"), pro: false, section: null as NotifSection | null },
    { icon: Bookmark, label: "Saved Deals", sub: "Offers you bookmarked", action: () => navigate("/deals/my"), pro: false, section: null as NotifSection | null },
    { icon: Ticket, label: "My Coupons", sub: "Claimed and ready to use", action: () => navigate("/deals/my"), pro: false, section: null as NotifSection | null },
    ...(isDealBusiness
      ? [{ icon: Store, label: "Business Dashboard", sub: "Post deals, analytics and verification", action: () => navigate("/deals/business"), pro: false, section: null as NotifSection | null }]
      : [{ icon: Store, label: "Become a Business", sub: "Reach local shoppers with Deals", action: () => navigate("/deals/become-business"), pro: false, section: null as NotifSection | null }]),
    { icon: ShoppingBag, label: "Purchases", sub: "View purchase history", action: () => goSection("purchases", "/purchases"), pro: false, section: "purchases" as NotifSection | null },
    { icon: CalendarDays, label: "My Bookings", sub: "Sessions and receipts", action: () => goSection("bookings", "/my-bookings"), pro: false, section: "bookings" as NotifSection | null },
    { icon: Building2, label: "Local Help Business", sub: "Manage your local services", action: () => goSection("localHelp", "/local-help/business"), pro: false, section: "localHelp" as NotifSection | null },
    { icon: Wrench, label: "My Gigs Dashboard", sub: "Posted, working and completed gigs", action: () => goSection("gigs", "/my-gigs"), pro: false, section: "gigs" as NotifSection | null },
    { icon: Building2, label: "My Studios", sub: "Manage studio listings", action: () => proGatedNav("Studio Listings", "/my-studios"), pro: true, section: null as NotifSection | null },
    { icon: BarChart3, label: "Analytics", sub: "View account insights", action: () => proGatedNav("Analytics", "/analytics"), pro: true, section: null as NotifSection | null },
    { icon: DollarSign, label: "Earnings", sub: "Revenue and payouts", action: () => proGatedNav("Earnings", "/earnings"), pro: true, section: null as NotifSection | null },
    { icon: Rocket, label: "My Boosts", sub: "Manage promotions", action: () => proGatedNav("Boosts", "/my-boosts"), pro: true, section: null as NotifSection | null },
    { icon: HelpCircle, label: "Help & Support", sub: "Tickets and FAQs", action: () => goSection("support", "/help"), pro: false, section: "support" as NotifSection | null },
    ...(isAdmin
      ? [
          { icon: Shield, label: "Trust & Safety", sub: "Admin · warnings, timeouts and bans", action: () => navigate("/admin/trust-safety"), pro: false, section: null as NotifSection | null },
          { icon: BadgeCheck, label: "Deals Verification", sub: "Admin · merchant approvals and moderation", action: () => navigate("/admin/deals-verification"), pro: false, section: null as NotifSection | null },
          { icon: Headphones, label: "Customer Relations", sub: "Admin · tickets, appeals and replies", action: () => navigate("/admin/customer-relations"), pro: false, section: null as NotifSection | null },
        ]
      : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-8 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em]">Profile</h1>
            <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">Manage your presence on YAJ.</p>
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-card text-foreground shadow-sm transition active:scale-95"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <ArtistSearchBar onSelectArtist={(artist) => navigate(`/artist/${artist.user_id}`)} />
        </div>

        <section className="overflow-hidden border-y border-border/70 bg-card shadow-sm sm:mx-4 sm:rounded-[24px] sm:border">
          <div className="relative h-44 overflow-hidden sm:h-52">
            <img src={profileInfo.banner_url || profileBanner} alt="Profile banner" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </div>

          <div className="relative px-4 pb-5">
            <div className="-mt-10 flex items-end justify-between gap-3">
              {profileInfo.avatar_url ? (
                <img src={profileInfo.avatar_url} alt="Profile" className="h-24 w-24 rounded-full border-4 border-card object-cover shadow-md" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-primary/10 shadow-md">
                  <span className="text-3xl font-bold text-primary">{(profileInfo.display_name || "?")[0]?.toUpperCase()}</span>
                </div>
              )}
              <button
                onClick={() => setShowEditProfile(true)}
                className="mb-1 flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-[13px] font-semibold shadow-sm transition active:scale-[0.98]"
              >
                <Edit3 className="h-4 w-4" />
                Edit profile
              </button>
            </div>

            <div className="mt-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[22px] font-bold tracking-[-0.025em]">{profileInfo.display_name || "Set your name"}</h2>
                {isPro && <CheckCircle className="h-4.5 w-4.5 fill-primary/15 text-primary" />}
              </div>
              <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">{profileInfo.email || "Your YAJ profile"}</p>
            </div>

            <div className="mt-4 grid grid-cols-4 divide-x divide-border/70 rounded-2xl border border-border/70 bg-background/60 py-3">
              {[
                { label: "Wins", value: winsCount, action: () => setShowWins(true) },
                { label: "Followers", value: followerCount, action: () => setShowFollowers(true) },
                { label: "Projects", value: projectsCount, action: () => setShowProjects(true) },
                { label: "Views", value: totalViews, action: undefined },
              ].map((stat) => (
                <button key={stat.label} type="button" onClick={stat.action} className="px-1 text-center active:opacity-70">
                  <p className="text-[16px] font-bold tracking-tight text-foreground">{stat.value}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{stat.label}</p>
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleFollow}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition active:scale-[0.99] ${
                  isFollowing ? "border border-primary bg-primary/5 text-primary" : "bg-primary text-primary-foreground shadow-sm"
                }`}
              >
                {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isFollowing ? "Following" : "Follow"}
              </button>
              <button onClick={() => navigate("/my-projects")} className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-background text-[13px] font-semibold active:scale-[0.99]">
                Projects
              </button>
              <button onClick={handleShare} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground active:scale-95" aria-label="Share profile">
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <div className="px-4 pt-5">
          <button
            type="button"
            onClick={() => navigate("/ask-yaj/settings")}
            className="flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-bold">YAJ AI Generator</p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">Dashboard</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">Voice, avatar and settings · {getYajAiVoiceLabel()}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          {!isPro && (
            <button onClick={() => requirePro("PRO Subscription")} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left transition active:scale-[0.99]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Crown className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">Upgrade to PRO</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Unlock advanced creator tools · $10/mo</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <section className="mt-6 border-y border-border/70 bg-card px-4 py-4 sm:mx-4 sm:rounded-2xl sm:border">
          <div className="mb-3">
            <h3 className="text-[16px] font-bold tracking-tight">Your content</h3>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Manage what you create and publish.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {contentTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => (tab.pro ? proGatedNav(tab.label, tab.route) : navigate(tab.route))}
                className="relative flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/60 px-2 text-[11px] font-semibold transition active:scale-[0.98]"
              >
                <tab.icon className="h-5 w-5 text-primary" />
                {tab.label}
                {tab.pro && !isPro && <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[7px] font-bold text-primary-foreground">PRO</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="px-4 pt-6">
          <div className="mb-3">
            <h3 className="text-[17px] font-bold tracking-tight">Account & tools</h3>
            <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">Shortcuts for your activity, business and creator tools.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {quickActions.map((item, index) => (
              <button
                key={item.label}
                onClick={item.action}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-muted/40 active:bg-muted/60 ${index > 0 ? "border-t border-border/60" : ""}`}
              >
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <item.icon className="h-[18px] w-[18px] text-primary" />
                  {item.section && notifCounts[item.section] > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-foreground">{item.label}</p>
                    {item.pro && !isPro && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">PRO</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted-foreground">{item.sub}</p>
                </div>
                {item.section && notifCounts[item.section] > 0 && <span className="rounded-full bg-destructive px-2 py-0.5 text-[9px] font-bold text-destructive-foreground">{notifCounts[item.section]} new</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" />
              </button>
            ))}
          </div>
        </section>

        {user && (
          <section className="px-4 pt-7">
            <div className="mb-3">
              <h3 className="text-[17px] font-bold tracking-tight">My feed</h3>
              <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">Posts and activity from your profile.</p>
            </div>
            <ProfileFeedSection userId={user.id} isOwner />
          </section>
        )}
      </div>

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
          setProfileInfo((prev) => ({
            ...prev,
            display_name: data.name,
            avatar_url: updates.avatar_url || prev.avatar_url,
            banner_url: updates.banner_url || prev.banner_url,
          }));
          toast({ title: "Profile updated!", description: "Your changes have been saved." });
        }}
      />

      {user && <FollowersSheet open={showFollowers} onClose={() => setShowFollowers(false)} userId={user.id} isOwner />}
      {user && <BattleWinsSheet open={showWins} onClose={() => setShowWins(false)} userId={user.id} />}
      {user && <UserProjectsSheet open={showProjects} onClose={() => setShowProjects(false)} userId={user.id} />}
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default ProfilePage;
