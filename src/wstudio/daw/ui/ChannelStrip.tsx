import { useDawStore } from "../state/DawStore";
import { Fader } from "./Fader";
import { Meter } from "./Meter";
import { Knob } from "./Knob";
import type { Track } from "../engine/types";
import type { DawEngine } from "../engine/DawEngine";

interface Props {
  track: Track;
  engine: DawEngine;
  onOpenFx: () => void;
}

export function ChannelStrip({ track, engine, onOpenFx }: Props) {
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const analyser = engine.getTrackAnalyser(track.id);

  return (
    <div
      onClick={() => selectTrack(track.id)}
      className={`w-24 shrink-0 bg-neutral-950 border-r border-neutral-800 px-2 py-3 flex flex-col items-center gap-2 cursor-pointer ${selectedTrackId === track.id ? "ring-1 ring-cyan-400/40 bg-neutral-900" : ""}`}
    >
      <div className="w-full h-1.5 rounded" style={{ background: track.color }} />
      <div className="text-[10px] text-neutral-300 truncate w-full text-center font-medium">{track.name}</div>

      {/* FX */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenFx(); }}
        className="text-[9px] uppercase tracking-wider text-neutral-400 border border-neutral-800 rounded px-2 py-0.5 hover:bg-neutral-800"
      >FX ({track.effects.length})</button>

      <Knob value={track.pan} min={-1} max={1} step={0.01} size={30} label="Pan" onChange={(v) => updateTrack(track.id, { pan: v })} color={track.color} />

      {/* Sends */}
      <div className="grid grid-cols-2 gap-1 w-full">
        <Knob value={track.reverbSend} min={0} max={1} step={0.01} size={26} label="Rvb" onChange={(v) => updateTrack(track.id, { reverbSend: v })} color="#a78bfa" />
        <Knob value={track.delaySend} min={0} max={1} step={0.01} size={26} label="Dly" onChange={(v) => updateTrack(track.id, { delaySend: v })} color="#f472b6" />
      </div>

      <div className="flex gap-1 mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { mute: !track.mute }); }}
          className={`w-7 h-5 rounded text-[9px] font-bold ${track.mute ? "bg-amber-500 text-black" : "bg-neutral-800 text-neutral-400"}`}
        >M</button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
          className={`w-7 h-5 rounded text-[9px] font-bold ${track.solo ? "bg-cyan-400 text-black" : "bg-neutral-800 text-neutral-400"}`}
        >S</button>
      </div>

      <div className="flex items-end gap-1 mt-1">
        <Fader value={track.volume} onChange={(v) => updateTrack(track.id, { volume: v })} color={track.color} />
        <Meter analyser={analyser} />
      </div>

      <div className="text-[9px] text-neutral-500 tabular-nums">
        {(20 * Math.log10(track.volume + 1e-9)).toFixed(1)} dB
      </div>
    </div>
  );
}
