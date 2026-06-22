import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Upload, Trash2, Film, Mic2, Music, Eye, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

const WheuatTvPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? "anon";
  const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "You";

  const [items, setItems] = useState<WheuatTvItem[]>(() => WheuatTv.list());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [uploadKind, setUploadKind] = useState<WheuatTvKind>("short-film");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setItems(WheuatTv.list());
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("wheuat-tv-updated", h);
    return () => window.removeEventListener("wheuat-tv-updated", h);
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  const openPlayer = async (id: string) => {
    if (playUrl) URL.revokeObjectURL(playUrl);
    const url = await WheuatTv.getUrl(id);
    if (!url) { toast({ title: "File missing on this device" }); return; }
    setPlayingId(id);
    setPlayUrl(url);
  };
  const closePlayer = () => {
    if (playUrl) URL.revokeObjectURL(playUrl);
    setPlayUrl(null);
    setPlayingId(null);
  };

  const handleUpload = async (file: File) => {
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled";
    try {
      await WheuatTv.add({
        kind: uploadKind,
        title,
        uploaderId: userId,
        uploaderName: userName,
        blob: file,
        mime: file.type || "video/mp4",
        ext,
      });
      toast({ title: "Published to WHEUAT.TV", description: title });
      refresh();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const openIncognito = () => {
    try {
      sessionStorage.setItem("incognito-feed-window-open", "true");
      sessionStorage.setItem("incognito-feed-window-minimized", "false");
      window.dispatchEvent(new Event("storage"));
      // Reload so the window reads the new sessionStorage on mount
      window.location.reload();
    } catch {}
  };

  return (
    <div className="px-4 pt-4 pb-28 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/tv")} className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-foreground leading-none">WHEUAT.TV</h1>
          <p className="text-[11px] text-muted-foreground">Creator manager — post or delete your videos</p>
        </div>
        <button
          onClick={openIncognito}
          title="Pop out incognito feed"
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-primary/50"
        >
          <Eye className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Upload */}
      <div className="rounded-2xl border border-border bg-card p-3 mb-4">
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Category</label>
        <select
          value={uploadKind}
          onChange={(e) => setUploadKind(e.target.value as WheuatTvKind)}
          className="w-full h-10 px-3 mb-2 rounded-xl bg-background border border-border text-sm text-foreground"
        >
          {(Object.keys(KIND_META) as WheuatTvKind[]).map((k) => (
            <option key={k} value={k}>{KIND_META[k].label}</option>
          ))}
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90"
        >
          <Upload className="w-4 h-4" />
          Upload Project
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-3 h-7 rounded-full text-[11px] border ${
                active ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nothing here yet. Upload a video or publish an edited podcast.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const M = KIND_META[item.kind];
            const isOwner = item.uploaderId === userId;
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{item.uploaderName} · {fmtAgo(item.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {isOwner ? (
                      <button
                        onClick={async () => { await WheuatTv.remove(item.id); refresh(); }}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Posted by another creator</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Player */}
      {playUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={closePlayer}>
          <video
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

export default WheuatTvPage;
