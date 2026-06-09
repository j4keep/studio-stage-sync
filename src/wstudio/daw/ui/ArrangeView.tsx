import { useRef, useState, useMemo } from "react";
import { useDawStore } from "../state/DawStore";
import { WaveformView } from "./WaveformView";
import { Knob } from "./Knob";
import { Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { Track, Clip } from "../engine/types";

interface Props {
  onArmToggle: (trackId: string) => void;
  onSeek?: (position: number) => void;
}

const HEADER_W = 200;
const TRACK_H = 80;
const RULER_H = 32;

const TOOL_CURSORS: Record<string, string> = {
  pointer: "default",
  pencil: "crosshair",
  eraser: "not-allowed",
  scissors: "crosshair",
  glue: "cell",
  mute: "pointer",
  zoom: "zoom-in",
  fade: "ew-resize",
  marquee: "crosshair",
};

export function ArrangeView({ onArmToggle, onSeek }: Props) {
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
  const reorderTracks = useDawStore(s => s.reorderTracks);
  const moveClipToTrack = useDawStore(s => s.moveClipToTrack);
  const copyClip = useDawStore(s => s.copyClip);
  const cutClip = useDawStore(s => s.cutClip);
  const pasteClipAt = useDawStore(s => s.pasteClipAt);
  const duplicateClip = useDawStore(s => s.duplicateClip);
  const addClip = useDawStore(s => s.addClip);
  const tool = useDawStore(s => s.tool);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
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
    onSeek?.(next) ?? setTransport({ position: next });
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

  // Clip drag state (pointer-based; supports cross-track move)
  const clipDrag = useRef<{
    clipId: string;
    startX: number; startY: number;
    startTime: number; startTrackId: string; startTrackIdx: number;
    mode: "move" | "resize";
    startDur: number;
  } | null>(null);

  const beginClipDrag = (clip: Clip, e: React.PointerEvent, mode: "move" | "resize") => {
    const idx = trackIndexById.get(clip.trackId) ?? 0;
    clipDrag.current = {
      clipId: clip.id, startX: e.clientX, startY: e.clientY,
      startTime: clip.startTime, startTrackId: clip.trackId, startTrackIdx: idx,
      mode, startDur: clip.duration,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onClipDragMove = (e: React.PointerEvent) => {
    const d = clipDrag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / pxPerSec;
    if (d.mode === "resize") {
      updateClip(d.clipId, { duration: Math.max(0.05, d.startDur + dx) });
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
  const endClipDrag = () => { clipDrag.current = null; };

  // Tool actions on a clip click
  const applyToolToClip = (clip: Clip, e: React.MouseEvent) => {
    switch (tool) {
      case "eraser":
        removeClip(clip.id); return true;
      case "scissors": {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const t = clip.startTime + (e.clientX - rect.left) / pxPerSec;
        splitClipAt(clip.id, t); return true;
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
          updateClip(clip.id, { duration: Math.max(clip.duration, next.startTime + next.duration - clip.startTime) });
          removeClip(next.id);
          toast.success("Glued clips");
        }
        return true;
      }
      case "zoom":
        setPxPerSec(e.altKey ? pxPerSec / 1.5 : pxPerSec * 1.5); return true;
      case "fade":
        toast("Drag clip edges to set fade length"); return false;
    }
    return false;
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-neutral-900"
      onClick={() => setCtxMenu(null)}
      style={{ cursor: TOOL_CURSORS[tool] }}
    >
      {/* Toolbar */}
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 gap-3 text-[10px] text-neutral-400">
        <span className="uppercase tracking-wider">Arrange</span>
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
        />
      </div>

      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div className="flex" style={{ minWidth: HEADER_W + timelineLen * pxPerSec }}>
          {/* Track headers column */}
          <div className="sticky left-0 z-10 bg-neutral-950 border-r border-neutral-800 overflow-hidden" style={{ width: HEADER_W }}>
            <div style={{ height: RULER_H }} className="border-b border-neutral-800" />
            {tracks.map(t => (
              <TrackHeader
                key={t.id}
                track={t}
                onArm={() => onArmToggle(t.id)}
                onMute={() => updateTrack(t.id, { mute: !t.mute })}
                onSolo={() => updateTrack(t.id, { solo: !t.solo })}
                onRemove={() => removeTrack(t.id)}
                onRename={(n) => updateTrack(t.id, { name: n })}
                onVolume={(v) => updateTrack(t.id, { volume: v })}
                onPan={(v) => updateTrack(t.id, { pan: v })}
                onDropTrack={(fromId) => reorderTracks(fromId, t.id)}
              />
            ))}
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

              <PlayheadMarker pxPerSec={pxPerSec} ruler />
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
              <div
                key={t.id}
                className="relative border-b border-neutral-800"
                style={{ height: TRACK_H, background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(0,0,0,0))" }}
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
                  pasteClipAt(t.id, time);
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
                    onPointerDownDrag={(e: React.PointerEvent, mode: "move" | "resize") => beginClipDrag(c, e, mode)}
                    onPointerMoveDrag={onClipDragMove}
                    onPointerUpDrag={endClipDrag}
                  />
                ))}
              </div>
            ))}
            <PlayheadMarker pxPerSec={pxPerSec} />
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
            { label: "Cut", sc: "⌘X", action: () => cutClip(ctxMenu.clipId) },
            { label: "Copy", sc: "⌘C", action: () => { copyClip(ctxMenu.clipId); toast.success("Copied"); } },
            { label: "Duplicate", sc: "⌘D", action: () => duplicateClip(ctxMenu.clipId) },
            { label: "Split at playhead", sc: "", action: () => splitClipAt(ctxMenu.clipId, useDawStore.getState().transport.position) },
            { label: "Delete", sc: "Del", action: () => removeClip(ctxMenu.clipId) },
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

function TrackHeader({ track, onArm, onMute, onSolo, onRemove, onRename, onVolume, onPan, onDropTrack }: {
  track: Track;
  onArm: () => void;
  onMute: () => void;
  onSolo: () => void;
  onRemove: () => void;
  onRename: (n: string) => void;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
  onDropTrack: (fromId: string) => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const db = track.volume <= 0.001 ? "-∞" : (20 * Math.log10(track.volume)).toFixed(1);
  const panLabel = track.pan < -0.01 ? `L ${Math.round(Math.abs(track.pan) * 100)}` : track.pan > 0.01 ? `R ${Math.round(track.pan * 100)}` : "C";
  return (
    <div
      className="border-b border-neutral-800 flex overflow-hidden"
      style={{ height: TRACK_H }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-daw-track")) e.preventDefault(); }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("application/x-daw-track");
        if (id && id !== track.id) onDropTrack(id);
      }}
    >
      <div className="w-1.5 shrink-0" style={{ background: track.color }} />
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("application/x-daw-track", track.id)}
        className="w-4 shrink-0 grid place-items-center cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-300"
        title="Drag to reorder track"
      ><GripVertical className="w-3 h-3" /></div>
      <div className="flex-1 p-2 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <input
            value={track.name}
            onChange={(e) => onRename(e.target.value)}
            onPointerDown={stop}
            onMouseDown={stop}
            className="flex-1 min-w-0 bg-transparent text-xs text-neutral-200 border-none outline-none"
          />
          <button onPointerDown={stop} onClick={onRemove} className="text-neutral-500 hover:text-red-400 shrink-0"><Trash2 className="w-3 h-3" /></button>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <button onPointerDown={stop} onClick={onArm} title="Record-arm" className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.armed ? "bg-red-500 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>R</button>
          <button onPointerDown={stop} onClick={onMute} title="Mute" className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.mute ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>M</button>
          <button onPointerDown={stop} onClick={onSolo} title="Solo" className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.solo ? "bg-cyan-400 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>S</button>
          <button onPointerDown={stop} title="Input monitor" className="w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 bg-neutral-800 text-neutral-400 hover:bg-neutral-700">I</button>
          <div className="ml-auto flex items-center gap-0.5" onPointerDown={stop} onClick={stop} title="Volume buttons">
            <button type="button" onClick={() => onVolume(Math.max(0, track.volume - 0.03))} className="h-5 w-5 rounded-l border border-neutral-800 bg-gradient-to-b from-neutral-800 to-neutral-950 text-neutral-300 hover:text-cyan-300">−</button>
            <button type="button" onDoubleClick={() => onVolume(0.8)} className="h-5 w-12 border-y border-neutral-800 bg-black/50 text-[9px] tabular-nums text-emerald-300">{db}</button>
            <button type="button" onClick={() => onVolume(Math.min(1, track.volume + 0.03))} className="h-5 w-5 rounded-r border border-neutral-800 bg-gradient-to-b from-neutral-800 to-neutral-950 text-neutral-300 hover:text-cyan-300">+</button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1" onPointerDown={stop} onClick={stop} title="Pan L/R">
            <span className="text-[9px] text-neutral-500">L</span>
            <Knob value={track.pan} min={-1} max={1} step={0.01} size={28} onChange={onPan} color={track.color} showValue={false} />
            <span className="text-[9px] text-neutral-500">R</span>
          </div>
          <button type="button" onPointerDown={stop} onClick={() => onPan(0)} className="h-5 w-14 rounded border border-neutral-800 bg-neutral-900 text-[9px] tabular-nums text-neutral-300 hover:text-cyan-300" title="Center pan">{panLabel}</button>
        </div>
      </div>
    </div>
  );
}

