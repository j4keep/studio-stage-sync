import { useEffect, useMemo, useRef, useState } from "react";
import { useDawStore, newId } from "../state/DawStore";
import { triggerSynthNote, startSynthNote, type DawEngine, type SynthVoice } from "../engine/DawEngine";
import type { MidiNote } from "../engine/types";
import { X, Minus, Plus, Piano, Keyboard as KeyboardIcon } from "lucide-react";
import { Knob } from "./Knob";
import { PRESETS, PresetModal, type Preset } from "./presets";


/**
 * Hardware-inspired floating MIDI keyboard. Computer keys act as MIDI input
 * (A W S E D F T G Y H U J K). LCD shows the currently selected instrument.
 */

const KEYBOARD_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
};

interface Key {
  midi: number;
  label: string;
  black: boolean;
  whiteIndex: number;
}

function buildKeys(startMidi: number, octaves: number): Key[] {
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const out: Key[] = [];
  let whiteIndex = 0;
  for (let i = 0; i < octaves * 12 + 1; i++) {
    const m = startMidi + i;
    const name = NAMES[m % 12];
    const black = name.includes("#");
    out.push({ midi: m, label: name + Math.floor(m / 12 - 1), black, whiteIndex });
    if (!black) whiteIndex++;
  }
  return out;
}

interface Props { engine: DawEngine; onClose: () => void; }

