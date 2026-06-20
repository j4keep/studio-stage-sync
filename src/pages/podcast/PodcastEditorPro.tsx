import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Play, Pause, Scissors, Trash2, Type, Film, Download, SkipBack,
  Volume2, VolumeX, Loader2, Upload, MousePointer2, Pencil, Eraser, MoveHorizontal,
  Undo2, Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { WaveformView } from "@/wstudio/daw/ui/WaveformView";

type EditorTool = "pointer" | "pencil" | "eraser" | "scissors" | "trim";

/**
 * Podcast Editor Pro — fully functional local-first editor.
 *  - Real trim per clip (in/out points within source)
 *  - Split at playhead → two clip segments
 *  - Delete selected segment
 *  - Merge multiple clips into single export
 *  - Title overlay (font size, color, X/Y position) baked into export
 *  - Intro / Outro file upload (prepended / appended to timeline)
 *  - Export via ffmpeg.wasm → MP4 (WebM fallback if encoding fails)
 *  - Real timeline with playhead, seek, clip segments, selected highlight
 *  - Shortcuts: Space play/pause, Enter or Tab → start, Delete → delete sel.
 */

export type EditorSource = { id: string; name: string; url: string; blob: Blob; durationMs: number };

type Clip = {
  id: string;
  // index into `sources`
  srcIdx: number;
  // in-seconds within source
  in: number;
  out: number;
};

type Overlay = {
  text: string;
  size: number;     // px in 1280px canvas
  x: number;        // 0..1 normalized
  y: number;        // 0..1 normalized
  color: string;    // #rrggbb
};

const uid = () => Math.random().toString(36).slice(2, 10);

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
};

