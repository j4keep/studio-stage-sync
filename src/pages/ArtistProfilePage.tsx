import { useEffect, useState } from "react";
import { Ban, MessageCircle, Share2, UserCheck, UserPlus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import profileBanner from "@/assets/profile-banner.jpg";
import FollowersSheet from "@/components/FollowersSheet";
import MessageUserButton from "@/components/MessageUserButton";
import ProfileFeedSection from "@/components/ProfileFeedSection";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";
import { blockUser, isBlockedBetween } from "@/lib/blocks";

const compactNumber = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : String(value);

const ArtistProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState("0");
  const [followingCount, setFollowingCount] = useState("0");
  const [postCount, setPostCount] = useState("0");
  const [totalViews, setTotalViews] = useState("0");
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockedPeer, setBlockedPeer] = useState(false);
  const [profileInfo, setProfileInfo] = useState<{
    display_name: string;
    avatar_url: string | null;
    banner_url: string | null;
  }>({ display_name: "", avatar_url: null, banner_url: null });

  useEffect(() => {
    if (userId && user && userId === user.id) navigate("/profile", { replace: true });
  }, [userId, user, navigate]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    const load = async () => {
      setLoading(true);

      if (user && user.id !== userId) {
        const blocked = await isBlockedBetween(user.id, userId);
        if (!alive) return;
        if (blocked) {
          setBlockedPeer(true);
          setLoading(false);
          return;
        }
        setBlockedPeer(false);
      }

      const [{ data: profile }, followers, following, posts, { data: postViews }, { data: battles }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url, banner_url").eq("user_id", userId).single(),
        (supabase as any).from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        (supabase as any).from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        (supabase as any).from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        (supabase as any).from("posts").select("views").eq("user_id", userId),
        (supabase as any).from("battles").select("views").eq("challenger_id", userId),
      ]);

      if (!alive) return;

      if (profile) {
        setProfileInfo({
          display_name: profile.display_name || "YAJ member",
          avatar_url: profile.avatar_url,
          banner_url: profile.banner_url,
        });
      }

      setFollowerCount(compactNumber(followers.count || 0));
      setFollowingCount(compactNumber(following.count || 0));
      setPostCount(compactNumber(posts.count || 0));

      let views = 0;
      (postViews || []).forEach((post: any) => { views += Number(post.views) || 0; });
      (battles || []).forEach((battle: any) => { views += Number(battle.views) || 0; });
      setTotalViews(compactNumber(views));

      if (user) {
        const { data: followData } = await (supabase as any)
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .maybeSingle();
        if (alive) setIsFollowing(Boolean(followData));
      }

      if (alive) setLoading(false);
    };

    void load();
    return () => {
      alive = false;
    };
  }, [userId, user]);

  const handleFollow = async () => {
    if (!user || !userId) return;
    if (isFollowing) {
      await (supabase as any).from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setIsFollowing(false);
      setFollowerCount((current) => current);
      toast({ title: "Unfollowed" });
    } else {
      await (supabase as any).from("follows").insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      toast({ title: "Following" });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profileInfo.display_name || "YAJ member"} on YAJ`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Profile link copied" });
    } catch {
      // Native share can be cancelled.
    }
  };

  const confirmBlock = async () => {
    if (!user || !userId) return;
    setBlockBusy(true);
    try {
      await blockUser(user.id, userId);
      toast({ title: `${profileInfo.display_name || "User"} blocked on YAJ` });
      setShowBlock(false);
      setIsFollowing(false);
      navigate(-1);
    } catch (error: any) {
      toast({ title: error?.message || "Could not block", variant: "destructive" });
    } finally {
      setBlockBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (blockedPeer) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Ban className="h-10 w-10 text-muted-foreground" />
        <p className="text-[17px] font-bold text-foreground">Profile unavailable</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          You can&apos;t view this YAJ profile because of a block. You can manage blocked accounts in Settings.
        </p>
        <button
          type="button"
          onClick={() => navigate("/settings/blocking")}
          className="mt-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Manage blocks
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-8 text-foreground">
      <div className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden border-y border-border/70 bg-card shadow-sm sm:mx-4 sm:mt-4 sm:rounded-[24px] sm:border">
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
            </div>

            <div className="mt-3">
              <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">{profileInfo.display_name || "YAJ member"}</h1>
              <p className="mt-1 text-[12px] font-medium text-muted-foreground">Member of the YAJ community</p>
            </div>

            <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-2xl border border-border/70 bg-background/55">
              {[
                { label: "Posts", value: postCount },
                { label: "Followers", value: followerCount, action: () => setShowFollowers(true) },
                { label: "Following", value: followingCount },
                { label: "Views", value: totalViews },
              ].map((stat, index) => (
                <button
                  key={stat.label}
                  type="button"
                  onClick={stat.action}
                  className={`min-w-0 px-1 py-3 text-center ${index > 0 ? "border-l border-border/70" : ""}`}
                >
                  <p className="text-[17px] font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">{stat.label}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleFollow()}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition active:scale-[0.98] ${
                  isFollowing ? "border border-primary bg-background text-primary" : "bg-primary text-primary-foreground"
                }`}
              >
                {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isFollowing ? "Following" : "Follow"}
              </button>

              <MessageUserButton
                userId={userId}
                displayName={profileInfo.display_name}
                avatarUrl={profileInfo.avatar_url}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background text-[13px] font-semibold transition active:scale-[0.98]"
              />

              <button
                type="button"
                onClick={() => void handleShare()}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition active:scale-[0.96]"
                aria-label="Share profile"
              >
                <Share2 className="h-4 w-4" />
              </button>

              {user && userId && user.id !== userId && (
                <button
                  type="button"
                  onClick={() => setShowBlock(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-destructive transition active:scale-[0.96]"
                  aria-label="Block"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </section>

        {userId && (
          <section className="px-4 pt-6">
            <div className="mb-3">
              <h2 className="text-[17px] font-bold tracking-tight">Posts</h2>
              <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">Recent activity shared on YAJ.</p>
            </div>
            <ProfileFeedSection userId={userId} isOwner={false} />
          </section>
        )}
      </div>

      {userId && <FollowersSheet open={showFollowers} onClose={() => setShowFollowers(false)} userId={userId} isOwner={false} />}
      <BlockConfirmDialog
        open={showBlock}
        name={profileInfo.display_name || "User"}
        loading={blockBusy}
        onClose={() => setShowBlock(false)}
        onConfirm={() => void confirmBlock()}
      />
    </div>
  );
};

export default ArtistProfilePage;
