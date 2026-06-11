import { useDawStore } from "../state/DawStore";
import { Fader, formatGainDb } from "./Fader";
import { Meter } from "./Meter";
import { Knob } from "./Knob";
import type { Track } from "../engine/types";
import type { DawEngine } from "../engine/DawEngine";

interface RowDef { key: string; label: string; h: number }
interface Props {
  track: Track;
  engine: DawEngine;
  onOpenFx: () => void;
  onArmToggle: (trackId: string) => void;
  rows?: RowDef[];
}

export function ChannelStrip({ track, engine, onOpenFx, onArmToggle, rows }: Props) {
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const clips = useDawStore(s => s.clips);
  const trackClips = clips.filter(c => c.trackId === track.id);
  const stereo = engine.getTrackStereoAnalysers(track.id);
  const mono = engine.getTrackAnalyser(track.id);
  const inputAn = engine.getTrackInputAnalyser(track.id);
  const isStereo = track.kind === "instrument" || trackClips.some(c => (c.buffer?.numberOfChannels ?? 0) >= 2);
  const canRecordInput = track.kind === "instrument" || (track.kind === "audio" && track.inputEnabled !== false && !(track.inputEnabled === undefined && trackClips.some(c => c.buffer && c.name !== "Recording")));
  // Vocal/input audio tracks show live mic input; imported beat/file tracks show playback only.
  // Audio input tracks show live mic meter; instrument & imported audio tracks show post-fader output.
  const meters = track.kind === "audio" && canRecordInput && inputAn
    ? [inputAn]
    : (isStereo && stereo ? [stereo.L, stereo.R] : mono ? [mono] : []);
  const isSel = selectedTrackId === track.id;

  // Logic-style stacked rows. If rows are supplied (from MixerView), align to those heights.
  const r = (key: string) => rows?.find(x => x.key === key)?.h ?? undefined;
  const Cell: any = ({ h, children, className = "", title }: any) => (
    <div title={title} className={`w-full border-b border-neutral-900 flex items-center justify-center px-1 ${className}`} style={{ height: h }}>{children}</div>
  );

  const dB = formatGainDb(track.volume);

  return (
    <div
      onClick={() => selectTrack(track.id)}
      title={`Channel: ${track.name}`}
      className={`w-24 shrink-0 bg-gradient-to-b from-neutral-900 to-neutral-950 border-r border-neutral-800 flex flex-col items-center cursor-pointer text-[10px] text-neutral-300 ${isSel ? "ring-1 ring-cyan-400/40" : ""}`}
    >
      {/* Track header */}
      <div className="h-6 w-full border-b border-neutral-800 flex items-center gap-1 px-1">
        <div className="w-1 h-3 rounded-sm" style={{ background: track.color }} />
        <div className="truncate flex-1 text-[9px] text-neutral-200">{track.name}</div>
      </div>
      {/* Setting */}
      <Cell h={r("setting")} title="Channel preset"><button onClick={(e)=>{e.stopPropagation();}} className="text-[9px] text-neutral-400 border border-neutral-800 rounded px-2 bg-neutral-950 hover:bg-neutral-800 w-full truncate">Setting</button></Cell>
      {/* EQ */}
      <Cell h={r("eq")} title="EQ display (click to open)">
        <button onClick={(e)=>{e.stopPropagation(); onOpenFx();}} className="w-full h-full grid place-items-center bg-neutral-950 border border-neutral-800 rounded">
          <svg width="60" height="28" viewBox="0 0 60 28"><path d="M0,14 Q15,2 30,14 T60,14" fill="none" stroke="#22d3ee" strokeWidth="1.2" /></svg>
        </button>
      </Cell>
      {/* Input */}
      <Cell h={r("input")} title="Audio input source"><div className="w-full h-full grid place-items-center bg-neutral-950 border border-neutral-800 rounded text-[9px]">{track.kind === "instrument" ? "Inst" : canRecordInput ? "In 1" : "File"}</div></Cell>
      {/* Audio FX */}
      <Cell h={r("fx")} title="Audio FX inserts">
        <button onClick={(e)=>{e.stopPropagation(); onOpenFx();}} className="w-full h-full bg-neutral-950 border border-neutral-800 rounded text-[9px] text-neutral-300 hover:bg-neutral-800 flex flex-col items-center justify-center gap-0.5">
          <div>FX</div>
          <div className="text-cyan-300/70 text-[9px]">{track.effects.length || "+"}</div>
        </button>
      </Cell>
      {/* Sends (Rvb / Dly) */}
      <Cell h={r("sends")}>
        <div className="grid grid-cols-2 gap-1 w-full">
          <div title="Reverb send"><Knob value={track.reverbSend} min={0} max={1} step={0.01} size={22} label="Rvb" onChange={(v) => updateTrack(track.id, { reverbSend: v })} color="#a78bfa" /></div>
          <div title="Delay send"><Knob value={track.delaySend} min={0} max={1} step={0.01} size={22} label="Dly" onChange={(v) => updateTrack(track.id, { delaySend: v })} color="#f472b6" /></div>
        </div>
      </Cell>
      {/* Output */}
      <Cell h={r("output")} title="Output bus"><div className="w-full h-full grid place-items-center bg-neutral-950 border border-neutral-800 rounded text-[9px]">St Out</div></Cell>
      {/* Group */}
      <Cell h={r("group")} title="Mix group"><div className="text-neutral-600 text-[9px]">—</div></Cell>
      {/* Automation */}
      <Cell h={r("auto")} title="Automation mode"><div className="text-emerald-400 text-[9px]">Read</div></Cell>
      {/* Pan */}
      <Cell h={r("pan")} title={`Pan ${track.pan < 0 ? "L" : track.pan > 0 ? "R" : "C"} ${Math.abs(track.pan * 100).toFixed(0)}%`}>
        <Knob value={track.pan} min={-1} max={1} step={0.01} size={30} label="L  R" onChange={(v) => updateTrack(track.id, { pan: v })} color={track.color} />
      </Cell>
      {/* dB readout */}
      <Cell h={r("db")} title="Fader level (dB)">
        <div className="tabular-nums text-[9px] text-neutral-300 bg-black/50 px-1.5 rounded border border-neutral-800">{dB}</div>
      </Cell>
      {/* Fader + Meter + M/S + R/I */}
      <div className="w-full flex flex-col items-center py-2" style={{ height: r("fader") ?? 220 }}>
        <div className="flex items-end gap-1 flex-1">
          <Fader value={track.volume} onChange={(v) => updateTrack(track.id, { volume: v })} color={track.color} height={160} />
          <div className="flex items-end gap-0.5">
            {meters.length ? meters.map((meter, i) => (
              <Meter key={i} analyser={meter} height={160} width={meters.length === 2 ? 5 : 8} />
            )) : <Meter analyser={null} height={160} />}
          </div>
        </div>
        <div className="flex gap-1 mt-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!canRecordInput) return;
              onArmToggle(track.id);
            }}
            disabled={!canRecordInput}
            title={canRecordInput ? "Record-arm" : "Playback-only imported audio"}
            className={`w-5 h-4 rounded text-[8px] font-bold border ${canRecordInput && track.armed ? "bg-red-500 text-white border-red-400" : canRecordInput ? "bg-neutral-900 text-neutral-400 border-neutral-800" : "bg-neutral-950 text-neutral-700 border-neutral-900 cursor-not-allowed"}`}
          >R</button>
          <button title="Input monitor" className="w-5 h-4 rounded text-[8px] font-bold border bg-neutral-900 text-neutral-400 border-neutral-800">I</button>
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { mute: !track.mute }); }}
            title="Mute"
            className={`w-5 h-4 rounded text-[8px] font-bold border ${track.mute ? "bg-amber-500 text-black border-amber-400" : "bg-neutral-900 text-neutral-400 border-neutral-800"}`}
          >M</button>
          <button
            onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
            title="Solo"
            className={`w-5 h-4 rounded text-[8px] font-bold border ${track.solo ? "bg-cyan-400 text-black border-cyan-300" : "bg-neutral-900 text-neutral-400 border-neutral-800"}`}
          >S</button>
        </div>
      </div>
    </div>
  );
}
