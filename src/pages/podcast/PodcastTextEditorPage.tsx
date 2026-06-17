// Word-level text-based editor + client-side "Magic Audio" export pipeline.
// Click any word to mark it deleted (struck-through). The exporter rebuilds audio
// from the non-deleted words, runs a gentle noise gate + normalization, and uploads
// the result to R2 as the recording's processed audio.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Wand2, Play, Pause, Download, RotateCcw } from "lucide-react";

type Word = { word: string; start: number; end: number };

const SUPABASE_URL = "https://cdcdlqbjyptamtleitdp.supabase.co";
const PAD = 0.04; // 40ms of crossfade padding around each kept range

const PodcastTextEditorPage = () => {
  const { episodeId, recordingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [words, setWords] = useState<Word[]>([]);
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [processedKey, setProcessedKey] = useState<string | null>(null);
  const [recPrefix, setRecPrefix] = useState<string>("");
  const [chunkCount, setChunkCount] = useState(0);
  const [mime, setMime] = useState("audio/webm");
  const [episodeTitle, setEpisodeTitle] = useState("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewBufferRef = useRef<AudioBuffer | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    (async () => {
      if (!episodeId || !recordingId) return;
      const [{ data: rec }, { data: tr }, { data: ep }] = await Promise.all([
        supabase.from("podcast_recordings")
          .select("r2_prefix, chunk_count, mime_type, edl, processed_audio_key")
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
        setMime(rec.mime_type || "audio/webm");
        setProcessedKey(rec.processed_audio_key);
        if (Array.isArray(rec.edl)) {
          // Restore deletion state by matching ranges to words
          const ws = (tr?.words as Word[] | undefined) ?? [];
          const next = new Set<number>();
          ws.forEach((w, i) => {
            const kept = (rec.edl as Array<{ start: number; end: number }>).some(
              (r) => w.start >= r.start - 0.01 && w.end <= r.end + 0.01
            );
            if (!kept) next.add(i);
          });
          setDeleted(next);
        }
      }
      if (tr?.words) setWords(tr.words as Word[]);
      if (ep) setEpisodeTitle(ep.title);
      setLoading(false);
    })();
  }, [episodeId, recordingId]);

  const keptRanges = useMemo(() => buildRanges(words, deleted), [words, deleted]);

  const toggle = (i: number) => {
    setDeleted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const fetchMergedAudio = async (): Promise<ArrayBuffer> => {
    const buffers: ArrayBuffer[] = [];
    for (let i = 0; i < chunkCount; i++) {
      setProgress(`Downloading chunk ${i + 1} / ${chunkCount}…`);
      const key = `${recPrefix}${i.toString().padStart(6, "0")}.webm`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error(`Failed chunk ${i}`);
      buffers.push(await r.arrayBuffer());
    }
    const total = buffers.reduce((n, b) => n + b.byteLength, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const b of buffers) { merged.set(new Uint8Array(b), off); off += b.byteLength; }
    return merged.buffer;
  };

  const buildEditedBuffer = async (): Promise<AudioBuffer> => {
    setProgress("Decoding audio…");
    const ctx = audioCtxRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const merged = await fetchMergedAudio();
    const decoded = await ctx.decodeAudioData(merged.slice(0));
    setProgress("Applying edits…");

    const ranges = keptRanges.length ? keptRanges : [{ start: 0, end: decoded.duration }];
    const sr = decoded.sampleRate;
    const totalSamples = ranges.reduce((n, r) => n + Math.max(0, Math.floor((r.end - r.start) * sr)), 0);
    if (totalSamples === 0) throw new Error("Nothing to export — every word is deleted.");
    const channels = decoded.numberOfChannels;
    const out = ctx.createBuffer(channels, totalSamples, sr);

    for (let ch = 0; ch < channels; ch++) {
      const src = decoded.getChannelData(ch);
      const dst = out.getChannelData(ch);
      let cursor = 0;
      for (const r of ranges) {
        const startIdx = Math.max(0, Math.floor(r.start * sr));
        const endIdx = Math.min(src.length, Math.floor(r.end * sr));
        const len = endIdx - startIdx;
        if (len <= 0) continue;
        // Copy with short fade in/out to avoid clicks at cut boundaries.
        const fade = Math.min(Math.floor(0.005 * sr), Math.floor(len / 2));
        for (let i = 0; i < len; i++) {
          let g = 1;
          if (i < fade) g = i / fade;
          else if (i >= len - fade) g = (len - i) / fade;
          dst[cursor + i] = src[startIdx + i] * g;
        }
        cursor += len;
      }

      // Magic Audio: gentle noise gate + peak normalization.
      // Gate: zero out samples below a learned noise floor (10th percentile of |x|).
      const sorted = Float32Array.from(dst).map(Math.abs).sort();
      const floor = sorted[Math.floor(sorted.length * 0.1)] || 0;
      const gate = Math.max(0.002, floor * 1.5);
      let peak = 0;
      for (let i = 0; i < dst.length; i++) {
        if (Math.abs(dst[i]) < gate) dst[i] *= 0.15; // soft duck (not hard cut)
        if (Math.abs(dst[i]) > peak) peak = Math.abs(dst[i]);
      }
      if (peak > 0) {
        const target = 0.95 / peak;
        for (let i = 0; i < dst.length; i++) dst[i] *= target;
      }
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
      setProgress("Uploading…");
      const key = `podcast-exports/${recordingId}-${Date.now()}.wav`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/r2-upload`, {
        method: "PUT",
        headers: { "x-upload-key": key, "x-upload-content-type": "audio/wav" },
        body: wav,
      });
      if (!r.ok) throw new Error("Upload failed");

      const edl = keptRanges;
      await supabase.from("podcast_recordings").update({
        edl,
        processed_audio_key: key,
        magic_audio_status: "ready",
      }).eq("id", recordingId);
      setProcessedKey(key);
      setProgress("");
      toast({ title: "Magic Audio ready", description: "Edited, de-noised, and normalized." });
    } catch (e) {
      await supabase.from("podcast_recordings").update({ magic_audio_status: "failed" }).eq("id", recordingId);
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading transcript…</div>;
  if (!user) return <div className="p-8 text-center text-muted-foreground">Sign in required.</div>;
  if (!words.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Header title={episodeTitle} onBack={() => navigate(`/tv/podcast/${episodeId}/edit`)} />
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No transcript words available. Run "Transcribe" from the episode page first.
        </div>
      </div>
    );
  }

  const totalKept = keptRanges.reduce((n, r) => n + (r.end - r.start), 0);
  const totalAll = words.length ? words[words.length - 1].end : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-32">
      <Header title={episodeTitle} onBack={() => navigate(`/tv/podcast/${episodeId}/edit`)} />

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
          <span>Click any word to cut it. {deleted.size} cut · {fmt(totalKept)} / {fmt(totalAll)}</span>
          {deleted.size > 0 && (
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { setDeleted(new Set()); previewBufferRef.current = null; }}>
              <RotateCcw className="w-3 h-3" /> Restore all
            </button>
          )}
        </div>
        <div className="leading-loose text-[15px] text-foreground select-text">
          {words.map((w, i) => (
            <span key={i}>
              <button
                onClick={() => { toggle(i); previewBufferRef.current = null; }}
                className={
                  "px-0.5 rounded transition " +
                  (deleted.has(i)
                    ? "line-through text-muted-foreground/60 bg-destructive/10"
                    : "hover:bg-primary/10")
                }
              >
                {w.word}
              </button>{" "}
            </span>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="outline" onClick={preview} disabled={exporting} className="flex-1">
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Stop" : "Preview"}
          </Button>
          <Button onClick={exportMagicAudio} disabled={exporting} className="flex-1">
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
            Export Magic Audio
          </Button>
          {processedKey && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(`${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(processedKey)}`, "_blank")}
              title="Download last export"
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
        {progress && <div className="px-4 pb-2 text-[11px] text-muted-foreground">{progress}</div>}
      </div>
    </div>
  );
};

const Header = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div className="flex items-center gap-2 mb-4">
    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-muted">
      <ArrowLeft className="w-5 h-5" />
    </button>
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Text Editor</div>
      <h1 className="text-lg font-display font-bold text-foreground truncate">{title}</h1>
    </div>
  </div>
);

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

// Merge consecutive non-deleted words into kept ranges with padding, then clamp/merge overlaps.
function buildRanges(words: Word[], deleted: Set<number>): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let cur: { start: number; end: number } | null = null;
  words.forEach((w, i) => {
    if (deleted.has(i)) {
      if (cur) { ranges.push(cur); cur = null; }
      return;
    }
    const s = Math.max(0, w.start - PAD);
    const e = w.end + PAD;
    if (!cur) cur = { start: s, end: e };
    else if (s <= cur.end) cur.end = Math.max(cur.end, e);
    else { ranges.push(cur); cur = { start: s, end: e }; }
  });
  if (cur) ranges.push(cur);
  return ranges;
}

// Encode a Web Audio AudioBuffer to a 16-bit PCM WAV ArrayBuffer.
function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const dataSize = len * numCh * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * bytesPerSample, true);
  view.setUint16(32, numCh * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return ab;
}

export default PodcastTextEditorPage;
