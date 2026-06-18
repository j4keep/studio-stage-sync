import { useRef, useState, useMemo, useEffect } from "react";
import { useDawStore } from "../state/DawStore";
import { WaveformView } from "./WaveformView";
import { ClipVideoStrip } from "@/pages/podcast/ClipVideoStrip";
import { usePodcastVideoStore } from "@/pages/podcast/podcastVideoStore";
import { Knob } from "./Knob";
import { HorizontalMeter } from "./HorizontalMeter";
import { Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Track, Clip, MidiNote } from "../engine/types";
import type { DawEngine } from "../engine/DawEngine";

interface Props {
  onArmToggle: (trackId: string) => void;
  onSeek?: (position: number) => void;
  engine?: DawEngine | null;
  onOpenInstrumentEditor?: (trackId: string) => void;
  onImportFilesAt?: (trackId: string, startTime: number, files: FileList) => void;
}

const HEADER_W = 200;
const TRACK_H_BASE = 80;
const RULER_H = 32;

// Build an SVG-based cursor that resembles the selected tool's icon. The icon
// is white with a black outline so it's legible on both light and dark UI.
const svgCursor = (inner: string, hx = 4, hy = 4) => {
  // 18x18 keeps the tool icons crisp without looming over small waveforms.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'>${inner}<g stroke='white' stroke-width='1.75'>${inner}</g></svg>`;
  const scale = 18 / 28;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${Math.round(hx * scale)} ${Math.round(hy * scale)}, auto`;
};

const TOOL_CURSORS: Record<string, string> = {
  pointer: "default",
  pencil: svgCursor(`<path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/>`, 2, 22),
  eraser: svgCursor(`<path d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'/><path d='M22 21H7'/><path d='m5 11 9 9'/>`, 4, 20),
  scissors: svgCursor(`<circle cx='6' cy='6' r='3'/><path d='M8.12 8.12 12 12'/><path d='M20 4 8.12 15.88'/><circle cx='6' cy='18' r='3'/><path d='M14.8 14.8 20 20'/>`, 12, 12),
  glue: svgCursor(`<path d='M10 18H5a3 3 0 0 1-3-3v-1'/><rect x='8' y='2' width='8' height='8' rx='2'/><path d='m7 21 3-3-3-3'/>`, 12, 12),
  mute: svgCursor(`<path d='M11 4.7v14.6L6 16H3V8h3z'/><line x1='22' x2='16' y1='9' y2='15'/><line x1='16' x2='22' y1='9' y2='15'/>`, 12, 12),
  zoom: svgCursor(`<circle cx='11' cy='11' r='8'/><line x1='21' x2='16.65' y1='21' y2='16.65'/><line x1='11' x2='11' y1='8' y2='14'/><line x1='8' x2='14' y1='11' y2='11'/>`, 11, 11),
  fade: svgCursor(`<path d='M2 12c2 0 3-4 5-4s3 8 5 8 3-8 5-8 3 4 5 4'/>`, 12, 12),
  marquee: svgCursor(`<path d='M3 5a2 2 0 0 1 2-2'/><path d='M21 5a2 2 0 0 0-2-2'/><path d='M19 21a2 2 0 0 0 2-2'/><path d='M3 19a2 2 0 0 0 2 2'/><path d='M9 3h1M14 3h1M9 21h1M14 21h1M3 9v1M21 9v1M3 14v1M21 14v1'/>`, 12, 12),
  text: svgCursor(`<polyline points='4 7 4 4 20 4 20 7'/><line x1='9' x2='15' y1='20' y2='20'/><line x1='12' x2='12' y1='4' y2='20'/>`, 12, 12),
  automation: svgCursor(`<path d='m3 17 6-6 4 4 8-8'/><path d='M14 7h7v7'/>`, 3, 17),
  flex: svgCursor(`<path d='M12 2v20M2 12h20M15 5l-3-3-3 3M5 9l-3 3 3 3M19 9l3 3-3 3M9 19l3 3 3-3'/>`, 12, 12),
  trim: svgCursor(`<polyline points='6 8 2 12 6 16'/><polyline points='18 8 22 12 18 16'/><line x1='2' x2='22' y1='12' y2='12'/>`, 12, 12),
};

