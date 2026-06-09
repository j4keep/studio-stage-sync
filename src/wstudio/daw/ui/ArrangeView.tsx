import { useEffect, useRef, useState } from "react";
import { useDawStore } from "../state/DawStore";
import { WaveformView } from "./WaveformView";
import { Trash2, Lock, Mic, Volume2, Headphones } from "lucide-react";
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineLen = Math.max(60, ...clips.map(c => c.startTime + c.duration)) + 20;

  const handleRulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    setTransport({ position: Math.max(0, x / pxPerSec) });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-900">
      {/* Toolbar */}
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 gap-3 text-[10px] text-neutral-400">
        <span className="uppercase tracking-wider">Arrange</span>
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
          <div className="sticky left-0 z-10 bg-neutral-950 border-r border-neutral-800" style={{ width: HEADER_W }}>
            {/* spacer for ruler */}
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
              />
            ))}
            {tracks.length === 0 && (
              <div className="p-6 text-center text-neutral-500 text-xs">
                Add a track to begin.
              </div>
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
              {/* Playhead */}
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
              >
                {/* grid */}
                {Array.from({ length: Math.ceil(timelineLen) }).map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-neutral-900" style={{ left: i * pxPerSec }} />
                ))}
                {/* clips */}
                {clips.filter(c => c.trackId === t.id).map(c => (
                  <ClipBlock
                    key={c.id}
                    clip={c}
                    color={t.color}
                    pxPerSec={pxPerSec}
                    selected={selectedClipId === c.id}
                    onSelect={() => selectClip(c.id)}
                    onMove={(dx) => updateClip(c.id, { startTime: Math.max(0, c.startTime + dx) })}
                    onDelete={() => removeClip(c.id)}
                    onSplitAtPlayhead={() => splitClipAt(c.id, transport.position)}
                  />
                ))}
              </div>
            ))}
            {/* Playhead through lanes */}
            <div
              className="absolute top-8 bottom-0 w-px bg-emerald-400/70 pointer-events-none z-20"
              style={{ left: transport.position * pxPerSec }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackHeader({ track, onArm, onMute, onSolo, onRemove, onRename, onVolume, onPan }: {
  track: Track;
  onArm: () => void;
  onMute: () => void;
  onSolo: () => void;
  onRemove: () => void;
  onRename: (n: string) => void;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
}) {
  return (
    <div className="border-b border-neutral-800 flex" style={{ height: TRACK_H }}>
      <div className="w-1.5" style={{ background: track.color }} />
      <div className="flex-1 p-2 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <input
            value={track.name}
            onChange={(e) => onRename(e.target.value)}
            className="flex-1 bg-transparent text-xs text-neutral-200 border-none outline-none min-w-0"
          />
          <button onClick={onRemove} className="text-neutral-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onArm} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold ${track.armed ? "bg-red-500 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>R</button>
          <button onClick={onMute} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold ${track.mute ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>M</button>
          <button onClick={onSolo} className={`w-5 h-5 grid place-items-center rounded text-[9px] font-bold ${track.solo ? "bg-cyan-400 text-black" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}>S</button>
          <input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => onVolume(Number(e.target.value))} className="flex-1 accent-cyan-500 h-1" />
        </div>
        <input type="range" min={-1} max={1} step={0.01} value={track.pan} onChange={(e) => onPan(Number(e.target.value))} className="w-full accent-neutral-400 h-1" />
      </div>
    </div>
  );
}

function ClipBlock({ clip, color, pxPerSec, selected, onSelect, onMove, onDelete, onSplitAtPlayhead }: any) {
  const startX = useRef(0);
  const startTime = useRef(0);
  const w = clip.duration * pxPerSec;
  const left = clip.startTime * pxPerSec;

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        startX.current = e.clientX;
        startTime.current = clip.startTime;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1)) return;
        const dx = (e.clientX - startX.current) / pxPerSec;
        onMove(dx + (clip.startTime - startTime.current) - (clip.startTime - startTime.current));
        // We want delta from original startTime; easier:
      }}
      className={`absolute top-1 bottom-1 rounded overflow-hidden border ${selected ? "border-white" : "border-black/30"} cursor-grab active:cursor-grabbing`}
      style={{ left, width: w, background: color + "22" }}
    >
      <div className="px-1.5 py-0.5 text-[10px] text-white/90 bg-black/30 flex items-center justify-between">
        <span className="truncate">{clip.name}</span>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onSplitAtPlayhead(); }} title="Split at playhead" className="text-white/60 hover:text-white text-[10px]">⫶</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-white/60 hover:text-red-300"><Trash2 className="w-2.5 h-2.5" /></button>
        </div>
      </div>
      <div className="absolute inset-x-0 top-4 bottom-0">
        {clip.peaks && <WaveformView peaks={clip.peaks} width={Math.max(1, w)} height={TRACK_H - 24} color={color} />}
      </div>
    </div>
  );
}
