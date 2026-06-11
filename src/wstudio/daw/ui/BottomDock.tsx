import { useEffect, useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { useDawStore } from "../state/DawStore";
import { InstrumentPanel } from "./InstrumentPanel";
import { FxRack } from "./FxRack";
import type { DawEngine } from "../engine/DawEngine";
import { triggerSynthNote, triggerDrumHit } from "../engine/DawEngine";

type Tab = "instrument" | "patterns" | "pianoroll" | "effects";

export function BottomDock({
  engine,
  open,
  tab,
  onTab,
  onClose,
}: {
  engine: DawEngine;
  open: boolean;
  tab: Tab;
  onTab: (t: Tab) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const active = tracks.find(t => t.id === selectedTrackId) ?? tracks.find(t => t.kind === "instrument") ?? null;

  if (!open) return null;

  const height = expanded ? "70vh" : "44vh";

  return (
    <div
      className="absolute left-0 right-0 bottom-0 bg-neutral-950 border-t border-neutral-800 z-30 flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
      style={{ height }}
    >
      <div className="h-10 border-b border-neutral-800 flex items-center px-3 gap-1 shrink-0">
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 mr-2"><X className="w-4 h-4" /></button>
        {(["instrument","patterns","pianoroll","effects"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`px-3 h-7 text-[12px] capitalize rounded ${tab === t ? "text-cyan-300 border-b-2 border-cyan-300" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            {t === "pianoroll" ? "Piano Roll" : t}
          </button>
        ))}
        <div className="flex-1" />
        <div className="text-[10px] text-neutral-500 truncate max-w-[200px]">{active ? active.name : "No track selected"}</div>
        <button onClick={() => setExpanded(v => !v)} className="text-neutral-500 hover:text-neutral-200 ml-2">
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "instrument" && <InstrumentPanel engine={engine} />}
        {tab === "patterns" && <PatternsView engine={engine} />}
        {tab === "pianoroll" && <PianoRollView engine={engine} />}
        {tab === "effects" && (active
          ? <FxRackEmbedded trackId={active.id} />
          : <div className="grid place-items-center h-full text-neutral-600 text-sm">Select a track</div>)}
      </div>
    </div>
  );
}

// 16-step drum sequencer that always shows even if track is synth
function PatternsView({ engine }: { engine: DawEngine }) {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const drumTracks = tracks.filter(t => t.kind === "instrument" && t.instrument === "drum");
  const active = drumTracks.find(t => t.id === selectedTrackId) ?? drumTracks[0] ?? null;

  const ROWS = ["kick","snare","hat","clap","tom","perc","ride","crash"] as const;
  type Row = typeof ROWS[number];
  const playable: Row[] = ["kick","snare","hat","clap"];

  const [bars, setBars] = useState(2);
  const stepCount = 16 * bars;
  const [steps, setSteps] = useState<Record<Row, boolean[]>>(() =>
    Object.fromEntries(ROWS.map(r => [r, Array(stepCount).fill(false)])) as Record<Row, boolean[]>
  );
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setSteps(s => Object.fromEntries(ROWS.map(r => [r, [...(s[r]||[]), ...Array(Math.max(0, stepCount - (s[r]?.length||0))).fill(false)].slice(0, stepCount)])) as Record<Row, boolean[]>);
  }, [stepCount]);

  useEffect(() => {
    if (!playing || !active) return;
    const bpm = useDawStore.getState().transport.bpm;
    const stepMs = (60 / bpm / 4) * 1000;
    const id = window.setInterval(() => {
      setIdx(prev => {
        const next = (prev + 1) % stepCount;
        for (const r of playable) {
          if (steps[r][next]) triggerDrumHit(engine, active.id, r as "kick" | "snare" | "hat" | "clap");
        }
        return next;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, active, engine, steps, stepCount]);

  if (!active) {
    return (
      <div className="h-full grid place-items-center">
        <button
          onClick={() => { const id = addTrack("instrument", "Drums"); updateTrack(id, { instrument: "drum" }); }}
          className="px-4 py-2 rounded bg-cyan-500 text-black text-xs font-medium"
        >+ Create Drum Track</button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-[11px] text-neutral-400">Track: <span className="text-neutral-100">{active.name}</span></div>
        <div className="flex-1" />
        <button onClick={() => setPlaying(p => !p)} className={`px-3 py-1 rounded text-[10px] uppercase ${playing ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-300"}`}>{playing ? "Stop" : "Play Pattern"}</button>
        <select value={bars} onChange={e => setBars(Number(e.target.value))} className="h-6 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-neutral-300 px-1">
          <option value={1}>1 bar</option>
          <option value={2}>2 bars</option>
          <option value={4}>4 bars</option>
        </select>
        <button onClick={() => setSteps(Object.fromEntries(ROWS.map(r => [r, Array(stepCount).fill(false)])) as Record<Row, boolean[]>)} className="px-2 py-1 rounded text-[10px] uppercase bg-neutral-800 text-neutral-400">Clear</button>
      </div>
      <div className="space-y-1">
        {ROWS.map(row => (
          <div key={row} className="flex items-center gap-2">
            <div className="w-16 text-[10px] uppercase text-neutral-400">{row}</div>
            <div className="flex gap-0.5 flex-wrap">
              {steps[row].map((on, i) => (
                <button
                  key={i}
                  onClick={() => setSteps(s => ({ ...s, [row]: s[row].map((v, k) => k === i ? !v : v) }))}
                  className={`w-6 h-6 rounded-sm border ${on ? "bg-cyan-400 border-cyan-300" : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"} ${playing && idx === i ? "ring-1 ring-amber-400" : ""} ${i % 4 === 0 ? "ml-1" : ""}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PianoRollView({ engine }: { engine: DawEngine }) {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const active = tracks.find(t => t.id === selectedTrackId && t.kind === "instrument") ?? tracks.find(t => t.kind === "instrument") ?? null;
  const NOTES = 25;
  const STEPS = 32;
  const [grid, setGrid] = useState<boolean[][]>(() => Array.from({length: NOTES}, () => Array(STEPS).fill(false)));

  if (!active) {
    return <div className="h-full grid place-items-center text-neutral-600 text-sm">Add an instrument track</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 border-b border-neutral-800 px-3 flex items-center gap-2 text-[11px] text-neutral-400">
        <span>Piano Roll · {active.name}</span>
        <div className="flex-1" />
        <button onClick={() => setGrid(Array.from({length: NOTES}, () => Array(STEPS).fill(false)))} className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-400">Clear</button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <div className="inline-block">
          {Array.from({length: NOTES}).map((_, row) => {
            const note = 72 - row;
            const isBlack = [1,3,6,8,10].includes(note % 12);
            return (
              <div key={row} className="flex">
                <div className={`w-10 h-5 text-[9px] grid place-items-center border-r border-b border-neutral-900 ${isBlack ? "bg-neutral-800 text-neutral-500" : "bg-neutral-900 text-neutral-400"}`}>
                  {["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][note%12]}{Math.floor(note/12)-1}
                </div>
                {Array.from({length: STEPS}).map((_, col) => {
                  const on = grid[row][col];
                  return (
                    <button
                      key={col}
                      onClick={() => {
                        setGrid(g => g.map((r,ri) => ri === row ? r.map((v,ci) => ci === col ? !v : v) : r));
                        if (!on) triggerSynthNote(engine, active.id, note);
                      }}
                      className={`w-5 h-5 border-r border-b ${on ? "bg-cyan-400 border-cyan-500" : isBlack ? "bg-neutral-900 border-neutral-800" : "bg-neutral-950 border-neutral-900"} ${col % 4 === 0 ? "border-l border-neutral-800" : ""}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FxRackEmbedded({ trackId }: { trackId: string }) {
  // Reuse the FxRack visual but flatten its absolute positioning to fit inside the dock.
  return (
    <div className="relative h-full overflow-auto">
      <div className="[&>div]:!relative [&>div]:!w-full [&>div]:!border-0 [&>div]:!shadow-none [&>div]:!h-full">
        <FxRack trackId={trackId} onClose={() => {}} />
      </div>
    </div>
  );
}