export default function PodcastEditorPro({
  initial,
  onClose,
}: {
  initial: EditorSource;
  onClose: () => void;
}) {
  // Sources: index 0 = main recording. Intro/outro injected as additional sources.
  const [sources, setSources] = useState<EditorSource[]>([initial]);
  const [clips, setClipsRaw] = useState<Clip[]>([
    { id: uid(), srcIdx: 0, in: 0, out: initial.durationMs / 1000 },
  ]);
  // ---------- undo / redo history ----------
  const historyRef = useRef<{ past: Clip[][]; future: Clip[][] }>({ past: [], future: [] });
  const [, forceHist] = useState(0);
  const setClips = useCallback((updater: Clip[] | ((prev: Clip[]) => Clip[])) => {
    setClipsRaw((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Clip[]) => Clip[])(prev) : updater;
      if (next === prev) return prev;
      historyRef.current.past.push(prev);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      forceHist((n) => n + 1);
      return next;
    });
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    setClipsRaw((curr) => {
      const prev = h.past.pop()!;
      h.future.push(curr);
      forceHist((n) => n + 1);
      return prev;
    });
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    setClipsRaw((curr) => {
      const next = h.future.pop()!;
      h.past.push(curr);
      forceHist((n) => n + 1);
      return next;
    });
  }, []);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0); // seconds in timeline
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [overlay, setOverlay] = useState<Overlay>({
    text: "",
    size: 56,
    x: 0.5,
    y: 0.85,
    color: "#ffffff",
  });
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [tool, setTool] = useState<EditorTool>("pointer");

  const vidRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  /* ---------- derived ---------- */
  // Layout uses each source's FULL duration so trim handles visibly move the
  // clip edge inward (not rescale the whole waveform). Playback still uses
  // trimmed `dur` for timing.
  const segments = useMemo(() => {
    let t = 0;           // playback time (trimmed)
    let layoutT = 0;     // layout time (full source widths)
    return clips.map((c) => {
      const dur = Math.max(0, c.out - c.in);
      const srcDur = Math.max(0.01, (sources[c.srcIdx]?.durationMs || 0) / 1000);
      const seg = {
        ...c,
        dur,
        startT: t,
        endT: t + dur,
        layoutStart: layoutT,
        layoutSpan: srcDur,
      };
      t += dur;
      layoutT += srcDur;
      return seg;
    });
  }, [clips, sources]);
  const totalDur = segments.length ? segments[segments.length - 1].endT : 0;
  const totalLayout = segments.length
    ? segments[segments.length - 1].layoutStart + segments[segments.length - 1].layoutSpan
    : 0;

  const activeSeg = useMemo(
    () => segments.find((s) => playhead >= s.startT && playhead < s.endT) || segments[segments.length - 1],
    [segments, playhead],
  );

  /* ---------- preview playback ---------- */
  // Seek video to correct source time when active segment / playhead changes externally.
  useEffect(() => {
    const v = vidRef.current;
    if (!v || !activeSeg) return;
    const src = sources[activeSeg.srcIdx]?.url;
    if (!src) return;
    if (v.src !== src) {
      v.src = src;
    }
    const within = playhead - activeSeg.startT + activeSeg.in;
    if (Math.abs(v.currentTime - within) > 0.25) {
      try { v.currentTime = within; } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeg?.id, activeSeg?.srcIdx]);

  // Drive playhead from video timeupdate while playing
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const onTime = () => {
      if (!activeSeg) return;
      const within = v.currentTime;
      // Crossed segment out point?
      if (within >= activeSeg.out - 0.02) {
        const next = segments[segments.findIndex((s) => s.id === activeSeg.id) + 1];
        if (next) {
          setPlayhead(next.startT + 0.001);
        } else {
          v.pause();
          setPlaying(false);
          setPlayhead(0);
        }
        return;
      }
      const t = activeSeg.startT + (within - activeSeg.in);
      setPlayhead(t);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [activeSeg, segments]);

  const togglePlay = useCallback(() => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const seekTo = useCallback((t: number) => {
    setPlayhead(Math.max(0, Math.min(totalDur, t)));
  }, [totalDur]);

  const toStart = useCallback(() => {
    const v = vidRef.current;
    if (v) v.pause();
    setPlaying(false);
    setPlayhead(0);
  }, []);

  /* ---------- editing actions ---------- */
  const splitAtPlayhead = useCallback(() => {
    if (!activeSeg) return;
    const within = playhead - activeSeg.startT + activeSeg.in;
    if (within <= activeSeg.in + 0.05 || within >= activeSeg.out - 0.05) {
      toast({ title: "Move the playhead inside a clip first" });
      return;
    }
    setClips((cs) => {
      const i = cs.findIndex((c) => c.id === activeSeg.id);
      if (i < 0) return cs;
      const orig = cs[i];
      const a: Clip = { ...orig, id: uid(), out: within };
      const b: Clip = { ...orig, id: uid(), in: within };
      const next = [...cs];
      next.splice(i, 1, a, b);
      return next;
    });
    toast({ title: "Clip split" });
  }, [activeSeg, playhead]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) { toast({ title: "Select a clip on the timeline first" }); return; }
    setClips((cs) => cs.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    toast({ title: "Clip deleted" });
  }, [selectedId]);

  const addMediaFile = async (file: File, position: "intro" | "outro") => {
    const url = URL.createObjectURL(file);
    // Probe duration with a temp video element
    const dur = await new Promise<number>((res) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      v.onloadedmetadata = () => res((v.duration || 0) * 1000);
      v.onerror = () => res(0);
    });
    setSources((s) => {
      const idx = s.length;
      const ns = [...s, { id: uid(), name: file.name, url, blob: file, durationMs: dur }];
      setClips((cs) => {
        const newClip: Clip = { id: uid(), srcIdx: idx, in: 0, out: dur / 1000 };
        return position === "intro" ? [newClip, ...cs] : [...cs, newClip];
      });
      return ns;
    });
    toast({ title: `${position === "intro" ? "Intro" : "Outro"} added` });
  };

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if (e.code === "Enter" || e.code === "Tab") { e.preventDefault(); toStart(); }
      else if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedId) { e.preventDefault(); deleteSelected(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toStart, deleteSelected, selectedId, undo, redo]);

  /* ---------- trim edge drag handler ---------- */
  // Live drag = bypass history; commit once at pointerup.
  const beginTrim = useCallback(() => {
    setClipsRaw((prev) => {
      historyRef.current.past.push(prev);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      forceHist((n) => n + 1);
      return prev;
    });
  }, []);
  const trimEdgeLive = useCallback((segId: string, edge: "in" | "out", deltaSec: number) => {
    setClipsRaw((cs) => {
      const i = cs.findIndex((c) => c.id === segId);
      if (i < 0) return cs;
      const c = cs[i];
      const src = sources[c.srcIdx];
      const srcDur = (src?.durationMs || 0) / 1000;
      const next = [...cs];
      if (edge === "in") {
        const v = Math.max(0, Math.min(c.out - 0.05, c.in + deltaSec));
        next[i] = { ...c, in: v };
      } else {
        const v = Math.max(c.in + 0.05, Math.min(srcDur, c.out + deltaSec));
        next[i] = { ...c, out: v };
      }
      return next;
    });
  }, [sources]);



  /* ---------- timeline interactions ---------- */
  const onTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * totalDur);
  };

  /* ---------- waveform (real, sampled to Float32 min/max pairs like DAW) ---------- */
  const [waveforms, setWaveforms] = useState<Record<number, Float32Array>>({});
  useEffect(() => {
    sources.forEach((s, idx) => {
      if (waveforms[idx]) return;
      (async () => {
        try {
          const buf = await s.blob.arrayBuffer();
          const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
          const decoded = await ac.decodeAudioData(buf.slice(0));
          const ch = decoded.getChannelData(0);
          const N = 2000;
          const block = Math.max(1, Math.floor(ch.length / N));
          const peaks = new Float32Array(N * 2);
          for (let i = 0; i < N; i++) {
            let mn = 1, mx = -1;
            const start = i * block;
            const end = Math.min(ch.length, start + block);
            for (let j = start; j < end; j++) {
              const v = ch[j];
              if (v < mn) mn = v;
              if (v > mx) mx = v;
            }
            peaks[i * 2] = mn;
            peaks[i * 2 + 1] = mx;
          }
          setWaveforms((w) => ({ ...w, [idx]: peaks }));
          ac.close();
        } catch {/* not decodable, skip */}
      })();
    });
  }, [sources, waveforms]);

  /* ---------- tool-driven clip click ---------- */
  const splitClipAt = useCallback((segId: string, withinTimelineT: number) => {
    setClips((cs) => {
      const i = cs.findIndex((c) => c.id === segId);
      if (i < 0) return cs;
      // need segment startT/in to map timeline t -> source t
      let acc = 0;
      for (let k = 0; k < i; k++) acc += Math.max(0, cs[k].out - cs[k].in);
      const orig = cs[i];
      const within = orig.in + (withinTimelineT - acc);
      if (within <= orig.in + 0.05 || within >= orig.out - 0.05) return cs;
      const a: Clip = { ...orig, id: uid(), out: within };
      const b: Clip = { ...orig, id: uid(), in: within };
      const next = [...cs];
      next.splice(i, 1, a, b);
      return next;
    });
  }, []);

  const handleClipClick = (segId: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = ratio * totalDur;
    if (tool === "eraser") {
      setClips((cs) => cs.filter((c) => c.id !== segId));
      setSelectedId(null);
      toast({ title: "Clip erased" });
    } else if (tool === "scissors") {
      splitClipAt(segId, t);
      toast({ title: "Clip split" });
    } else {
      setSelectedId(segId);
    }
  };

  /* ---------- export with ffmpeg.wasm ---------- */
  const exportFinal = async () => {
    if (!clips.length) { toast({ title: "Nothing to export" }); return; }
    setExporting(true);
    setExportProgress(0);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => setExportProgress(Math.round((progress || 0) * 100)));
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });

      // Write each source once
      const writtenSources: string[] = [];
      for (let i = 0; i < sources.length; i++) {
        const name = `src${i}.bin`;
        await ffmpeg.writeFile(name, await fetchFile(sources[i].blob));
        writtenSources.push(name);
      }

      // Build inputs and filter graph: trim each clip then concat
      const args: string[] = [];
      clips.forEach((c) => {
        args.push("-i", writtenSources[c.srcIdx]);
      });

      const parts: string[] = [];
      const concatStreams: string[] = [];
      clips.forEach((c, i) => {
        const dur = Math.max(0.05, c.out - c.in);
        parts.push(
          `[${i}:v]trim=start=${c.in.toFixed(3)}:duration=${dur.toFixed(3)},setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
        );
        parts.push(
          `[${i}:a]atrim=start=${c.in.toFixed(3)}:duration=${dur.toFixed(3)},asetpts=PTS-STARTPTS,aresample=44100[a${i}]`,
        );
        concatStreams.push(`[v${i}][a${i}]`);
      });
      parts.push(`${concatStreams.join("")}concat=n=${clips.length}:v=1:a=1[cv][ca]`);

      let vOut = "[cv]";
      if (overlay.text.trim()) {
        const txt = overlay.text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
        const xPx = `(w-text_w)*${overlay.x.toFixed(3)}`;
        const yPx = `(h-text_h)*${overlay.y.toFixed(3)}`;
        const color = overlay.color.replace("#", "0x");
        parts.push(`[cv]drawtext=text='${txt}':fontcolor=${color}:fontsize=${Math.round(overlay.size)}:x=${xPx}:y=${yPx}:box=1:boxcolor=0x00000088:boxborderw=10[vo]`);
        vOut = "[vo]";
      }

      const filter = parts.join(";");
      args.push(
        "-filter_complex", filter,
        "-map", vOut, "-map", "[ca]",
      );

      // Try mp4 first; fall back to webm on failure
      let outName = "out.mp4";
      let mime = "video/mp4";
      try {
        await ffmpeg.exec([
          ...args,
          "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
          "-c:a", "aac", "-b:a", "128k",
          outName,
        ]);
      } catch {
        outName = "out.webm";
        mime = "video/webm";
        await ffmpeg.exec([
          ...args,
          "-c:v", "libvpx", "-b:v", "1M",
          "-c:a", "libvorbis",
          outName,
        ]);
      }

      const data = await ffmpeg.readFile(outName);
      const u8 = data as Uint8Array;
      const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
      const blob = new Blob([ab], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wstudio-podcast-edited.${outName.endsWith("mp4") ? "mp4" : "webm"}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast({ title: "Export complete" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Export failed", description: e?.message?.slice(0, 200) || "Unknown error" });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  /* ---------- render ---------- */
  const playheadPct = totalDur ? (playhead / totalDur) * 100 : 0;

  return (
    <div className="rounded-xl border border-purple-500/30 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-purple-300 uppercase tracking-wider">Editor Pro</p>
          <p className="text-sm font-medium">{initial.name}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Preview with overlay */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={vidRef}
          className="w-full max-h-[55vh] object-contain bg-black"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline
        />
        {overlay.text.trim() && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded"
            style={{
              left: `${overlay.x * 100}%`,
              top: `${overlay.y * 100}%`,
              color: overlay.color,
              fontSize: `${overlay.size * 0.4}px`,
              background: "rgba(0,0,0,0.5)",
              fontWeight: 600,
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {overlay.text}
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="flex items-center gap-2 text-xs">
        <button onClick={toStart} className="p-2 rounded bg-zinc-800 hover:bg-zinc-700" title="Return to start (Enter/Tab)">
          <SkipBack className="w-4 h-4" />
        </button>
        <button onClick={togglePlay} className="p-2 rounded bg-purple-600 hover:bg-purple-500" title="Play/Pause (Space)">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <span className="font-mono text-zinc-400">{fmt(playhead)} / {fmt(totalDur)}</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setMuted((m) => { const nm = !m; if (vidRef.current) vidRef.current.muted = nm; return nm; }); }} className="p-1.5 rounded bg-zinc-800">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={vol}
            onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); if (vidRef.current) vidRef.current.volume = v; }}
            className="accent-purple-500 w-24" />
        </div>
      </div>

      {/* Tool palette (W.Studio DAW style) */}
      <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-zinc-950 border border-zinc-800">
        {([
          { id: "pointer", label: "Pointer", Icon: MousePointer2, hint: "Select clips" },
          { id: "pencil", label: "Pencil", Icon: Pencil, hint: "Draw on waveform" },
          { id: "eraser", label: "Eraser", Icon: Eraser, hint: "Click clip to delete" },
          { id: "scissors", label: "Scissors", Icon: Scissors, hint: "Click to split at point" },
          { id: "trim", label: "Trim", Icon: MoveHorizontal, hint: "Drag clip edges" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.hint}
            className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs transition ${
              tool === t.id
                ? "bg-purple-600 border-purple-400 text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <t.Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-zinc-800" />
        <Button size="sm" variant="secondary" onClick={undo} disabled={!canUndo} className="gap-1.5 h-8" title="Undo (⌘Z)"><Undo2 className="w-3.5 h-3.5" />Undo</Button>
        <Button size="sm" variant="secondary" onClick={redo} disabled={!canRedo} className="gap-1.5 h-8" title="Redo (⌘⇧Z)"><Redo2 className="w-3.5 h-3.5" />Redo</Button>
        <div className="mx-1 h-6 w-px bg-zinc-800" />
        <Button size="sm" variant="secondary" onClick={splitAtPlayhead} className="gap-1.5 h-8"><Scissors className="w-3.5 h-3.5" />Split</Button>
        <Button size="sm" variant="secondary" onClick={deleteSelected} className="gap-1.5 h-8" disabled={!selectedId}><Trash2 className="w-3.5 h-3.5" />Delete</Button>
        <label className="cursor-pointer">
          <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addMediaFile(f, "intro"); e.currentTarget.value = ""; }} />
          <span className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700"><Upload className="w-3.5 h-3.5" />Intro</span>
        </label>
        <label className="cursor-pointer">
          <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addMediaFile(f, "outro"); e.currentTarget.value = ""; }} />
          <span className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700"><Film className="w-3.5 h-3.5" />Outro</span>
        </label>
        <Button size="sm" onClick={exportFinal} disabled={exporting} className="ml-auto bg-purple-600 hover:bg-purple-500 gap-1.5 h-8">
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? `Exporting… ${exportProgress}%` : "Export"}
        </Button>
      </div>

      {/* Title overlay controls */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end p-3 rounded-lg bg-zinc-950 border border-zinc-800">
        <div className="md:col-span-2">
          <label className="text-[10px] text-zinc-400 flex items-center gap-1"><Type className="w-3 h-3" />Title overlay</label>
          <Input value={overlay.text} onChange={(e) => setOverlay({ ...overlay, text: e.target.value })} placeholder="Episode title…" className="bg-zinc-900 border-zinc-800 h-8" />
        </div>
        <div>
          <label className="text-[10px] text-zinc-400">Size</label>
          <input type="range" min={16} max={140} value={overlay.size} onChange={(e) => setOverlay({ ...overlay, size: parseInt(e.target.value) })} className="w-full accent-purple-500" />
        </div>
        <div>
          <label className="text-[10px] text-zinc-400">X / Y</label>
          <div className="flex gap-1">
            <input type="range" min={0} max={1} step={0.01} value={overlay.x} onChange={(e) => setOverlay({ ...overlay, x: parseFloat(e.target.value) })} className="w-full accent-purple-500" />
            <input type="range" min={0} max={1} step={0.01} value={overlay.y} onChange={(e) => setOverlay({ ...overlay, y: parseFloat(e.target.value) })} className="w-full accent-purple-500" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-zinc-400">Color</label>
          <input type="color" value={overlay.color} onChange={(e) => setOverlay({ ...overlay, color: e.target.value })} className="w-full h-8 bg-transparent" />
        </div>
      </div>

      {/* Timeline — uses real DAW WaveformView */}
      <TimelineView
        timelineRef={timelineRef}
        onSeek={onTimelineSeek}
        segments={segments}
        sources={sources}
        waveforms={waveforms}
        totalDur={totalDur}
        selectedId={selectedId}
        tool={tool}
        playheadPct={playheadPct}
        onClipClick={handleClipClick}
        onTrimEdge={trimEdgeLive}
        onTrimBegin={beginTrim}
        fmt={fmt}
      />
      <div className="flex justify-between text-[9px] text-zinc-600 font-mono">
        <span>0:00</span><span>{fmt(totalDur)}</span>
      </div>

      {exporting && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${exportProgress}%` }} />
        </div>
      )}
    </div>
  );
}

