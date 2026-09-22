import { useEffect, useRef, useState } from "react";
import { Play, Image as ImageIcon } from "lucide-react";
import type { HappeningItem } from "@/lib/happening-items";
import { happeningKindLabel } from "@/lib/happening-items";

interface Props {
  item: HappeningItem;
  compact?: boolean;
  onOpen: () => void;
}

/**
 * Clean media-first Happening card.
 * Image/video fills the whole tile; metadata floats over the media instead of
 * living in a separate white footer.
 */
export default function HappeningThumbCard({ item, compact = false, onOpen }: Props) {
  const isVideo = item.mediaType === "video";
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const canPreviewVideo = isVideo && Boolean(item.previewVideoUrl);

  useEffect(() => {
    if (!canPreviewVideo) return;
    const video = videoRef.current;
    const card = cardRef.current;
    if (!video || !card) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [canPreviewVideo, item.previewVideoUrl]);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-2xl bg-neutral-900 text-left shadow-sm transition duration-150 active:scale-[0.985] ${
        compact ? "aspect-[3/4] w-[6.8rem] shrink-0" : "aspect-[3/4] w-full"
      }`}
    >
      {canPreviewVideo ? (
        <>
          <video
            ref={videoRef}
            src={item.previewVideoUrl || undefined}
            poster={item.coverUrl || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
          />
          {!videoReady && item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
        </>
      ) : item.coverUrl ? (
        <img
          src={item.coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          {isVideo ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80" />

      <div className="absolute left-2 top-2">
        <span className="inline-flex rounded-full bg-black/55 px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
          {happeningKindLabel(item.kind)}
        </span>
      </div>

      {isVideo && !canPreviewVideo ? (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Play className="h-3 w-3 fill-white" />
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8">
        <p className={`${compact ? "text-[11px]" : "text-xs"} line-clamp-2 font-bold leading-[1.25] text-white drop-shadow`}>
          {item.title}
        </p>
        {item.subtitle ? (
          <p className="mt-0.5 truncate text-[9px] font-medium text-white/70">{item.subtitle}</p>
        ) : null}
      </div>
    </button>
  );
}
