import { useRef, useState } from "react";
import { useDawStore } from "../state/DawStore";
import { WaveformView } from "./WaveformView";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "../engine/types";

interface Props {
  onArmToggle: (trackId: string) => void;
}

const HEADER_W = 200;
const TRACK_H = 80;

export function ArrangeView({ onArmToggle }: Props) {
  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const transport = useDawStore(s => s.transport);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const timelineLen = Math.max(60, ...clips.map(c => c.startTime + c.duration)) + 20;

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setTransport({ position: Math.max(0, x / pxPerSec) });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900" onClick={() => setCtxMenu(null)}>
      {/* Toolbar */}
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 gap-3 text-[10px] text-neutral-400">
        <span className="uppercase tracking-wider">Arrange</span>
        <span className="text-neutral-600">Space play · Shift+Space stop · Enter rewind · R record · ⌘C/V/X · ⌘D dup · Del</span>
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
            <div className="h-8 border-b border-neutral-800" />
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
            {/* Ruler */}
            <div
              className="h-8 border-b border-neutral-800 bg-neutral-950 relative cursor-pointer"
              onClick={handleRulerClick}
              style={{ width: timelineLen * pxPerSec }}
            >
              {Array.from({ length: Math.ceil(timelineLen) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-neutral-800 text-[9px] text-neutral-500 pl-1"
                  style={{ left: i * pxPerSec }}
                >
                  {i % 5 === 0 ? `${i}s` : ""}
                </div>
              ))}
              <div
                className="absolute top-0 bottom-0 w-px bg-emerald-400 pointer-events-none z-30"
                style={{ left: transport.position * pxPerSec }}
              >
                <div className="w-2 h-2 bg-emerald-400 -translate-x-1/2 rotate-45" />
              </div>
            </div>

            {/* Track lanes */}
            {tracks.map(t => (
              <div
                key={t.id}
                className="relative border-b border-neutral-800"
                style={{ height: TRACK_H, background: "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(0,0,0,0))" }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const clipId = e.dataTransfer.getData("application/x-daw-clip");
                  if (clipId) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const newStart = Math.max(0, (e.clientX - rect.left) / pxPerSec);
                    moveClipToTrack(clipId, t.id);
                    updateClip(clipId, { startTime: newStart });
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  // empty-lane paste
                  const rect = e.currentTarget.getBoundingClientRect();
                  const time = Math.max(0, (e.clientX - rect.left) / pxPerSec);
                  pasteClipAt(t.id, time);
                }}
              >
                {Array.from({ length: Math.ceil(timelineLen) }).map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-neutral-900" style={{ left: i * pxPerSec }} />
                ))}
                {clips.filter(c => c.trackId === t.id).map(c => (
                  <ClipBlock
                    key={c.id}
                    clip={c}
                    color={t.color}
                    pxPerSec={pxPerSec}
                    selected={selectedClipId === c.id}
                    onSelect={() => selectClip(c.id)}
                    onMoveTo={(tt) => updateClip(c.id, { startTime: Math.max(0, tt) })}
                    onResize={(d) => updateClip(c.id, { duration: Math.max(0.05, d) })}
                    onContext={(x, y) => setCtxMenu({ x, y, clipId: c.id })}
                  />
                ))}
              </div>
            ))}
            <div
              className="absolute top-8 bottom-0 w-px bg-emerald-400/70 pointer-events-none z-20"
              style={{ left: transport.position * pxPerSec }}
            />
          </div>
        </div>
      </div>

      {ctxMenu && (
        <div
          className="fixed z-50 bg-neutral-950 border border-neutral-800 rounded shadow-xl py-1 text-xs text-neutral-200 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "Cut", sc: "⌘X", action: () => cutClip(ctxMenu.clipId) },
            { label: "Copy", sc: "⌘C", action: () => { copyClip(ctxMenu.clipId); toast.success("Copied"); } },
            { label: "Duplicate", sc: "⌘D", action: () => duplicateClip(ctxMenu.clipId) },
            { label: "Split at playhead", sc: "", action: () => splitClipAt(ctxMenu.clipId, transport.position) },
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
  return (
    <div
      className="border-b border-neutral-800 flex overflow-hidden"
      style={{ height: TRACK_H }}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("application/x-daw-track", track.id)}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-daw-track")) e.preventDefault(); }}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("application/x-daw-track");
        if (id && id !== track.id) onDropTrack(id);
      }}
    >
      <div className="w-1.5 shrink-0 cursor-grab" style={{ background: track.color }} title="Drag to reorder" />
      <div className="flex-1 p-2 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <input
            value={track.name}
            onChange={(e) => onRename(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-xs text-neutral-200 border-none outline-none"
          />
          <button onClick={onRemove} className="text-neutral-500 hover:text-red-400 shrink-0"><Trash2 className="w-3 h-3" /></button>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={onArm} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.armed ? "bg-red-500 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>R</button>
          <button onClick={onMute} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.mute ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>M</button>
          <button onClick={onSolo} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold shrink-0 ${track.solo ? "bg-cyan-400 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>S</button>
          <input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => onVolume(Number(e.target.value))} className="min-w-0 flex-1 accent-cyan-500 h-1" />
        </div>
        <input type="range" min={-1} max={1} step={0.01} value={track.pan} onChange={(e) => onPan(Number(e.target.value))} className="w-full accent-neutral-400 h-1" />
      </div>
    </div>
  );
}

function ClipBlock({ clip, color, pxPerSec, selected, onSelect, onMoveTo, onResize, onContext }: any) {
  const startX = useRef(0);
  const startTime = useRef(0);
  const startDur = useRef(0);
  const mode = useRef<"move" | "resize" | null>(null);
  const w = clip.duration * pxPerSec;
  const left = clip.startTime * pxPerSec;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-daw-clip", clip.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(); onContext(e.clientX, e.clientY); }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onSelect();
        startX.current = e.clientX;
        startTime.current = clip.startTime;
        startDur.current = clip.duration;
        const target = e.target as HTMLElement;
        mode.current = target.dataset.handle === "resize" ? "resize" : "move";
        target.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1) || !mode.current) return;
        const dx = (e.clientX - startX.current) / pxPerSec;
        if (mode.current === "move") onMoveTo(startTime.current + dx);
        else onResize(startDur.current + dx);
      }}
      onPointerUp={() => { mode.current = null; }}
      className={`absolute top-1 bottom-1 rounded overflow-hidden border ${selected ? "border-white" : "border-black/30"} cursor-grab active:cursor-grabbing`}
      style={{ left, width: w, background: color + "22" }}
    >
      <div className="px-1.5 py-0.5 text-[10px] text-white/90 bg-black/30 flex items-center justify-between">
        <span className="truncate">{clip.name}</span>
      </div>
      <div className="absolute inset-x-0 top-4 bottom-0 pointer-events-none">
        {clip.peaks && <WaveformView peaks={clip.peaks} width={Math.max(1, w)} height={TRACK_H - 24} color={color} />}
      </div>
      {/* resize handle */}
      <div data-handle="resize" className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20 hover:bg-white/40" />
    </div>
  );
}
