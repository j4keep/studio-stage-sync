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
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPausedRef = useRef(false);
  const autoplayAudioLockedRef = useRef(false);
  const playWhenActivePromiseRef = useRef<Promise<boolean> | null>(null);
  const audiblePlaybackPromiseRef = useRef<Promise<boolean> | null>(null);
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
    if (hasAddedSound && postMeta?.muteOriginal !== false) return true;
    return postMeta?.muteOriginal === true;
  }, [isMuted, hasAddedSound, postMeta?.muteOriginal]);

  const getVideoMixAudio = useCallback(
    (forceMuted?: boolean): { muted: boolean; volume?: number } => {
      if (forceMuted || getVideoMuted()) return { muted: true };
      const mix = getMixedPlaybackVolumes({
        muteOriginal: postMeta?.muteOriginal,
        originalVolume: postMeta?.originalVolume,
        musicVolume: postMeta?.music?.volume,
      });
      if (hasAddedSound && postMeta?.muteOriginal !== true) {
        return { muted: false, volume: mix.videoVolume };
      }
      return { muted: false };
    },
    [getVideoMuted, hasAddedSound, postMeta?.muteOriginal, postMeta?.originalVolume, postMeta?.music?.volume],
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

  const startAudiblePlayback = useCallback(() => {
    if (audiblePlaybackPromiseRef.current) return audiblePlaybackPromiseRef.current;

    const run = async () => {
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
      const audio = musicAudioRef.current;
      const soundSync = getAddedSoundVideoSyncOptions(true, postMeta ?? {});
      const mix = getMixedPlaybackVolumes({
        muteOriginal: soundSync.muteOriginal,
        originalVolume: postMeta?.originalVolume,
        musicVolume: soundSync.volume,
      });
      applyFeedVideoAudio(video, { muted: true, volume: 0 });
      if (!audio) {
        setAutoplayAudioLocked(true);
        return false;
      }
      try {
        audio.currentTime = mapMusicTime(video.currentTime);
      } catch {
        /* wait for metadata */
      }
      audio.volume = mix.musicVolume;
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
    };

    const promise = run().finally(() => {
      if (audiblePlaybackPromiseRef.current === promise) {
        audiblePlaybackPromiseRef.current = null;
      }
    });
    audiblePlaybackPromiseRef.current = promise;
    return promise;
  }, [post.media_type, isMuted, hasAddedSound, getVideoMuted, playbackMeta, mapMusicTime, postMeta?.muteOriginal, getVideoMixAudio]);

  const playWhenActive = useCallback(() => {
    if (playWhenActivePromiseRef.current) return playWhenActivePromiseRef.current;

    const run = async () => {
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
      applyFeedVideoAudio(video, { muted: true, volume: 0 });
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

      if (needsGestureForAudio) {
        setAutoplayAudioLocked(true);
        activateFeedPlayback(true);
        return true;
      }

      const audibleStarted = await startAudiblePlayback();
      if (audibleStarted) {
        setAutoplayAudioLocked(false);
        return true;
      }

      audio.pause();
      setAutoplayAudioLocked(true);
      activateFeedPlayback(true);
      return true;
    }

    if (needsGestureForAudio) {
      setAutoplayAudioLocked(true);
      const played = await playSilently();
      return played;
    }

    setAutoplayAudioLocked(false);
    applyFeedVideoAudio(video, { muted: false });
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

    };

    const promise = run().finally(() => {
      if (playWhenActivePromiseRef.current === promise) {
        playWhenActivePromiseRef.current = null;
      }
    });
    playWhenActivePromiseRef.current = promise;
    return promise;
  }, [post.media_type, getVideoMuted, activateFeedPlayback, onChromeHiddenChange, isMuted, hasAddedSound, startAudiblePlayback]);

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

  // Keep adjacent videos attached only as metadata so swipes don't cold-start,
  // while avoiding several full-screen auto decoders at once.
  const shouldAttachMedia = post.media_type !== "video" || isActive || isNear;

  useEffect(() => {
    setLiked(!!post.isLiked);
    setLikesCount(post.likes_count || 0);
    setMediaFailed(false);
  }, [post.id, post.isLiked, post.likes_count]);

  useEffect(() => {
    if (!videoRef.current) return;
    const muted = getVideoMuted() || autoplayAudioLocked;
    applyFeedVideoAudio(videoRef.current, { muted });
  }, [getVideoMuted, autoplayAudioLocked]);

  useEffect(() => {
    const onUnlocked = () => {
      setFeedAudioUnlocked(true);
      setAutoplayAudioLocked(false);
      const video = videoRef.current;
      if (!video || !isActive || userPausedRef.current) return;
      if (!getVideoMuted()) {
        void startAudiblePlayback();
      }
    };
    window.addEventListener("feed-audio-unlocked", onUnlocked);
    return () => window.removeEventListener("feed-audio-unlocked", onUnlocked);
  }, [isActive, getVideoMuted, startAudiblePlayback]);

  useEffect(() => {
    const onFeedStartAudible = () => {
      if (
        post.media_type !== "video" ||
        !isActiveRef.current ||
        userPausedRef.current ||
        isMuted ||
        !autoplayAudioLockedRef.current
      ) return;
      setFeedAudioUnlocked(true);
      setAutoplayAudioLocked(false);
      void startAudiblePlayback();
    };

    window.addEventListener("feed-start-audible", onFeedStartAudible);
    return () => window.removeEventListener("feed-start-audible", onFeedStartAudible);
  }, [post.media_type, isMuted, startAudiblePlayback]);

  // Added sound plays in sync with video — vocal stays audible unless muted in editor.
  useEffect(() => {
    musicStopRef.current?.();
    musicStopRef.current = null;
    musicAudioRef.current = null;
    if (!isActive || !postMeta?.music?.audioUrl) return;

    const mix = getMixedPlaybackVolumes({
      muteOriginal: postMeta?.muteOriginal,
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
    postMeta?.muteOriginal,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = musicAudioRef.current;
    if (!video || !audio || !postMeta?.music?.audioUrl || !isActive) return;

    const onPlay = () => {
      if (!isMuted && isFeedAudioSessionUnlocked() && audio.paused) {
        void startAudiblePlayback();
      }
    };
    const onPause = () => audio.pause();
    const onSeeked = () => {
      const mix = getMixedPlaybackVolumes({
        muteOriginal: postMeta?.muteOriginal,
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
  }, [isActive, postMeta?.music?.audioUrl, post.id, startAudiblePlayback, musicTrim, postMeta?.music?.durationSec, postMeta?.originalVolume, postMeta?.muteOriginal, postMeta?.music?.volume, isMuted]);

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
      musicAudioRef.current?.pause();
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
    let lastProgress = -1;
    let lastProgressAt = 0;
    const tick = (now: number) => {
      if (!isScrubbingRef.current && video.duration && isFinite(video.duration) && !video.paused) {
        const nextProgress = (video.currentTime / video.duration) * 100;
        if (now - lastProgressAt > 180 || Math.abs(nextProgress - lastProgress) > 1.25) {
          lastProgress = nextProgress;
          lastProgressAt = now;
          setVideoProgress(nextProgress);
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
            try {
              addedAudio.currentTime = mapMusicTime(videoRef.current.currentTime);
            } catch {
              /* wait for metadata */
            }
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

  return (
    <>
      <div
        className="absolute inset-0 bg-black overflow-hidden"
        onPointerDownCapture={handleFirstFeedInteraction}
        onTouchStartCapture={handleFirstFeedInteraction}
        onMouseDownCapture={handleFirstFeedInteraction}
      >
        {post.media_url && shouldAttachMedia &&
          (post.media_type === "video" ? (
            <video
              ref={videoRef}
              src={post.media_url}
              className="absolute inset-0 h-full w-full object-cover"
              style={cropStyle}
              loop
              playsInline
              muted={videoMutedForAutoplay}
              autoPlay={false}
              preload={isActive ? "auto" : "metadata"}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => {
                setMediaFailed(true);
                musicAudioRef.current?.pause();
              }}
            />
          ) : (
            <img
              src={post.media_url}
              alt={displayCaption || "Feed post"}
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setMediaFailed(true)}
            />
          ))}

        {post.media_url && !shouldAttachMedia && (
          <div className="absolute inset-0 bg-background" />
        )}

        {mediaFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
            This post couldn&apos;t load. Swipe for the next one.
          </div>
        )}

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

        <div className="absolute right-3 feed-bottom-offset z-40 flex flex-col items-center gap-4 pb-1">
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
                      try {
                        addedAudio.currentTime = mapMusicTime(video.currentTime);
                      } catch {
                        /* wait for metadata */
                      }
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
                      try {
                        addedAudio.currentTime = mapMusicTime(video.currentTime);
                      } catch {
                        /* wait for metadata */
                      }
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