export function FloatingKeyboard({ engine, onClose }: Props) {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);

  const instruments = tracks.filter(t => t.kind === "instrument");
  const active = instruments.find(t => t.id === selectedTrackId) || instruments[0] || null;

  const [octaveStart, setOctaveStart] = useState(48); // C3
  const [octaves, setOctaves] = useState(3);
  const [mode, setMode] = useState<"piano" | "typing">("piano");
  const [sustain, setSustain] = useState(false);
  const [velocity, setVelocity] = useState(5); // 1..8
  const keys = useMemo(() => buildKeys(octaveStart, octaves), [octaveStart, octaves]);
  const whiteCount = keys.filter(k => !k.black).length;
  const WHITE_W = 28;
  const WHITE_H = 120;
  const BLACK_W = 18;
  const BLACK_H = 78;

  // Drag-to-move window
  const [pos, setPos] = useState({ x: 80, y: window.innerHeight - 260 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const onHeaderDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onHeaderMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy });
  };
  const onHeaderUp = () => { dragRef.current = null; };

  const [flashed, setFlashed] = useState<Set<number>>(new Set());
  const flash = (m: number) => {
    setFlashed(prev => { const n = new Set(prev); n.add(m); return n; });
    setTimeout(() => setFlashed(prev => { const n = new Set(prev); n.delete(m); return n; }), 220);
  };

  // Record-on-arm: append notes into a MIDI clip while transport is recording.
  const addClip = useDawStore(s => s.addClip);
  const updateClip = useDawStore(s => s.updateClip);
  const midiRecRef = useRef<{ clipId: string; clipStart: number; notes: Map<number, { id: string; startBeat: number }> } | null>(null);
  const recordNoteOn = (trackId: string, midi: number, vel: number) => {
    const st = useDawStore.getState();
    const recTrack = st.tracks.find(t => t.id === trackId);
    if (!st.transport.isRecording || !recTrack?.armed || recTrack.kind !== "instrument") return;
    const secPerBeat = 60 / Math.max(1, st.transport.bpm);
    const clipStart = midiRecRef.current?.clipStart ?? st.transport.position;
    const startBeat = Math.max(0, (st.transport.position - clipStart) / secPerBeat);
    if (!midiRecRef.current) {
      const clipId = newId("clip");
      midiRecRef.current = { clipId, clipStart, notes: new Map() };
      addClip({ id: clipId, trackId, startTime: clipStart, duration: Math.max(secPerBeat, secPerBeat * 4), offset: 0, name: "MIDI Recording", notes: [], color: "#a855f7" });
    }
    if (midiRecRef.current.notes.has(midi)) return;
    const noteId = newId("n");
    midiRecRef.current.notes.set(midi, { id: noteId, startBeat });
    const clip = useDawStore.getState().clips.find(c => c.id === midiRecRef.current?.clipId);
    updateClip(midiRecRef.current.clipId, {
      notes: [...(clip?.notes ?? []), { id: noteId, start: startBeat, length: 0.25, pitch: midi, velocity: vel } as MidiNote],
    });
  };
  const isRecording = useDawStore(s => s.transport.isRecording);
  useEffect(() => { if (!isRecording) midiRecRef.current = null; }, [isRecording]);

  const playNote = (midi: number) => {
    const vel = velocity / 8;
    let t = active;
    if (!t) {
      const id = addTrack("instrument", "Synth");
      updateTrack(id, { instrument: "synth", instrumentPreset: "Bright Synth", synthWave: "sawtooth" });
      selectTrack(id);
      setTimeout(() => {
        const tr = useDawStore.getState().tracks.find(x => x.id === id);
        triggerSynthNote(engine, id, midi, sustain ? 0.6 : 0.3, vel, (tr?.synthWave as OscillatorType) || "sawtooth");
      }, 30);
      flash(midi);
      return;
    }
    // Use this track's preset waveform so the LCD label and the sound match.
    triggerSynthNote(engine, t.id, midi, sustain ? 0.6 : 0.3, vel, (t.synthWave as OscillatorType) || "sawtooth");
    recordNoteOn(t.id, midi, vel);
    flash(midi);
  };

  // Computer-keyboard MIDI input + meta keys (Z/X octave, Tab sustain, 1-8 vel)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); setOctaveStart(o => Math.max(0, o - 12)); return; }
      if (k === "x") { e.preventDefault(); setOctaveStart(o => Math.min(96, o + 12)); return; }
      if (e.key === "Tab") { e.preventDefault(); setSustain(s => !s); return; }
      if (/^[1-8]$/.test(e.key)) { setVelocity(Number(e.key)); return; }
      const n = KEYBOARD_MAP[k];
      if (n != null && !e.repeat) {
        const base = octaveStart - 48;
        playNote(n + base);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [octaveStart, active?.id, engine, sustain, velocity]);

  // Slide-to-play
  const pressedRef = useRef(false);
  const lastNoteRef = useRef<number | null>(null);
  const onKeyDown = (m: number) => (e: React.PointerEvent) => {
    e.stopPropagation(); pressedRef.current = true; lastNoteRef.current = m; playNote(m);
  };
  const onKeyEnter = (m: number) => () => {
    if (!pressedRef.current) return;
    if (lastNoteRef.current === m) return;
    lastNoteRef.current = m; playNote(m);
  };
  useEffect(() => {
    const up = () => { pressedRef.current = false; lastNoteRef.current = null; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  const width = Math.max(560, whiteCount * WHITE_W + 24);
  const lcdLine1 = active ? active.name : "— NO TRACK —";
  const lcdLine2 = active?.instrumentPreset || (active?.instrument === "drum" ? "Drum Kit" : "Default Synth");

  return (
    <div
      className="fixed z-[80] rounded-xl select-none shadow-2xl shadow-black/80"
      style={{
        left: pos.x, top: pos.y, width,
        background: "linear-gradient(180deg,#1a1a1d 0%,#0a0a0b 100%)",
        border: "1px solid #2a2a2d",
        boxShadow: "0 18px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Brushed-metal header: drag handle + LCD + hardware knob strip */}
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        className="h-14 px-3 flex items-center gap-3 cursor-move rounded-t-xl"
        style={{
          background:
            "repeating-linear-gradient(90deg, #1f1f22 0px, #232326 2px, #1f1f22 4px), linear-gradient(180deg,#28282b,#161618)",
          borderBottom: "1px solid #000",
        }}
      >
        <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">W.STUDIO · SL73</span>

        {/* LCD screen */}
        <div
          className="ml-1 px-3 py-1.5 rounded-md font-mono leading-tight tabular-nums"
          style={{
            minWidth: 200,
            background: "linear-gradient(180deg,#0d1f12,#081308)",
            border: "1px solid #1c2a1c",
            boxShadow: "inset 0 0 12px rgba(0,255,120,0.15), inset 0 0 0 1px #000",
            color: "#7cf2a6", textShadow: "0 0 6px rgba(124,242,166,0.6)",
          }}
        >
          <div className="text-[11px] truncate">{lcdLine1}</div>
          <div className="text-[9px] opacity-70 truncate">{lcdLine2}</div>
        </div>

        {/* Functional knob strip — wired to selected track */}
        <div className="flex items-end gap-3 px-2" onPointerDown={(e) => e.stopPropagation()}>
          <Knob size={28} min={0} max={1} value={active?.volume ?? 1} onChange={(v) => active && updateTrack(active.id, { volume: v })} label="Vol" color="#22d3ee" showValue={false} />
          <Knob size={28} min={-1} max={1} value={active?.pan ?? 0} onChange={(v) => active && updateTrack(active.id, { pan: v })} label="Pan" color="#a855f7" showValue={false} />
          <Knob size={28} min={0} max={1} value={active?.reverbSend ?? 0} onChange={(v) => active && updateTrack(active.id, { reverbSend: v })} label="Rev" color="#f59e0b" showValue={false} />
          <Knob size={28} min={0} max={1} value={active?.delaySend ?? 0} onChange={(v) => active && updateTrack(active.id, { delaySend: v })} label="Dly" color="#ef4444" showValue={false} />
        </div>

        <div className="flex-1" />

        {/* Mode toggle — explicit Piano vs Computer-Keyboard */}
        <div className="flex items-center rounded border border-neutral-700 overflow-hidden bg-neutral-950" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMode("piano"); }}
            title="Real piano keys"
            className={`h-7 px-2 flex items-center gap-1 text-[10px] font-semibold ${mode === "piano" ? "bg-cyan-500/30 text-cyan-100" : "text-neutral-500 hover:text-neutral-300"}`}
          ><Piano className="w-3.5 h-3.5" />PIANO</button>
          <button
            onClick={(e) => { e.stopPropagation(); setMode("typing"); }}
            title="Computer keyboard typing"
            className={`h-7 px-2 flex items-center gap-1 text-[10px] font-semibold border-l border-neutral-700 ${mode === "typing" ? "bg-amber-500/30 text-amber-100" : "text-neutral-500 hover:text-neutral-300"}`}
          ><KeyboardIcon className="w-3.5 h-3.5" />TYPE</button>
        </div>

        {/* Octave */}
        <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOctaveStart(o => Math.max(0, o - 12)); }}
          className="w-6 h-6 grid place-items-center text-neutral-400 hover:text-cyan-300 rounded border border-neutral-800" title="Octave down (Z)">
          <Minus className="w-3 h-3" />
        </button>
        <span className="text-[10px] text-neutral-400 tabular-nums w-7 text-center">C{Math.floor(octaveStart / 12) - 1}</span>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOctaveStart(o => Math.min(96, o + 12)); }}
          className="w-6 h-6 grid place-items-center text-neutral-400 hover:text-cyan-300 rounded border border-neutral-800" title="Octave up (X)">
          <Plus className="w-3 h-3" />
        </button>

        {mode === "piano" && (
          <div className="flex items-center gap-1">
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOctaves(o => Math.max(2, o - 1)); }}
              className="px-1 text-[10px] text-neutral-500 hover:text-neutral-300">−</button>
            <span className="text-[10px] text-neutral-500">{octaves} oct</span>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOctaves(o => Math.min(5, o + 1)); }}
              className="px-1 text-[10px] text-neutral-500 hover:text-neutral-300">+</button>
          </div>
        )}

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-6 h-6 grid place-items-center text-neutral-400 hover:text-red-400 rounded border border-neutral-800"
          title="Close keyboard"
        ><X className="w-3 h-3" /></button>
      </div>

      {/* Body */}
      <div
        className="p-3"
        style={{ background: "linear-gradient(180deg,#0a0a0b 0%,#050506 100%)" }}
      >
        {mode === "piano" ? (
          <>
            <div className="relative touch-none mx-auto" style={{ width: whiteCount * WHITE_W, height: WHITE_H }}>
              {keys.filter(k => !k.black).map((k) => (
                <button
                  key={k.midi}
                  onPointerDown={onKeyDown(k.midi)}
                  onPointerEnter={onKeyEnter(k.midi)}
                  className={`absolute top-0 rounded-b-md transition-colors ${
                    flashed.has(k.midi) ? "bg-cyan-200" : "bg-gradient-to-b from-white to-neutral-200 hover:from-neutral-50 hover:to-neutral-200"
                  }`}
                  style={{
                    left: k.whiteIndex * WHITE_W, width: WHITE_W - 1, height: WHITE_H,
                    border: "1px solid #999", borderTop: "2px solid #444",
                    boxShadow: "inset 0 -6px 6px rgba(0,0,0,0.18)",
                  }}
                >
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-neutral-500 pointer-events-none">
                    {k.midi % 12 === 0 ? k.label : ""}
                  </span>
                </button>
              ))}
              {keys.filter(k => k.black).map((k) => {
                const prevWhite = keys.filter(x => !x.black && x.midi < k.midi).length;
                const left = prevWhite * WHITE_W - BLACK_W / 2;
                return (
                  <button
                    key={k.midi}
                    onPointerDown={onKeyDown(k.midi)}
                    onPointerEnter={onKeyEnter(k.midi)}
                    className={`absolute top-0 z-10 rounded-b-md transition-colors ${
                      flashed.has(k.midi) ? "bg-cyan-700" : "bg-gradient-to-b from-neutral-800 to-black hover:from-neutral-700"
                    }`}
                    style={{
                      left, width: BLACK_W, height: BLACK_H,
                      border: "1px solid #000",
                      boxShadow: "inset 0 -4px 6px rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.6)",
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-[9px] text-neutral-500 text-center">
              Slide for glissando · Computer keys A-K play MIDI · <span className="text-blue-400">Z/X</span> octave · <span className="text-emerald-400">Tab</span> sustain · <span className="text-amber-400">1-8</span> velocity
            </div>
          </>
        ) : (
          <TypingView
            octaveStart={octaveStart}
            flashed={flashed}
            sustain={sustain}
            velocity={velocity}
            onTap={(m) => playNote(m)}
          />
        )}
      </div>
    </div>
  );
}

/** Logic-style musical typing layout with color-coded meta keys. */
function TypingView({
  octaveStart, flashed, sustain, velocity, onTap,
}: {
  octaveStart: number;
  flashed: Set<number>;
  sustain: boolean;
  velocity: number;
  onTap: (midi: number) => void;
}) {
  const base = octaveStart - 48;
  const blackRow: Array<{ key: string; midi: number | null }> = [
    { key: "W", midi: 61 + base }, { key: "E", midi: 63 + base }, { key: "", midi: null },
    { key: "T", midi: 66 + base }, { key: "Y", midi: 68 + base }, { key: "U", midi: 70 + base },
    { key: "", midi: null }, { key: "O", midi: 73 + base }, { key: "P", midi: 75 + base },
  ];
  const whiteRow: Array<{ key: string; midi: number }> = [
    { key: "A", midi: 60 + base }, { key: "S", midi: 62 + base }, { key: "D", midi: 64 + base },
    { key: "F", midi: 65 + base }, { key: "G", midi: 67 + base }, { key: "H", midi: 69 + base },
    { key: "J", midi: 71 + base }, { key: "K", midi: 72 + base }, { key: "L", midi: 74 + base },
    { key: ";", midi: 76 + base },
  ];
  const KEY_W = 40;
  const velColor = (n: number) => n <= 3 ? "#fb923c" : n <= 6 ? "#f97316" : "#ef4444";

  return (
    <div className="px-1 pt-1 pb-2">
      {/* Meta row: octave (blue), sustain (green), velocity (orange/red) */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="flex gap-1">
          <span className="px-2 h-6 grid place-items-center rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">Z ◀</span>
          <span className="px-2 h-6 grid place-items-center rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">▶ X</span>
          <span className="px-2 h-6 grid place-items-center rounded text-[9px] uppercase text-blue-400/70">Octave</span>
        </div>
        <span className={`px-2 h-6 grid place-items-center rounded text-[10px] font-bold border ${sustain ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-emerald-500/10 text-emerald-300/70 border-emerald-500/30"}`}>
          Tab · Sustain {sustain ? "ON" : "OFF"}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] uppercase text-amber-400/70">Velocity</span>
          {[1,2,3,4,5,6,7,8].map(n => (
            <span
              key={n}
              className="w-5 h-6 grid place-items-center rounded text-[10px] font-bold border"
              style={{
                background: n === velocity ? velColor(n) : "transparent",
                color: n === velocity ? "#000" : velColor(n),
                borderColor: velColor(n) + "66",
              }}
            >{n}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-1 mb-1 ml-[20px]">
        {blackRow.map((b, i) => (
          b.midi != null ? (
            <button
              key={i}
              onPointerDown={(e) => { e.stopPropagation(); onTap(b.midi!); }}
              style={{ width: KEY_W, height: 46 }}
              className={`rounded text-[11px] font-semibold ${flashed.has(b.midi) ? "bg-cyan-500 text-black" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700"}`}
            >{b.key}</button>
          ) : (
            <div key={i} style={{ width: KEY_W, height: 46 }} />
          )
        ))}
      </div>
      <div className="flex gap-1">
        {whiteRow.map((w) => (
          <button
            key={w.key}
            onPointerDown={(e) => { e.stopPropagation(); onTap(w.midi); }}
            style={{ width: KEY_W, height: 62 }}
            className={`rounded text-[12px] font-bold border ${flashed.has(w.midi) ? "bg-cyan-300 text-black border-cyan-200" : "bg-gradient-to-b from-white to-neutral-200 text-neutral-700 hover:from-neutral-50 border-neutral-300"}`}
          >{w.key}</button>
        ))}
      </div>
    </div>
  );
}
