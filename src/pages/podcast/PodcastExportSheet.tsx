import { useState } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { X, Grid3x3, Rows, Mic, Video, Layers, User, FileAudio } from "lucide-react";
import type { DawEngine } from "@/wstudio/daw/engine/DawEngine";
import type { Track, Clip } from "@/wstudio/daw/engine/types";
import { useDawStore } from "@/wstudio/daw/state/DawStore";
import { usePodcastVideoStore } from "./podcastVideoStore";
import { WheuatTv } from "@/pages/wheuat-tv/wheuatTvStore";
import { publishPodcastAudio } from "./podcastPublishStore";
import { usePublishPodcastChoice } from "./PublishPodcastDialog";

type Mode = "grid" | "rows" | "speaker" | "pip" | "audio" | "pertrack" | "stems";

const OPTIONS: { id: Mode; title: string; desc: string; icon: any }[] = [
  { id: "grid",     title: "Grid (tiles)",        desc: "Zoom-style auto-grid of every camera, full mix audio.", icon: Grid3x3 },
  { id: "rows",     title: "Stacked rows",        desc: "Each participant a horizontal row, full mix audio.",     icon: Rows },
  { id: "speaker",  title: "Active speaker",      desc: "Loudest fills the screen, others as small thumbs.",      icon: Mic },
  { id: "pip",      title: "Picture-in-picture",  desc: "Host fills the screen, guests as corner thumbnails.",   icon: Video },
  { id: "audio",    title: "Audio only (WAV)",    desc: "Full stereo mix as a single WAV file.",                  icon: FileAudio },
  { id: "pertrack", title: "Per-track ZIP",       desc: "Each participant exported as their own video + audio.",  icon: User },
  { id: "stems",    title: "Stems (audio only)",  desc: "Each track exported as an isolated WAV file in a zip.",  icon: Layers },
];

type Props = {
  open: boolean;
  onClose: () => void;
  engine: DawEngine;
  tracks: Track[];
  clips: Clip[];
  projectName: string;
};

