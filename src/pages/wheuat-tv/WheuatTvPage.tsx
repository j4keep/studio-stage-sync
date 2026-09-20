import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, Film, Mic2, Music, Play, Loader2, Pencil, ImagePlus, Save, X, Radio, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { VideoPoster } from "@/components/VideoPoster";
import AICoverImageGenerator from "@/components/ai-studio/AICoverImageGenerator";
import { YajTvShell } from "./YajTvShell";
import { WheuatTv, type WheuatTvItem, type WheuatTvKind } from "./wheuatTvStore";
import { getActiveYajTvLiveForHost, startYajTvLive } from "./yajTvLiveStore";

async function urlToFile(url: string, fileName: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

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
  const [goingLive, setGoingLive] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [uploadKind, setUploadKind] = useState<WheuatTvKind>("short-film");
  const [newTitle, setNewTitle] = useState("");
  const [newCover, setNewCover] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [aiCoverOpen, setAiCoverOpen] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editCover, setEditCover] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const newCoverRef = useRef<HTMLInputElement>(null);

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

  const refresh = async () => { const mine = (await WheuatTv.list()).filter((i) => i.creator.id === userId); setItems(mine); };
  useEffect(() => {
    let active = true;
    (async () => { await refresh(); if (active) setLoading(false); })();
    const h = () => { refresh(); };
    window.addEventListener("wheuat-tv-updated", h);
    return () => { active = false; window.removeEventListener("wheuat-tv-updated", h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  const handleUpload = async (file: File) => {
    if (!userId) { toast({ title: "Sign in to publish" }); return; }
    // A cover picture without a real title just looks unfinished — require one.
    // Without a cover, the auto-captured video frame is a fine stand-in and the
    // filename-derived title keeps quick uploads friction-free.
    if (newCover && !newTitle.trim()) {
      toast({ title: "Add a title", description: "Give this project a title before using a cover picture.", variant: "destructive" });
      return;
    }
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const derivedTitle = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Untitled";
    const title = newTitle.trim().slice(0, 80) || derivedTitle;
    setUploading(true);
    try {
      await WheuatTv.publish({
        kind: uploadKind,
        title,
        blob: file,
        mime: file.type || "video/mp4",
        ext,
        coverFile: newCover,
      });
      toast({ title: "Published to YAJ.TV", description: title });
      setNewTitle("");
      setNewCover(null);
      setNewCoverPreview(null);
      await refresh();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleAiCoverGenerated = async (url: string) => {
    setGeneratingCover(true);
    try {
      const file = await urlToFile(url, `${Date.now()}-ai-cover.png`);
      setNewCover(file);
      setNewCoverPreview(url);
      setAiCoverOpen(false);
    } catch (e: any) {
      toast({ title: "Couldn't use that image", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setGeneratingCover(false);
    }
  };

  const handleGoLive = async () => {
    if (!userId) { toast({ title: "Sign in to go live" }); return; }
    setGoingLive(true);
    try {
      const existing = await getActiveYajTvLiveForHost(userId);
      const session = existing || (await startYajTvLive(userId));
      navigate(`/tv/live/${session.id}`);
    } catch (e: any) {
      toast({ title: "Couldn't go live", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setGoingLive(false);
    }
  };

  return (
    <YajTvShell headerTitle="Creator Studio" showBack>
      <div className="px-4 pt-2 pb-8">
        <p className="mb-4 text-[12px] text-white/50">Publish podcasts, short films and music videos to YAJ.TV.</p>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-5">
          <label className="block text-[11px] font-semibold text-white/50 mb-1.5">Category</label>
          <select
            value={uploadKind}
            onChange={(e) => setUploadKind(e.target.value as WheuatTvKind)}
            className="w-full h-10 px-3 mb-2 rounded-xl bg-black/40 border border-white/15 text-sm text-white"
          >
            {(Object.keys(KIND_META) as WheuatTvKind[]).map((k) => (
              <option key={k} value={k} className="bg-black">{KIND_META[k].label}</option>
            ))}
          </select>

          <label className="block text-[11px] font-semibold text-white/50 mb-1.5">
            Title {newCover && <span className="font-normal text-primary">(required with a cover)</span>}
          </label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Project title"
            className="w-full h-10 px-3 mb-2 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-white/40"
          />

          <label className="block text-[11px] font-semibold text-white/50 mb-1.5">
            Cover picture <span className="font-normal text-white/30">(optional)</span>
          </label>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button
              type="button"
              onClick={() => newCoverRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs font-medium text-white disabled:opacity-60"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {newCoverPreview ? "Change cover" : "Upload from device"}
            </button>
            <button
              type="button"
              onClick={() => setAiCoverOpen((v) => !v)}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs font-medium text-white disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              YAJ Buddy AI
            </button>
            {newCoverPreview && (
              <>
                <img src={newCoverPreview} alt="" className="h-10 w-16 rounded-lg object-cover border border-white/15" />
                <button
                  type="button"
                  onClick={() => { setNewCover(null); setNewCoverPreview(null); }}
                  aria-label="Remove cover"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 border border-white/15 text-white/60"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <p className="mb-2 text-[10px] text-white/30">
            Photos come from your device's file or photo library — no in-app camera capture.
          </p>
          {aiCoverOpen && (
            <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3">
              <AICoverImageGenerator
                onImageGenerated={handleAiCoverGenerated}
                label="Describe your cover art"
                placeholder="A neon-lit late-night diner, cinematic…"
              />
              {generatingCover && <p className="mt-2 text-[10px] text-white/40">Saving cover…</p>}
            </div>
          )}
          <input
            ref={newCoverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setNewCover(f);
                setNewCoverPreview(URL.createObjectURL(f));
              }
              e.currentTarget.value = "";
            }}
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading…" : "Upload Project"}
          </button>
          {!newCoverPreview && (
            <p className="mt-1.5 text-[10px] text-white/30">
              No cover? We'll automatically grab a frame from your video instead.
            </p>
          )}
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

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mb-5">
          <div className="flex items-start gap-2 mb-2">
            <Radio className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-white">Live TV</p>
              <p className="text-[11px] text-white/50">Go live on YAJ.TV — viewers can chat and send hearts in real time.</p>
            </div>
          </div>
          <button
            onClick={handleGoLive}
            disabled={goingLive}
            className="w-full h-11 rounded-xl bg-red-600 text-white flex items-center justify-center gap-2 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {goingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            {goingLive ? "Starting…" : "Go Live"}
          </button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 px-3 h-7 rounded-full text-[11px] font-semibold border ${
                  active ? "bg-white text-black border-white" : "bg-white/5 text-white border-white/15"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-center py-10 text-sm text-white/40">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-white/40">
            Nothing here yet. Upload a video or publish an edited podcast.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => {
              const M = KIND_META[item.kind];
              const isEditing = editingId === item.id;
              return (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <button
                    onClick={() => setPlayUrl(item.videoUrl)}
                    className="relative w-full aspect-video bg-black flex items-center justify-center group overflow-hidden"
                  >
                    <VideoPoster
                      src={item.videoUrl}
                      poster={item.thumbUrl}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center">
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
                        <h3 className="text-sm font-semibold text-white truncate">{item.title}</h3>
                        {item.description && (
                          <p className="text-[11px] text-white/50 line-clamp-2">{item.description}</p>
                        )}
                        <p className="text-[11px] text-white/40">{item.creator.displayName} · {fmtAgo(item.createdAt)}</p>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Project title"
                          className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/40"
                        />
                        <input
                          value={editSubtitle}
                          onChange={(e) => setEditSubtitle(e.target.value)}
                          placeholder="Subtitle (optional)"
                          className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/40"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => coverRef.current?.click()}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-xs font-medium text-white"
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            {editCover ? "Change cover" : editCoverPreview ? "Replace cover" : "Add cover"}
                          </button>
                          {editCoverPreview && (
                            <img src={editCoverPreview} alt="" className="h-9 w-14 rounded-md object-cover border border-white/15" />
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
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-xs font-medium text-white"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      {!isEditing && (
                        <button
                          onClick={() => beginEdit(item)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/5 border border-white/15 text-xs font-medium text-white hover:border-primary/50"
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
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {playUrl && (
        <div className="fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-4" onClick={() => setPlayUrl(null)}>
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
    </YajTvShell>
  );
};

export default WheuatTvPage;