function PlayheadMarker({ pxPerSec, ruler = false }: { pxPerSec: number; ruler?: boolean }) {
  const position = useDawStore(s => s.transport.position);
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
      style={{ transform: `translate3d(${position * pxPerSec}px, 0, 0)`, top: RULER_H, bottom: 0 }}
    />
  );
}

function ClipBlock({ clip, color, pxPerSec, selected, tool, onSelect, onContext, onToolApply, onPointerDownDrag, onPointerMoveDrag, onPointerUpDrag }: any) {
  const w = clip.duration * pxPerSec;
  const left = clip.startTime * pxPerSec;
  const interactive = tool === "pointer";

  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); onContext(e.clientX, e.clientY); }}
      onClick={(e) => {
        e.stopPropagation();
        if (tool !== "pointer") { onToolApply(e); return; }
        onSelect();
      }}
      onPointerDown={(e) => {
        if (!interactive || e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        const target = e.target as HTMLElement;
        const mode = target.dataset.handle === "resize" ? "resize" : "move";
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
      <div className="absolute inset-x-0 top-4 bottom-0 pointer-events-none">
        {clip.peaks && <WaveformView peaks={clip.peaks} width={Math.max(1, w)} height={TRACK_H - 24} color={color} />}
      </div>
      <div data-handle="resize" className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20 hover:bg-white/40" />
    </div>
  );
}
