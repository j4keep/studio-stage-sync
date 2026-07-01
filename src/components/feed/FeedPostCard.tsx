import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Heart,
  MessageCircle,
  Forward,
  Trash2,
  MoreHorizontal,
  Bookmark,
  Edit3,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Users,
} from "lucide-react";
import { incrementPostViews } from "@/hooks/use-likes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PostCommentsSheet from "./PostCommentsSheet";
import CreatePostSheet from "./CreatePostSheet";
import PostOverlayRenderer from "./create/PostOverlayRenderer";
import useFloatingEmojis, { FloatingEmojiLayer } from "./FloatingEmojis";
import { parsePostCaption, hasVisualOverlayLayers } from "@/lib/post-editor";
import { playUploadedAudio, getMusicDisplayName } from "@/lib/feed-music";
import {
  applyFeedVideoAudio,
  applyFeedAudioElementVolume,
  bindFeedMediaSession,
  type FeedPlaybackMeta,
} from "@/lib/feed-video-playback";

interface Props {
  post: any;
  currentUserId?: string;
  isActive?: boolean;
  isNear?: boolean;
  chromeHidden?: boolean;
  onChromeHiddenChange?: (hidden: boolean) => void;
}

let feedAudibleAutoplayUnlocked = false;

const FeedPostCard = ({ post, currentUserId, isActive = false, isNear = false, chromeHidden = false, onChromeHiddenChange }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayAudioLocked, setAutoplayAudioLocked] = useState(false);
  const [feedAudioUnlocked, setFeedAudioUnlocked] = useState(feedAudibleAutoplayUnlocked);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const musicStopRef = useRef<(() => void) | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSessionCleanupRef = useRef<(() => void) | null>(null);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPausedRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const { emojis, spawnEmoji } = useFloatingEmojis();

  const { caption: displayCaption, meta: postMeta } = parsePostCaption(post.caption);
  const postTitle = postMeta?.title?.trim();
  const playbackMeta = useMemo<FeedPlaybackMeta>(
    () => ({
      title: postTitle || displayCaption.split("\n")[0] || "JHi",
      artist: profile.display_name || "JHi",
    }),
    [postTitle, displayCaption, profile.display_name],
  );

  const getVideoMuted = useCallback(() => {
    const hasAddedSound = Boolean(postMeta?.music?.audioUrl);
    return isMuted || hasAddedSound || postMeta?.muteOriginal === true;
  }, [isMuted, postMeta?.music?.audioUrl, postMeta?.muteOriginal]);

  const canStartWithSound = useCallback(() => {
    if (feedAudioUnlocked) return true;
    if (typeof navigator === "undefined" || !("userActivation" in navigator)) return true;
    return Boolean(navigator.userActivation?.isActive);
  }, [feedAudioUnlocked]);

  const unlockFeedAudio = useCallback(() => {
    feedAudibleAutoplayUnlocked = true;
    setFeedAudioUnlocked(true);
    setAutoplayAudioLocked(false);
    window.dispatchEvent(new Event("feed-audio-unlocked"));
  }, []);

  const activateFeedPlayback = useCallback((forceMuted?: boolean) => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video") return;

    const muted = forceMuted ?? (getVideoMuted() || autoplayAudioLocked);
    applyFeedVideoAudio(video, { muted });

    mediaSessionCleanupRef.current?.();
    mediaSessionCleanupRef.current = null;

    const hasAddedSound = Boolean(postMeta?.music?.audioUrl);
    if (hasAddedSound && musicAudioRef.current) {
      applyFeedAudioElementVolume(musicAudioRef.current);
      mediaSessionCleanupRef.current = bindFeedMediaSession(musicAudioRef.current, playbackMeta);
    } else if (!muted) {
      mediaSessionCleanupRef.current = bindFeedMediaSession(video, playbackMeta);
    }
  }, [post.media_type, getVideoMuted, autoplayAudioLocked, postMeta?.music?.audioUrl, playbackMeta]);

  const playWhenActive = useCallback(async () => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video" || userPausedRef.current) return false;

    const targetMuted = getVideoMuted();
    const playMuted = targetMuted || !canStartWithSound();

    const markPlaying = () => {
      applyFeedVideoAudio(video, { muted: playMuted });
      setAutoplayAudioLocked(!targetMuted && playMuted);
      activateFeedPlayback(playMuted);
      setIsPlaying(true);
      onChromeHiddenChange?.(true);
    };

    // Kick the network fetch immediately so playback isn't held up by lazy loading.
    if (video.readyState === 0 && video.preload !== "auto") {
      video.preload = "auto";
      try { video.load(); } catch { /* ignore */ }
    }

    try {
      // Mobile autoplay requires muted playback first — unmute after if allowed.
      applyFeedVideoAudio(video, { muted: playMuted });
      await video.play();
      markPlaying();
      return true;
    } catch {
      setIsPlaying(false);
      return false;
    }
  }, [post.media_type, getVideoMuted, canStartWithSound, activateFeedPlayback, onChromeHiddenChange]);

  const toggleVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video") return;

    if (video.paused) {
      userPausedRef.current = false;
      setUserPaused(false);
      unlockFeedAudio();
      void playWhenActive();
    } else if (autoplayAudioLocked) {
      unlockFeedAudio();
      applyFeedVideoAudio(video, { muted: getVideoMuted() });
      activateFeedPlayback();
    } else {
      userPausedRef.current = true;
      setUserPaused(true);
      video.pause();
      setIsPlaying(false);
      onChromeHiddenChange?.(false);
    }
  }, [post.media_type, playWhenActive, autoplayAudioLocked, getVideoMuted, activateFeedPlayback, unlockFeedAudio, onChromeHiddenChange]);

  // Image posts bake text/stickers/draw into the file — overlay renderer would double them
  const showVisualOverlays =
    postMeta &&
    hasVisualOverlayLayers(postMeta) &&
    !postMeta.bakedEdits &&
    post.media_type === "video";

  const cropStyle =
    postMeta?.crop && post.media_type === "video"
      ? {
          transform: `scale(${postMeta.crop.scale})`,
          objectPosition: `${postMeta.crop.x}% ${postMeta.crop.y}%`,
        }
      : undefined;

  useEffect(() => {
    setLiked(!!post.isLiked);
    setLikesCount(post.likes_count || 0);
  }, [post.id, post.isLiked, post.likes_count]);

  useEffect(() => {
    if (!videoRef.current) return;
    const muted = getVideoMuted() || autoplayAudioLocked || (isActive && !feedAudioUnlocked && !isPlaying);
    applyFeedVideoAudio(videoRef.current, { muted });
  }, [getVideoMuted, autoplayAudioLocked, isActive, feedAudioUnlocked, isPlaying]);

  useEffect(() => {
    const onUnlocked = () => setFeedAudioUnlocked(true);
    window.addEventListener("feed-audio-unlocked", onUnlocked);
    return () => window.removeEventListener("feed-audio-unlocked", onUnlocked);
  }, []);

  // Added sound plays in sync with video — camera audio is muted when a sound is attached.
  useEffect(() => {
    musicStopRef.current?.();
    musicStopRef.current = null;
    musicAudioRef.current = null;
    if (!isActive || !postMeta?.music?.audioUrl) return;

    const dur =
      postMeta.music.durationSec && postMeta.music.durationSec > 0
        ? postMeta.music.durationSec
        : undefined;
    const player = playUploadedAudio(postMeta.music.audioUrl, {
      loop: !dur,
      maxDurationSec: dur,
      autoplay: false,
    });
    musicAudioRef.current = player.audio;
    musicStopRef.current = player.stop;

    return () => {
      musicStopRef.current?.();
      musicStopRef.current = null;
      musicAudioRef.current = null;
    };
  }, [isActive, postMeta?.music?.audioUrl, postMeta?.music?.durationSec]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = musicAudioRef.current;
    if (!video || !audio || !postMeta?.music?.audioUrl || !isActive) return;

    const onPlay = () => {
      audio.currentTime = video.currentTime;
      applyFeedAudioElementVolume(audio);
      activateFeedPlayback();
      void audio.play().catch(() => {});
    };
    const onPause = () => audio.pause();
    const onSeeked = () => {
      audio.currentTime = video.currentTime;
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);

    if (!video.paused) onPlay();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [isActive, postMeta?.music?.audioUrl, post.id, activateFeedPlayback]);

  useEffect(() => {
    if (post.media_type !== "video") return;

    if (!isActive) {
      setShowComments(false);
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = null;
      userPausedRef.current = false;
      setUserPaused(false);
      setAutoplayAudioLocked(false);
      videoRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    const video = videoRef.current;
    const tryPlay = () => {
      if (userPausedRef.current || showComments) return;
      void playWhenActive();
    };

    tryPlay();

    if (!video) return;

    const onReady = () => {
      if (isActive && !userPausedRef.current && !showComments && video.paused) {
        void playWhenActive();
      }
    };

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("canplaythrough", onReady);

    const rafId = requestAnimationFrame(tryPlay);
    const timerIds = [0, 50, 150, 400].map((ms) => window.setTimeout(tryPlay, ms));

    return () => {
      cancelAnimationFrame(rafId);
      timerIds.forEach((id) => window.clearTimeout(id));
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("canplaythrough", onReady);
    };
  }, [isActive, showComments, post.media_type, playWhenActive]);

  useEffect(() => {
    if (!viewCounted && isActive && post.id) {
      setViewCounted(true);
      incrementPostViews(post.id);
    }
  }, [isActive, post.id, viewCounted]);

  // Video progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video") return;

    const onTimeUpdate = () => {
      if (!isScrubbing && video.duration && isFinite(video.duration)) {
        setVideoProgress((video.currentTime / video.duration) * 100);
      }
      const trim = postMeta?.trim;
      if (trim && video.currentTime >= trim.end) {
        video.currentTime = trim.start;
      }
    };
    const onLoadedMetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };
    const onDurationChange = () => {
      if (video.duration && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, [post.media_type, isScrubbing, postMeta?.trim]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleScrubStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsScrubbing(true);
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setScrubTime((pct / 100) * videoDuration);
    setVideoProgress(pct);
  }, [videoDuration]);

  const handleScrubMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isScrubbing) return;
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setScrubTime((pct / 100) * videoDuration);
    setVideoProgress(pct);
  }, [isScrubbing, videoDuration]);

  const handleScrubEnd = useCallback(() => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    const video = videoRef.current;
    if (video && videoDuration) {
      video.currentTime = (videoProgress / 100) * videoDuration;
    }
  }, [isScrubbing, videoProgress, videoDuration]);

  useEffect(() => {
    if (!isScrubbing) return;
    const onMove = (e: TouchEvent | MouseEvent) => handleScrubMove(e);
    const onEnd = () => handleScrubEnd();
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [isScrubbing, handleScrubMove, handleScrubEnd]);

  useEffect(() => {
    if (!user || user.id === post.user_id) return;
    (supabase as any)
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", post.user_id)
      .maybeSingle()
      .then(({ data }: any) => setIsFollowing(!!data));
  }, [user, post.user_id]);


  const toggleFollow = async () => {
    if (!user) return toast.error("Sign in to follow");
    if (user.id === post.user_id) return;

    if (isFollowing) {
      await (supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", post.user_id);
      setIsFollowing(false);
      toast.success("Unfollowed");
    } else {
      await (supabase as any).from("follows").insert({ follower_id: user.id, following_id: post.user_id });
      setIsFollowing(true);
      toast.success("Following!");
    }
  };

  const likeMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Not authenticated");
      const { data: existingLike } = await (supabase as any)
        .from("likes")
        .select("id")
        .eq("user_id", currentUserId)
        .eq("content_id", post.id)
        .eq("content_type", "post")
        .maybeSingle();

      if (existingLike) {
        await (supabase as any)
          .from("likes")
          .delete()
          .eq("user_id", currentUserId)
          .eq("content_id", post.id)
          .eq("content_type", "post");
      } else {
        await (supabase as any).from("likes").insert({
          user_id: currentUserId,
          content_id: post.id,
          content_type: "post",
        });
      }
    },
    onMutate: () => {
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikesCount((count: number) => (wasLiked ? Math.max(count - 1, 0) : count + 1));
      return { previousLiked: wasLiked, previousLikesCount: likesCount };
    },
    onError: (_error: any, _variables: any, context: any) => {
      setLiked(context?.previousLiked ?? !!post.isLiked);
      setLikesCount(context?.previousLikesCount ?? (post.likes_count || 0));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success("Post deleted");
    },
  });

  const toggleNav = useCallback((hidden: boolean) => {
    onChromeHiddenChange?.(hidden);
  }, [onChromeHiddenChange]);

  const handleContentTap = useCallback(() => {
    const now = Date.now();
    const doubleTapDelay = 300;

    if (now - lastTapRef.current < doubleTapDelay) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      const willLike = !liked;
      likeMutation.mutate();
      if (willLike) {
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      }
      toggleNav(true);
      lastTapRef.current = 0;
      return;
    }

    lastTapRef.current = now;
    tapTimerRef.current = setTimeout(() => {
      if (post.media_type === "video" && videoRef.current) {
        if (autoplayAudioLocked) {
          unlockFeedAudio();
          applyFeedVideoAudio(videoRef.current, { muted: getVideoMuted() });
          activateFeedPlayback();
          return;
        }
        toggleVideoPlayback();
      } else if (post.media_type === "image" || post.media_url) {
        toggleNav(!chromeHidden);
      }
    }, doubleTapDelay);
  }, [liked, likeMutation, post.media_type, post.media_url, chromeHidden, toggleNav, toggleVideoPlayback, autoplayAudioLocked, unlockFeedAudio, getVideoMuted, activateFeedPlayback]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/feed`;
    const shareText = post.caption || "Check this out!";

    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const handleEmojiComment = (emojiId: string) => {
    spawnEmoji(emojiId);
  };

  const formatCount = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return value.toString();
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: false });
  const videoMutedForAutoplay =
    getVideoMuted() || autoplayAudioLocked || (isActive && !userPaused && !getVideoMuted() && !isPlaying);

  return (
    <>
      <div className="absolute inset-0 bg-black overflow-hidden">
        {post.media_url &&
          (post.media_type === "video" ? (
            <video
              ref={videoRef}
              src={post.media_url}
              className="absolute inset-0 h-full w-full object-cover"
              style={cropStyle}
              loop
              playsInline
              muted={videoMutedForAutoplay}
              autoPlay={isActive && !userPaused}
              preload={isActive || isNear ? "auto" : "metadata"}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <img
              src={post.media_url}
              alt={displayCaption || "Feed post"}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ))}

        {!post.media_url && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-card to-background">
            <p className="px-8 text-center text-lg font-semibold leading-relaxed text-foreground">{displayCaption}</p>
          </div>
        )}

        {showVisualOverlays && (
          <PostOverlayRenderer meta={postMeta} />
        )}

        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />

        <button
          onClick={handleContentTap}
          className="absolute inset-0 z-20"
          aria-label="Tap to play or pause, double tap to like"
        />

        {showHeart && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 fill-red-500 text-red-500 animate-ping" />
          </div>
        )}

        {post.media_type === "video" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVideoPlayback();
            }}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-primary/80 backdrop-blur-md shadow-lg transition-all duration-300 active:scale-90 ${
              isPlaying || (isActive && !userPaused) ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
            ) : (
              <Play className="w-7 h-7 text-primary-foreground fill-primary-foreground ml-1" />
            )}
          </button>
        )}

        <div className="absolute right-3 feed-bottom-offset z-40 flex flex-col items-center gap-4 pb-1">
          {post.media_type === "video" && (
            <button
              onClick={() => {
                setIsMuted((value) => {
                  const next = !value;
                  if (!next) {
                    requestAnimationFrame(() => activateFeedPlayback());
                  }
                  return next;
                });
              }}
              className="feed-action-btn"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX className="feed-action-icon" /> : <Volume2 className="feed-action-icon" />}
            </button>
          )}

          <button onClick={() => likeMutation.mutate()} className="feed-action-btn">
            <Heart className={`feed-action-icon ${liked ? "fill-red-500 text-red-500" : ""}`} />
            <span className="feed-action-count">{formatCount(likesCount)}</span>
          </button>

          <button onClick={() => setShowComments(true)} className="feed-action-btn">
            <MessageCircle className="feed-action-icon" />
            <span className="feed-action-count">{post.comments_count || 0}</span>
          </button>

          <button className="feed-action-btn" aria-label="Save">
            <Bookmark className="feed-action-icon" />
          </button>

          <button onClick={handleShare} className="feed-action-btn">
            <Forward className="feed-action-icon" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); navigate("/circle"); }}
            className="feed-action-btn"
            aria-label="Open Catch Up Circle"
          >
            <Users className="feed-action-icon" />
            <span className="feed-action-count text-[9px]">Circle</span>
          </button>
        </div>

        <div className="absolute left-3 right-[4.5rem] feed-bottom-offset z-40 pb-1 max-w-[calc(100%-5.5rem)]">
          <div className="relative z-50 mb-1.5">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/40">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/30 flex items-center justify-center text-sm font-bold text-white">
                  {(profile.display_name || "A")[0].toUpperCase()}
                </div>
              )}
            </div>
            {user?.id !== post.user_id && !isFollowing && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFollow();
                }}
                className="absolute -bottom-1.5 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-red-500"
              >
                <span className="text-[10px] font-bold text-white">+</span>
              </button>
            )}
          </div>
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => navigate(`/artist/${post.user_id}`)}
              className="z-50 text-[15px] font-extrabold text-white drop-shadow-lg hover:underline"
            >
              @{profile.display_name || "Artist"}
            </button>
            {user?.id !== post.user_id && (
              <button
                onClick={toggleFollow}
                className={`z-50 rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                  isFollowing ? "border border-white/35 bg-white/15 text-white" : "bg-red-500 text-white"
                }`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          {(postTitle || displayCaption) && (
            <div className="pr-1">
              {postTitle && (
                <p className="text-[13px] font-bold leading-snug text-white drop-shadow-md line-clamp-2">{postTitle}</p>
              )}
              {displayCaption && (
                <p className={`text-[12px] leading-snug text-white/90 drop-shadow-md line-clamp-2 ${postTitle ? "mt-0.5" : ""}`}>
                  {displayCaption}
                </p>
              )}
            </div>
          )}
          {postMeta?.location && (
            <span className="mt-0.5 block text-[10px] text-white/55">{postMeta.location}</span>
          )}
          {postMeta?.music?.audioUrl && (
            <span className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
              <Volume2 className="w-3 h-3" />
              {getMusicDisplayName(postMeta.music)}
            </span>
          )}
          <span className="mt-1 block text-[10px] text-white/45">{timeAgo} ago</span>

          {post.media_type === "video" && (
            <div className="z-50 mt-2 relative seek-area px-0.5" role="slider" aria-valuenow={videoProgress} aria-valuemin={0} aria-valuemax={100}>
              <div
                ref={progressRef}
                className="relative h-[2px] w-full rounded-full bg-white/20 cursor-pointer touch-none"
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
              >
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white pointer-events-none transition-[width] duration-75"
                  style={{ width: `${videoProgress}%` }}
                />
                {(isScrubbing || videoProgress > 0) && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white pointer-events-none shadow-sm ${
                      isScrubbing ? "h-2.5 w-2.5" : "h-1.5 w-1.5 opacity-80"
                    }`}
                    style={{ left: `calc(${videoProgress}% - ${isScrubbing ? 5 : 3}px)` }}
                  />
                )}
              </div>
              {isScrubbing && (
                <div
                  className="absolute -top-7 rounded bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white pointer-events-none"
                  style={{ left: `${videoProgress}%`, transform: "translateX(-50%)" }}
                >
                  {formatTime(scrubTime)}
                </div>
              )}
            </div>
          )}

        </div>

        {currentUserId === post.user_id && (
          <div className="absolute top-16 right-3 z-50">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm"
            >
              <MoreHorizontal className="w-5 h-5 text-white" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-11 z-50 min-w-[150px] rounded-xl border border-border bg-card py-1 shadow-2xl">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowEdit(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-secondary"
                  >
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      deleteMutation.mutate();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-secondary"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <FloatingEmojiLayer emojis={emojis} />

      <PostCommentsSheet
        postId={post.id}
        open={showComments}
        onClose={() => setShowComments(false)}
        onEmojiComment={handleEmojiComment}
      />
      <CreatePostSheet open={showEdit} onClose={() => setShowEdit(false)} postToEdit={post} />
    </>
  );
};

export default FeedPostCard;