function safeName(name: string) {
  return (name || "podcast").replace(/[\\/:*?"<>|]+/g, "_").trim() || "podcast";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderTrackWav(engine: DawEngine, tracks: Track[], clips: Clip[], trackId: string): Promise<Blob> {
  const isolated = tracks.map(t => ({ ...t, mute: t.id !== trackId }));
  const trackClips = clips.filter(c => c.trackId === trackId);
  const len = Math.max(0.5, ...trackClips.map(c => c.startTime + c.duration)) + 0.5;
  return engine.exportToWav(isolated, clips, len);
}

/**
 * Real-time composite of every linked video into one webm. Audio comes
 * straight from the engine's master MediaStream so the mix matches
 * playback exactly.
 */
async function renderComposite(
  mode: Mode,
  engine: DawEngine,
  tracks: Track[],
  clips: Clip[],
  videos: Record<string, { url: string; participantLabel?: string }>,
  durationSec: number,
): Promise<Blob> {
  const W = 1280, H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Prepare video elements for every linked clip
  const entries = Object.entries(videos)
    .map(([clipId, v]) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return null;
      const el = document.createElement("video");
      el.src = v.url; el.muted = true; el.playsInline = true; el.preload = "auto";
      return { clipId, clip, el, label: v.participantLabel || "Track" };
    })
    .filter(Boolean) as { clipId: string; clip: Clip; el: HTMLVideoElement; label: string }[];

  await Promise.all(entries.map(e => new Promise<void>(res => {
    if (e.el.readyState >= 2) return res();
    e.el.onloadeddata = () => res();
    e.el.onerror = () => res();
  })));

  // Speaker analysers per track (for active-speaker layout)
  const analysers = new Map<string, AnalyserNode>();
  for (const t of tracks) {
    const a = engine.getTrackAnalyser?.(t.id);
    if (a) analysers.set(t.id, a);
  }
  const loudestTrack = (): string | null => {
    let best: string | null = null;
    let bestLevel = -Infinity;
    analysers.forEach((a, id) => {
      const data = new Uint8Array(a.fftSize);
      a.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      if (rms > bestLevel) { bestLevel = rms; best = id; }
    });
    return best;
  };

  // Build combined MediaStream (canvas video + engine master audio)
  const canvasStream = canvas.captureStream(30);
  const audioStream = engine.destStream.stream;
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    .find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const rec = new MediaRecorder(combined, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const recDone = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: mime })); });

  const drawTile = (e: typeof entries[0], x: number, y: number, w: number, h: number, label?: string) => {
    ctx.fillStyle = "#111"; ctx.fillRect(x, y, w, h);
    try { ctx.drawImage(e.el, x, y, w, h); } catch {}
    if (label) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x + 6, y + h - 26, ctx.measureText(label).width + 16, 20);
      ctx.fillStyle = "#fff"; ctx.font = "14px system-ui";
      ctx.fillText(label, x + 14, y + h - 12);
    }
  };

  const drawFrame = () => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const visible = entries.filter(e => {
      // entries are visible if playback time is inside the clip window
      const pos = engine.currentPosition?.() ?? 0;
      return pos >= e.clip.startTime - 0.05 && pos <= e.clip.startTime + e.clip.duration + 0.05;
    });
    const list = visible.length > 0 ? visible : entries;

    if (mode === "grid") {
      const n = Math.max(1, list.length);
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cw = W / cols, ch = H / rows;
      list.forEach((e, i) => drawTile(e, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, e.label));
    } else if (mode === "rows") {
      const n = Math.max(1, list.length);
      const rh = H / n;
      list.forEach((e, i) => drawTile(e, 0, i * rh, W, rh, e.label));
    } else if (mode === "speaker") {
      const speaker = loudestTrack();
      const main = list.find(e => e.clip.trackId === speaker) ?? list[0];
      if (main) drawTile(main, 0, 0, W, H, main.label);
      const thumbs = list.filter(e => e !== main).slice(0, 4);
      const tw = 220, th = 124;
      thumbs.forEach((e, i) => drawTile(e, W - (i + 1) * (tw + 12), H - th - 12, tw, th, e.label));
    } else if (mode === "pip") {
      const host = list[0];
      if (host) drawTile(host, 0, 0, W, H, host.label);
      const guests = list.slice(1, 5);
      const tw = 240, th = 135;
      guests.forEach((e, i) => drawTile(e, 24 + i * (tw + 12), 24, tw, th, e.label));
    }
  };

  // Sync each video to playback position
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const pos = engine.currentPosition?.() ?? 0;
    for (const e of entries) {
      const local = pos - e.clip.startTime + (e.clip.offset ?? 0);
      if (local >= 0 && local <= e.clip.duration + (e.clip.offset ?? 0) + 0.2) {
        const target = Math.max(0, local);
        if (e.el.paused || Math.abs(e.el.currentTime - target) > 0.12) {
          try { e.el.currentTime = target; } catch {}
        }
        if (e.el.paused) { e.el.play().catch(() => {}); }
      } else if (!e.el.paused) {
        e.el.pause();
      }
    }
    drawFrame();
    requestAnimationFrame(tick);
  };

  await engine.resume();
  engine.stop();
  // Start playback from 0
  const transport = { isPlaying: true, isRecording: false, position: 0, bpm: 120, timeSigNum: 4, timeSigDen: 4,
    loopEnabled: false, metronome: false, metronomeVolume: 0, metroAccent: false } as any;
  engine.play(transport, tracks, clips);
  rec.start(250);
  tick();

  await new Promise(r => setTimeout(r, durationSec * 1000 + 400));
  stopped = true;
  entries.forEach(e => { try { e.el.pause(); } catch {} });
  engine.stop();
  rec.stop();
  return recDone;
}

