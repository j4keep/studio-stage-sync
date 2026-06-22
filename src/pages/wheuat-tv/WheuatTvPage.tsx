import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Upload, Trash2, Film, Mic2, Music, Eye, Play, Loader2, Pencil, ImagePlus, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { VideoPoster } from "@/components/VideoPoster";
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
  const userId = user?.id ?? null;

  const [items, setItems] = useState<WheuatTvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [uploadKind, setUploadKind] = useState<WheuatTvKind>("short-film");
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editCover, setEditCover] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const beginEdit = (item: WheuatTvItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditSubtitle(item.description || "");
    setEditCover(null);
    setEditCoverPreview(item.thumbUrl || null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditCover(null);
    setEditCoverPreview(null);
  };
  const saveEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      await WheuatTv.updateMeta(id, {
        title: editTitle.trim() || "Untitled",
        description: editSubtitle.trim() || null,
        coverFile: editCover,
      });
      toast({ title: "Project updated" });
      cancelEdit();
      await refresh();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const refresh = async () => setItems(await WheuatTv.list());
  useEffect(() => {
    let active = true;
    (async () => { await refresh(); if (active) setLoading(false); })();
    const h = () => { refresh(); };
    window.addEventListener("wheuat-tv-updated", h);
    return () => { active = false; window.removeEventListener("wheuat-tv-updated", h); };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  const handleUpload = async (file: File) => {
    if (!userId) { toast({ title: "Sign in to publish" }); return; }
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled";
    setUploading(true);
    try {
      await WheuatTv.publish({
        kind: uploadKind,
        title,
        blob: file,
        mime: file.type || "video/mp4",
        ext,
      });
      toast({ title: "Published to WHEUAT.TV", description: title });
      await refresh();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-28 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/tv")} className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-foreground leading-none">WHEUAT.TV</h1>
          <p className="text-[11px] text-muted-foreground">Publish to the public TV feed</p>
        </div>
        <button
          onClick={() => navigate("/tv/watch")}
          title="Browse public feed"
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-primary/50"
        >
          <Eye className="w-4 h-4 text-foreground" />
        </button>
      </div>

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
          disabled={uploading}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload Project"}
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

      {loading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nothing here yet. Upload a video or publish an edited podcast.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const M = KIND_META[item.kind];
            const isOwner = userId && item.creator.id === userId;
            const isEditing = editingId === item.id;
            return (
              <article key={item.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setPlayUrl(item.videoUrl)}
                  className="relative w-full aspect-video bg-muted flex items-center justify-center group overflow-hidden"
                >
                  <VideoPoster
                    src={item.videoUrl}
                    poster={item.thumbUrl}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
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
                    <div className="w-9 h-9 rounded-full bg-primary/15 overflow-hidden flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {item.creator.avatarUrl ? (
                        <img src={item.creator.avatarUrl} alt={item.creator.displayName} className="w-full h-full object-cover" />
                      ) : (
                        item.creator.displayName[0]?.toUpperCase() || "A"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">{item.creator.displayName} · {fmtAgo(item.createdAt)}</p>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Project title"
                        className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm"
                      />
                      <input
                        value={editSubtitle}
                        onChange={(e) => setEditSubtitle(e.target.value)}
                        placeholder="Subtitle (optional)"
                        className="w-full h-9 px-3 rounded-lg bg-card border border-border text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => coverRef.current?.click()}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card border border-border text-xs font-medium"
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          {editCover ? "Change cover" : editCoverPreview ? "Replace cover" : "Add cover"}
                        </button>
                        {editCoverPreview && (
                          <img src={editCoverPreview} alt="" className="h-9 w-14 rounded-md object-cover border border-border" />
                        )}
                        <input
                          ref={coverRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setEditCover(f);
                              setEditCoverPreview(URL.createObjectURL(f));
                            }
                            e.currentTarget.value = "";
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={savingEdit}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                        >
                          {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card border border-border text-xs font-medium"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {isOwner ? (
                      <>
                        {!isEditing && (
                          <button
                            onClick={() => beginEdit(item)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background border border-border text-xs font-medium hover:border-primary/50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${item.title}"?`)) return;
                            await WheuatTv.remove(item.id, item.videoKey);
                            await refresh();
                          }}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </>
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

      {playUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPlayUrl(null)}>
          <video
            src={playUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPlayUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default WheuatTvPage;
