import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
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
  getAddedSoundVideoSyncOptions,
  getMixedPlaybackVolumes,
  syncTrimmedAudioToVideo,
  videoTimeToMusicTime,
} from "@/lib/post-music-preview";
import {
  applyFeedVideoAudio,
  applyFeedAudioElementVolume,
  bindFeedMediaSession,
  forceIosAudioSessionToPlayback,
  isFeedAudioSessionUnlocked,
  isTouchFeedDevice,
  unlockFeedAudioSession,
  waitForVideoCanPlay,
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
  const [mediaReady, setMediaReady] = useState(false);
  const [videoFrameReady, setVideoFrameReady] = useState(false);
  const [localPosterUrl, setLocalPosterUrl] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [autoplayAudioLocked, setAutoplayAudioLocked] = useState(false);
  const [feedAudioUnlocked, setFeedAudioUnlocked] = useState(isFeedAudioSessionUnlocked);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const musicStopRef = useRef<(() => void) | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSessionCleanupRef = useRef<(() => void) | null>(null);
  const paintRecoveryTimerRef = useRef<number | null>(null);
  const paintRecoveryAttemptsRef = useRef(0);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPausedRef = useRef(false);
  const autoplayAudioLockedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  const suppressNextMediaToggleRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false);
  const { emojis, spawnEmoji } = useFloatingEmojis();

  autoplayAudioLockedRef.current = autoplayAudioLocked;
  isActiveRef.current = isActive;
  isScrubbingRef.current = isScrubbing;

  const { caption: displayCaption, meta: postMeta } = parsePostCaption(post.caption);
  const postTitle = postMeta?.title?.trim();
  const playbackMeta = useMemo<FeedPlaybackMeta>(
    () => ({
      title: postTitle || displayCaption.split("\n")[0] || "JHi",
      artist: profile.display_name || "JHi",
    }),
    [postTitle, displayCaption, profile.display_name],
  );
  const hasAddedSound = Boolean(postMeta?.music?.audioUrl);
  const coverUrl = postMeta?.coverUrl;
  const hasMediaUrl = typeof post.media_url === "string" && post.media_url.trim().length > 0;
  const showMediaFallback = !hasMediaUrl || mediaFailed;
  const playbackMuteOriginal = hasAddedSound ? false : postMeta?.muteOriginal === true;

  const musicTrim = useMemo(
    () => ({
      trimStart: postMeta?.music?.trimStart,
      trimEnd: postMeta?.music?.trimEnd,
      sourceDurationSec: postMeta?.music?.durationSec,
    }),
    [postMeta?.music?.trimStart, postMeta?.music?.trimEnd, postMeta?.music?.durationSec],
  );

  const mapMusicTime = useCallback(
    (videoTime: number) => videoTimeToMusicTime(videoTime, musicTrim),
    [musicTrim],
  );

  const getVideoMuted = useCallback(() => {
    if (isMuted) return true;
    return playbackMuteOriginal;
  }, [isMuted, playbackMuteOriginal]);

  const getVideoMixAudio = useCallback(
    (forceMuted?: boolean): { muted: boolean; volume?: number } => {
      if (forceMuted || getVideoMuted()) return { muted: true };
      const mix = getMixedPlaybackVolumes({
        muteOriginal: playbackMuteOriginal,
        originalVolume: postMeta?.originalVolume,
        musicVolume: postMeta?.music?.volume,
      });
      if (hasAddedSound && !playbackMuteOriginal) {
        return { muted: false, volume: mix.videoVolume };
      }
      return { muted: false };
    },
    [getVideoMuted, hasAddedSound, playbackMuteOriginal, postMeta?.originalVolume, postMeta?.music?.volume],
  );

  const unlockFeedAudio = useCallback(() => {
    setFeedAudioUnlocked(true);
    setAutoplayAudioLocked(false);
    unlockFeedAudioSession();
  }, []);

  const activateFeedPlayback = useCallback((forceMuted?: boolean) => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video") return;

    const muted = forceMuted ?? (getVideoMuted() || autoplayAudioLocked);
    applyFeedVideoAudio(video, getVideoMixAudio(forceMuted ?? muted));

    mediaSessionCleanupRef.current?.();
    mediaSessionCleanupRef.current = null;

    if (hasAddedSound && musicAudioRef.current) {
      applyFeedAudioElementVolume(musicAudioRef.current);
      mediaSessionCleanupRef.current = bindFeedMediaSession(musicAudioRef.current, playbackMeta);
    } else if (!muted) {
      mediaSessionCleanupRef.current = bindFeedMediaSession(video, playbackMeta);
    }
  }, [post.media_type, getVideoMuted, autoplayAudioLocked, hasAddedSound, playbackMeta, getVideoMixAudio]);

  const startAudiblePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video" || !isActiveRef.current || userPausedRef.current) return false;

    if (video.readyState === 0 && video.preload !== "auto") {
      video.preload = "auto";
      try { video.load(); } catch { /* ignore */ }
    }

    if (isMuted) {
      musicAudioRef.current?.pause();
      applyFeedVideoAudio(video, { muted: getVideoMuted() });
      setAutoplayAudioLocked(false);
      return true;
    }

    if (hasAddedSound) {
      forceIosAudioSessionToPlayback();
      const audio = musicAudioRef.current;
      const soundSync = getAddedSoundVideoSyncOptions(true, { ...(postMeta ?? {}), muteOriginal: playbackMuteOriginal });
      const mix = getMixedPlaybackVolumes({
        muteOriginal: soundSync.muteOriginal,
        originalVolume: postMeta?.originalVolume,
        musicVolume: soundSync.volume,
      });
      applyFeedVideoAudio(video, { muted: mix.videoMuted, volume: mix.videoVolume });
      if (!audio) {
        setAutoplayAudioLocked(true);
        return false;
      }
      audio.currentTime = mapMusicTime(video.currentTime);
      audio.volume = mix.musicVolume;
      unlockFeedAudioSession();
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = bindFeedMediaSession(audio, playbackMeta);
      try {
        await audio.play();
        if (video.paused) await video.play();
        setAutoplayAudioLocked(false);
        setFeedAudioUnlocked(true);
        if (!isFeedAudioSessionUnlocked()) unlockFeedAudioSession();
        return true;
      } catch {
        setAutoplayAudioLocked(true);
        return false;
      }
    }

    applyFeedVideoAudio(video, { muted: false });
    forceIosAudioSessionToPlayback();
    mediaSessionCleanupRef.current?.();
    mediaSessionCleanupRef.current = bindFeedMediaSession(video, playbackMeta);
    try {
      await video.play();
      setAutoplayAudioLocked(false);
      setFeedAudioUnlocked(true);
      if (!isFeedAudioSessionUnlocked()) unlockFeedAudioSession();
      return true;
    } catch {
      setAutoplayAudioLocked(true);
      return false;
    }
  }, [post.media_type, isMuted, hasAddedSound, getVideoMuted, playbackMeta, mapMusicTime, playbackMuteOriginal, getVideoMixAudio]);

  const playWhenActive = useCallback(async () => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video" || userPausedRef.current) return false;

    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setIsPlaying(true);
      return true;
    }

    const targetMuted = getVideoMuted();

    video.preload = "auto";
    const ready = await waitForVideoCanPlay(video);
    if (!ready || !isActiveRef.current || userPausedRef.current) return false;

    const touchDevice = isTouchFeedDevice();
    const needsGestureForAudio = touchDevice && !isFeedAudioSessionUnlocked();

    const markPlaying = () => {
      setIsPlaying(true);
      onChromeHiddenChange?.(true);
    };

    const playSilently = async () => {
      applyFeedVideoAudio(video, { muted: true });
      try {
        await video.play();
        markPlaying();
        activateFeedPlayback(true);
        return true;
      } catch {
        setIsPlaying(false);
        return false;
      }
    };

    if (isMuted || (targetMuted && !hasAddedSound)) {
      setAutoplayAudioLocked(false);
      return playSilently();
    }

    if (hasAddedSound) {
      if (needsGestureForAudio) {
        const played = await playSilently();
        setAutoplayAudioLocked(true);
        return played;
      }

      applyFeedVideoAudio(video, getVideoMixAudio());
      forceIosAudioSessionToPlayback();
      try {
        await video.play();
        markPlaying();
      } catch {
        setIsPlaying(false);
        return false;
      }

      const audio = musicAudioRef.current;
      if (!audio) {
        setAutoplayAudioLocked(true);
        activateFeedPlayback(true);
        return true;
      }

      audio.currentTime = mapMusicTime(video.currentTime);
      applyFeedAudioElementVolume(audio);
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = bindFeedMediaSession(audio, playbackMeta);

      try {
        await audio.play();
        setAutoplayAudioLocked(false);
        setFeedAudioUnlocked(true);
        if (!isFeedAudioSessionUnlocked()) unlockFeedAudioSession();
        return true;
      } catch {
        audio.pause();
        setAutoplayAudioLocked(true);
        activateFeedPlayback(true);
        return true;
      }
    }

    if (needsGestureForAudio) {
      setAutoplayAudioLocked(true);
      const played = await playSilently();
      return played;
    }

    setAutoplayAudioLocked(false);
    applyFeedVideoAudio(video, { muted: false });
      forceIosAudioSessionToPlayback();
    mediaSessionCleanupRef.current?.();
    mediaSessionCleanupRef.current = bindFeedMediaSession(video, playbackMeta);

    try {
      await video.play();
      markPlaying();
      setFeedAudioUnlocked(true);
      if (!isFeedAudioSessionUnlocked()) unlockFeedAudioSession();
      return true;
    } catch {
      setAutoplayAudioLocked(true);
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = null;
      return playSilently();
    }
  }, [post.media_type, getVideoMuted, activateFeedPlayback, onChromeHiddenChange, isMuted, hasAddedSound, playbackMeta, mapMusicTime, playbackMuteOriginal]);

  const handleFirstFeedInteraction = useCallback(() => {
    const video = videoRef.current;
    if (!video || post.media_type !== "video" || !isActiveRef.current || userPausedRef.current || isMuted) return;
    if (autoplayAudioLockedRef.current || video.muted || !isFeedAudioSessionUnlocked()) {
      suppressNextMediaToggleRef.current = true;
      void startAudiblePlayback();
    }
  }, [post.media_type, isMuted, startAudiblePlayback]);

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
      activateFeedPlayback(getVideoMuted());
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
    setMediaReady(false);
    setVideoFrameReady(false);
    setLocalPosterUrl(null);
    setMediaFailed(false);
    paintRecoveryAttemptsRef.current = 0;
    if (paintRecoveryTimerRef.current) {
      window.clearTimeout(paintRecoveryTimerRef.current);
      paintRecoveryTimerRef.current = null;
    }
  }, [post.id, post.media_url, post.isLiked, post.likes_count]);

  useEffect(() => {
    if (!videoRef.current) return;
    const muted = getVideoMuted() || autoplayAudioLocked;
    applyFeedVideoAudio(videoRef.current, { muted });
  }, [getVideoMuted, autoplayAudioLocked]);

  useEffect(() => {
    const onUnlocked = () => {
      setFeedAudioUnlocked(true);
      setAutoplayAudioLocked(false);
    };
    window.addEventListener("feed-audio-unlocked", onUnlocked);
    return () => window.removeEventListener("feed-audio-unlocked", onUnlocked);
  }, []);

  // Added sound plays in sync with video — vocal stays audible unless muted in editor.
  useEffect(() => {
    musicStopRef.current?.();
    musicStopRef.current = null;
    musicAudioRef.current = null;
    if (!isActive || !postMeta?.music?.audioUrl) return;

    const mix = getMixedPlaybackVolumes({
      muteOriginal: playbackMuteOriginal,
      originalVolume: postMeta?.originalVolume,
      musicVolume: postMeta?.music?.volume,
    });

    const player = playUploadedAudio(postMeta.music.audioUrl, {
      loop: true,
      trimStart: postMeta.music.trimStart ?? 0,
      trimEnd: postMeta.music.trimEnd,
      volume: mix.musicVolume,
      autoplay: false,
      externallySynced: true,
    });
    player.audio.volume = mix.musicVolume;
    musicAudioRef.current = player.audio;
    musicStopRef.current = player.stop;

    return () => {
      musicStopRef.current?.();
      musicStopRef.current = null;
      musicAudioRef.current = null;
    };
  }, [
    isActive,
    postMeta?.music?.audioUrl,
    postMeta?.music?.durationSec,
    postMeta?.music?.trimStart,
    postMeta?.music?.trimEnd,
    postMeta?.music?.volume,
    postMeta?.originalVolume,
    playbackMuteOriginal,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = musicAudioRef.current;
    if (!video || !audio || !postMeta?.music?.audioUrl || !isActive) return;

    const onPlay = () => {
      void startAudiblePlayback();
    };
    const onPause = () => audio.pause();
    const onSeeked = () => {
      const mix = getMixedPlaybackVolumes({
        muteOriginal: playbackMuteOriginal,
        originalVolume: postMeta?.originalVolume,
        musicVolume: postMeta?.music?.volume,
      });
      audio.volume = mix.musicVolume;
      applyFeedVideoAudio(video, { muted: mix.videoMuted, volume: mix.videoVolume });
      syncTrimmedAudioToVideo(
        video,
        audio,
        musicTrim,
        postMeta?.music?.durationSec ?? 0,
        true,
      );
      if (!video.paused && audio.paused) {
        void audio.play().catch(() => {});
      }
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
  }, [isActive, postMeta?.music?.audioUrl, post.id, startAudiblePlayback, musicTrim, postMeta?.music?.durationSec, postMeta?.originalVolume, playbackMuteOriginal, postMeta?.music?.volume]);

  useEffect(() => {
    if (!isActive || isMuted || post.media_type !== "video") return;
    if (feedAudioUnlocked || isFeedAudioSessionUnlocked()) {
      void startAudiblePlayback();
    }
  }, [isActive, isMuted, post.media_type, feedAudioUnlocked, startAudiblePlayback]);

  useEffect(() => {
    if (post.media_type !== "video") return;

    if (!isActive) {
      setShowComments(false);
      mediaSessionCleanupRef.current?.();
      mediaSessionCleanupRef.current = null;
      userPausedRef.current = false;
      setUserPaused(false);
      setAutoplayAudioLocked(false);
      setVideoProgress(0);
      setVideoDuration(0);
      videoRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setVideoProgress(0);
    setVideoDuration(0);

    let cancelled = false;
    const video = videoRef.current;

    const attemptPlay = () => {
      if (cancelled || userPausedRef.current || showComments) return;
      void playWhenActive();
    };

    attemptPlay();

    if (!video) return () => { cancelled = true; };

    const onReady = () => attemptPlay();
    video.addEventListener("canplay", onReady);
    const retryId = window.setTimeout(attemptPlay, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(retryId);
      video.removeEventListener("canplay", onReady);
    };
  }, [isActive, showComments, post.media_type, playWhenActive]);

  // iOS/Android pause feed video in background — restore audio when app returns.
  useEffect(() => {
    if (!isActive || post.media_type !== "video") return;

    const restoreAfterBackground = () => {
      if (document.visibilityState !== "visible") return;
      if (userPausedRef.current || showComments) return;

      const video = videoRef.current;
      if (!video) return;

      if (isFeedAudioSessionUnlocked() && !getVideoMuted()) {
        setAutoplayAudioLocked(false);
        setFeedAudioUnlocked(true);
        void startAudiblePlayback();
      } else if (video.paused) {
        void playWhenActive();
      } else if (!getVideoMuted() && video.muted) {
        void startAudiblePlayback();
      }
    };

    document.addEventListener("visibilitychange", restoreAfterBackground);
    window.addEventListener("pageshow", restoreAfterBackground);
    return () => {
      document.removeEventListener("visibilitychange", restoreAfterBackground);
      window.removeEventListener("pageshow", restoreAfterBackground);
    };
  }, [isActive, post.media_type, showComments, getVideoMuted, playWhenActive, startAudiblePlayback]);

  useEffect(() => {
    if (!viewCounted && isActive && post.id) {
      setViewCounted(true);
      incrementPostViews(post.id);
    }
  }, [isActive, post.id, viewCounted]);

  // Video progress — rAF while active so iOS timeupdate throttling doesn't freeze the bar.
  useEffect(() => {
    if (!isActive || post.media_type !== "video") return;

    const video = videoRef.current;
    if (!video) return;

    const syncDuration = () => {
      if (video.duration && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };
    syncDuration();
    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("durationchange", syncDuration);

    const trim = postMeta?.trim;
    let rafId = 0;
    let lastProgressSync = 0;
    const tick = () => {
      if (!isScrubbingRef.current && video.duration && isFinite(video.duration) && !video.paused) {
        const now = performance.now();
        if (now - lastProgressSync > 250) {
          lastProgressSync = now;
          setVideoProgress((video.currentTime / video.duration) * 100);
        }
      }
      if (trim && !video.paused && video.currentTime >= trim.end) {
        video.currentTime = trim.start;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("durationchange", syncDuration);
    };
  }, [isActive, post.media_type, post.id, postMeta?.trim]);

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
        if (suppressNextMediaToggleRef.current) {
          suppressNextMediaToggleRef.current = false;
          return;
        }
        if (autoplayAudioLocked) {
          unlockFeedAudio();
          const muted = getVideoMuted();
          applyFeedVideoAudio(videoRef.current, { muted });
          activateFeedPlayback(muted);
          const addedAudio = musicAudioRef.current;
          if (addedAudio && postMeta?.music?.audioUrl && !isMuted) {
            addedAudio.currentTime = videoRef.current.currentTime;
            applyFeedAudioElementVolume(addedAudio);
            void addedAudio.play().catch(() => {});
          }
          void videoRef.current.play().catch(() => {});
          return;
        }
        toggleVideoPlayback();
      } else if (post.media_type === "image" || post.media_url) {
        toggleNav(!chromeHidden);
      }
    }, doubleTapDelay);
  }, [liked, likeMutation, post.media_type, post.media_url, chromeHidden, toggleNav, toggleVideoPlayback, autoplayAudioLocked, unlockFeedAudio, getVideoMuted, activateFeedPlayback, postMeta?.music?.audioUrl, isMuted]);

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
    getVideoMuted() || autoplayAudioLocked;

  const captureLocalPoster = useCallback((video: HTMLVideoElement) => {
    if (coverUrl || localPosterUrl || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setLocalPosterUrl(canvas.toDataURL("image/jpeg", 0.82));
    } catch {
      /* Cross-origin or decoder not ready — native poster/first frame still applies. */
    }
  }, [coverUrl, localPosterUrl]);

  const hasVisibleVideoFrame = useCallback((video: HTMLVideoElement) => {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return false;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return true;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let darkPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = data[i] + data[i + 1] + data[i + 2];
        if (brightness < 24) darkPixels += 1;
      }
      return darkPixels / (data.length / 4) < 0.96;
    } catch {
      // If browser/CORS blocks sampling, trust the decoded frame rather than hiding forever.
      return true;
    }
  }, []);

  const scheduleVideoPaintRecovery = useCallback((video: HTMLVideoElement) => {
    if (paintRecoveryTimerRef.current || paintRecoveryAttemptsRef.current >= 3) return;
    paintRecoveryTimerRef.current = window.setTimeout(() => {
      paintRecoveryTimerRef.current = null;
      const v = videoRef.current;
      if (!v || v !== video || !isActiveRef.current || userPausedRef.current || mediaFailed || videoFrameReady) return;
      paintRecoveryAttemptsRef.current += 1;
      try {
        const nextTime = Math.min(
          Number.isFinite(v.duration) && v.duration > 0 ? Math.max(0, v.duration - 0.05) : v.currentTime + 0.034,
          Math.max(0, v.currentTime + 0.034),
        );
        v.currentTime = nextTime;
      } catch { /* ignore */ }

      // The user's manual pause/play is what wakes the iOS decoder; do it invisibly while the poster stays up.
      if (!v.paused) {
        v.pause();
      }
      window.setTimeout(() => {
        if (!isActiveRef.current || userPausedRef.current) return;
        void playWhenActive();
      }, 90);
    }, paintRecoveryAttemptsRef.current === 0 ? 450 : 750);
  }, [mediaFailed, playWhenActive, videoFrameReady]);

  const revealFirstFrame = (video: HTMLVideoElement) => {
    if (coverUrl) return;
    if (video.currentTime > 0.05) {
      captureLocalPoster(video);
      return;
    }
    const target = postMeta?.coverTime ?? 0.12;
    if (Number.isFinite(video.duration) && video.duration > target + 0.05) {
      try {
        video.addEventListener("seeked", () => captureLocalPoster(video), { once: true });
        video.currentTime = target;
      } catch {
        /* ignore */
      }
    } else {
      captureLocalPoster(video);
    }
  };

  const markVideoFrameReady = useCallback((video: HTMLVideoElement) => {
    if (video !== videoRef.current) return;

    const reveal = () => {
      if (video !== videoRef.current) return;
      if (!hasVisibleVideoFrame(video)) {
        scheduleVideoPaintRecovery(video);
        return;
      }
      if (paintRecoveryTimerRef.current) {
        window.clearTimeout(paintRecoveryTimerRef.current);
        paintRecoveryTimerRef.current = null;
      }
      setVideoFrameReady(true);
      setMediaReady(true);
      captureLocalPoster(video);
    };

    const requestFrame = (video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number, meta: { width: number; height: number }) => void) => number;
    }).requestVideoFrameCallback;

    if (typeof requestFrame === "function") {
      requestFrame.call(video, (_now, meta) => {
        if (meta && meta.width > 0 && meta.height > 0) reveal();
      });
      return;
    }

    // Fallback for browsers without rVFC — trust that data is decoded.
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      window.setTimeout(reveal, 120);
    }
  }, [captureLocalPoster, hasVisibleVideoFrame, scheduleVideoPaintRecovery]);

  // iOS Safari sometimes plays audio but stalls the video decoder on the
  // active card — nudge currentTime by a hair to force a frame paint.
  useEffect(() => {
    if (!isActive || post.media_type !== "video") return;
    if (videoFrameReady || mediaFailed) return;
    const video = videoRef.current;
    if (!video) return;
    const timer = window.setTimeout(() => {
      const v = videoRef.current;
      if (!v || videoFrameReady) return;
      scheduleVideoPaintRecovery(v);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isActive, videoFrameReady, mediaFailed, isPlaying, post.media_type, scheduleVideoPaintRecovery]);

  const cropTransform = cropStyle?.transform;
  const compositedTransform = `${cropTransform ? `${cropTransform} ` : ""}translateZ(0)`;
  const videoCompositedStyle = {
    ...cropStyle,
    transform: compositedTransform,
    WebkitTransform: compositedTransform,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  } as CSSProperties;

  const posterOverlayUrl = coverUrl || localPosterUrl;
  const showPosterOverlay =
    post.media_type === "video" &&
    Boolean(posterOverlayUrl) &&
    !videoFrameReady &&
    !mediaFailed;

  return (
    <>
      <div
        className="absolute inset-0 bg-black overflow-hidden"
        onPointerDownCapture={handleFirstFeedInteraction}
        onTouchStartCapture={handleFirstFeedInteraction}
        onMouseDownCapture={handleFirstFeedInteraction}
      >
        {hasMediaUrl && !mediaFailed &&
          (post.media_type === "video" ? (
            <video
              ref={videoRef}
              src={post.media_url}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ ...videoCompositedStyle, opacity: showPosterOverlay ? 0.01 : 1 }}
              loop
              playsInline
              muted={videoMutedForAutoplay}
              autoPlay={false}
              preload={isActive || isNear ? "auto" : "metadata"}
              onLoadedMetadata={(e) => {
                revealFirstFrame(e.currentTarget);
                if (coverUrl) setMediaReady(true);
              }}
              onLoadedData={(e) => {
                setMediaReady(true);
                markVideoFrameReady(e.currentTarget);
              }}
              onCanPlay={(e) => {
                setMediaReady(true);
                markVideoFrameReady(e.currentTarget);
              }}
              onError={() => setMediaFailed(true)}
              onPlay={() => {
                setMediaReady(true);
                setIsPlaying(true);
                if (videoRef.current) markVideoFrameReady(videoRef.current);
              }}
              onPlaying={(e) => markVideoFrameReady(e.currentTarget)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <img
              src={post.media_url}
              alt={displayCaption || "Feed post"}
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={() => setMediaReady(true)}
              onError={() => setMediaFailed(true)}
            />
          ))}

        {showPosterOverlay && posterOverlayUrl && (
          <img
            src={posterOverlayUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 z-[1] h-full w-full object-cover pointer-events-none transition-opacity duration-200"
            style={videoCompositedStyle}
          />
        )}

        {showMediaFallback && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <p className="px-8 text-center text-lg font-semibold leading-relaxed text-white">
              {displayCaption || postTitle || "Post unavailable"}
            </p>
          </div>
        )}

        {hasMediaUrl && !mediaFailed && post.media_type === "video" && isActive && !mediaReady && !showPosterOverlay && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {showVisualOverlays && (
          <PostOverlayRenderer meta={postMeta} />
        )}

        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />

        <button
          onClick={handleContentTap}
          className="absolute inset-0 z-10"
          aria-label="Tap to play or pause, double tap to like"
        />

        {showHeart && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 fill-red-500 text-red-500 animate-ping" />
          </div>
        )}

        {post.media_type === "video" && userPaused && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVideoPlayback();
            }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-primary/80 backdrop-blur-md shadow-lg transition-all duration-300 active:scale-90"
            aria-label="Play video"
          >
            <Play className="w-7 h-7 text-primary-foreground fill-primary-foreground ml-1" />
          </button>
        )}

        <div className="absolute right-3 feed-bottom-offset z-40 flex flex-col items-center gap-4 pb-1 pointer-events-auto">
          {post.media_type === "video" && (
            <button
              onPointerDown={(e) => {
                if (!autoplayAudioLockedRef.current) return;
                e.stopPropagation();
                suppressNextMediaToggleRef.current = true;
                unlockFeedAudio();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (suppressNextMediaToggleRef.current || autoplayAudioLockedRef.current) {
                  suppressNextMediaToggleRef.current = false;
                  unlockFeedAudio();
                  setIsMuted(false);
                  const video = videoRef.current;
                  if (video) {
                    const muted = getVideoMuted();
                    applyFeedVideoAudio(video, { muted });
                    activateFeedPlayback(muted);
                    const addedAudio = musicAudioRef.current;
                    if (addedAudio && postMeta?.music?.audioUrl) {
                      addedAudio.currentTime = mapMusicTime(video.currentTime);
                      applyFeedAudioElementVolume(addedAudio);
                      void addedAudio.play().catch(() => {});
                    }
                    void video.play().catch(() => {});
                  }
                  return;
                }
                setIsMuted((value) => {
                  const next = !value;
                  if (next) {
                    musicAudioRef.current?.pause();
                  }
                  if (!next) {
                    unlockFeedAudio();
                    requestAnimationFrame(() => activateFeedPlayback(false));
                    const video = videoRef.current;
                    const addedAudio = musicAudioRef.current;
                    if (video && addedAudio && postMeta?.music?.audioUrl) {
                      addedAudio.currentTime = mapMusicTime(video.currentTime);
                      applyFeedAudioElementVolume(addedAudio);
                      void addedAudio.play().catch(() => {});
                    }
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
            aria-label="Open My Circle"
          >
            <Users className="feed-action-icon" />
            <span className="feed-action-count text-[9px]">My Circle</span>
          </button>
        </div>

        <div className="absolute left-3 right-[4.5rem] feed-bottom-offset z-40 pb-1 max-w-[calc(100%-5.5rem)] pointer-events-auto">
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
                  className="absolute left-0 top-0 h-full rounded-full bg-white pointer-events-none"
                  style={{
                    width: `${videoProgress}%`,
                    transition: isScrubbing ? "none" : videoProgress > 0 ? "width 100ms linear" : "none",
                  }}
                />
                {(isScrubbing || (isPlaying && videoProgress > 0)) && (
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
