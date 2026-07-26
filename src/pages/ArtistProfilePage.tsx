import { useState, useEffect } from "react";
import {
  User, Music, Heart, Trophy, Video, UserPlus, Share2, UserCheck, DollarSign, FolderHeart, ShoppingBag, CheckCircle, Ban
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import profileBanner from "@/assets/profile-banner.jpg";
import FollowersSheet from "@/components/FollowersSheet";
import MessageUserButton from "@/components/MessageUserButton";

import ProfileFeedSection from "@/components/ProfileFeedSection";
import UserReviewsSection from "@/components/UserReviewsSection";
import BattleWinsSheet from "@/components/BattleWinsSheet";
import UserProjectsSheet from "@/components/UserProjectsSheet";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";
import { blockUser, isBlockedBetween } from "@/lib/blocks";

const ArtistProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState("0");
  const [winsCount, setWinsCount] = useState("0");
  const [projectsCount, setProjectsCount] = useState("0");
  const [totalViews, setTotalViews] = useState("0");
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showWins, setShowWins] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockedPeer, setBlockedPeer] = useState(false);
  const [profileInfo, setProfileInfo] = useState<{
    display_name: string;
    avatar_url: string | null;
    banner_url: string | null;
  }>({ display_name: "", avatar_url: null, banner_url: null });

  useEffect(() => {
    if (userId && user && userId === user.id) {
      navigate("/profile", { replace: true });
    }
  }, [userId, user, navigate]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);

      if (user && user.id !== userId) {
        const blocked = await isBlockedBetween(user.id, userId);
        if (blocked) {
          setBlockedPeer(true);
          setLoading(false);
          return;
        }
        setBlockedPeer(false);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, banner_url")
        .eq("user_id", userId)
        .single();

      if (profile) {
        setProfileInfo({
          display_name: profile.display_name || "Artist",
          avatar_url: profile.avatar_url,
          banner_url: profile.banner_url,
        });
      }

      // Fetch wins count
      const { count: winsC } = await (supabase as any)
        .from("battle_wins")
        .select("id", { count: "exact", head: true })
        .eq("winner_id", userId);
      const w = winsC || 0;
      setWinsCount(w >= 1000 ? `${(w / 1000).toFixed(1)}K` : String(w));

      // Fetch projects count
      const [songsR, videosR, podcastsR, postsR, battlesR] = await Promise.all([
        (supabase as any).from("songs").select("id", { count: "exact", head: true }).eq("user_id", userId),
        (supabase as any).from("videos").select("id", { count: "exact", head: true }).eq("user_id", userId),
        (supabase as any).from("podcasts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        (supabase as any).from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        (supabase as any).from("battles").select("id", { count: "exact", head: true }).eq("challenger_id", userId),
      ]);
      const projTotal = (songsR.count || 0) + (videosR.count || 0) + (podcastsR.count || 0) + (postsR.count || 0) + (battlesR.count || 0);
      setProjectsCount(projTotal >= 1000 ? `${(projTotal / 1000).toFixed(1)}K` : String(projTotal));

      const { count } = await (supabase as any)
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId);
      const c = count || 0;
      setFollowerCount(c >= 1000 ? `${(c / 1000).toFixed(1)}K` : String(c));

      const [{ data: songData }, { data: videoData }, { data: podcastData }, { data: postData }, { data: battleData }] = await Promise.all([
        (supabase as any).from("songs").select("plays").eq("user_id", userId),
        (supabase as any).from("videos").select("views").eq("user_id", userId),
        (supabase as any).from("podcasts").select("plays").eq("user_id", userId),
        (supabase as any).from("posts").select("views").eq("user_id", userId),
        (supabase as any).from("battles").select("views").eq("challenger_id", userId),
      ]);

      let viewsTotal = 0;
      (songData || []).forEach((s: any) => { viewsTotal += parseInt(s.plays) || 0; });
      (videoData || []).forEach((v: any) => { viewsTotal += parseInt(v.views) || 0; });
      (podcastData || []).forEach((p: any) => { viewsTotal += parseInt(p.plays) || 0; });
      (postData || []).forEach((p: any) => { viewsTotal += p.views || 0; });
      (battleData || []).forEach((b: any) => { viewsTotal += b.views || 0; });

      setTotalViews(viewsTotal >= 1000 ? `${(viewsTotal / 1000).toFixed(1)}K` : String(viewsTotal));

      if (user) {
        const { data: followData } = await (supabase as any)
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .maybeSingle();
        setIsFollowing(!!followData);
      }

      setLoading(false);
    };
    load();
  }, [userId, user]);

  const handleFollow = async () => {
    if (!user || !userId) return;
    if (isFollowing) {
      await (supabase as any).from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
      setIsFollowing(false);
      toast({ title: "Unfollowed" });
    } else {
      await (supabase as any).from("follows").insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      toast({ title: "Following!" });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/artist/${userId}`);
    toast({ title: "Link copied!" });
  };

  const confirmBlock = async () => {
    if (!user || !userId) return;
    setBlockBusy(true);
    try {
      await blockUser(user.id, userId);
      toast({ title: `${profileInfo.display_name || "User"} blocked on all YAJ pages` });
      setShowBlock(false);
      setIsFollowing(false);
      navigate(-1);
    } catch (e: any) {
      toast({ title: e?.message || "Could not block", variant: "destructive" });
    } finally {
      setBlockBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (blockedPeer) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Ban className="h-10 w-10 text-muted-foreground" />
        <p className="text-base font-bold text-foreground">Profile unavailable</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          You can&apos;t view this YAJ page because of a block. Manage blocks in Settings → Blocking.
        </p>
        <button
          type="button"
          onClick={() => navigate("/settings/blocking")}
          className="mt-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Open Blocking
        </button>
      </div>
    );
  }

  return (
    <div className="pb-4">
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
            <h2 className="text-lg font-display font-bold text-foreground">{profileInfo.display_name}</h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleFollow}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${isFollowing ? "bg-card border border-primary text-primary" : "gradient-primary text-primary-foreground glow-primary"}`}
          >
            {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {isFollowing ? "Following" : "Follow"}
          </button>
          <MessageUserButton
            userId={userId}
            displayName={profileInfo?.display_name}
            avatarUrl={(profileInfo as any)?.avatar_url}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-card border border-border text-foreground hover:border-primary/30 transition-all"
          />

          <button onClick={handleShare} className="w-10 py-2.5 rounded-xl bg-card border border-border text-muted-foreground flex items-center justify-center hover:border-primary/30 transition-all">
            <Share2 className="w-4 h-4" />
          </button>
          {user && userId && user.id !== userId && (
            <button
              type="button"
              onClick={() => setShowBlock(true)}
              className="w-10 py-2.5 rounded-xl bg-card border border-border text-destructive flex items-center justify-center hover:border-destructive/40 transition-all"
              aria-label="Block"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: "Wins", value: winsCount, action: () => setShowWins(true) },
            { label: "Followers", value: followerCount, action: () => setShowFollowers(true) },
            { label: "Projects", value: projectsCount, action: () => setShowProjects(true) },
            { label: "Views", value: totalViews },
          ].map((s) => (
            <button key={s.label} onClick={(s as any).action} className="p-2.5 rounded-xl bg-card border border-border text-center hover:border-primary/30 transition-all">
              <p className="text-base font-display font-bold text-primary">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Artist's Posts Feed */}
      {userId && (
        <div className="px-4 mt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Feed</p>
          <ProfileFeedSection userId={userId} isOwner={false} />
        </div>
      )}

      {userId && <FollowersSheet open={showFollowers} onClose={() => setShowFollowers(false)} userId={userId} isOwner={false} />}
      {userId && <BattleWinsSheet open={showWins} onClose={() => setShowWins(false)} userId={userId} />}
      {userId && <UserProjectsSheet open={showProjects} onClose={() => setShowProjects(false)} userId={userId} />}
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
