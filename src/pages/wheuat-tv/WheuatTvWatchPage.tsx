import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Heart, MessageCircle, Share2, Play, Film, Mic2, Music, Copy, Send, MessageSquareText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { WheuatTv, type WheuatTvItem, type WheuatTvKind } from "./wheuatTvStore";

const KIND_META: Record<WheuatTvKind, { label: string; Icon: typeof Film }> = {
  podcast: { label: "Podcast", Icon: Mic2 },
  "short-film": { label: "Short Film", Icon: Film },
  "music-video": { label: "Music Video", Icon: Music },
};

const FILTERS: { id: "all" | WheuatTvKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "podcast", label: "Podcasts" },
  { id: "short-film", label: "Short Films" },
  { id: "music-video", label: "Music Videos" },
];

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const WheuatTvWatchPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? "anon";
  const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Viewer";

  const [items, setItems] = useState<WheuatTvItem[]>(() => WheuatTv.list());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [openShare, setOpenShare] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const h = () => setItems(WheuatTv.list());
    window.addEventListener("wheuat-tv-updated", h);
    return () => window.removeEventListener("wheuat-tv-updated", h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== "all" && i.kind !== filter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.uploaderName.toLowerCase().includes(q) ||
        KIND_META[i.kind].label.toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const openPlayer = async (id: string) => {
    if (playUrl) URL.revokeObjectURL(playUrl);
    const url = await WheuatTv.getUrl(id);
    if (!url) {
      toast({ title: "Video unavailable", description: "This file isn't cached on this device." });
      return;
    }
    setPlayingId(id);
    setPlayUrl(url);
  };
  const closePlayer = () => {
    if (playUrl) URL.revokeObjectURL(playUrl);
    setPlayUrl(null);
    setPlayingId(null);
  };

  const toggleLike = (id: string) => {
    WheuatTv.toggleLike(id, userId);
    setItems(WheuatTv.list());
  };

  const submitComment = (id: string) => {
    const text = (commentDraft[id] || "").trim();
    if (!text) return;
    WheuatTv.addComment(id, { userId, userName, text });
    setCommentDraft((d) => ({ ...d, [id]: "" }));
    setItems(WheuatTv.list());
  };

  const shareUrl = (item: WheuatTvItem) =>
    `${window.location.origin}${window.location.pathname}#/tv/watch?v=${item.id}`;

  const doShare = async (item: WheuatTvItem, channel: "copy" | "whatsapp" | "sms" | "native") => {
    const url = shareUrl(item);
    const text = `Watch "${item.title}" on WHEUAT.TV`;
    if (channel === "copy") {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } else if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank");
    } else if (channel === "sms") {
      window.location.href = `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`;
    } else if (channel === "native" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: item.title, text, url });
      } catch {}
    }
    setOpenShare(null);
  };

  return (
    <div className="px-4 pt-4 pb-28 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-foreground leading-none">WHEUAT.TV</h1>
          <p className="text-[11px] text-muted-foreground">Podcasts · Short films · Music videos</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by artist, video, podcast name…"
          className="w-full h-10 pl-9 pr-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold border ${
                active ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {query ? "No matches." : "Nothing posted yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const M = KIND_META[item.kind];
            const liked = item.likes.includes(userId);
            return (
              <article key={item.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => openPlayer(item.id)}
                  className="relative w-full aspect-video bg-muted flex items-center justify-center group"
                >
                  {item.thumbDataUrl ? (
                    <img src={item.thumbDataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <M.Icon className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Play className="w-5 h-5 ml-0.5" />
                    </div>
                  </div>
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] px-2 h-5 rounded-full bg-black/60 text-white">
                    <M.Icon className="w-3 h-3" />
                    {M.label}
                  </span>
                </button>
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => navigate(`/artist/${item.uploaderId}`)}
                      className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0"
                      aria-label={`Open ${item.uploaderName} profile`}
                    >
                      {item.uploaderName[0]?.toUpperCase() || "A"}
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
                      <button
                        onClick={() => navigate(`/artist/${item.uploaderId}`)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {item.uploaderName} · {fmtAgo(item.createdAt)}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-3">
                    <button
                      onClick={() => toggleLike(item.id)}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border ${
                        liked ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground"
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} />
                      {item.likes.length}
                    </button>
                    <button
                      onClick={() => setOpenComments(openComments === item.id ? null : item.id)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-background border border-border text-foreground"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {item.comments.length}
                    </button>
                    <button
                      onClick={() => setOpenShare(openShare === item.id ? null : item.id)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-background border border-border text-foreground"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                  </div>

                  {openShare === item.id && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <button onClick={() => doShare(item, "whatsapp")} className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      <button onClick={() => doShare(item, "sms")} className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs bg-sky-500/15 text-sky-600 border border-sky-500/30">
                        <MessageSquareText className="w-3.5 h-3.5" /> Text
                      </button>
                      <button onClick={() => doShare(item, "copy")} className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs bg-background border border-border text-foreground">
                        <Copy className="w-3.5 h-3.5" /> Copy link
                      </button>
                    </div>
                  )}

                  {openComments === item.id && (
                    <div className="mt-3 space-y-2">
                      {item.comments.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">Be the first to comment.</p>
                      )}
                      {item.comments.map((c) => (
                        <div key={c.id} className="text-[12px] text-foreground">
                          <span className="font-semibold">{c.userName}</span>{" "}
                          <span className="text-muted-foreground">{c.text}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          value={commentDraft[item.id] || ""}
                          onChange={(e) => setCommentDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") submitComment(item.id); }}
                          placeholder="Add a comment…"
                          className="flex-1 h-8 px-3 rounded-full bg-background border border-border text-xs"
                        />
                        <button
                          onClick={() => submitComment(item.id)}
                          className="h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {playUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={closePlayer}>
          <video
            ref={videoRef}
            src={playUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default WheuatTvWatchPage;
