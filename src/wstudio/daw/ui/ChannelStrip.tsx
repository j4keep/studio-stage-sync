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
      title={`Channel: ${track.name}`}
      className={`w-24 shrink-0 bg-gradient-to-b from-neutral-900 to-neutral-950 border-r border-neutral-800 px-2 py-3 flex flex-col items-center gap-2 cursor-pointer ${selectedTrackId === track.id ? "ring-1 ring-cyan-400/40 from-neutral-800 to-neutral-900" : ""}`}
    >
      <div className="w-full h-1.5 rounded shadow-inner shadow-black/40" style={{ background: track.color }} title="Track color" />
      <div className="text-[10px] text-neutral-300 truncate w-full text-center font-medium" title={track.name}>{track.name}</div>

      {/* FX */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenFx(); }}
        title="Open FX rack — add EQ, compressor, reverb, plug-ins…"
        className="text-[9px] uppercase tracking-wider text-neutral-400 border border-neutral-800 rounded px-2 py-0.5 hover:bg-neutral-800 bg-neutral-950 shadow-inner shadow-black/40"
      >FX ({track.effects.length})</button>

      <div title={`Pan: ${track.pan < 0 ? "L" : track.pan > 0 ? "R" : "C"} ${Math.abs(track.pan * 100).toFixed(0)}%`}>
        <Knob value={track.pan} min={-1} max={1} step={0.01} size={30} label="L  R" onChange={(v) => updateTrack(track.id, { pan: v })} color={track.color} />
      </div>

      {/* Sends */}
      <div className="grid grid-cols-2 gap-1 w-full">
        <div title="Reverb send level"><Knob value={track.reverbSend} min={0} max={1} step={0.01} size={26} label="Rvb" onChange={(v) => updateTrack(track.id, { reverbSend: v })} color="#a78bfa" /></div>
        <div title="Delay send level"><Knob value={track.delaySend} min={0} max={1} step={0.01} size={26} label="Dly" onChange={(v) => updateTrack(track.id, { delaySend: v })} color="#f472b6" /></div>
      </div>

      <div className="flex gap-1 mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { mute: !track.mute }); }}
          title="Mute this track"
          className={`w-7 h-5 rounded text-[9px] font-bold border ${track.mute ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "bg-neutral-900 text-neutral-400 border-neutral-800"}`}
        >M</button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
          title="Solo this track"
          className={`w-7 h-5 rounded text-[9px] font-bold border ${track.solo ? "bg-cyan-400 text-black border-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "bg-neutral-900 text-neutral-400 border-neutral-800"}`}
        >S</button>
      </div>

      <div className="flex items-end gap-1 mt-1" title="Channel fader and level meter">
        <Fader value={track.volume} onChange={(v) => updateTrack(track.id, { volume: v })} color={track.color} />
        <Meter analyser={analyser} />
      </div>

      <div className="text-[9px] text-neutral-500 tabular-nums" title="Fader level in decibels">
        {(20 * Math.log10(track.volume + 1e-9)).toFixed(1)} dB
      </div>
    </div>
  );
}
