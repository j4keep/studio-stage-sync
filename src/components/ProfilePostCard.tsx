import { Heart, MessageCircle, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  post: any;
}

const ProfilePostCard = ({ post }: Props) => {
  const profile = post.profile || { display_name: "Artist", avatar_url: null };
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      {post.media_url && (
        <div className="aspect-[4/5] bg-secondary overflow-hidden">
          {post.media_type === "video" ? (
            <video
              src={post.media_url}
              controls
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={post.media_url}
              alt={post.caption || `${profile.display_name} post`}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary bg-primary/10">
                {(profile.display_name || "A")[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">@{profile.display_name || "Artist"}</p>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>

        {post.caption && <p className="text-sm text-foreground/90 leading-relaxed mb-3">{post.caption}</p>}

        <div className="flex items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span className="text-xs">{post.likes_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs">{post.comments_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs">{post.views || 0}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProfilePostCard;