export function ArrangeView({ onArmToggle, onSeek, engine, onOpenInstrumentEditor, onImportFilesAt }: Props) {
  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const bpm = useDawStore(s => s.transport.bpm);
  const loopEnabled = useDawStore(s => s.transport.loopEnabled);
  const loopStart = useDawStore(s => s.transport.loopStart);
  const loopEnd = useDawStore(s => s.transport.loopEnd);
  const pxPerSec = useDawStore(s => s.pxPerSec);
  const setTransport = useDawStore(s => s.setTransport);
  const updateTrack = useDawStore(s => s.updateTrack);
  const removeTrack = useDawStore(s => s.removeTrack);
  const updateClip = useDawStore(s => s.updateClip);
  const removeClip = useDawStore(s => s.removeClip);
  const selectClip = useDawStore(s => s.selectClip);
  const selectedClipId = useDawStore(s => s.selectedClipId);
  const splitClipAt = useDawStore(s => s.splitClipAt);
  const setPxPerSec = useDawStore(s => s.setPxPerSec);
  const verticalZoom = useDawStore(s => s.verticalZoom);
  const setVerticalZoom = useDawStore(s => s.setVerticalZoom);
  const TRACK_H = Math.round(TRACK_H_BASE * verticalZoom);
  const reorderTracks = useDawStore(s => s.reorderTracks);
  const moveClipToTrack = useDawStore(s => s.moveClipToTrack);
  const copyClip = useDawStore(s => s.copyClip);
  const cutClip = useDawStore(s => s.cutClip);
  const pasteClipAt = useDawStore(s => s.pasteClipAt);
  const duplicateClip = useDawStore(s => s.duplicateClip);
  const addClip = useDawStore(s => s.addClip);
  const tool = useDawStore(s => s.tool);
  const toggleAutomationLane = useDawStore(s => s.toggleAutomationLane);
  const setAutomationParam = useDawStore(s => s.setAutomationParam);
  const addAutomationPoint = useDawStore(s => s.addAutomationPoint);
  const updateAutomationPoint = useDawStore(s => s.updateAutomationPoint);
  const removeAutomationPoint = useDawStore(s => s.removeAutomationPoint);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [liveRec, setLiveRec] = useState<{ trackId: string; peaks: number[]; dur: number } | null>(null);

  useEffect(() => {
    if (!engine) return;
    engine.onRecordingProgress = (peaks, dur) => {
      const tid = engine.getRecordingTrackId();
      if (!tid || dur <= 0) setLiveRec(null);
      else setLiveRec({ trackId: tid, peaks: peaks.slice(), dur });
    };
    return () => { if (engine) engine.onRecordingProgress = undefined; };
  }, [engine]);

  const timelineLen = Math.max(60, ...clips.map(c => c.startTime + c.duration)) + 20;

  // Bars/beats math (4/4)
  const secPerBeat = 60 / Math.max(40, bpm);
  const secPerBar = secPerBeat * 4;
  const barPx = secPerBar * pxPerSec;
  const beatPx = secPerBeat * pxPerSec;
  const totalBars = Math.ceil(timelineLen / secPerBar) + 1;

  const trackIndexById = useMemo(() => {
    const m = new Map<string, number>();
    tracks.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [tracks]);

  const handleRulerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.cycle) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const next = Math.max(0, x / pxPerSec);
    if (onSeek) onSeek(next);
    else setTransport({ position: next });
  };

  // Pointer drag for the cycle (loop) region
  const cycleDrag = useRef<{ mode: "move" | "start" | "end" | "create"; startX: number; startS: number; startE: number } | null>(null);
  const onCyclePointerDown = (e: React.PointerEvent, mode: "move" | "start" | "end") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    cycleDrag.current = { mode, startX: e.clientX, startS: loopStart ?? 0, startE: loopEnd ?? 8 };
  };
  const onCyclePointerMove = (e: React.PointerEvent) => {
    const d = cycleDrag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / pxPerSec;
    if (d.mode === "move") {
      const len = d.startE - d.startS;
      const ns = Math.max(0, d.startS + dx);
      setTransport({ loopStart: ns, loopEnd: ns + len });
    } else if (d.mode === "start") {
      setTransport({ loopStart: Math.max(0, Math.min((loopEnd ?? 0) - 0.1, d.startS + dx)) });
    } else if (d.mode === "end") {
      setTransport({ loopEnd: Math.max((loopStart ?? 0) + 0.1, d.startE + dx) });
    }
  };
  const onCyclePointerUp = () => { cycleDrag.current = null; };

  const cycleStart = loopStart ?? 0;
  const cycleEnd = loopEnd ?? 8;
  const rulerDrag = useRef(false);
  const seekFromRuler = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const next = Math.max(0, (clientX - rect.left) / pxPerSec);
    if (onSeek) onSeek(next);
    else setTransport({ position: next });
  };

  // Clip drag state (pointer-based; supports cross-track move + trim on either edge)
  const clipDrag = useRef<{
    clipId: string;
    startX: number; startY: number;
    startTime: number; startTrackId: string; startTrackIdx: number;
    mode: "move" | "resize-right" | "resize-left";
    startDur: number;
    startOffset: number;
  } | null>(null);

  const beginClipDrag = (clip: Clip, e: React.PointerEvent, mode: "move" | "resize-right" | "resize-left") => {
    const idx = trackIndexById.get(clip.trackId) ?? 0;
    clipDrag.current = {
      clipId: clip.id, startX: e.clientX, startY: e.clientY,
      startTime: clip.startTime, startTrackId: clip.trackId, startTrackIdx: idx,
      mode, startDur: clip.duration, startOffset: clip.offset ?? 0,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onClipDragMove = (e: React.PointerEvent) => {
    const d = clipDrag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / pxPerSec;
    if (d.mode === "resize-right") {
      // Pure trim: shorten/extend right edge without moving startTime or stretching audio.
      const clip = useDawStore.getState().clips.find(c => c.id === d.clipId);
      const bufDur = clip?.buffer?.duration ?? Infinity;
      const maxDur = Math.max(0.05, bufDur - (clip?.offset ?? 0));
      updateClip(d.clipId, { duration: Math.max(0.05, Math.min(maxDur, d.startDur + dx)) });
      return;
    }
    if (d.mode === "resize-left") {
      // Pure trim from the left: change offset + startTime, keep audio content locked to timeline.
      const delta = Math.max(-d.startOffset, Math.min(d.startDur - 0.05, dx));
      updateClip(d.clipId, {
        startTime: Math.max(0, d.startTime + delta),
        offset: d.startOffset + delta,
        duration: d.startDur - delta,
      });
      return;
    }
    const dy = e.clientY - d.startY;
    const targetIdx = Math.max(0, Math.min(tracks.length - 1, d.startTrackIdx + Math.round(dy / TRACK_H)));
    const targetTrack = tracks[targetIdx];
    const newStart = Math.max(0, d.startTime + dx);
    updateClip(d.clipId, { startTime: newStart });
    if (targetTrack && targetTrack.id !== d.startTrackId) {
      moveClipToTrack(d.clipId, targetTrack.id);
      d.startTrackId = targetTrack.id;
      d.startTrackIdx = targetIdx;
      d.startY = e.clientY;
    }
  };
  const endClipDrag = () => {
    const d = clipDrag.current;
    clipDrag.current = null;
    // If the clip was moved to another track or its start time changed while
    // playback was active, the engine's scheduled audio is now stale. Restart
    // playback from the current position so audio follows the visual move.
    if (d && engine?.playing) {
      const st = useDawStore.getState();
      const pos = st.transport.position;
      engine.stop();
      requestAnimationFrame(() => {
        const fresh = useDawStore.getState();
        engine.play({ ...fresh.transport, position: pos, isPlaying: true }, fresh.tracks, fresh.clips);
      });
    }
  };

  // Tool actions on a clip click
  const applyToolToClip = (clip: Clip, e: React.MouseEvent) => {
    switch (tool) {
      case "eraser":
        usePodcastVideoStore.getState().removeVideo(clip.id);
        removeClip(clip.id); return true;
      case "scissors": {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const t = clip.startTime + (e.clientX - rect.left) / pxPerSec;
        const rightClipId = splitClipAt(clip.id, t);
        if (rightClipId) usePodcastVideoStore.getState().cloneVideo(clip.id, rightClipId);
        return true;
      }
      case "mute":
        updateClip(clip.id, { name: clip.name.startsWith("[M] ") ? clip.name.slice(4) : "[M] " + clip.name });
        return true;
      case "glue": {
        const sameTrack = useDawStore.getState().clips
          .filter(c => c.trackId === clip.trackId && c.id !== clip.id && c.startTime >= clip.startTime)
          .sort((a, b) => a.startTime - b.startTime);
        const next = sameTrack[0];
        if (next) {
          if (!usePodcastVideoStore.getState().videos[clip.id] && usePodcastVideoStore.getState().videos[next.id]) {
            usePodcastVideoStore.getState().cloneVideo(next.id, clip.id);
          }
          updateClip(clip.id, { duration: Math.max(clip.duration, next.startTime + next.duration - clip.startTime) });
          usePodcastVideoStore.getState().removeVideo(next.id);
          removeClip(next.id);
          toast.success("Glued clips");
        }
        return true;
      }
      case "zoom":
        setPxPerSec(e.altKey ? pxPerSec / 1.5 : pxPerSec * 1.5); return true;
      case "fade":
        toast("Drag clip edges to set fade length"); return false;
      case "text": {
        const name = window.prompt("Rename clip", clip.name);
        if (name !== null && name.trim()) updateClip(clip.id, { name: name.trim() });
        return true;
      }
      case "automation":
        updateClip(clip.id, { name: clip.name.startsWith("[A] ") ? clip.name.slice(4) : "[A] " + clip.name });
        toast.success("Automation lane toggled");
        return true;
      case "flex":
        toast("Drag the clip's right edge to time-stretch");
        return false;
      case "trim":
        toast("Drag the clip's right edge to trim");
        return false;
    }
    return false;
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-neutral-900 min-h-0 min-w-0"
      onClick={() => setCtxMenu(null)}
      style={{ cursor: TOOL_CURSORS[tool] }}
    >

      {/* Toolbar */}
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 gap-3 text-[10px] text-neutral-400">
        <span className="uppercase tracking-wider">Edit</span>
        <span className="text-cyan-300/80 uppercase tracking-wider">Tool: {tool}</span>
        <button
          type="button"
          onClick={() => setTransport({ loopEnabled: !loopEnabled })}
          className={`h-5 px-2 rounded border text-[9px] uppercase tracking-wider ${loopEnabled ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "border-neutral-800 text-neutral-500 hover:text-neutral-300"}`}
        >Cycle {loopEnabled ? "On" : "Off"}</button>
        <span className="text-neutral-600">Drag amber bar to set loop region</span>
        <div className="flex-1" />
        <span>Zoom</span>
        <input
          type="range" min={20} max={300} step={5}
          value={pxPerSec}
          onChange={(e) => setPxPerSec(Number(e.target.value))}
          className="w-32 accent-cyan-500"
          title="Horizontal zoom"
        />
        <span className="text-neutral-600">·</span>
        <span>V-Zoom</span>
        <input
          type="range" min={0.5} max={3} step={0.1}
          value={verticalZoom}
          onChange={(e) => setVerticalZoom(Number(e.target.value))}
          className="w-24 accent-purple-500"
          title="Vertical (track height) zoom"
        />
      </div>

      <div
        className="flex-1 overflow-auto min-h-0 min-w-0 overscroll-contain"
        ref={scrollRef}
        style={{ touchAction: "pan-x pan-y" }}
      >

        <div className="flex" style={{ minWidth: HEADER_W + timelineLen * pxPerSec }}>
          {/* Track headers column */}
          <div className="sticky left-0 z-10 bg-neutral-950 border-r border-neutral-800 overflow-hidden" style={{ width: HEADER_W }}>
            <div style={{ height: RULER_H }} className="border-b border-neutral-800" />
            {tracks.map(t => {
              const trackClips = clips.filter(c => c.trackId === t.id);
              const inputAn = engine?.getTrackInputAnalyser(t.id) ?? null;
              const isStereo = t.kind === "instrument" || trackClips.some(c => (c.buffer?.numberOfChannels ?? 0) >= 2);
              const stereo = engine?.getTrackStereoAnalysers(t.id) ?? null;
              const mono = engine?.getTrackAnalyser(t.id) ?? null;
              const canRecordInput = t.kind === "instrument" || (t.kind === "audio" && t.inputEnabled !== false && !(t.inputEnabled === undefined && trackClips.some(c => c.buffer && c.name !== "Recording")));
              const meters = t.kind === "audio" && canRecordInput && inputAn ? [inputAn] : isStereo && stereo ? [stereo.L, stereo.R] : mono ? [mono] : [];
              return (
                <div key={t.id}>
                  <TrackHeader
                    track={t}
                    canRecordInput={canRecordInput}
                    meters={meters}
                    onArm={() => onArmToggle(t.id)}
                    onMute={() => updateTrack(t.id, { mute: !t.mute })}
                    onSolo={() => updateTrack(t.id, { solo: !t.solo })}
                    onRemove={() => removeTrack(t.id)}
                    onRename={(n) => updateTrack(t.id, { name: n })}
                    onVolume={(v) => updateTrack(t.id, { volume: v })}
                    onPan={(v) => updateTrack(t.id, { pan: v })}
                    onDropTrack={(fromId) => reorderTracks(fromId, t.id)}
                    onToggleAuto={() => toggleAutomationLane(t.id)}
                    onOpenEditor={t.kind === "instrument" && onOpenInstrumentEditor ? () => onOpenInstrumentEditor(t.id) : undefined}
                  />
                  {t.automationOpen && (
                    <AutomationLaneHeader
                      param={t.automationParam ?? "volume"}
                      onSelect={(p) => setAutomationParam(t.id, p)}
                      onClose={() => toggleAutomationLane(t.id)}
                    />
                  )}
                </div>
              );
            })}
            {tracks.length === 0 && (
              <div className="p-6 text-center text-neutral-500 text-xs">Add a track to begin.</div>
            )}
          </div>

          {/* Timeline area */}
          <div className="flex-1 relative">
            {/* Bars/Beats Ruler */}
            <div
              className="border-b border-neutral-800 bg-neutral-950 relative cursor-pointer select-none"
              onClick={handleRulerClick}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).dataset.cycle) return;
                rulerDrag.current = true;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                seekFromRuler(e.clientX, e.currentTarget as HTMLElement);
              }}
              onPointerMove={(e) => {
                if (!rulerDrag.current || !(e.buttons & 1)) return;
                seekFromRuler(e.clientX, e.currentTarget as HTMLElement);
              }}
              onPointerUp={() => { rulerDrag.current = false; }}
              onPointerCancel={() => { rulerDrag.current = false; }}
              style={{ width: timelineLen * pxPerSec, height: RULER_H }}
            >
              {/* Bar markers */}
              {Array.from({ length: totalBars }).map((_, i) => {
                const left = i * barPx;
                return (
                  <div key={`bar-${i}`} className="absolute top-0 bottom-0" style={{ left }}>
                    <div className="absolute top-0 bottom-0 w-px bg-neutral-700" />
                    <div className="absolute top-0.5 left-1 text-[10px] font-mono text-amber-300/80 tabular-nums">{i + 1}</div>
                    {/* Beat subdivisions inside this bar (skip beat 1) */}
                    {beatPx > 8 && [1, 2, 3].map(b => (
                      <div key={b} className="absolute top-3 bottom-0 w-px bg-neutral-800/80" style={{ left: b * beatPx }} />
                    ))}
                  </div>
                );
              })}

              {/* Cycle (loop) region */}
              <div
                data-cycle="1"
                onPointerDown={(e) => onCyclePointerDown(e, "move")}
                onPointerMove={onCyclePointerMove}
                onPointerUp={onCyclePointerUp}
                title="Drag to move cycle region — click toggle in toolbar"
                className={`absolute top-0 h-3 rounded-sm ${loopEnabled ? "bg-amber-400/60 border border-amber-300" : "bg-amber-400/15 border border-amber-400/30"} cursor-grab active:cursor-grabbing`}
                style={{ left: cycleStart * pxPerSec, width: Math.max(4, (cycleEnd - cycleStart) * pxPerSec) }}
              >
                <div
                  data-cycle="1"
                  onPointerDown={(e) => onCyclePointerDown(e, "start")}
                  onPointerMove={onCyclePointerMove}
                  onPointerUp={onCyclePointerUp}
                  className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-300 cursor-ew-resize"
                />
                <div
                  data-cycle="1"
                  onPointerDown={(e) => onCyclePointerDown(e, "end")}
                  onPointerMove={onCyclePointerMove}
                  onPointerUp={onCyclePointerUp}
                  className="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-300 cursor-ew-resize"
                />
              </div>

              <PlayheadMarker pxPerSec={pxPerSec} ruler recOverride={liveRec ? engine!.getRecordingStart() + liveRec.dur : null} />
            </div>

            {/* Loop region shading down lanes */}
            {loopEnabled && (
              <div
                className="absolute top-0 bottom-0 bg-amber-400/5 border-x border-amber-400/30 pointer-events-none z-0"
                style={{ left: cycleStart * pxPerSec, width: Math.max(2, (cycleEnd - cycleStart) * pxPerSec), marginTop: RULER_H }}
              />
            )}

            {/* Track lanes */}
            {tracks.map(t => (
              <div key={t.id}>
                <div
                  className="relative border-b border-neutral-800"
                  style={{ height: TRACK_H, background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(0,0,0,0))" }}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes("Files")) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "copy";
                    }
                  }}
                  onDrop={(e) => {
                    if (!e.dataTransfer.files?.length || !onImportFilesAt) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const time = Math.max(0, (e.clientX - rect.left) / pxPerSec);
                    onImportFilesAt(t.id, time, e.dataTransfer.files);
                  }}
                  onClick={(e) => {
                    if (tool === "pencil") {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const time = Math.max(0, (e.clientX - rect.left) / pxPerSec);
                      addClip({
                        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
                        trackId: t.id, startTime: time, duration: 2, offset: 0, name: "New Region",
                      });
                    } else if (tool === "zoom") {
                      setPxPerSec(e.altKey ? pxPerSec / 1.5 : pxPerSec * 1.5);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const time = Math.max(0, (e.clientX - rect.left) / pxPerSec);
                    const pastedId = pasteClipAt(t.id, time);
                    if (pastedId) usePodcastVideoStore.getState().pasteVideoFromClipboard(pastedId);
                  }}
                >
                  {/* Bar grid lines on lane */}
                  {Array.from({ length: totalBars }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 w-px bg-neutral-800/80" style={{ left: i * barPx }} />
                  ))}
                  {clips.filter(c => c.trackId === t.id).map(c => (
                    <ClipBlock
                      key={c.id}
                      clip={c}
                      color={t.color}
                      pxPerSec={pxPerSec}
                      selected={selectedClipId === c.id}
                      tool={tool}
                      onSelect={() => selectClip(c.id)}
                      onContext={(x: number, y: number) => setCtxMenu({ x, y, clipId: c.id })}
                      onToolApply={(e: React.MouseEvent) => applyToolToClip(c, e)}
                      onPointerDownDrag={(e: React.PointerEvent, mode: "move" | "resize-left" | "resize-right") => beginClipDrag(c, e, mode)}
                      onPointerMoveDrag={onClipDragMove}
                      onPointerUpDrag={endClipDrag}
                    />
                  ))}
                  {liveRec && liveRec.trackId === t.id && engine && (
                    <LiveRecordingBlock
                      startTime={engine.getRecordingStart()}
                      peaks={liveRec.peaks}
                      duration={liveRec.dur}
                      pxPerSec={pxPerSec}
                      height={TRACK_H}
                    />
                  )}
                </div>
                {t.automationOpen && (
                  <AutomationLane
                    track={t}
                    width={timelineLen * pxPerSec}
                    pxPerSec={pxPerSec}
                    onAdd={(p) => addAutomationPoint(t.id, p)}
                    onUpdate={(i, patch) => updateAutomationPoint(t.id, i, patch)}
                    onRemove={(i) => removeAutomationPoint(t.id, i)}
                  />
                )}
              </div>
            ))}
            <PlayheadMarker pxPerSec={pxPerSec} recOverride={liveRec ? engine!.getRecordingStart() + liveRec.dur : null} />
          </div>
        </div>
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 bg-neutral-950 border border-neutral-800 rounded shadow-xl py-1 text-xs text-neutral-200 min-w-[180px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "Cut", sc: "⌘X", action: () => { usePodcastVideoStore.getState().copyVideoToClipboard(ctxMenu.clipId); cutClip(ctxMenu.clipId); } },
            { label: "Copy", sc: "⌘C", action: () => { copyClip(ctxMenu.clipId); usePodcastVideoStore.getState().copyVideoToClipboard(ctxMenu.clipId); toast.success("Copied"); } },
            { label: "Duplicate", sc: "⌘D", action: () => { const id = duplicateClip(ctxMenu.clipId); if (id) usePodcastVideoStore.getState().cloneVideo(ctxMenu.clipId, id); } },
            { label: "Split at playhead", sc: "", action: () => { const id = splitClipAt(ctxMenu.clipId, useDawStore.getState().transport.position); if (id) usePodcastVideoStore.getState().cloneVideo(ctxMenu.clipId, id); } },
            { label: "Delete", sc: "Del", action: () => { usePodcastVideoStore.getState().removeVideo(ctxMenu.clipId); removeClip(ctxMenu.clipId); } },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setCtxMenu(null); }}
              className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 flex items-center justify-between"
            >
              <span>{item.label}</span>
              {item.sc && <span className="text-neutral-500 text-[10px]">{item.sc}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackHeader({ track, canRecordInput, meters = [], onArm, onMute, onSolo, onRemove, onRename, onVolume, onPan, onDropTrack, onToggleAuto, onOpenEditor }: {
  track: Track;
  canRecordInput: boolean;
  meters?: AnalyserNode[];
  onArm: () => void;
  onMute: () => void;
  onSolo: () => void;
  onRemove: () => void;
  onRename: (n: string) => void;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
  onDropTrack: (fromId: string) => void;
  onToggleAuto?: () => void;
  onOpenEditor?: () => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const TRACK_H = Math.round(TRACK_H_BASE * useDawStore(s => s.verticalZoom));
  const sliderRef = useRef<HTMLDivElement>(null);
  const setVolFromX = (clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onVolume(t * 2);
  };
  return (
    <div
      className="border-b border-neutral-800 flex overflow-hidden bg-gradient-to-b from-neutral-900 to-neutral-950"
      style={{ height: TRACK_H }}
      draggable
      onDragStart={(e) => {
        // Don't initiate a track-reorder drag when the user grabs an input/button
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA" || tag === "SELECT") {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("application/x-daw-track", track.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-daw-track")) e.preventDefault(); }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("application/x-daw-track");
        if (id && id !== track.id) onDropTrack(id);
      }}
    >
      <div className="w-1.5 shrink-0" style={{ background: track.color }} />
      <div
        className="w-3 shrink-0 grid place-items-center cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-300"
        title="Drag the row to reorder this track"
      ><GripVertical className="w-3 h-3" /></div>


      <div className="flex-1 p-1.5 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <input
            value={track.name}
            onChange={(e) => onRename(e.target.value)}
            onPointerDown={stop}
            onMouseDown={stop}
            className="flex-1 min-w-0 bg-transparent text-[11px] font-medium text-neutral-100 border-none outline-none"
          />
          {onToggleAuto && (
            <button onPointerDown={stop} onClick={onToggleAuto} title="Toggle automation lane" className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.automationOpen ? "bg-emerald-400 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>A</button>
          )}
          <button onPointerDown={stop} onClick={onRemove} title="Delete track" className="text-neutral-600 hover:text-red-400 shrink-0"><Trash2 className="w-3 h-3" /></button>
        </div>

        <div
          className="flex items-center gap-1.5 min-w-0"
          onClick={onOpenEditor ? () => onOpenEditor() : undefined}
          title={onOpenEditor ? "Click to reopen instrument editor" : undefined}
          style={onOpenEditor ? { cursor: "pointer" } : undefined}
        >
          <button onPointerDown={stop} onClick={onMute} title="Mute" className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.mute ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>M</button>
          <button onPointerDown={stop} onClick={onSolo} title="Solo" className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.solo ? "bg-cyan-400 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>S</button>
          <button
            onPointerDown={stop}
            onClick={() => { if (canRecordInput) onArm(); }}
            disabled={!canRecordInput}
            title={canRecordInput ? "Record-arm" : "Playback-only imported audio"}
            className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${canRecordInput && track.armed ? "bg-red-500 text-white" : canRecordInput ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" : "bg-neutral-950 text-neutral-700 cursor-not-allowed"}`}
          >R</button>

          <div
            ref={sliderRef}
            onPointerDown={(e) => { stop(e); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setVolFromX(e.clientX); }}
            onPointerMove={(e) => { if (!(e.buttons & 1)) return; setVolFromX(e.clientX); }}
            title={`Volume — drag to adjust  ·  ${meters.length === 2 ? "Stereo" : "Mono"} meter`}
            className="flex-1 min-w-0 rounded bg-neutral-950 border border-neutral-700 relative cursor-ew-resize overflow-hidden"
              style={{ height: meters.length === 2 ? 16 : 12 }}
          >
            {/* Live level meter underlay (1 or 2 bars based on track channels) */}
            {meters.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <HorizontalMeter analysers={meters} height={meters.length === 2 ? 16 : 12} />
              </div>
            )}
            {/* Volume position scrim (dims area to the right of fader position) */}
            <div
              className="absolute inset-y-0 pointer-events-none bg-black/40"
              style={{ left: `${Math.min(100, (track.volume / 2) * 100)}%`, right: 0 }}
            />
            {/* Fader thumb line */}
            <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${Math.min(100, (track.volume / 2) * 100)}%`, width: 2, background: "rgba(255,255,255,0.95)", boxShadow: "0 0 4px rgba(255,255,255,0.6)" }} />
          </div>

          <div className="flex items-center gap-0.5 shrink-0" onPointerDown={stop} onClick={stop} title="Pan L/R">
            <span className="text-[8px] text-neutral-500">L</span>
            <Knob value={track.pan} min={-1} max={1} step={0.01} size={22} onChange={onPan} color={track.color} showValue={false} />
            <span className="text-[8px] text-neutral-500">R</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveRecordingBlock({ startTime, peaks, duration, pxPerSec, height }: { startTime: number; peaks: number[]; duration: number; pxPerSec: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Width follows recorded duration ONLY (peaks-based), so the playhead — which is
  // glued to the same recorded duration above — lands exactly at the wave's edge.
  const displayDuration = Math.max(0.02, duration);
  const w = Math.max(2, Math.ceil(displayDuration * pxPerSec));
  const h = height - 8;
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    c.width = w; c.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const mid = h / 2;
    const N = peaks.length;
    if (N === 0) return;
    // Draw min/max pairs using the same shape logic as finished clips.
    const samples = Math.floor(N / 2);
    const step = samples / w;
    for (let x = 0; x < w; x++) {
      const i = Math.min(samples - 1, Math.floor(x * step));
      const min = peaks[i * 2] ?? 0;
      const max = peaks[i * 2 + 1] ?? 0;
      const yTop = mid + min * mid;
      const yBot = mid + max * mid;
      ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop));
    }
  }, [peaks, w, h]);
  return (
    <div
      className="absolute top-1 bottom-1 rounded overflow-hidden border-2 border-red-400 pointer-events-none"
      style={{ left: startTime * pxPerSec, width: w, background: "rgba(239,68,68,0.18)", boxShadow: "0 0 12px rgba(239,68,68,0.5)" }}
    >
      <div className="px-1.5 py-0.5 text-[10px] text-white bg-red-600/80 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Recording…
      </div>
      <canvas ref={canvasRef} className="absolute inset-x-0 bottom-0" style={{ height: h }} />
    </div>
  );
}

function PlayheadMarker({ pxPerSec, ruler = false, recOverride = null }: { pxPerSec: number; ruler?: boolean; recOverride?: number | null }) {
  const transportPos = useDawStore(s => s.transport.position);
  const position = recOverride != null ? recOverride : transportPos;
  if (ruler) {
    return (
      <div className="absolute top-0 bottom-0 w-px bg-emerald-400 pointer-events-none z-30" style={{ transform: `translate3d(${position * pxPerSec}px, 0, 0)` }}>
        <div className="w-2 h-2 bg-emerald-400 -translate-x-1/2 rotate-45" />
      </div>
    );
  }
  return (
    <div
      className="absolute w-px bg-emerald-400/70 pointer-events-none z-20 will-change-transform"
      style={{ left: 0, transform: `translate3d(${position * pxPerSec}px, 0, 0)`, top: RULER_H, bottom: 0 }}
    />
  );
}

// Bracket-style trim cursor: matches DAW convention (Logic / Soundtrap) for clip-edge resize.
const TRIM_LEFT_CURSOR = svgCursor(`<path d='M14 4 H8 V20 H14'/><path d='M8 12 H2'/><polyline points='5 9 2 12 5 15'/>`, 8, 12);
const TRIM_RIGHT_CURSOR = svgCursor(`<path d='M10 4 H16 V20 H10'/><path d='M16 12 H22'/><polyline points='19 9 22 12 19 15'/>`, 16, 12);

function ClipBlock({ clip, color, pxPerSec, selected, tool, onSelect, onContext, onToolApply, onPointerDownDrag, onPointerMoveDrag, onPointerUpDrag }: {
  clip: Clip;
  color: string;
  pxPerSec: number;
  selected: boolean;
  tool: string;
  onSelect: () => void;
  onContext: (x: number, y: number) => void;
  onToolApply: (e: React.MouseEvent) => void;
  onPointerDownDrag: (e: React.PointerEvent, mode: "move" | "resize-left" | "resize-right") => void;
  onPointerMoveDrag: (e: React.PointerEvent) => void;
  onPointerUpDrag: () => void;
}) {
  const TRACK_H = Math.round(TRACK_H_BASE * useDawStore(s => s.verticalZoom));
  const w = clip.duration * pxPerSec;
  const left = clip.startTime * pxPerSec;
  const interactive = tool === "pointer" || tool === "trim";
  const bufDur = clip.buffer?.duration ?? (clip.duration + (clip.offset ?? 0));
  const offsetRatio = bufDur > 0 ? (clip.offset ?? 0) / bufDur : 0;
  const spanRatio = bufDur > 0 ? Math.min(1 - offsetRatio, clip.duration / bufDur) : 1;
  const hasVideo = !!usePodcastVideoStore(s => s.videos[clip.id]);
  const VIDEO_STRIP_H = hasVideo ? Math.min(48, Math.max(28, Math.round((TRACK_H - 24) * 0.4))) : 0;

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); onContext(e.clientX, e.clientY); }}
      onClick={(e) => {
        e.stopPropagation();
        if (tool !== "pointer" && tool !== "trim") { onToolApply(e); return; }
        onSelect();
      }}
      onPointerDown={(e) => {
        if (!interactive || e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        const target = e.target as HTMLElement;
        const handle = target.dataset.handle;
        const mode = handle === "resize-right" ? "resize-right" : handle === "resize-left" ? "resize-left" : tool === "trim" ? "resize-right" : "move";
        onPointerDownDrag(e, mode);
      }}
      onPointerMove={onPointerMoveDrag}
      onPointerUp={onPointerUpDrag}
      onPointerCancel={onPointerUpDrag}
      className={`absolute top-1 bottom-1 rounded overflow-hidden border touch-none ${selected ? "border-white" : "border-black/30"} ${interactive ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ left, width: w, background: color + "22" }}
    >
      <div className="px-1.5 py-0.5 text-[10px] text-white/90 bg-black/30 flex items-center justify-between">
        <span className="truncate">{clip.name}</span>
      </div>
      {hasVideo && (
        <div
          className="absolute inset-x-0 pointer-events-none overflow-hidden border-b border-black/40"
          style={{ top: 16, height: VIDEO_STRIP_H, background: "#000" }}
        >
          <ClipVideoStrip clipId={clip.id} width={Math.max(1, w)} height={VIDEO_STRIP_H} offsetSec={clip.offset ?? 0} durationSec={clip.duration} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ top: 16 + VIDEO_STRIP_H }}>
        {clip.peaks && <WaveformView peaks={clip.peaks} width={Math.max(1, w)} height={Math.max(8, TRACK_H - 24 - VIDEO_STRIP_H)} color={color} offsetRatio={offsetRatio} spanRatio={spanRatio} />}
        {clip.notes && clip.notes.length > 0 && (
          <div className="absolute inset-1 rounded bg-purple-500/15 border border-purple-300/20 overflow-hidden">
            {clip.notes.map((n: MidiNote) => {
              const minPitch = Math.min(...clip.notes.map((x: MidiNote) => x.pitch));
              const maxPitch = Math.max(...clip.notes.map((x: MidiNote) => x.pitch));
              const range = Math.max(1, maxPitch - minPitch);
              const noteStartSec = n.start * (60 / Math.max(1, useDawStore.getState().transport.bpm));
              const noteLenSec = n.length * (60 / Math.max(1, useDawStore.getState().transport.bpm));
              return (
                <div
                  key={n.id}
                  className="absolute h-1 rounded-full bg-purple-200/85 shadow-[0_0_4px_rgba(216,180,254,0.7)]"
                  style={{
                    left: `${(noteStartSec / Math.max(0.25, clip.duration)) * 100}%`,
                    width: `${Math.max(3, (noteLenSec / Math.max(0.25, clip.duration)) * 100)}%`,
                    top: `${8 + (1 - (n.pitch - minPitch) / range) * 70}%`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* Left trim handle */}
      <div
        data-handle="resize-left"
        title="Drag to trim left edge"
        className="absolute top-0 left-0 bottom-0 w-2 bg-white/15 hover:bg-white/40"
        style={{ cursor: TRIM_LEFT_CURSOR }}
      />
      {/* Right trim handle */}
      <div
        data-handle="resize-right"
        title="Drag to trim right edge"
        className="absolute top-0 right-0 bottom-0 w-2 bg-white/15 hover:bg-white/40"
        style={{ cursor: TRIM_RIGHT_CURSOR }}
      />
    </div>
  );
}

const AUTO_LANE_H = 70;

function AutomationLaneHeader({ param, onSelect, onClose }: {
  param: "volume" | "pan";
  onSelect: (p: "volume" | "pan") => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-neutral-800 bg-neutral-950/60 flex items-center px-2 gap-1 text-[9px] uppercase tracking-wider text-neutral-400" style={{ height: AUTO_LANE_H }}>
      <span className="text-emerald-300">Automation</span>
      <select
        value={param}
        onChange={(e) => onSelect(e.target.value as "volume" | "pan")}
        className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 text-[9px] text-neutral-200"
      >
        <option value="volume">Volume</option>
        <option value="pan">Pan</option>
      </select>
      <div className="flex-1" />
      <button onClick={onClose} className="text-neutral-500 hover:text-red-400">×</button>
    </div>
  );
}

function AutomationLane({ track, width, pxPerSec, onAdd, onUpdate, onRemove }: {
  track: Track;
  width: number;
  pxPerSec: number;
  onAdd: (p: { t: number; v: number }) => void;
  onUpdate: (idx: number, patch: Partial<{ t: number; v: number }>) => void;
  onRemove: (idx: number) => void;
}) {
  const param = track.automationParam ?? "volume";
  const points = track.automation?.[param] ?? [];
  const isPan = param === "pan";
  const min = isPan ? -1 : 0;
  const max = 1;
  const h = AUTO_LANE_H;
  const ratioToY = (v: number) => h - ((v - min) / (max - min)) * h;
  const yToRatio = (y: number) => Math.max(min, Math.min(max, max - (y / h) * (max - min)));
  const dragRef = useRef<{ idx: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const formatVal = (v: number) => {
    if (isPan) {
      if (Math.abs(v) < 0.02) return "C";
      const pct = Math.round(Math.abs(v) * 100);
      return `${pct} ${v < 0 ? "L" : "R"}`;
    }
    const db = v <= 0.001 ? -Infinity : 20 * Math.log10(v);
    return isFinite(db) ? `${db.toFixed(1)} dB` : "-∞ dB";
  };

  const baseline = isPan ? (track.pan ?? 0) : (track.volume ?? 0.8);
  const linePts = points.length > 0
    ? points
    : [{ t: 0, v: baseline }, { t: width / pxPerSec, v: baseline }];

  const onLanePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.autoHit) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, (e.clientX - rect.left) / pxPerSec);
    const v = yToRatio(e.clientY - rect.top);
    onAdd({ t, v });
  };

  return (
    <div
      ref={containerRef}
      className="relative border-b border-neutral-800 bg-emerald-950/10 select-none"
      style={{ height: h, width }}
      onPointerDown={onLanePointerDown}
    >
      <div className="absolute left-0 right-0 border-t border-emerald-400/15" style={{ top: ratioToY(isPan ? 0 : 0.8) }} />

      <svg className="absolute inset-0 pointer-events-none" width={width} height={h}>
        <polyline
          points={linePts.map(p => `${p.t * pxPerSec},${ratioToY(p.v)}`).join(" ")}
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth={1.75}
        />
      </svg>

      {points.length >= 2 && points.slice(0, -1).map((p, i) => {
        const next = points[i + 1];
        const x1 = p.t * pxPerSec;
        const x2 = next.t * pxPerSec;
        const y1 = ratioToY(p.v);
        const y2 = ratioToY(next.v);
        const segLeft = Math.min(x1, x2);
        const segTop = Math.min(y1, y2) - 6;
        const segW = Math.max(2, Math.abs(x2 - x1));
        const segH = Math.abs(y2 - y1) + 12;
        return (
          <div
            key={`seg-${i}`}
            data-auto-hit="1"
            title="Drag to move segment"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const startY = e.clientY;
              const startV1 = p.v;
              const startV2 = next.v;
              const onMove = (ev: PointerEvent) => {
                const dy = ev.clientY - startY;
                const dv = -(dy / h) * (max - min);
                const nv1 = Math.max(min, Math.min(max, startV1 + dv));
                const nv2 = Math.max(min, Math.min(max, startV2 + dv));
                onUpdate(i, { v: nv1 });
                onUpdate(i + 1, { v: nv2 });
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setTip({
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                    text: formatVal((nv1 + nv2) / 2),
                  });
                }
              };
              const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                setTip(null);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
            className="absolute cursor-ns-resize"
            style={{ left: segLeft, top: segTop, width: segW, height: segH }}
          />
        );
      })}

      {points.map((p, i) => (
        <div
          key={i}
          data-auto-hit="1"
          onPointerDown={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { idx: i };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const parent = (e.currentTarget as HTMLElement).parentElement!;
            const rect = parent.getBoundingClientRect();
            const t = Math.max(0, (e.clientX - rect.left) / pxPerSec);
            const v = yToRatio(e.clientY - rect.top);
            onUpdate(dragRef.current.idx, { t, v });
            setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, text: formatVal(v) });
          }}
          onPointerUp={() => { dragRef.current = null; setTip(null); }}
          onPointerCancel={() => { dragRef.current = null; setTip(null); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(i); }}
          title={`${param} ${formatVal(p.v)} @ ${p.t.toFixed(2)}s — right-click to remove`}
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 border border-emerald-100 shadow cursor-move hover:scale-125"
          style={{ left: p.t * pxPerSec, top: ratioToY(p.v) }}
        />
      ))}

      {tip && (
        <div
          className="absolute z-30 px-1.5 py-0.5 rounded bg-neutral-900/95 border border-emerald-400/40 text-[10px] text-emerald-200 pointer-events-none whitespace-nowrap"
          style={{ left: tip.x + 10, top: tip.y - 22 }}
        >
          {tip.text}
        </div>
      )}

      {points.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-[10px] text-neutral-600 pointer-events-none">
          Click to add a {param} automation point — drag the line between points to move it
        </div>
      )}
    </div>
  );
}

