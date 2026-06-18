import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Film, LayoutTemplate, Loader2, MessageSquareText, Monitor, Pause, Play, Plus, RotateCcw, Save, Scissors, Settings, Trash2, Type, Wand2, Waves } from "lucide-react";

type Word = { word: string; start: number; end: number };
type Range = { start: number; end: number; label?: string };

const SUPABASE_URL = "https://cdcdlqbjyptamtleitdp.supabase.co";
const PAD = 0.04;

const PodcastTextEditorPage = () => {
  const { episodeId, recordingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [words, setWords] = useState<Word[]>([]);
  const [deletedWords, setDeletedWords] = useState<Set<number>>(new Set());
  const [manualCuts, setManualCuts] = useState<Range[]>([]);
  const [cutDraft, setCutDraft] = useState({ start: "0", end: "10", label: "Cut" });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [processedKey, setProcessedKey] = useState<string | null>(null);
  const [recPrefix, setRecPrefix] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [mime, setMime] = useState("video/webm");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [magicAudio, setMagicAudio] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("16:9");
  const [layout, setLayout] = useState("Grid");
  const [currentTime, setCurrentTime] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const previewBufferRef = useRef<AudioBuffer | null>(null);
  const mediaBufferRef = useRef<ArrayBuffer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    (async () => {
      if (!episodeId || !recordingId) return;
      const [{ data: rec }, { data: tr }, { data: ep }] = await Promise.all([
        supabase.from("podcast_recordings")
          .select("r2_prefix, chunk_count, mime_type, duration_seconds, edl, processed_audio_key")
          .eq("id", recordingId).maybeSingle(),
        supabase.from("podcast_transcripts")
          .select("words")
          .eq("recording_id", recordingId)
          .eq("status", "ready")
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from("podcast_episodes").select("title").eq("id", episodeId).maybeSingle(),
      ]);
      if (rec) {
        setRecPrefix(rec.r2_prefix);
        setChunkCount(rec.chunk_count);
        setMime(rec.mime_type || "video/webm");
        setDuration(rec.duration_seconds || rec.chunk_count * 5 || 60);
        setProcessedKey(rec.processed_audio_key);
        if (Array.isArray(rec.edl)) setManualCuts([]);
      }
      if (Array.isArray(tr?.words)) setWords(tr.words as Word[]);
      if (ep) setEpisodeTitle(ep.title);
      setLoading(false);
    })();
  }, [episodeId, recordingId]);

  const wordCutRanges = useMemo(() => buildWordCutRanges(words, deletedWords), [words, deletedWords]);
  const cutRanges = useMemo(() => mergeRanges([...manualCuts, ...wordCutRanges], duration || 60), [manualCuts, wordCutRanges, duration]);
  const keepRanges = useMemo(() => invertRanges(cutRanges, duration || Math.max(60, words.at(-1)?.end || 0)), [cutRanges, duration, words]);
  const keptSeconds = keepRanges.reduce((n, r) => n + Math.max(0, r.end - r.start), 0);

  const invalidatePreview = () => {
    previewBufferRef.current = null;
    sourceRef.current?.stop();
    setPlaying(false);
  };

  const addCut = () => {
    const start = Number(cutDraft.start);
    const end = Number(cutDraft.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      toast({ title: "Use a valid start and end time", variant: "destructive" });
      return;
    }
    setManualCuts((cuts) => [...cuts, { start, end, label: cutDraft.label || "Cut" }]);
    setCutDraft({ start: String(end), end: String(end + 10), label: "Cut" });
    invalidatePreview();
  };

  const setCutPoint = (field: "start" | "end", value: number) => {
    const next = Math.max(0, Math.min(duration || 60, value));
    setCutDraft((draft) => {
      if (field === "start") {
        const end = Math.max(next + 1, Number(draft.end) || next + 1);
        return { ...draft, start: String(Math.floor(next)), end: String(Math.min(duration || 60, Math.floor(end))) };
      }
      const start = Math.min(Number(draft.start) || 0, next - 1);
      return { ...draft, start: String(Math.max(0, Math.floor(start))), end: String(Math.floor(next)) };
    });
    if (videoRef.current) videoRef.current.currentTime = next;
    setCurrentTime(next);
  };

  const saveTimeline = async () => {
    if (!recordingId) return;
    setExporting(true);
    try {
      await supabase.from("podcast_recordings").update({ edl: keepRanges }).eq("id", recordingId);
      toast({ title: "Timeline saved", description: "Your video/audio cut list is saved on this episode." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const saveEditorSettings = async () => {
    if (!recordingId) return;
    setExporting(true);
    try {
      await supabase.from("podcast_recordings").update({
        edl: keepRanges,
        export_settings: { format: exportFormat, layout, magicAudio },
      }).eq("id", recordingId);
      toast({ title: "Export settings saved" });
    } catch (e) {
      toast({ title: "Settings could not save", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const toggleWord = (i: number) => {
    setDeletedWords((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
    invalidatePreview();
  };

  const fetchMergedMedia = async (): Promise<ArrayBuffer> => {
    if (mediaBufferRef.current) return mediaBufferRef.current.slice(0);
    const buffers: ArrayBuffer[] = [];
    for (let i = 0; i < chunkCount; i++) {
      setProgress(`Loading saved video ${i + 1} / ${chunkCount}…`);
      const key = `${recPrefix}${i.toString().padStart(6, "0")}.webm`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`Failed to load saved video part ${i + 1}`);
      buffers.push(await r.arrayBuffer());
    }
    if (buffers.length === 0) throw new Error("No saved video was found. Record again and wait for the saved episode to appear before editing.");
    const total = buffers.reduce((n, b) => n + b.byteLength, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const b of buffers) { merged.set(new Uint8Array(b), off); off += b.byteLength; }
    mediaBufferRef.current = merged.buffer;
    return merged.buffer.slice(0);
  };

  const loadVideoPreview = async () => {
    if (videoPreviewUrl) return;
    try {
      setProgress("Loading video preview…");
      const merged = await fetchMergedMedia();
      const blob = new Blob([merged], { type: mime || "video/webm" });
      setVideoPreviewUrl(URL.createObjectURL(blob));
      setProgress("");
    } catch (e) {
      setProgress("");
      toast({ title: "Video preview failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const getDecodedAudio = async () => {
    if (originalBufferRef.current) return originalBufferRef.current;
    setProgress("Decoding recording…");
    const ctx = audioCtxRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const merged = await fetchMergedMedia();
    const decoded = await ctx.decodeAudioData(merged.slice(0));
    originalBufferRef.current = decoded;
    if (!duration) setDuration(decoded.duration);
    return decoded;
  };

  const buildEditedBuffer = async () => {
    const decoded = await getDecodedAudio();
    setProgress("Applying timeline edits…");
    const ctx = audioCtxRef.current!;
    const ranges = keepRanges.length ? keepRanges : [{ start: 0, end: decoded.duration }];
    const sr = decoded.sampleRate;
    const totalSamples = ranges.reduce((n, r) => n + Math.max(0, Math.floor((Math.min(decoded.duration, r.end) - r.start) * sr)), 0);
    if (totalSamples <= 0) throw new Error("Nothing to export — all audio is cut.");
    const out = ctx.createBuffer(decoded.numberOfChannels, totalSamples, sr);

    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const src = decoded.getChannelData(ch);
      const dst = out.getChannelData(ch);
      let cursor = 0;
      for (const r of ranges) {
        const startIdx = Math.max(0, Math.floor(r.start * sr));
        const endIdx = Math.min(src.length, Math.floor(Math.min(decoded.duration, r.end) * sr));
        const len = endIdx - startIdx;
        if (len <= 0) continue;
        const fade = Math.min(Math.floor(0.006 * sr), Math.floor(len / 2));
        for (let i = 0; i < len; i++) {
          let gain = 1;
          if (fade > 0 && i < fade) gain = i / fade;
          else if (fade > 0 && i >= len - fade) gain = (len - i) / fade;
          dst[cursor + i] = src[startIdx + i] * gain;
        }
        cursor += len;
      }
      if (magicAudio) processMagicAudio(dst);
    }
    return out;
  };

  const preview = async () => {
    try {
      if (playing) {
        sourceRef.current?.stop();
        setPlaying(false);
        return;
      }
      const buf = previewBufferRef.current ?? await buildEditedBuffer();
      previewBufferRef.current = buf;
      const ctx = audioCtxRef.current!;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => setPlaying(false);
      src.start();
      sourceRef.current = src;
      setPlaying(true);
      setProgress("");
    } catch (e) {
      toast({ title: "Preview failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
      setProgress("");
    }
  };

  const exportMagicAudio = async () => {
    if (!recordingId) return;
    setExporting(true);
    try {
      await supabase.from("podcast_recordings").update({ magic_audio_status: "processing" }).eq("id", recordingId);
      const buf = previewBufferRef.current ?? await buildEditedBuffer();
      previewBufferRef.current = buf;
      setProgress("Encoding WAV…");
      const wav = encodeWAV(buf);
      const key = `podcast-exports/${recordingId}-${Date.now()}.wav`;
      setProgress("Uploading export…");
      const r = await fetch(`${SUPABASE_URL}/functions/v1/r2-upload`, {
        method: "POST",
        headers: { "x-upload-key": key, "x-upload-content-type": "audio/wav", "Content-Type": "audio/wav" },
        body: wav,
      });
      if (!r.ok) throw new Error("Upload failed");
      await supabase.from("podcast_recordings").update({
        edl: keepRanges,
        processed_audio_key: key,
        magic_audio_status: "ready",
      }).eq("id", recordingId);
      setProcessedKey(key);
      setProgress("");
      toast({ title: "Export ready", description: "Timeline edits and Magic Audio were applied." });
    } catch (e) {
      await supabase.from("podcast_recordings").update({ magic_audio_status: "failed" }).eq("id", recordingId);
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const downloadProcessed = async () => {
    if (!processedKey) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(processedKey)}`);
      if (!res.ok) throw new Error(await res.text().catch(() => `Download failed: ${res.status}`));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = processedKey.split("/").pop() || "podcast-export.wav";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Download not available", description: e instanceof Error ? e.message : "The export was not found.", variant: "destructive" });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading editor…</div>;
  if (!user) return <div className="p-8 text-center text-muted-foreground">Sign in required.</div>;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(`/tv/podcast/${episodeId}/edit`)} className="p-2 -ml-2 rounded-md hover:bg-muted" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Timeline editor</div>
            <h1 className="text-xl font-display font-bold truncate">{episodeTitle}</h1>
          </div>
          <Button variant="outline" onClick={preview} disabled={exporting}>
            {playing ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}{playing ? "Stop" : "Preview"}
          </Button>
          <Button variant="secondary" onClick={saveTimeline} disabled={exporting}>
            <Save className="w-4 h-4 mr-2" /> Save cuts
          </Button>
          <Button onClick={exportMagicAudio} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />} Export
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[1.35fr_0.8fr]">
        <section className="space-y-4 min-w-0">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold"><Film className="w-4 h-4 text-primary" /> Video preview</div>
              <div className="flex gap-2">
                <Segment value={exportFormat} options={["16:9", "9:16", "1:1"]} onChange={setExportFormat} />
                <Segment value={layout} options={["Grid", "Speaker", "Split"]} onChange={setLayout} />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              {videoPreviewUrl ? <video ref={videoRef} src={videoPreviewUrl} controls onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} className="mx-auto aspect-video max-h-[360px] w-full object-contain" /> : <button onClick={loadVideoPreview} className="flex aspect-video w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Monitor className="h-12 w-12 text-primary" /> Load saved video/audio</button>}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold"><Waves className="w-4 h-4 text-primary" /> Video + audio timeline</div>
                <div className="text-xs text-muted-foreground">{formatTime(keptSeconds)} kept from {formatTime(duration)} · cuts apply to the episode export</div>
              </div>
              <button className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={() => { setManualCuts([]); setDeletedWords(new Set()); invalidatePreview(); }}>
                <RotateCcw className="w-3 h-3" /> Reset edits
              </button>
            </div>
            <Timeline duration={duration || 60} cuts={cutRanges} currentTime={currentTime} draftStart={Number(cutDraft.start) || 0} draftEnd={Number(cutDraft.end) || 0} onSeek={(seconds) => setCutPoint("start", seconds)} />
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-muted-foreground">Cut starts at {formatTime(Number(cutDraft.start) || 0)}<input type="range" min="0" max={Math.max(1, duration || 60)} value={Number(cutDraft.start) || 0} onChange={(event) => setCutPoint("start", Number(event.target.value))} className="mt-2 w-full accent-primary" /></label>
                <label className="text-xs font-semibold text-muted-foreground">Cut ends at {formatTime(Number(cutDraft.end) || 0)}<input type="range" min="0" max={Math.max(1, duration || 60)} value={Number(cutDraft.end) || 0} onChange={(event) => setCutPoint("end", Number(event.target.value))} className="mt-2 w-full accent-primary" /></label>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
              <Input placeholder="Cut label" value={cutDraft.label} onChange={(e) => setCutDraft((s) => ({ ...s, label: e.target.value }))} />
              <Input value={cutDraft.start} onChange={(e) => setCutDraft((s) => ({ ...s, start: e.target.value }))} placeholder="Start sec" />
              <Input value={cutDraft.end} onChange={(e) => setCutDraft((s) => ({ ...s, end: e.target.value }))} placeholder="End sec" />
              <Button onClick={addCut}><Plus className="w-4 h-4 mr-1" /> Cut</Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Type className="w-4 h-4 text-primary" /> Text cuts</div>
            {words.length ? (
              <div className="leading-loose text-[15px] select-text">
                {words.map((w, i) => (
                  <span key={i}>
                    <button onClick={() => toggleWord(i)} className={`rounded px-0.5 transition ${deletedWords.has(i) ? "bg-destructive/10 text-muted-foreground line-through" : "hover:bg-primary/10"}`}>{w.word}</button>{" "}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Text editing appears here after transcription. Timeline cuts, preview, and Magic Audio work now without a transcript.</div>
            )}
          </div>
        </section>

        <aside className="space-y-4 min-w-0">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><LayoutTemplate className="w-4 h-4 text-primary" /> Layout tools</div>
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border p-3"><div className="font-medium">Canvas</div><div className="text-muted-foreground">{exportFormat} · {layout}</div></div>
              <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => document.getElementById("podcast-text-cuts")?.scrollIntoView({ behavior: "smooth", block: "start" })}><Type className="mr-2 h-4 w-4" /> Text</Button><Button variant="secondary" onClick={() => document.getElementById("podcast-text-cuts")?.scrollIntoView({ behavior: "smooth", block: "start" })}><MessageSquareText className="mr-2 h-4 w-4" /> Captions</Button></div>
              <Button className="w-full" variant="outline" onClick={saveEditorSettings} disabled={exporting}><Settings className="mr-2 h-4 w-4" /> Export settings</Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Scissors className="w-4 h-4 text-primary" /> Cut list</div>
            {cutRanges.length === 0 ? <div className="text-sm text-muted-foreground">No cuts added.</div> : (
              <div className="space-y-2">
                {cutRanges.map((cut, i) => (
                  <div key={`${cut.start}-${cut.end}-${i}`} className="flex items-center gap-2 rounded-md border border-border p-2">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{cut.label || `Cut ${i + 1}`}</div><div className="text-xs text-muted-foreground">{formatTime(cut.start)} → {formatTime(cut.end)}</div></div>
                    {manualCuts.includes(cut) && <button className="rounded p-2 text-muted-foreground hover:bg-muted" onClick={() => { setManualCuts((cuts) => cuts.filter((_, idx) => idx !== i)); invalidatePreview(); }}><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Wand2 className="w-4 h-4 text-primary" /> Magic Audio</div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div><div className="text-sm font-medium">Noise cleanup + normalize</div><div className="text-xs text-muted-foreground">Soft gate, de-click fades, peak leveling</div></div>
              <Switch checked={magicAudio} onCheckedChange={(v) => { setMagicAudio(v); invalidatePreview(); }} />
            </div>
            {processedKey && <Button className="mt-3 w-full" variant="secondary" onClick={downloadProcessed}><Download className="w-4 h-4 mr-2" /> Download last export</Button>}
            {progress && <div className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">{progress}</div>}
          </div>
        </aside>
      </main>
    </div>
  );
};

const Timeline = ({ duration, cuts, currentTime, draftStart, draftEnd, onSeek }: { duration: number; cuts: Range[]; currentTime: number; draftStart: number; draftEnd: number; onSeek: (seconds: number) => void }) => (
  <button type="button" onClick={(event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(((event.clientX - rect.left) / rect.width) * duration);
  }} className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-background text-left">
    <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
    <div className="absolute inset-x-3 top-5 flex items-end gap-1">
      {Array.from({ length: 64 }).map((_, i) => <div key={i} className="w-full rounded-sm bg-primary/35" style={{ height: `${18 + ((i * 17) % 42)}px` }} />)}
    </div>
    {cuts.map((cut, i) => (
      <div key={`${cut.start}-${cut.end}-${i}`} className="absolute top-0 h-full bg-destructive/35 border-x border-destructive" style={{ left: `${(cut.start / duration) * 100}%`, width: `${Math.max(1, ((cut.end - cut.start) / duration) * 100)}%` }} />
    ))}
    <div className="absolute top-0 h-full border-l-2 border-primary" style={{ left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }} />
    <div className="absolute top-2 h-[calc(100%-2.5rem)] rounded-sm border border-primary bg-primary/20" style={{ left: `${Math.min(100, Math.max(0, (draftStart / duration) * 100))}%`, width: `${Math.max(1, ((Math.max(draftStart, draftEnd) - Math.min(draftStart, draftEnd)) / duration) * 100)}%` }} />
    <div className="absolute bottom-2 left-3 text-xs text-muted-foreground">0:00</div>
    <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">{formatTime(duration)}</div>
  </button>
);

const Segment = ({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) => (
  <div className="grid h-9 grid-cols-3 rounded-md border border-border bg-background p-1">
    {options.map((option) => <button key={option} onClick={() => onChange(option)} className={`rounded px-2 text-xs font-semibold ${value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{option}</button>)}
  </div>
);

function buildWordCutRanges(words: Word[], deleted: Set<number>): Range[] {
  const ranges: Range[] = [];
  let current: Range | null = null;
  words.forEach((w, i) => {
    if (!deleted.has(i)) {
      if (current) { ranges.push(current); current = null; }
      return;
    }
    const start = Math.max(0, w.start - PAD);
    const end = w.end + PAD;
    if (!current) current = { start, end, label: "Text cut" };
    else if (start <= current.end + 0.1) current.end = Math.max(current.end, end);
    else { ranges.push(current); current = { start, end, label: "Text cut" }; }
  });
  if (current) ranges.push(current);
  return ranges;
}

function mergeRanges(ranges: Range[], duration: number): Range[] {
  const sorted = ranges.map((r) => ({ ...r, start: Math.max(0, r.start), end: Math.min(duration, r.end) })).filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  sorted.forEach((r) => {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push(r);
  });
  return merged;
}

function invertRanges(cuts: Range[], duration: number): Range[] {
  const keep: Range[] = [];
  let cursor = 0;
  cuts.forEach((cut) => {
    if (cut.start > cursor) keep.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  });
  if (cursor < duration) keep.push({ start: cursor, end: duration });
  return keep;
}

function processMagicAudio(samples: Float32Array) {
  const abs = Array.from(samples, Math.abs).sort((a, b) => a - b);
  const floor = abs[Math.floor(abs.length * 0.12)] || 0;
  const gate = Math.max(0.002, floor * 1.8);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) < gate) samples[i] *= 0.18;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak > 0) {
    const gain = 0.95 / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  }
}

function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const dataSize = len * channels * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, dataSize, true);
  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < len; i++) for (let ch = 0; ch < channels; ch++) { const s = Math.max(-1, Math.min(1, data[ch][i])); view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); offset += 2; }
  return ab;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

export default PodcastTextEditorPage;