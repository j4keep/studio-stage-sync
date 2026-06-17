import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, X, Check, Music2, Loader2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2, generateR2Key, deleteFromR2 } from "@/lib/r2-storage";
import { toast } from "sonner";
import {
  categorizeFilename, detectBpm, detectKey, sanitizeCategory, colorForCategory,
  listUserSounds, type UserSoundRow, type LoopCategory,
} from "@/lib/userSoundLibrary";

const CATEGORIES: LoopCategory[] = [
  "drums","808","hi-hats","snare","kick","clap","synth","bass","piano","guitar","sfx","vocal",
];

interface PendingFile {
  file: File;
  name: string;
  category: LoopCategory;
  bpm: number;
  musical_key: string;
  pack: string;
  genre: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

export default function AdminSoundLibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [sounds, setSounds] = useState<UserSoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<LoopCategory | "">("");
  const [bulkPack, setBulkPack] = useState("");
  const [defaultPack, setDefaultPack] = useState("My Library");

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(Boolean(data));
    });
  }, [user]);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  const refresh = async () => {
    setLoading(true);
    const rows = await listUserSounds();
    setSounds(rows);
    setLoading(false);
  };

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const newOnes: PendingFile[] = Array.from(files).map((f) => {
      const baseName = f.name.replace(/\.(wav|mp3|ogg|flac|m4a|aiff?)$/i, "");
      return {
        file: f,
        name: baseName,
        category: categorizeFilename(f.name),
        bpm: detectBpm(f.name) ?? 120,
        musical_key: detectKey(f.name),
        pack: defaultPack,
        genre: "",
        status: "pending",
        progress: 0,
      };
    });
    setPending((p) => [...p, ...newOnes]);
  };

  const updatePending = (i: number, patch: Partial<PendingFile>) => {
    setPending((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  };

  const removePending = (i: number) => {
    setPending((p) => p.filter((_, idx) => idx !== i));
  };

  const uploadAll = async () => {
    if (!user) return;
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (p.status === "done") continue;
      updatePending(i, { status: "uploading", progress: 0 });
      const key = generateR2Key(user.id, "sound-library", p.file.name);
      const res = await uploadToR2(p.file, {
        folder: undefined,
        fileName: key,
        mimeType: p.file.type || "audio/mpeg",
        onProgress: (pr) => updatePending(i, { progress: pr }),
      });
      if (!res.success || !res.data) {
        updatePending(i, { status: "error", error: res.error });
        continue;
      }

      // Decode for duration
      let duration = 0;
      try {
        const arr = await p.file.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buf = await ctx.decodeAudioData(arr.slice(0));
        duration = buf.duration;
        ctx.close();
      } catch {/* ignore */}

      const { error: insertErr } = await supabase.from("sound_library").insert({
        name: p.name,
        category: p.category,
        genre: p.genre,
        pack: p.pack || "My Library",
        bpm: p.bpm,
        musical_key: p.musical_key,
        r2_key: res.data.key,
        duration_sec: duration,
        color: colorForCategory(p.category),
        uploaded_by: user.id,
      });
      if (insertErr) {
        updatePending(i, { status: "error", error: insertErr.message });
        continue;
      }
      updatePending(i, { status: "done", progress: 100 });
    }
    toast.success("Upload batch complete");
    refresh();
  };

  const clearDone = () => setPending((p) => p.filter((x) => x.status !== "done"));

  const filteredSounds = useMemo(() => {
    if (!search.trim()) return sounds;
    const q = search.toLowerCase();
    return sounds.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.pack ?? "").toLowerCase().includes(q),
    );
  }, [sounds, search]);

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAll = () => {
    if (selected.size === filteredSounds.length) setSelected(new Set());
    else setSelected(new Set(filteredSounds.map((s) => s.id)));
  };

  const bulkApply = async () => {
    if (selected.size === 0) return;
    const patch: any = {};
    if (bulkCat) { patch.category = bulkCat; patch.color = colorForCategory(bulkCat); }
    if (bulkPack.trim()) patch.pack = bulkPack.trim();
    if (!Object.keys(patch).length) return;
    const { error } = await supabase.from("sound_library").update(patch).in("id", Array.from(selected));
    if (error) toast.error(error.message);
    else { toast.success(`Updated ${selected.size} sounds`); setSelected(new Set()); setBulkCat(""); setBulkPack(""); refresh(); }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} sounds? Files will be removed from storage.`)) return;
    const rows = sounds.filter((s) => selected.has(s.id));
    for (const r of rows) {
      await deleteFromR2(r.r2_key).catch(() => {});
    }
    const { error } = await supabase.from("sound_library").delete().in("id", Array.from(selected));
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); setSelected(new Set()); refresh(); }
  };

  if (isAdmin === null) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 inline animate-spin" /> Checking access…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-lg font-bold mb-2">Admin only</h1>
        <p className="text-sm text-muted-foreground mb-4">The sound library uploader is restricted to admins.</p>
        <button onClick={() => navigate("/")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Go home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
        <h1 className="text-lg font-display font-bold flex items-center gap-2">
          <Music2 className="w-5 h-5 text-primary" /> Sound Library Admin
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Upload your beats, loops & samples for PRO users in W.Studio.</p>
      </div>

      {/* Upload zone */}
      <div className="p-4">
        <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition">
          <input type="file" multiple accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aiff,.aif"
            className="hidden"
            onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm font-medium">Drop audio files or tap to browse</div>
          <div className="text-[11px] text-muted-foreground mt-1">WAV, MP3, OGG, FLAC, M4A, AIFF</div>
        </label>

        <div className="mt-3 flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground">Default pack:</label>
          <input value={defaultPack} onChange={(e) => setDefaultPack(e.target.value)}
            className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background" />
        </div>
      </div>

      {/* Pending upload list */}
      {pending.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Queue ({pending.length})</h2>
            <div className="flex gap-2">
              <button onClick={clearDone} className="text-[11px] text-muted-foreground hover:text-foreground">Clear done</button>
              <button onClick={uploadAll}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                Upload all
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {pending.map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-2 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <input value={p.name} onChange={(e) => updatePending(i, { name: e.target.value })}
                    className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background" />
                  {p.status === "done" && <Check className="w-4 h-4 text-green-500" />}
                  {p.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {p.status === "error" && <span className="text-[10px] text-destructive">{p.error}</span>}
                  <button onClick={() => removePending(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <select value={p.category} onChange={(e) => updatePending(i, { category: e.target.value as LoopCategory })}
                    className="h-7 px-1 text-[11px] rounded border border-border bg-background">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" value={p.bpm} onChange={(e) => updatePending(i, { bpm: parseInt(e.target.value) || 120 })}
                    placeholder="BPM" className="h-7 px-2 text-[11px] rounded border border-border bg-background" />
                  <input value={p.musical_key} onChange={(e) => updatePending(i, { musical_key: e.target.value })}
                    placeholder="Key" className="h-7 px-2 text-[11px] rounded border border-border bg-background" />
                  <input value={p.pack} onChange={(e) => updatePending(i, { pack: e.target.value })}
                    placeholder="Pack" className="h-7 px-2 text-[11px] rounded border border-border bg-background" />
                </div>
                {p.status === "uploading" && (
                  <div className="mt-2 h-1 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Library list */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Library ({sounds.length})</h2>
          <button onClick={selectAll} className="text-[11px] text-muted-foreground hover:text-foreground">
            {selected.size === filteredSounds.length && filteredSounds.length > 0 ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
            className="w-full h-8 pl-8 pr-2 text-xs rounded border border-border bg-background" />
        </div>

        {selected.size > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 mb-2 space-y-2">
            <div className="text-[11px] font-medium">{selected.size} selected — bulk edit:</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value as LoopCategory)}
                className="h-7 px-1 text-[11px] rounded border border-border bg-background">
                <option value="">Category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input value={bulkPack} onChange={(e) => setBulkPack(e.target.value)} placeholder="New pack name"
                className="h-7 px-2 text-[11px] rounded border border-border bg-background" />
            </div>
            <div className="flex gap-2">
              <button onClick={bulkApply} className="flex-1 h-7 rounded bg-primary text-primary-foreground text-[11px] font-semibold">Apply</button>
              <button onClick={bulkDelete} className="h-7 px-2 rounded bg-destructive text-destructive-foreground text-[11px] font-semibold flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground text-xs py-8"><Loader2 className="w-4 h-4 inline animate-spin" /> Loading…</div>
        ) : filteredSounds.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8">No sounds yet — upload some above.</div>
        ) : (
          <div className="space-y-1">
            {filteredSounds.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded border border-border bg-card">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)}
                  className="w-4 h-4 shrink-0" />
                <div className="w-1 h-7 rounded shrink-0" style={{ background: s.color || "#06b6d4" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.category} · {s.bpm} BPM{s.musical_key ? ` · ${s.musical_key}` : ""} · {s.pack}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
