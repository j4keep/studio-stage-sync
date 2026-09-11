import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Eye, Heart, HeartHandshake, MessageCircle, Pin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ACTIVITY_META,
  COMMUNITY_SUBTYPE_META,
  addCircleContentComment,
  buildEventCalendarUrl,
  donateToCircleContent,
  listCircleContentComments,
  recordCircleContentView,
  setCircleContentRsvp,
  setCirclePollVote,
  toggleCircleContentLike,
  type CircleContent,
  type CircleContentComment,
  type EventRsvpStatus,
} from "@/lib/circle-content";

const TIP_AMOUNTS = [100, 300, 500, 1000];

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
  const [rsvp, setRsvp] = useState<EventRsvpStatus | null>(item.my_rsvp ?? null);
  const [pollVote, setPollVote] = useState<number | null>(item.my_poll_vote ?? null);

  useEffect(() => {
    setLiked(Boolean(item.liked_by_me));
    setLikes(item.like_count);
    setViews(item.view_count);
    setRsvp(item.my_rsvp ?? null);
    setPollVote(item.my_poll_vote ?? null);
  }, [item]);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void recordCircleContentView(item.id, item.circle_id).then(() => setViews((v) => v + 1));
  }, [item.id, item.circle_id]);

  const activityLabel =
    item.activity_type === "video"
      ? "Photo / Video"
      : item.activity_type === "community" && item.community_subtype
        ? COMMUNITY_SUBTYPE_META[item.community_subtype].label
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

  const chooseRsvp = async (status: EventRsvpStatus) => {
    if (!userId || !canInteract) return;
    try {
      await setCircleContentRsvp(item.id, userId, status);
      setRsvp(status);
      onChanged();
    } catch {
      toast({ title: "Couldn't save RSVP", variant: "destructive" });
    }
  };

  const vote = async (index: number) => {
    if (!userId || !canInteract) return;
    try {
      await setCirclePollVote(item.id, userId, index);
      setPollVote(index);
      onChanged();
    } catch {
      toast({ title: "Couldn't record vote", variant: "destructive" });
    }
  };

  const calUrl = item.activity_type === "event" ? buildEventCalendarUrl(item) : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            {activityLabel}
          </span>
          {item.is_pinned && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          {item.activity_type === "exclusive" && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
              {item.visibility === "paid_members" ? "Supporters" : "Members"}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <Eye className="h-3 w-3" /> {views}
        </span>
      </div>

      {item.title && <h3 className="px-3.5 pt-2 text-[15px] font-bold tracking-tight">{item.title}</h3>}
      {item.body && <p className="px-3.5 pt-1.5 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{item.body}</p>}

      {item.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3.5 pt-2">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}

      {item.activity_type === "event" && (
        <div className="mx-3.5 mt-2 space-y-2 rounded-xl bg-muted/50 px-3 py-2.5 text-[12px]">
          {item.event_at && (
            <p className="font-semibold text-foreground">
              {new Date(item.event_at).toLocaleString()}
              {item.event_end_at ? ` – ${new Date(item.event_end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          )}
          {item.event_location && <p className="text-muted-foreground">{item.event_location}</p>}
          {item.event_online_url && (
            <a href={item.event_online_url} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
              Online link
            </a>
          )}
          {(item.event_capacity || item.event_ticket_cents) && (
            <p className="text-muted-foreground">
              {item.event_capacity ? `Capacity ${item.event_capacity}` : ""}
              {item.event_capacity && item.event_ticket_cents ? " · " : ""}
              {item.event_ticket_cents ? `$${(item.event_ticket_cents / 100).toFixed(2)} ticket` : ""}
            </p>
          )}
          {canInteract && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(
                [
                  ["going", "Going"],
                  ["interested", "Interested"],
                  ["cant_go", "Can't go"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void chooseRsvp(id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    rsvp === id ? "bg-primary text-primary-foreground" : "bg-background border border-border"
                  }`}
                >
                  {label}
                  {item.rsvp_counts?.[id] ? ` · ${item.rsvp_counts[id]}` : ""}
                </button>
              ))}
              {calUrl && (
                <a
                  href={calUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold"
                >
                  <CalendarPlus className="h-3 w-3" /> Calendar
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {item.activity_type === "community" && item.community_subtype === "poll" && item.poll_options.length > 0 && (
        <div className="mx-3.5 mt-2 space-y-1.5">
          {item.poll_options.map((opt, i) => {
            const count = item.poll_counts?.[i] ?? 0;
            const total = (item.poll_counts ?? []).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <button
                key={i}
                type="button"
                disabled={!canInteract}
                onClick={() => void vote(i)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-[12px] font-semibold disabled:opacity-60 ${
                  pollVote === i ? "border-primary" : "border-border"
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary/15"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex justify-between gap-2">
                  <span>{opt}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </span>
              </button>
            );
          })}
        </div>
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
