import { useMemo } from "react";
import { Heart, MessageCircle, Play, Image as ImageIcon } from "lucide-react";
import { parsePostCaption } from "@/lib/post-editor";

interface Props {
  post: any;
  compact?: boolean;
  onOpen: () => void;
}

/** Compact card used in the split-feed columns. Nothing floats — all chrome inside the card. */
export default function FeedThumbCard({ post, compact = false, onOpen }: Props) {
  const { caption, meta } = useMemo(() => parsePostCaption(post.caption), [post.caption]);
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const isVideo = post.media_type === "video";
  const title = (meta?.title || caption || "").trim();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl overflow-hidden bg-black shadow-xl border border-white/10 active:scale-[0.98] transition-transform"
    >
      <div className={`relative w-full ${compact ? "aspect-[9/16]" : "aspect-[4/5]"} bg-neutral-900`}>
        {post.media_url ? (
          isVideo ? (
            <video
              src={post.media_url}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={post.media_url}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}

        {isVideo && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        )}

        {/* Gradient + caption footer inside the card */}
        <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
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