/* ---------------- TimelineView ---------------- */

type Segment = Clip & { dur: number; startT: number; endT: number };

function TimelineView({
  timelineRef, onSeek, segments, sources, waveforms, totalDur,
  selectedId, tool, playheadPct, onClipClick, onTrimEdge, onTrimBegin, fmt,
}: {
  timelineRef: React.RefObject<HTMLDivElement>;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  segments: Segment[];
  sources: EditorSource[];
  waveforms: Record<number, Float32Array>;
  totalDur: number;
  selectedId: string | null;
  tool: EditorTool;
  playheadPct: number;
  onClipClick: (segId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  onTrimEdge: (segId: string, edge: "in" | "out", deltaSec: number) => void;
  onTrimBegin: () => void;
  fmt: (s: number) => string;
}) {
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [timelineRef]);

  const cursor =
    tool === "scissors" ? "cursor-crosshair" :
    tool === "eraser" ? "cursor-not-allowed" :
    tool === "pencil" ? "cursor-cell" :
    tool === "trim" ? "cursor-ew-resize" :
    "cursor-pointer";

  const startEdgeDrag = (
    e: React.PointerEvent,
    segId: string,
    edge: "in" | "out",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const pxPerSec = totalDur > 0 ? width / totalDur : 0;
    if (pxPerSec <= 0) return;
    onTrimBegin();
    let lastDelta = 0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = dx / pxPerSec;
      const step = deltaSec - lastDelta;
      lastDelta = deltaSec;
      if (Math.abs(step) > 0.0005) onTrimEdge(segId, edge, step);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>Timeline · click to seek · tool: <span className="text-purple-300 uppercase">{tool}</span></span>
        <span>Space: play · Enter/Tab: start · Delete: remove · ⌘Z undo</span>
      </div>
      <div
        ref={timelineRef}
        onClick={onSeek}
        className={`relative h-28 bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden select-none ${cursor}`}
      >
        {segments.map((s) => {
          const left = totalDur ? (s.startT / totalDur) * 100 : 0;
          const w = totalDur ? (s.dur / totalDur) * 100 : 0;
          const isSel = selectedId === s.id;
          const peaks = waveforms[s.srcIdx];
          const src = sources[s.srcIdx];
          const srcDur = (src?.durationMs || 1) / 1000;
          const offsetRatio = s.in / srcDur;
          const spanRatio = Math.max(0.0001, (s.out - s.in) / srcDur);
          const segPx = Math.max(8, Math.floor((w / 100) * width) - 4);
          const handleActive = tool === "trim" || isSel;
          return (
            <div
              key={s.id}
              onClick={(e) => onClipClick(s.id, e)}
              style={{ left: `${left}%`, width: `${w}%` }}
              className={`absolute top-1 bottom-1 rounded border overflow-hidden ${
                isSel
                  ? "border-purple-400 bg-purple-500/15 ring-2 ring-purple-400"
                  : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800/80"
              }`}
              title={`Clip ${fmt(s.startT)} – ${fmt(s.endT)}`}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                {peaks ? (
                  <WaveformView
                    peaks={peaks}
                    width={segPx}
                    height={96}
                    color={isSel ? "rgba(192,132,252,0.95)" : "rgba(168,85,247,0.85)"}
                    offsetRatio={offsetRatio}
                    spanRatio={spanRatio}
                  />
                ) : (
                  <div className="text-[9px] text-zinc-500">decoding…</div>
                )}
              </div>
              <div className="absolute top-0.5 left-1 text-[9px] font-mono text-white/80 bg-black/40 px-1 rounded-sm pointer-events-none">
                {fmt(s.dur)}
              </div>
              {/* Trim drag handles — always present; brighter when trim tool or selected */}
              <div
                onPointerDown={(e) => startEdgeDrag(e, s.id, "in")}
                onClick={(e) => e.stopPropagation()}
                title="Drag to trim left edge ["
                className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center ${
                  handleActive ? "bg-amber-400/80" : "bg-amber-400/30 hover:bg-amber-400/70"
                }`}
              >
                <span className="text-[10px] font-bold text-black/80 select-none">[</span>
              </div>
              <div
                onPointerDown={(e) => startEdgeDrag(e, s.id, "out")}
                onClick={(e) => e.stopPropagation()}
                title="Drag to trim right edge ]"
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize flex items-center justify-center ${
                  handleActive ? "bg-amber-400/80" : "bg-amber-400/30 hover:bg-amber-400/70"
                }`}
              >
                <span className="text-[10px] font-bold text-black/80 select-none">]</span>
              </div>
            </div>
          );
        })}
        <div className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none" style={{ left: `${playheadPct}%` }}>
          <div className="absolute -top-1 -left-1.5 w-3 h-3 rotate-45 bg-red-500" />
        </div>
      </div>
    </div>
  );
}
