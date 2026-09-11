import { useEffect, useRef, useState } from "react";
import { Eye, Heart, MessageCircle, HeartHandshake } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ACTIVITY_META,
  addCircleContentComment,
  donateToCircleContent,
  listCircleContentComments,
  recordCircleContentView,
  toggleCircleContentLike,
  type CircleContent,
  type CircleContentComment,
} from "@/lib/circle-content";

const TIP_AMOUNTS = [100, 300, 500, 1000]; // cents

type Props = {
  item: CircleContent;
  userId?: string;
  canInteract: boolean;
  onChanged: () => void;
};

export default function CircleContentCard({ item, userId, canInteract, onChanged }: Props) {
  const viewed = useRef(false);
  const [liked, setLiked] = useState(Boolean(item.liked_by_me));
  const [likes, setLikes] = useState(item.like_count);
  const [views, setViews] = useState(item.view_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CircleContentComment[]>([]);
  const [draft, setDraft] = useState("");
  const [showDonate, setShowDonate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLiked(Boolean(item.liked_by_me));
    setLikes(item.like_count);
    setViews(item.view_count);
  }, [item.id, item.liked_by_me, item.like_count, item.view_count]);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void recordCircleContentView(item.id, item.circle_id).then(() => setViews((v) => v + 1));
  }, [item.id, item.circle_id]);

  const activityLabel =
    item.kind === "video"
      ? "Video"
      : ACTIVITY_META[item.activity_type as keyof typeof ACTIVITY_META]?.label ?? "Post";

  const onLike = async () => {
    if (!userId || !canInteract) return;
    try {
      const next = await toggleCircleContentLike(item.id, userId, item.circle_id);
      setLiked(next);
      setLikes((n) => Math.max(0, n + (next ? 1 : -1)));
      onChanged();
    } catch {
      toast({ title: "Couldn't like", variant: "destructive" });
    }
  };

  const openComments = async () => {
    setShowComments(true);
    try {
      setComments(await listCircleContentComments(item.id));
    } catch {
      setComments([]);
    }
  };

  const sendComment = async () => {
    if (!userId || !draft.trim()) return;
    setBusy(true);
    try {
      const c = await addCircleContentComment(item.id, userId, draft, item.circle_id);
      setComments((prev) => [...prev, c]);
      setDraft("");
      onChanged();
    } catch {
      toast({ title: "Couldn't comment", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const tip = async (cents: number) => {
    if (!userId) return;
    setBusy(true);
    try {
      await donateToCircleContent(item.id, userId, cents);
      toast({ title: "Thanks!", description: `$${(cents / 100).toFixed(2)} tip sent to the creator.` });
      setShowDonate(false);
    } catch {
      toast({ title: "Donation unavailable", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          {activityLabel}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <Eye className="h-3 w-3" /> {views}
        </span>
      </div>

      {item.title && <h3 className="px-3.5 pt-2 text-[15px] font-bold tracking-tight">{item.title}</h3>}
      {item.body && <p className="px-3.5 pt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>}

      {item.activity_type === "event" && (item.event_at || item.event_location) && (
        <p className="px-3.5 pt-2 text-[11px] font-semibold text-primary">
          {item.event_at ? new Date(item.event_at).toLocaleString() : ""}
          {item.event_location ? ` · ${item.event_location}` : ""}
        </p>
      )}

      {item.media_type === "image" && item.media_urls[0] && (
        <img src={item.media_urls[0]} alt="" className="mt-3 max-h-80 w-full object-cover" />
      )}
      {item.media_type === "video" && item.media_urls[0] && (
        <video
          src={item.media_urls[0]}
          className="mt-3 max-h-80 w-full bg-black object-contain"
          controls
          playsInline
          preload="metadata"
        />
      )}

      <div className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={() => void onLike()}
          disabled={!canInteract}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-40 ${
            liked ? "text-red-500" : "text-muted-foreground"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {likes}
        </button>
        <button
          type="button"
          onClick={() => void openComments()}
          disabled={!canInteract}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-muted-foreground disabled:opacity-40"
        >
          <MessageCircle className="h-4 w-4" />
          {item.comment_count}
        </button>
        {item.donations_enabled && canInteract && (
          <button
            type="button"
            onClick={() => setShowDonate((v) => !v)}
            className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Donate
          </button>
        )}
      </div>

      {showDonate && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2.5">
          {TIP_AMOUNTS.map((cents) => (
            <button
              key={cents}
              type="button"
              disabled={busy}
              onClick={() => void tip(cents)}
              className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold"
            >
              ${(cents / 100).toFixed(0)}
            </button>
          ))}
        </div>
      )}

      {showComments && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3">
          {comments.length === 0 && <p className="text-[11px] text-muted-foreground">No comments yet — say hello.</p>}
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl bg-muted/50 px-2.5 py-2">
              <p className="text-[10px] font-bold text-primary">{c.display_name || "Member"}</p>
              <p className="text-[12px]">{c.body}</p>
            </div>
          ))}
          {canInteract && (
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a comment…"
                className="h-9 flex-1 rounded-full border border-border bg-background px-3 text-[12px] outline-none"
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void sendComment()}
                className="rounded-full bg-primary px-3 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
