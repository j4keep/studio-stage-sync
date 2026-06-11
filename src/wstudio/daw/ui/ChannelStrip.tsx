import { useState } from "react";
import { useDawStore } from "../state/DawStore";
import { Fader, formatGainDb } from "./Fader";
import { Meter } from "./Meter";
import { Knob } from "./Knob";
import { EFFECT_META } from "../engine/Effects";
import type { Track, EffectId } from "../engine/types";
import type { DawEngine } from "../engine/DawEngine";

interface RowDef { key: string; label: string; h: number }
interface Props {
  track: Track;
  engine: DawEngine;
  onOpenPlugin: (effectId: string) => void;
  onArmToggle: (trackId: string) => void;
  rows?: RowDef[];
}

const FX_LIST: EffectId[] = ["eq3", "compressor", "reverb", "delay", "chorus", "distortion", "limiter", "pitch"];
const INSERT_SLOTS = 5;


export function ChannelStrip({ track, engine, onOpenPlugin, onArmToggle, rows }: Props) {
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const replaceEffectAtSlot = useDawStore(s => s.replaceEffectAtSlot);
  const clips = useDawStore(s => s.clips);
  const trackClips = clips.filter(c => c.trackId === track.id);
  const [openSlot, setOpenSlot] = useState<number | null>(null);

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
      <Cell h={r("eq")} title="EQ display">
        <div className="w-full h-full grid place-items-center bg-neutral-950 border border-neutral-800 rounded">
          <svg width="60" height="28" viewBox="0 0 60 28"><path d="M0,14 Q15,2 30,14 T60,14" fill="none" stroke="#22d3ee" strokeWidth="1.2" /></svg>
        </div>
      </Cell>
      {/* Input */}
      <Cell h={r("input")} title="Audio input source"><div className="w-full h-full grid place-items-center bg-neutral-950 border border-neutral-800 rounded text-[9px]">{track.kind === "instrument" ? "Inst" : canRecordInput ? "In 1" : "File"}</div></Cell>
      {/* Audio FX — 5 insert slots (Logic-style). Click empty = pick plug-in.
           Click filled = open floating plug-in window. Use the chevron to swap/remove. */}
      <Cell h={r("fx")} title="Audio FX inserts">
        <div className="w-full h-full flex flex-col gap-[2px] justify-between py-[1px]">
          {Array.from({ length: INSERT_SLOTS }).map((_, slotIndex) => {
            const fx = track.effects[slotIndex];
            const meta = fx ? EFFECT_META[fx.type as keyof typeof EFFECT_META] : null;
            const isOpen = openSlot === slotIndex;
            const usedTypes = new Set(track.effects.map(e => e.type as EffectId));
            return (
              <div key={slotIndex} className="relative flex-1 min-h-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fx) onOpenPlugin(fx.id);
                    else setOpenSlot(v => v === slotIndex ? null : slotIndex);
                  }}
                  className={`w-full h-full rounded-[3px] flex items-center justify-between gap-1 px-1.5 text-[9px] border ${fx ? "bg-sky-500/80 border-sky-400 text-white" : "bg-neutral-900/80 border-neutral-700 text-neutral-500 hover:bg-neutral-800"}`}
                >
                  <span className="truncate flex-1 text-left">{meta ? meta.label : ""}</span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setOpenSlot(v => v === slotIndex ? null : slotIndex); }}
                    className="text-[8px] opacity-70 hover:opacity-100 cursor-pointer"
                  >▾</span>
                </button>
                {isOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenSlot(null); }} />
                    <div className="absolute left-full ml-1 top-0 z-50 w-40 bg-neutral-900 border border-neutral-700 rounded shadow-2xl py-1 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                        Insert {slotIndex + 1}
                      </div>
                      <button
                        onClick={() => { replaceEffectAtSlot(track.id, slotIndex, null); setOpenSlot(null); }}
                        className="w-full text-left px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-800"
                      >No plug-in</button>
                      <div className="border-t border-neutral-800 my-0.5" />
                      {FX_LIST.map(t => {
                        const disabled = usedTypes.has(t) && fx?.type !== t;
                        return (
                          <button
                            key={t}
                            disabled={disabled}
                            onClick={() => {
                              const id = replaceEffectAtSlot(track.id, slotIndex, t);
                              setOpenSlot(null);
                              if (id) onOpenPlugin(id);
                            }}
                            className={`w-full text-left px-2 py-1 text-[11px] ${disabled ? "text-neutral-700 cursor-not-allowed" : fx?.type === t ? "text-sky-300 bg-sky-500/10" : "text-neutral-200 hover:bg-sky-500/20"}`}
                          >{EFFECT_META[t].label}{disabled ? " · in use" : ""}</button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
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
