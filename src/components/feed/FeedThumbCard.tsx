import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Play, Image as ImageIcon } from "lucide-react";
import { parsePostCaption } from "@/lib/post-editor";

interface Props {
  post: any;
  compact?: boolean;
  onOpen: () => void;
}

/** Compact card used in the split-feed columns. Nothing floats — all chrome inside the card. */
export default function FeedThumbCard({ post, compact = false, onOpen }: Props) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const { caption, meta } = useMemo(() => parsePostCaption(post.caption), [post.caption]);
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const isVideo = post.media_type === "video";
  const title = (meta?.title || caption || "").trim();
  const coverUrl = meta?.coverUrl;
  // Thumbnails never autoplay — only the tapped item plays in the fullscreen viewer.
  // This keeps only one video active at a time and prevents overlapping audio.
  const thumbSrc = isVideo ? coverUrl : post.media_url;

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl overflow-hidden bg-black shadow-xl border border-white/10 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className={`relative w-full ${compact ? "aspect-[9/16]" : "aspect-[4/5]"} bg-neutral-900 pointer-events-none`}>
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : isVideo ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
            <Play className="w-7 h-7 text-white/70 fill-white/70" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 pointer-events-none">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}

        {isVideo && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center pointer-events-none">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        )}

        {/* Gradient + caption footer inside the card */}
        <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
          {title && (
            <p className={`text-white font-semibold leading-tight line-clamp-2 ${compact ? "text-[10px]" : "text-xs"}`}>
              {title}
            </p>
          )}
        </div>
      </div>

      {/* Meta strip in-card */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 bg-black ${compact ? "text-[9px]" : "text-[10px]"} text-white/80`}>
        <div className="w-4 h-4 rounded-full overflow-hidden bg-white/15 shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white">
              {(profile.display_name || "?")[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <span className="truncate flex-1 font-medium">{profile.display_name || "Artist"}</span>
        <span className="flex items-center gap-0.5">
          <Heart className="w-2.5 h-2.5" />
          {post.likes_count || 0}
        </span>
        {!compact && (
          <span className="flex items-center gap-0.5">
            <MessageCircle className="w-2.5 h-2.5" />
            {post.comments_count || 0}
          </span>
        )}
      </div>
    </button>
  );
}
