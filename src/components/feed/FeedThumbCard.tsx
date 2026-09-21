import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Play, Image as ImageIcon } from "lucide-react";
import { VideoPoster } from "@/components/VideoPoster";
import { parsePostCaption } from "@/lib/post-editor";
import { unlockFeedAudioSession, forceIosAudioSessionToPlayback } from "@/lib/feed-video-playback";

interface Props {
  post: any;
  compact?: boolean;
  onOpen: () => void;
  /** When true, the card auto-plays a muted looping preview so the feed has visible motion. */
  autoPlayMuted?: boolean;
  /** Desktop: open after press-hold (also opens on click). Opens on pointer-up so audio gesture stays valid. */
  pressHoldMs?: number;
}

/** Home-feed post card with clear social-app hierarchy and all chrome contained in-card. */
export default function FeedThumbCard({ post, compact = false, onOpen, autoPlayMuted = false, pressHoldMs }: Props) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const holdTimer = useRef<number | null>(null);
  const holdReady = useRef(false);
  const holdOpened = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const { caption, meta } = useMemo(() => parsePostCaption(post.caption), [post.caption]);
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const isVideo = post.media_type === "video";
  const title = (meta?.title || caption || "").trim();
  const coverUrl = meta?.coverUrl;
  const thumbSrc = isVideo ? coverUrl || post.media_url : post.media_url;
  const shouldAutoPlay = autoPlayMuted && isVideo && Boolean(post.media_url);

  useEffect(() => {
    setAvatarFailed(false);
  }, [post.id, profile.avatar_url]);

  const openWithAudio = () => {
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    onOpen();
  };

  useEffect(() => {
    if (!shouldAutoPlay) return;
    const video = videoRef.current;
    const card = cardRef.current;
    if (!video || !card) return;

    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [shouldAutoPlay, post.media_url]);

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={(e) => {
        if (holdOpened.current) {
          e.preventDefault();
          holdOpened.current = false;
          return;
        }
        openWithAudio();
      }}
      onPointerDown={() => {
        if (!pressHoldMs) return;
        holdReady.current = false;
        holdOpened.current = false;
        clearHold();
        holdTimer.current = window.setTimeout(() => {
          holdReady.current = true;
        }, pressHoldMs);
      }}
      onPointerUp={() => {
        clearHold();
        if (pressHoldMs && holdReady.current) {
          holdReady.current = false;
          holdOpened.current = true;
          openWithAudio();
        }
      }}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      onContextMenu={(e) => {
        if (pressHoldMs) e.preventDefault();
      }}
      className="w-full overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)] transition duration-150 active:scale-[0.992] cursor-pointer"
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
          {profile.avatar_url && !avatarFailed ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-foreground">
              {(profile.display_name || "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-foreground">
            {profile.display_name || "Artist"}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">YAJ community</p>
        </div>
      </div>

      {title && (
        <div className="px-3 pb-2.5">
          <p className={`text-foreground ${compact ? "text-xs" : "text-[13px]"} font-medium leading-[1.45] line-clamp-3`}>
            {title}
          </p>
        </div>
      )}

      <div className={`relative w-full ${compact ? "aspect-[9/16]" : "aspect-[4/5]"} bg-neutral-900 pointer-events-none`}>
        {shouldAutoPlay ? (
          <>
            <video
              ref={videoRef}
              src={post.media_url}
              poster={coverUrl || undefined}
              muted
              loop
              playsInline
              preload="auto"
              onLoadedData={() => setVideoReady(true)}
              onCanPlay={() => setVideoReady(true)}
              className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            />
            {!videoReady && coverUrl ? (
              <img
                src={coverUrl}
                alt={title || "Video preview"}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
              />
            ) : null}
          </>
        ) : isVideo && post.media_url ? (
          <VideoPoster
            src={post.media_url}
            poster={coverUrl}
            alt={title || "Video preview"}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          />
        ) : thumbSrc ? (
          <img
            src={thumbSrc}
            alt={title || "Post preview"}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          />
        ) : isVideo ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground pointer-events-none">
            <ImageIcon className="h-7 w-7" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 pointer-events-none">
            <ImageIcon className="h-7 w-7" />
          </div>
        )}

        {isVideo && !shouldAutoPlay && (
          <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 shadow-sm backdrop-blur-sm pointer-events-none">
            <Play className="h-3.5 w-3.5 fill-white text-white" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 border-t border-border/70 px-3 py-2.5 text-[11px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" strokeWidth={2} />
          {post.likes_count || 0}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          {post.comments_count || 0}
        </span>
        <span className="ml-auto text-[10px] font-medium text-muted-foreground/80">Tap to open</span>
      </div>
    </button>
  );
}
