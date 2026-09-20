import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Play,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  Star,
  Loader2,
  Copy,
  Send,
  MessageSquareText,
  Clock,
  HeartHandshake,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { WheuatTv, effectiveCategory, type WheuatTvItem, type WheuatTvComment } from "./wheuatTvStore";
import { YajTvShell } from "./YajTvShell";
import { YajTvRow } from "./YajTvRow";
import { YajTvPosterPlaceholder } from "./YajTvPosterPlaceholder";
import { YajTvDonatePanel } from "./YajTvDonatePanel";
import { CATEGORY_LABELS, KIND_META, formatRuntime, formatViews, type CategorySelection } from "./yajTvMeta";

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const YajTvDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [all, setAll] = useState<WheuatTvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [comments, setComments] = useState<WheuatTvComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");

  const refresh = async () => setAll(await WheuatTv.list());

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    const h = () => refresh();
    window.addEventListener("wheuat-tv-updated", h);
    return () => {
      active = false;
      window.removeEventListener("wheuat-tv-updated", h);
    };
  }, []);

  const item = useMemo(() => all.find((i) => i.id === id) || null, [all, id]);

  useEffect(() => {
    if (item) void WheuatTv.recordView(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const related = useMemo(() => {
    if (!item) return [];
    const cat = effectiveCategory(item);
    return all
      .filter((i) => i.id !== item.id && (effectiveCategory(i) === cat || i.kind === item.kind))
      .slice(0, 15);
  }, [all, item]);

  const toggleLike = async (target: WheuatTvItem) => {
    if (!user) {
      toast({ title: "Sign in to like" });
      return;
    }
    setAll((rs) =>
      rs.map((r) => (r.id === target.id ? { ...r, likedByMe: !r.likedByMe, likes: r.likes + (r.likedByMe ? -1 : 1) } : r)),
    );
    await WheuatTv.toggleLike(target.id);
  };

  const toggleMyList = async (target: WheuatTvItem) => {
    if (!user) {
      toast({ title: "Sign in to use My List" });
      return;
    }
    setAll((rs) => rs.map((r) => (r.id === target.id ? { ...r, inMyList: !r.inMyList } : r)));
    await WheuatTv.toggleWatchlist(target.id, target.inMyList);
    toast({ title: target.inMyList ? "Removed from My List" : "Added to My List" });
  };

  const openComments = async () => {
    setShowComments((v) => !v);
    if (!showComments && item && comments.length === 0) {
      setComments(await WheuatTv.listComments(item.id));
    }
  };

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || !item) return;
    if (!user) {
      toast({ title: "Sign in to comment" });
      return;
    }
    try {
      await WheuatTv.addComment(item.id, text);
      setCommentDraft("");
      const list = await WheuatTv.listComments(item.id);
      setComments(list);
      setAll((rs) => rs.map((r) => (r.id === item.id ? { ...r, commentCount: list.length } : r)));
    } catch (e: any) {
      toast({ title: "Could not post", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const doShare = async (target: WheuatTvItem, channel: "copy" | "whatsapp" | "sms" | "native") => {
    const url = `${window.location.origin}/tv/title/${target.id}`;
    const text = `Watch "${target.title}" on YAJ.TV`;
    if (channel === "copy") {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } else if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
    } else if (channel === "sms") {
      window.location.href = `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`;
    } else if (channel === "native" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: target.title, text, url });
      } catch {}
    }
    setShowShare(false);
  };

  const handlePlay = () => {
    if (!item) return;
    if (!item.hasMedia) {
      toast({ title: "Coming soon", description: "This YAJ Original hasn't been uploaded yet." });
      return;
    }
    setPlaying(true);
  };

  if (loading) {
    return (
      <YajTvShell headerTitle="YAJ.TV" showBack>
        <div className="flex justify-center py-16 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </YajTvShell>
    );
  }

  if (!item) {
    return (
      <YajTvShell headerTitle="YAJ.TV" showBack>
        <div className="px-4 py-16 text-center text-sm text-white/50">This title isn't available.</div>
      </YajTvShell>
    );
  }

  const backdrop = item.backdropUrl || item.posterUrl || item.thumbUrl;
  const category = effectiveCategory(item) as CategorySelection;
  const runtime = formatRuntime(item.durationMs);
  const Icon = KIND_META[item.kind].Icon;

  return (
    <YajTvShell headerTitle={item.title} showBack>
      <div className="relative aspect-[4/5] w-full sm:aspect-video">
        {backdrop ? (
          <img src={backdrop} alt={item.title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <YajTvPosterPlaceholder title={item.title} kind={item.kind} className="absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <button
          onClick={handlePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-black shadow-xl active:scale-95">
            <Play className="ml-1 h-7 w-7" />
          </span>
        </button>
      </div>

      <div className="px-4 pt-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/60">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
            <Icon className="h-3 w-3" />
            {CATEGORY_LABELS[category] || KIND_META[item.kind].label}
          </span>
          {item.isOriginal && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary">YAJ Original</span>}
          {item.maturityRating && <span className="rounded-full bg-white/10 px-2 py-0.5">{item.maturityRating}</span>}
          {runtime && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {runtime}
            </span>
          )}
          {item.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-amber-400" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>

        <h1 className="mt-2 text-xl font-bold leading-tight">{item.title}</h1>
        <button
          onClick={() => navigate(`/artist/${item.creator.id}`)}
          className="mt-1 text-[13px] font-medium text-white/60 hover:text-white"
        >
          {item.creator.displayName} · {fmtAgo(item.createdAt)}
        </button>

        {item.description && <p className="mt-3 text-[13px] leading-relaxed text-white/80">{item.description}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handlePlay}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black active:scale-95"
          >
            <Play className="h-4 w-4" />
            Play
          </button>
          <button
            onClick={() => toggleLike(item)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
              item.likedByMe ? "border-primary bg-primary text-primary-foreground" : "border-white/15 bg-white/5 text-white"
            }`}
          >
            <Heart className={`h-4 w-4 ${item.likedByMe ? "fill-current" : ""}`} />
            {item.likes}
          </button>
          <button
            onClick={() => toggleMyList(item)}
            aria-label="My List"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
          >
            {item.inMyList ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={openComments}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {item.commentCount} Comments
          </button>
          <button
            onClick={() => setShowShare((v) => !v)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-white"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={() => setShowDonate((v) => !v)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Support
          </button>
        </div>

        {showDonate && <YajTvDonatePanel item={item} userId={user?.id} />}

        {showShare && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => doShare(item, "whatsapp")} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-400">
              <Send className="h-3.5 w-3.5" /> WhatsApp
            </button>
            <button onClick={() => doShare(item, "sms")} className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-400">
              <MessageSquareText className="h-3.5 w-3.5" /> Text
            </button>
            <button onClick={() => doShare(item, "copy")} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white">
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
          </div>
        )}

        {showComments && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            {comments.length === 0 && <p className="text-[11px] text-white/50">Be the first to comment.</p>}
            {comments.map((c) => (
              <div key={c.id} className="text-[12px]">
                <span className="font-semibold text-white">{c.author.displayName}</span>{" "}
                <span className="text-white/70">{c.text}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder="Add a comment…"
                className="h-8 flex-1 rounded-full border border-white/15 bg-black/40 px-3 text-xs text-white placeholder:text-white/40"
              />
              <button onClick={submitComment} className="h-8 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground">
                Post
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <YajTvRow title="More like this" items={related} />
      </div>

      {playing && item.hasMedia && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black p-4"
          onClick={() => setPlaying(false)}
        >
          <video
            src={item.videoUrl}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPlaying(false)}
            className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </YajTvShell>
  );
};

export default YajTvDetailPage;
