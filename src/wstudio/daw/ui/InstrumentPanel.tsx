import { useEffect, useMemo, useState } from "react";
import { useDawStore } from "../state/DawStore";
import { triggerSynthNote, triggerDrumHit, type DawEngine } from "../engine/DawEngine";
import { DRUM_KITS, DRUM_PIECES_ORDER, DRUM_PIECE_LABELS, getPresetByName, type DrumPiece } from "../engine/presetData";
import { Music2, Drum } from "lucide-react";

const KEYS = [
  { note: 60, label: "C", black: false },
  { note: 61, label: "C#", black: true },
  { note: 62, label: "D", black: false },
  { note: 63, label: "D#", black: true },
  { note: 64, label: "E", black: false },
  { note: 65, label: "F", black: false },
  { note: 66, label: "F#", black: true },
  { note: 67, label: "G", black: false },
  { note: 68, label: "G#", black: true },
  { note: 69, label: "A", black: false },
  { note: 70, label: "A#", black: true },
  { note: 71, label: "B", black: false },
  { note: 72, label: "C", black: false },
];

const KEYBOARD_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
};

const SEQ_ROWS: DrumPiece[] = ["kick", "snare", "hat", "openhat", "clap", "perc"];

export function InstrumentPanel({ engine }: { engine: DawEngine }) {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);

  const instrumentTracks = tracks.filter(t => t.kind === "instrument");
  const activeId = (selectedTrackId && tracks.find(t => t.id === selectedTrackId && t.kind === "instrument")?.id) || instrumentTracks[0]?.id || null;
  const active = instrumentTracks.find(t => t.id === activeId);
  const kitName = active?.drumKit || "808";
  const activePreset = useMemo(
    () => getPresetByName(active?.instrumentPreset) || undefined,
    [active?.instrumentPreset],
  );

  const [octave, setOctave] = useState(0);
  const [steps, setSteps] = useState<Record<DrumPiece, boolean[]>>(() => ({
    kick: Array(16).fill(false), snare: Array(16).fill(false), hat: Array(16).fill(false),
    openhat: Array(16).fill(false), clap: Array(16).fill(false), perc: Array(16).fill(false),
    rim: [], tom: [], ride: [], crash: [], cowbell: [],
  }));
  const [seqPlaying, setSeqPlaying] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!active || active.instrument !== "synth") return;
    const down = (e: KeyboardEvent) => {
      const n = KEYBOARD_MAP[e.key.toLowerCase()];
      if (n != null && !e.repeat) triggerSynthNote(engine, active.id, n + octave * 12, 0.4, 0.85, activePreset);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [active, engine, octave, activePreset]);

  useEffect(() => {
    if (!seqPlaying || !active || active.instrument !== "drum") return;
    const bpm = useDawStore.getState().transport.bpm;
    const stepMs = (60 / bpm / 4) * 1000;
    const id = window.setInterval(() => {
      setStepIdx(prev => {
        const next = (prev + 1) % 16;
        SEQ_ROWS.forEach(piece => {
          if (steps[piece][next]) triggerDrumHit(engine, active.id, piece, kitName);
        });
        return next;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [seqPlaying, active, engine, steps, kitName]);

  return (
    <div className="flex-1 bg-neutral-900 overflow-hidden flex flex-col">
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 gap-3 text-[10px] uppercase tracking-wider text-neutral-400">
        <span>Instruments</span>
        <div className="flex-1" />
        <button
          onClick={() => { const id = addTrack("instrument", "Synth"); updateTrack(id, { instrument: "synth", instrumentPreset: "Bright Saw Lead", synthWave: "sawtooth" }); }}
          className="h-6 px-2 rounded border border-neutral-800 hover:bg-neutral-800 flex items-center gap-1 normal-case"
        ><Music2 className="w-3 h-3" /> Add Synth</button>
        <button
          onClick={() => { const id = addTrack("instrument", "Drums"); updateTrack(id, { instrument: "drum", drumKit: "808" }); }}
          className="h-6 px-2 rounded border border-neutral-800 hover:bg-neutral-800 flex items-center gap-1 normal-case"
        ><Drum className="w-3 h-3" /> Add Drums</button>
      </div>

      {!active && (
        <div className="flex-1 grid place-items-center text-neutral-600 text-sm">
          Add a Synth or Drum track to play
        </div>
      )}

      {active?.instrument === "synth" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="text-xs text-neutral-400">Playing on: <span className="text-neutral-200 font-medium">{active.name}</span></div>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <span>Octave</span>
            <button onClick={() => setOctave(o => Math.max(-3, o - 1))} className="w-6 h-6 border border-neutral-800 rounded">-</button>
            <span className="w-6 text-center">{octave}</span>
            <button onClick={() => setOctave(o => Math.min(3, o + 1))} className="w-6 h-6 border border-neutral-800 rounded">+</button>
            <span className="ml-2">Keys: A W S E D F T G Y H U J K</span>
          </div>
          <div
            className="relative touch-none"
            style={{ width: 8 * 60, height: 200 }}
            onPointerDown={() => { (window as any).__wsKeyHeld = true; }}
            onPointerUp={() => { (window as any).__wsKeyHeld = false; }}
            onPointerLeave={() => { (window as any).__wsKeyHeld = false; }}
          >
            {KEYS.filter(k => !k.black).map((k, i) => (
              <button
                key={k.note}
                onPointerDown={() => { (window as any).__wsKeyHeld = true; triggerSynthNote(engine, active.id, k.note + octave * 12); }}
                onPointerEnter={() => { if ((window as any).__wsKeyHeld) triggerSynthNote(engine, active.id, k.note + octave * 12); }}
                className="absolute top-0 bottom-0 bg-white hover:bg-neutral-200 border border-neutral-300 active:bg-cyan-200"
                style={{ left: i * 60, width: 60 }}
              >
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-neutral-500">{k.label}</span>
              </button>
            ))}
            {KEYS.filter(k => k.black).map((k) => {
              const whiteIdx = KEYS.filter(x => !x.black && x.note < k.note).length;
              return (
                <button
                  key={k.note}
                  onPointerDown={() => { (window as any).__wsKeyHeld = true; triggerSynthNote(engine, active.id, k.note + octave * 12); }}
                  onPointerEnter={() => { if ((window as any).__wsKeyHeld) triggerSynthNote(engine, active.id, k.note + octave * 12); }}
                  className="absolute top-0 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 active:bg-cyan-700 z-10"
                  style={{ left: whiteIdx * 60 - 18, width: 36, height: 120 }}
                />
              );
            })}
          </div>
        </div>
      )}

      {active?.instrument === "drum" && (
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center gap-3 text-xs text-neutral-300 flex-wrap">
            <span>Track: <span className="text-neutral-100 font-medium">{active.name}</span></span>
            <label className="flex items-center gap-2 ml-2">
              <span className="text-[10px] uppercase text-neutral-500">Kit</span>
              <select
                value={kitName}
                onChange={(e) => updateTrack(active.id, { drumKit: e.target.value })}
                className="bg-neutral-800 text-neutral-100 text-xs rounded px-2 py-1 border border-neutral-700"
              >
                {DRUM_KITS.map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
              </select>
            </label>
            <button
              onClick={() => setSeqPlaying(s => !s)}
              className={`px-3 py-1 rounded text-[10px] uppercase ${seqPlaying ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-300"}`}
            >{seqPlaying ? "Stop" : "Run"}</button>
            <button
              onClick={() => setSteps(s => {
                const cleared = { ...s };
                SEQ_ROWS.forEach(p => { cleared[p] = Array(16).fill(false); });
                return cleared;
              })}
              className="px-3 py-1 rounded text-[10px] uppercase bg-neutral-800 text-neutral-400"
            >Clear</button>
          </div>

          {SEQ_ROWS.map(row => (
            <div key={row} className="flex items-center gap-2">
              <button
                onClick={() => triggerDrumHit(engine, active.id, row, kitName)}
                className="w-20 text-[11px] uppercase text-neutral-300 hover:text-cyan-300 text-left"
                title={`Trigger ${DRUM_PIECE_LABELS[row]}`}
              >{DRUM_PIECE_LABELS[row]}</button>
              <div className="flex gap-1">
                {steps[row].map((on, i) => (
                  <button
                    key={i}
                    onClick={() => setSteps(s => ({ ...s, [row]: s[row].map((v, idx) => idx === i ? !v : v) }))}
                    className={`w-7 h-7 rounded border ${on ? "bg-cyan-400 border-cyan-300" : "bg-neutral-900 border-neutral-800"} ${seqPlaying && stepIdx === i ? "ring-1 ring-amber-400" : ""}`}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 mt-2">
            {DRUM_PIECES_ORDER.map(piece => (
              <button
                key={piece}
                onClick={() => triggerDrumHit(engine, active.id, piece, kitName)}
                className="px-3 py-3 bg-neutral-800 hover:bg-neutral-700 rounded text-xs text-neutral-200 min-w-[72px]"
              >{DRUM_PIECE_LABELS[piece]}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