export function PodcastExportSheet({ open, onClose, engine, tracks, clips, projectName }: Props) {
  const videos = usePodcastVideoStore(s => s.videos);
  const [mode, setMode] = useState<Mode>("grid");
  const [busy, setBusy] = useState(false);
  const { request: requestPublishChoice, dialog: publishChoiceDialog } = usePublishPodcastChoice();

  if (!open) return null;

  const run = async (action: "download" | "publish" = "download") => {
    if (clips.length === 0) { toast.error("Nothing to export"); return; }
    const wantsPublish = action === "publish";
    setBusy(true);
    const base = safeName(projectName);
    try {
      if (mode === "audio") {
        toast.loading(wantsPublish ? "Publishing audio podcast…" : "Rendering mix…", { id: "exp" });
        const len = Math.max(...clips.map(c => c.startTime + c.duration)) + 0.5;
        const blob = await engine.exportToWav(tracks, clips, len);
        if (wantsPublish) {
          await publishPodcastAudio({ title: projectName || base, blob, mime: "audio/wav", ext: "wav", durationMs: len * 1000 });
          toast.success("Published to Radio Podcasts", { id: "exp" });
        } else {
          downloadBlob(blob, `${base}.wav`);
          toast.success("Exported WAV", { id: "exp" });
        }
      } else if (mode === "stems") {
        if (wantsPublish) { toast.error("Choose Audio only or a video layout to publish", { id: "exp" }); setBusy(false); return; }
        toast.loading("Rendering stems…", { id: "exp" });
        const zip = new JSZip();
        for (const t of tracks) {
          const wav = await renderTrackWav(engine, tracks, clips, t.id);
          zip.file(`${safeName(t.name)}.wav`, await wav.arrayBuffer());
        }
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `${base}-stems.zip`);
        toast.success("Exported stems", { id: "exp" });
      } else if (mode === "pertrack") {
        if (wantsPublish) { toast.error("Choose Audio only or a video layout to publish", { id: "exp" }); setBusy(false); return; }
        toast.loading("Packaging per-track…", { id: "exp" });
        const zip = new JSZip();
        for (const t of tracks) {
          const trackClips = clips.filter(c => c.trackId === t.id);
          if (trackClips.length === 0) continue;
          const wav = await renderTrackWav(engine, tracks, clips, t.id);
          zip.file(`${safeName(t.name)}/audio.wav`, await wav.arrayBuffer());
          for (const c of trackClips) {
            const v = videos[c.id];
            if (v) {
              const ext = (v.mime.includes("mp4") ? "mp4" : "webm");
              zip.file(`${safeName(t.name)}/${safeName(c.name)}.${ext}`, await v.blob.arrayBuffer());
            }
          }
        }
        const out = await zip.generateAsync({ type: "blob" });
        downloadBlob(out, `${base}-pertrack.zip`);
        toast.success("Per-track zip ready", { id: "exp" });
      } else {
        const linked = Object.keys(videos).length;
        if (linked === 0) { toast.error("No linked videos to composite"); setBusy(false); return; }
        toast.loading(wantsPublish ? "Publishing video podcast…" : "Compositing video — playing back in real time…", { id: "exp" });
        const len = Math.max(...clips.map(c => c.startTime + c.duration)) + 0.5;
        const blob = await renderComposite(mode, engine, tracks, clips, videos as any, len);
        if (wantsPublish) {
          await WheuatTv.add({ kind: "podcast", title: projectName || base, blob, mime: blob.type || "video/webm", ext: "webm", durationMs: len * 1000 });
          toast.success("Published to WHEUAT.TV", { id: "exp" });
        } else {
          downloadBlob(blob, `${base}-${mode}.webm`);
          toast.success("Video exported", { id: "exp" });
        }
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Export failed", { id: "exp" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg w-[640px] max-w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="h-11 px-4 flex items-center justify-between border-b border-neutral-800">
          <div className="text-sm font-medium text-neutral-100">Export podcast</div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-auto">
          {OPTIONS.map(o => {
            const Icon = o.icon;
            const active = mode === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setMode(o.id)}
                className={`text-left p-3 rounded border ${active ? "border-cyan-400 bg-cyan-500/10" : "border-neutral-800 hover:border-neutral-700 bg-neutral-900"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${active ? "text-cyan-300" : "text-neutral-400"}`} />
                  <div className="text-[12px] font-medium text-neutral-100">{o.title}</div>
                </div>
                <div className="text-[11px] text-neutral-500 leading-snug">{o.desc}</div>
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-neutral-800 flex items-center justify-between gap-2">
          <div className="text-[10px] text-neutral-500">
            Video composites play back in real-time — give it the length of the project.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="h-8 px-3 rounded text-xs text-neutral-300 hover:text-neutral-100">Cancel</button>
            <button onClick={() => run("publish")} disabled={busy} className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium">
              {busy ? "Publishing…" : mode === "audio" ? "Publish to Radio" : "Publish to TV"}
            </button>
            <button onClick={() => run("download")} disabled={busy} className="h-8 px-4 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium">
              {busy ? "Exporting…" : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
