import { useEffect, useMemo, useRef, useState } from "react";
import { X, Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronDown, Search, Play, Plus, Save, Pencil, MousePointer2, Trash2, Sliders } from "lucide-react";
import { useDawStore, newId } from "../state/DawStore";
import { FxRack } from "./FxRack";
import type { DawEngine } from "../engine/DawEngine";
import { triggerSynthNote, midiToFreq, startSynthNote, triggerDrumHit, type SynthVoice } from "../engine/DawEngine";
import type { MidiNote, Clip } from "../engine/types";

type Tab = "instrument" | "chords" | "pianoroll" | "effects";

/* ---------- Preset catalog ---------- */
type Preset = { name: string; wave: "sine" | "triangle" | "sawtooth" | "square"; cat: string; sub: string };
const PRESET_CATS = ["My Presets", "Guitar", "Bass & 808s", "Orchestral", "Keys", "Synths", "Drums & Machines", "FX"] as const;
const PRESETS: Preset[] = [
  { name: "Bright Synth",   wave: "sawtooth", cat: "Synths",       sub: "Leads" },
  { name: "Pluck Lead",     wave: "triangle", cat: "Synths",       sub: "Leads" },
  { name: "Warm Pad",       wave: "sine",     cat: "Synths",       sub: "Pads" },
  { name: "Trap Bells",     wave: "sine",     cat: "Synths",       sub: "Bells" },
  { name: "Bright Piano",   wave: "triangle", cat: "Keys",         sub: "Piano" },
  { name: "Soft Keys",      wave: "sine",     cat: "Keys",         sub: "Electric Piano" },
  { name: "Electric Piano", wave: "triangle", cat: "Keys",         sub: "Electric Piano" },
  { name: "808 Bass",       wave: "sine",     cat: "Bass & 808s",  sub: "808" },
  { name: "Sub Bass",       wave: "sine",     cat: "Bass & 808s",  sub: "Bass" },
  { name: "Reese Bass",     wave: "sawtooth", cat: "Bass & 808s",  sub: "Bass" },
  { name: "Clean Guitar",   wave: "triangle", cat: "Guitar",       sub: "Clean" },
  { name: "Crunch Guitar",  wave: "sawtooth", cat: "Guitar",       sub: "Distorted" },
  { name: "Strings",        wave: "sawtooth", cat: "Orchestral",   sub: "Strings" },
  { name: "Brass Stab",     wave: "square",   cat: "Orchestral",   sub: "Brass" },
  { name: "Drum Kit",       wave: "square",   cat: "Drums & Machines", sub: "Kits" },
  { name: "FX Riser",       wave: "sawtooth", cat: "FX",           sub: "Risers" },
];

/* ---------- Keyboard ---------- */
const KEY_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
  o: 73, l: 74, p: 75, ";": 76,
};
const KEY_LABELS: Record<number, string> = { 60:"A",61:"W",62:"S",63:"E",64:"D",65:"F",66:"T",67:"G",68:"Y",69:"H",70:"U",71:"J",72:"K",73:"O",74:"L",75:"P",76:";" };

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
  const active =
    tracks.find(t => t.id === selectedTrackId && t.kind === "instrument") ??
    tracks.find(t => t.kind === "instrument") ?? null;

  if (!open) return null;
  const height = expanded ? "70vh" : "48vh";

  return (
    <div
      className="absolute left-0 right-0 bottom-0 bg-[#0a0a0c] border-t border-neutral-800 z-30 flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.7)]"
      style={{ height }}
    >
      {/* Header tabs */}
      <div className="h-11 border-b border-neutral-800 flex items-center px-3 gap-1 shrink-0 bg-gradient-to-b from-neutral-900/80 to-[#0a0a0c]">
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 mr-2"><X className="w-4 h-4" /></button>
        {(["instrument","chords","pianoroll","effects"] as Tab[]).map(t => {
          const isDrum = active?.instrument === "drum";
          const label = t === "pianoroll" ? "Piano Roll"
            : t === "instrument" ? "Instrument"
            : t === "chords" ? (isDrum ? "Beats" : "Chords")
            : "Effects";
          return (
            <button
              key={t}
              onClick={() => onTab(t)}
              className={`relative px-4 h-8 text-[12px] capitalize rounded-md transition-colors ${
                tab === t ? "text-teal-300 bg-teal-500/10" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {label}
              {tab === t && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-gradient-to-r from-teal-400 to-purple-400 rounded-full" />}
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="text-[10px] text-neutral-500 truncate max-w-[260px]">
          {active ? <>Track: <span className="text-neutral-300">{active.name}</span>{active.instrumentPreset ? <> · <span className="text-purple-300">{active.instrumentPreset}</span></> : null}</> : "No instrument track selected"}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-neutral-500 hover:text-neutral-200 ml-2">
          {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {!active ? <EmptyHint /> :
          tab === "instrument" ? <InstrumentTab engine={engine} trackId={active.id} /> :
          tab === "chords"     ? (active.instrument === "drum"
                                    ? <BeatGridTab engine={engine} trackId={active.id} />
                                    : <ChordsTab engine={engine} trackId={active.id} />) :
          tab === "pianoroll"  ? <PianoRollTab engine={engine} trackId={active.id} /> :
                                 <EffectsTab trackId={active.id} />}
      </div>

    </div>
  );
}

function EmptyHint() {
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  return (
    <div className="h-full grid place-items-center text-center">
      <div>
        <div className="text-neutral-500 text-sm mb-3">Add an instrument track to start playing</div>
        <button
          onClick={() => { const id = addTrack("instrument", "Synth"); updateTrack(id, { instrument: "synth", instrumentPreset: "Bright Synth", synthWave: "sawtooth" }); }}
          className="px-4 py-2 rounded-md bg-gradient-to-r from-teal-500 to-purple-500 text-black text-xs font-medium"
        >+ Create Synth Track</button>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* INSTRUMENT TAB                                                         */
/* ===================================================================== */

function InstrumentTab({ engine, trackId }: { engine: DawEngine; trackId: string }) {
  const track = useDawStore(s => s.tracks.find(t => t.id === trackId)!);
  const updateTrack = useDawStore(s => s.updateTrack);
  const addClip = useDawStore(s => s.addClip);
  const updateClip = useDawStore(s => s.updateClip);
  const isRecording = useDawStore(s => s.transport.isRecording);
  const [octave, setOctave] = useState(0);
  const [sustain, setSustain] = useState(false);
  const [autoChords, setAutoChords] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const presetIdx = Math.max(0, PRESETS.findIndex(p => p.name === (track.instrumentPreset || "Bright Synth")));
  const preset = PRESETS[presetIdx];

  const applyPreset = (p: Preset) => {
    updateTrack(trackId, { instrumentPreset: p.name, synthWave: p.wave, name: p.name });
  };

  // Active voice map for sustained note-on / note-off (keyboard + mouse).
  // Keyed by midi pitch so the same key can't double-trigger and create
  // stuck notes — repeated key-down before key-up is a no-op.
  const voicesRef = useRef<Map<number, SynthVoice[]>>(new Map());
  const midiRecRef = useRef<{
    clipId: string;
    clipStart: number;
    notes: Map<number, { id: string; startBeat: number }>;
  } | null>(null);

  const recordNoteOn = (midi: number, velocity = 0.85) => {
    const st = useDawStore.getState();
    const recTrack = st.tracks.find(t => t.id === trackId);
    if (!st.transport.isRecording || !recTrack?.armed || recTrack.kind !== "instrument") return;
    const secPerBeat = 60 / Math.max(1, st.transport.bpm);
    const clipStart = midiRecRef.current?.clipStart ?? st.transport.position;
    const startBeat = Math.max(0, (st.transport.position - clipStart) / secPerBeat);
    if (!midiRecRef.current) {
      const clipId = newId("clip");
      midiRecRef.current = { clipId, clipStart, notes: new Map() };
      addClip({
        id: clipId,
        trackId,
        startTime: clipStart,
        duration: Math.max(secPerBeat, secPerBeat * 4),
        offset: 0,
        name: "MIDI Recording",
        notes: [],
        color: "#a855f7",
      });
    }
    if (midiRecRef.current.notes.has(midi)) return;
    const noteId = newId("n");
    midiRecRef.current.notes.set(midi, { id: noteId, startBeat });
    const clip = useDawStore.getState().clips.find(c => c.id === midiRecRef.current?.clipId);
    const notes = clip?.notes ?? [];
    updateClip(midiRecRef.current.clipId, {
      notes: [...notes, { id: noteId, start: startBeat, length: 0.25, pitch: midi, velocity }],
    });
  };

  const recordNoteOff = (midi: number) => {
    const rec = midiRecRef.current;
    if (!rec) return;
    const held = rec.notes.get(midi);
    if (!held) return;
    rec.notes.delete(midi);
    const st = useDawStore.getState();
    const secPerBeat = 60 / Math.max(1, st.transport.bpm);
    const endBeat = Math.max(held.startBeat + 0.125, (st.transport.position - rec.clipStart) / secPerBeat);
    const length = Math.max(0.125, endBeat - held.startBeat);
    const clip = st.clips.find(c => c.id === rec.clipId);
    const notes = (clip?.notes ?? []).map(n => n.id === held.id ? { ...n, length } : n);
    updateClip(rec.clipId, {
      notes,
      duration: Math.max(clip?.duration ?? 0, (held.startBeat + length) * secPerBeat),
    });
  };

  const noteOn = (midi: number) => {
    const existing = voicesRef.current.get(midi);
    if (existing && existing.length > 0) return; // prevent stuck notes
    const wave = preset.wave;
    const targets = autoChords ? [0, 4, 7] : [0];
    const voices: SynthVoice[] = [];
    for (const off of targets) {
      const pitch = midi + off;
      const v = startSynthNote(engine, trackId, pitch, 0.85, wave);
      if (v) voices.push(v);
      recordNoteOn(pitch, 0.85);
    }
    voicesRef.current.set(midi, voices);
    // If user prefers staccato (sustain off) auto-release shortly.
    if (!sustain) {
      setTimeout(() => noteOff(midi), 220);
    }
  };

  const noteOff = (midi: number) => {
    const voices = voicesRef.current.get(midi);
    if (!voices) return;
    voicesRef.current.delete(midi);
    voices.forEach(v => { v.stop(0.18); recordNoteOff(v.midi); });
  };

  // Clean up any held voices on unmount or preset/track switch.
  useEffect(() => {
    return () => {
      voicesRef.current.forEach(arr => arr.forEach(v => v.stop(0.05)));
      voicesRef.current.clear();
    };
  }, [trackId]);

  useEffect(() => {
    if (isRecording) return;
    const rec = midiRecRef.current;
    if (rec) {
      Array.from(rec.notes.keys()).forEach(recordNoteOff);
    }
    midiRecRef.current = null;
  }, [isRecording]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = KEY_MAP[e.key.toLowerCase()];
      if (n != null && !e.repeat) noteOn(n + octave * 12);
    };
    const up = (e: KeyboardEvent) => {
      const n = KEY_MAP[e.key.toLowerCase()];
      if (n != null) noteOff(n + octave * 12);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [octave, sustain, autoChords, trackId, preset.wave]);

  return (
    <div className="h-full flex flex-col">
      {/* Controls row */}
      <div className="px-4 py-3 flex items-center gap-4 border-b border-neutral-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => applyPreset(PRESETS[(presetIdx - 1 + PRESETS.length) % PRESETS.length])}
            className="w-7 h-7 grid place-items-center rounded border border-neutral-800 hover:border-teal-400/50 text-neutral-300"
          ><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={() => setPresetOpen(true)}
            className="h-7 min-w-[160px] px-3 rounded border border-neutral-800 bg-neutral-900 hover:border-purple-400/50 text-neutral-100 text-xs flex items-center justify-between gap-2"
          >
            <span className="truncate">{preset.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          <button
            onClick={() => applyPreset(PRESETS[(presetIdx + 1) % PRESETS.length])}
            className="w-7 h-7 grid place-items-center rounded border border-neutral-800 hover:border-teal-400/50 text-neutral-300"
          ><ChevronRight className="w-4 h-4" /></button>
          <button className="ml-2 h-7 px-3 rounded border border-neutral-800 text-[11px] text-neutral-300 hover:border-teal-400/50 flex items-center gap-1.5">
            <Save className="w-3 h-3" /> Save Preset
          </button>
        </div>

        <div className="flex-1" />

        <Knob label="Reverb" value={track.reverbSend} onChange={(v) => updateTrack(trackId, { reverbSend: v })} />
        <Knob label="Pan" value={(track.pan + 1) / 2} onChange={(v) => updateTrack(trackId, { pan: v * 2 - 1 })} bipolar />
        <Knob label="Volume" value={track.volume} onChange={(v) => updateTrack(trackId, { volume: v })} accent />

        <div className="w-px h-8 bg-neutral-800 mx-1" />

        <Toggle label="Sustain" on={sustain} onClick={() => setSustain(s => !s)} />
        <div className="flex items-center gap-1">
          <button onClick={() => setOctave(o => Math.max(-3, o - 1))} className="w-6 h-6 rounded border border-neutral-800 text-neutral-300 text-xs">−</button>
          <span className="text-[10px] text-neutral-500 w-12 text-center">Octave {octave > 0 ? `+${octave}` : octave}</span>
          <button onClick={() => setOctave(o => Math.min(3, o + 1))} className="w-6 h-6 rounded border border-neutral-800 text-neutral-300 text-xs">+</button>
        </div>
        <Toggle label="Auto-chords" on={autoChords} onClick={() => setAutoChords(s => !s)} />
      </div>

      {/* Keyboard */}
      <div className="flex-1 overflow-hidden p-3">
        <PianoKeyboard onDown={noteOn} onUp={noteOff} octave={octave} />
      </div>


      {presetOpen && (
        <PresetModal
          currentName={preset.name}
          onClose={() => setPresetOpen(false)}
          onPick={(p) => { applyPreset(p); setPresetOpen(false); }}
        />
      )}
    </div>
  );
}

function Knob({ label, value, onChange, bipolar, accent }: { label: string; value: number; onChange: (v: number) => void; bipolar?: boolean; accent?: boolean }) {
  // value 0..1
  const angle = -135 + value * 270;
  const startRef = useRef<{ y: number; v: number } | null>(null);
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          startRef.current = { y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          if (!startRef.current) return;
          const dy = startRef.current.y - e.clientY;
          onChange(Math.max(0, Math.min(1, startRef.current.v + dy / 150)));
        }}
        onPointerUp={() => { startRef.current = null; }}
        className={`relative w-9 h-9 rounded-full border ${accent ? "border-teal-400/40" : "border-neutral-700"} bg-gradient-to-b from-neutral-800 to-neutral-950 cursor-ns-resize`}
      >
        <div
          className={`absolute left-1/2 top-1 w-[2px] h-3.5 -translate-x-1/2 origin-bottom rounded ${accent ? "bg-teal-300" : bipolar ? "bg-purple-300" : "bg-neutral-200"}`}
          style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: "50% 14px" }}
        />
      </div>
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 rounded text-[11px] border transition-colors ${on ? "bg-teal-500/15 text-teal-300 border-teal-500/40" : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"}`}
    >{label}</button>
  );
}

function PianoKeyboard({ onDown, onUp, octave }: { onDown: (n: number) => void; onUp: (n: number) => void; octave: number }) {
  // Render 2 octaves of white keys starting at C4
  const whites: { midi: number; idx: number }[] = [];
  const semitones = [0,2,4,5,7,9,11];
  let wi = 0;
  for (let o = 0; o < 2; o++) {
    for (const s of semitones) { whites.push({ midi: 60 + o * 12 + s, idx: wi }); wi++; }
  }

  // Pointer handlers that fire note-on on press and note-off on release/leave.
  // Using onPointerDown + onPointerUp + onPointerLeave avoids stuck notes if
  // the cursor drags off the key before releasing.
  const press = (n: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    onDown(n);
  };
  const release = (n: number) => (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    onUp(n);
  };

  return (
    <div className="relative h-full w-full" style={{ minHeight: 140 }}>
      <div className="absolute inset-0 flex">
        {whites.map(w => {
          const label = KEY_LABELS[w.midi];
          const midi = w.midi + octave * 12;
          return (
            <button
              key={w.midi}
              onPointerDown={press(midi)}
              onPointerUp={release(midi)}
              onPointerLeave={release(midi)}
              onPointerCancel={release(midi)}
              className="flex-1 mx-[1px] rounded-b-md bg-gradient-to-b from-white to-neutral-200 hover:from-teal-50 hover:to-teal-200 active:from-teal-200 active:to-teal-300 border border-neutral-300 shadow-inner relative"
            >
              {label && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded bg-neutral-800 text-neutral-200 text-[9px] grid place-items-center">{label}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="absolute inset-0 flex pointer-events-none">
        {whites.map((w, i) => {
          const isLastInOct = i % 7 === 2 || i % 7 === 6;
          if (isLastInOct) return <div key={i} className="flex-1" />;
          const midi = w.midi + 1 + octave * 12;
          return (
            <div key={i} className="flex-1 relative">
              <button
                onPointerDown={press(midi)}
                onPointerUp={release(midi)}
                onPointerLeave={release(midi)}
                onPointerCancel={release(midi)}
                className="absolute right-0 translate-x-1/2 top-0 h-[62%] w-[60%] bg-gradient-to-b from-neutral-800 to-black hover:from-purple-700 hover:to-purple-900 active:from-purple-600 rounded-b-md border border-neutral-900 z-10 pointer-events-auto shadow-lg"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ===================================================================== */
/* PRESET MODAL                                                           */
/* ===================================================================== */

function PresetModal({ currentName, onClose, onPick }: { currentName: string; onClose: () => void; onPick: (p: Preset) => void }) {
  const [cat, setCat] = useState<string>("Synths");
  const [sub, setSub] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const subs = useMemo(() => Array.from(new Set(PRESETS.filter(p => p.cat === cat).map(p => p.sub))), [cat]);
  const list = useMemo(() => PRESETS.filter(p =>
    (cat === "My Presets" ? p.name === currentName : p.cat === cat) &&
    (!sub || p.sub === sub) &&
    (!q.trim() || p.name.toLowerCase().includes(q.toLowerCase()))
  ), [cat, sub, q, currentName]);

  const previewCtx = useRef<AudioContext | null>(null);
  const previewPreset = (p: Preset) => {
    if (!previewCtx.current) previewCtx.current = new AudioContext();
    const ctx = previewCtx.current;
    const now = ctx.currentTime;
    [60, 64, 67].forEach((m, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = p.wave; o.frequency.value = midiToFreq(m);
      g.gain.setValueAtTime(0, now + i * 0.1);
      g.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.65);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(960px,96vw)] h-[min(620px,86vh)] bg-[#0c0c10] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="h-12 border-b border-neutral-800 flex items-center px-4 gap-3">
          <div className="text-sm text-neutral-100 font-medium">Instrument Presets</div>
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full h-8 bg-neutral-900 border border-neutral-800 rounded-md pl-8 pr-3 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-teal-400/50"
            />
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 grid grid-cols-[200px_200px_1fr] overflow-hidden">
          {/* Categories */}
          <div className="border-r border-neutral-800 overflow-y-auto py-2">
            {PRESET_CATS.map(c => (
              <button
                key={c}
                onClick={() => { setCat(c); setSub(null); }}
                className={`w-full text-left px-4 h-10 text-[12px] flex items-center gap-2 ${cat === c ? "bg-purple-500/10 text-purple-200" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"}`}
              >{c}</button>
            ))}
          </div>
          {/* Subcategories */}
          <div className="border-r border-neutral-800 overflow-y-auto py-2">
            <button
              onClick={() => setSub(null)}
              className={`w-full text-left px-4 h-9 text-[12px] ${!sub ? "bg-teal-500/10 text-teal-200" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"}`}
            >All</button>
            {subs.map(s => (
              <button
                key={s}
                onClick={() => setSub(s)}
                className={`w-full text-left px-4 h-9 text-[12px] ${sub === s ? "bg-teal-500/10 text-teal-200" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"}`}
              >{s}</button>
            ))}
          </div>
          {/* Presets */}
          <div className="overflow-y-auto py-2">
            {list.length === 0 && <div className="px-4 py-6 text-neutral-600 text-xs">No presets</div>}
            {list.map(p => (
              <div key={p.name} className="flex items-center gap-2 px-3 h-10 hover:bg-neutral-900 group">
                <button onClick={() => previewPreset(p)} className="w-7 h-7 grid place-items-center rounded-full border border-neutral-700 text-teal-300 hover:border-teal-400 hover:bg-teal-500/10"><Play className="w-3 h-3" /></button>
                <button onClick={() => onPick(p)} className="flex-1 text-left text-[12px] text-neutral-200 truncate">{p.name}</button>
                <span className="text-[9px] uppercase text-neutral-500">{p.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* CHORDS TAB                                                             */
/* ===================================================================== */

const CHORD_QUALITIES = ["", "m", "dim", "", "m", "m", "dim"];
const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function ChordsTab({ engine, trackId }: { engine: DawEngine; trackId: string }) {
  const keyRoot = useDawStore(s => s.transport.keyRoot);
  const keyMode = useDawStore(s => s.transport.keyMode);
  const addClip = useDawStore(s => s.addClip);
  const playhead = useDawStore(s => s.transport.position);
  const bpm = useDawStore(s => s.transport.bpm);
  const wave = (useDawStore(s => s.tracks.find(t => t.id === trackId)?.synthWave) || "sawtooth") as OscillatorType;
  const [style, setStyle] = useState<"Full Chord" | "On One" | "Stabs" | "Arp Up" | "Arp Down">("Full Chord");
  const [chordType, setChordType] = useState<"Triad" | "7th" | "Add9">("Triad");
  const [strum, setStrum] = useState(0);

  const rootMidi = 60 + NOTE_NAMES.indexOf(keyRoot);

  const chords = useMemo(() => {
    return SCALE_INTERVALS.map((iv, i) => {
      const root = rootMidi + iv;
      const name = NOTE_NAMES[((NOTE_NAMES.indexOf(keyRoot)) + iv) % 12] + (keyMode === "minor" ? (i === 0 || i === 3 || i === 4 ? "m" : "") : CHORD_QUALITIES[i]);
      const intervals = chordType === "Triad" ? [0, 4, 7] : chordType === "7th" ? [0, 4, 7, 11] : [0, 4, 7, 14];
      const minorish = (keyMode === "minor") || CHORD_QUALITIES[i] === "m" || CHORD_QUALITIES[i] === "dim";
      const adj = minorish ? intervals.map(n => n === 4 ? 3 : n) : intervals;
      return { name, root, notes: adj.map(n => root + n), shortcut: "QWERTYU"[i] };
    });
  }, [rootMidi, keyMode, chordType, keyRoot]);

  const playChord = (notes: number[]) => {
    const stagger = strum * 0.02;
    notes.forEach((n, i) => setTimeout(() => triggerSynthNote(engine, trackId, n, style === "Stabs" ? 0.15 : 0.8, 0.8, wave), i * stagger * 1000));
    if (style === "Arp Up") notes.forEach((n, i) => setTimeout(() => triggerSynthNote(engine, trackId, n, 0.2, 0.8, wave), i * 120));
    if (style === "Arp Down") [...notes].reverse().forEach((n, i) => setTimeout(() => triggerSynthNote(engine, trackId, n, 0.2, 0.8, wave), i * 120));
  };


  const addChordClip = (c: { name: string; notes: number[] }) => {
    const beatsPerBar = useDawStore.getState().transport.timeSigNum || 4;
    const secPerBeat = 60 / bpm;
    const durSec = beatsPerBar * secPerBeat;
    const midi: MidiNote[] = c.notes.map((p, i) => ({
      id: newId("n"),
      start: 0,
      length: beatsPerBar,
      pitch: p,
      velocity: 0.8,
    }));
    const clip: Clip = {
      id: newId("clip"),
      trackId,
      startTime: playhead,
      duration: durSec,
      offset: 0,
      name: c.name,
      notes: midi,
      color: "#a855f7",
    };
    addClip(clip);
  };

  return (
    <div className="h-full overflow-auto p-4 flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-[11px] uppercase text-neutral-500">Key</div>
          <div className="px-3 h-7 rounded bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs flex items-center">{keyRoot} {keyMode}</div>
          <div className="flex-1" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {chords.map(c => (
            <div key={c.name} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 hover:border-teal-400/40 transition-colors group">
              <button onClick={() => playChord(c.notes)} className="w-full text-left">
                <div className="text-base text-neutral-100 font-medium">{c.name}</div>
                <div className="text-[10px] text-neutral-500 mt-1">{c.shortcut}</div>
              </button>
              <button onClick={() => addChordClip(c)} className="mt-2 w-full h-7 rounded bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px] flex items-center justify-center gap-1 hover:bg-purple-500/25">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="w-[220px] shrink-0 space-y-4">
        <div>
          <div className="text-[10px] uppercase text-neutral-500 mb-2">Playing styles</div>
          {(["Full Chord","On One","Stabs","Arp Up","Arp Down"] as const).map(s => (
            <button key={s} onClick={() => setStyle(s)} className={`w-full h-8 rounded mb-1 text-[11px] text-left px-3 ${style === s ? "bg-teal-500/15 text-teal-200 border border-teal-500/40" : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700"}`}>{s}</button>
          ))}
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500 mb-2">Auto-chords</div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            {(["Triad","7th","Add9"] as const).map(t => (
              <button key={t} onClick={() => setChordType(t)} className={`h-7 rounded text-[11px] ${chordType === t ? "bg-purple-500/15 text-purple-200 border border-purple-500/40" : "bg-neutral-900 border border-neutral-800 text-neutral-300"}`}>{t}</button>
            ))}
          </div>
          <div className="text-[10px] text-neutral-500">Strum {Math.round(strum * 100)}%</div>
          <input type="range" min={0} max={1} step={0.01} value={strum} onChange={e => setStrum(Number(e.target.value))} className="w-full accent-teal-400" />
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* PIANO ROLL TAB                                                         */
/* ===================================================================== */

type PRTool = "pencil" | "pointer" | "velocity" | "eraser";
const PR_NOTES = 36;   // 36 semitones visible
const PR_TOP_PITCH = 84;
const PR_BEATS = 16;
const PR_PX_PER_BEAT = 48;
const PR_ROW_H = 16;

// Logic-style time quantize grid (in quarter-note beats)
const PR_QUANTIZE: Array<{ id: string; label: string; beats: number }> = [
  { id: "1/1",   label: "1/1 Note",  beats: 4 },
  { id: "1/2",   label: "1/2 Note",  beats: 2 },
  { id: "1/4",   label: "1/4 Note",  beats: 1 },
  { id: "1/8",   label: "1/8 Note",  beats: 0.5 },
  { id: "1/16",  label: "1/16 Note", beats: 0.25 },
  { id: "1/32",  label: "1/32 Note", beats: 0.125 },
  { id: "1/64",  label: "1/64 Note", beats: 0.0625 },
  { id: "1/2T",  label: "1/2 Triplet (1/3)",   beats: 4/3 },
  { id: "1/4T",  label: "1/4 Triplet (1/6)",   beats: 2/3 },
  { id: "1/8T",  label: "1/8 Triplet (1/12)",  beats: 1/3 },
  { id: "1/16T", label: "1/16 Triplet (1/24)", beats: 1/6 },
  { id: "1/32T", label: "1/32 Triplet (1/48)", beats: 1/12 },
  { id: "1/64T", label: "1/64 Triplet (1/96)", beats: 1/24 },
  { id: "1/16SA", label: "1/16 Swing A", beats: 0.25 },
  { id: "1/16SB", label: "1/16 Swing B", beats: 0.25 },
  { id: "1/16SC", label: "1/16 Swing C", beats: 0.25 },
  { id: "1/16SD", label: "1/16 Swing D", beats: 0.25 },
  { id: "1/16SE", label: "1/16 Swing E", beats: 0.25 },
  { id: "1/16SF", label: "1/16 Swing F", beats: 0.25 },
  { id: "1/8SA",  label: "1/8 Swing A",  beats: 0.5 },
  { id: "1/8SB",  label: "1/8 Swing B",  beats: 0.5 },
  { id: "1/8SC",  label: "1/8 Swing C",  beats: 0.5 },
  { id: "1/8SD",  label: "1/8 Swing D",  beats: 0.5 },
  { id: "1/8SE",  label: "1/8 Swing E",  beats: 0.5 },
  { id: "1/8SF",  label: "1/8 Swing F",  beats: 0.5 },
];

// Logic-style scale quantize presets
const PR_SCALES: Array<{ id: string; label: string; intervals: number[] | null }> = [
  { id: "off",        label: "Off",            intervals: null },
  { id: "major",      label: "Major",          intervals: [0,2,4,5,7,9,11] },
  { id: "minor",      label: "Natural Minor",  intervals: [0,2,3,5,7,8,10] },
  { id: "harmonic",   label: "Harmonic Minor", intervals: [0,2,3,5,7,8,11] },
  { id: "melodic",    label: "Melodic Minor",  intervals: [0,2,3,5,7,9,11] },
  { id: "dorian",     label: "Dorian",         intervals: [0,2,3,5,7,9,10] },
  { id: "phrygian",   label: "Phrygian",       intervals: [0,1,3,5,7,8,10] },
  { id: "lydian",     label: "Lydian",         intervals: [0,2,4,6,7,9,11] },
  { id: "mixolydian", label: "Mixolydian",     intervals: [0,2,4,5,7,9,10] },
  { id: "locrian",    label: "Locrian",        intervals: [0,1,3,5,6,8,10] },
  { id: "majorPent",  label: "Major Pent",     intervals: [0,2,4,7,9] },
  { id: "minorPent",  label: "Minor Pent",     intervals: [0,3,5,7,10] },
  { id: "majorBlues", label: "Major Blues",    intervals: [0,2,3,4,7,9] },
  { id: "minorBlues", label: "Minor Blues",    intervals: [0,3,5,6,7,10] },
  { id: "chromatic",  label: "Chromatic",      intervals: [0,1,2,3,4,5,6,7,8,9,10,11] },
];

function PianoRollTab({ engine, trackId }: { engine: DawEngine; trackId: string }) {
  const allClips = useDawStore(s => s.clips);
  const clips = useMemo(() => allClips.filter(c => c.trackId === trackId), [allClips, trackId]);
  const addClip = useDawStore(s => s.addClip);
  const updateClip = useDawStore(s => s.updateClip);
  const playhead = useDawStore(s => s.transport.position);
  const bpm = useDawStore(s => s.transport.bpm);

  const activeClip = useMemo(
    () => clips.find(c => c.notes && playhead >= c.startTime && playhead < c.startTime + c.duration) ?? clips.find(c => c.notes),
    [clips, playhead]
  );

  const ensureClip = (): string => {
    if (activeClip) return activeClip.id;
    const id = newId("clip");
    addClip({
      id, trackId, startTime: playhead, duration: PR_BEATS * (60 / bpm),
      offset: 0, name: "MIDI", notes: [], color: "#a855f7",
    });
    return id;
  };

  const [tool, setTool] = useState<PRTool>("pencil");
  const [velocity, setVelocity] = useState(0.8);
  const [quantizeId, setQuantizeId] = useState<string>("1/16");
  const [strength, setStrength] = useState(100);
  const [swing, setSwing] = useState(0);
  const [scaleRoot, setScaleRoot] = useState<string>("C");
  const [scaleId, setScaleId] = useState<string>("off");

  const snapBeats = useMemo(() => PR_QUANTIZE.find(q => q.id === quantizeId)?.beats ?? 0.25, [quantizeId]);
  // Swing presets A–F → 50/54/58/62/66/70 % swing applied automatically.
  useEffect(() => {
    const m = quantizeId.match(/S([A-F])$/);
    if (m) setSwing(50 + (m[1].charCodeAt(0) - 65) * 4);
  }, [quantizeId]);
  const scale = useMemo(() => PR_SCALES.find(s => s.id === scaleId) ?? PR_SCALES[0], [scaleId]);
  const scaleSet = useMemo(() => {
    if (!scale.intervals) return null;
    const rootIdx = NOTE_NAMES.indexOf(scaleRoot);
    return new Set(scale.intervals.map(i => (rootIdx + i + 12) % 12));
  }, [scale, scaleRoot]);

  const snapToScale = (pitch: number): number => {
    if (!scaleSet) return pitch;
    let p = pitch;
    for (let i = 0; i < 12; i++) {
      if (scaleSet.has(((p % 12) + 12) % 12)) return p;
      p--;
    }
    return pitch;
  };

  const notes = activeClip?.notes ?? [];
  const setNotes = (next: MidiNote[]) => {
    const id = activeClip?.id ?? ensureClip();
    updateClip(id, { notes: next });
  };

  const applyQuantize = () => {
    if (!activeClip || notes.length === 0) return;
    const str = strength / 100;
    const sw = swing / 100;
    const next = notes.map(n => {
      const target = Math.round(n.start / snapBeats) * snapBeats;
      let start = n.start + (target - n.start) * str;
      // Swing: delay off-beats (odd-indexed grid positions)
      const gridIdx = Math.round(start / snapBeats);
      if (gridIdx % 2 === 1) start += snapBeats * 0.5 * sw;
      const pitch = snapToScale(n.pitch);
      return { ...n, start: Math.max(0, start), pitch };
    });
    setNotes(next);
  };

  const gridRef = useRef<HTMLDivElement | null>(null);

  const handleDown = (e: React.PointerEvent) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridRef.current.scrollLeft;
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    const beat = Math.max(0, Math.round((x / PR_PX_PER_BEAT) / snapBeats) * snapBeats);
    let pitch = PR_TOP_PITCH - Math.floor(y / PR_ROW_H);
    pitch = snapToScale(pitch);
    if (tool === "pencil") {
      const id = activeClip?.id ?? ensureClip();
      const cur = useDawStore.getState().clips.find(c => c.id === id)?.notes ?? [];
      updateClip(id, { notes: [...cur, { id: newId("n"), start: beat, length: Math.max(0.25, snapBeats), pitch, velocity }] });
      triggerSynthNote(engine, trackId, pitch, 0.3, velocity);
    } else if (tool === "eraser") {
      const hit = notes.find(n => n.pitch === pitch && beat >= n.start && beat < n.start + n.length);
      if (hit) setNotes(notes.filter(n => n.id !== hit.id));
    }
  };

  return (
    <div className="h-full flex">
      {/* Inspector (Logic-style) */}
      <div className="w-56 shrink-0 border-r border-neutral-900 p-3 space-y-3 overflow-y-auto bg-[#0c0c10]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Tools</div>
          <div className="grid grid-cols-4 gap-1">
            <ToolBtn active={tool === "pointer"}  onClick={() => setTool("pointer")}  icon={<MousePointer2 className="w-3.5 h-3.5" />} />
            <ToolBtn active={tool === "pencil"}   onClick={() => setTool("pencil")}   icon={<Pencil className="w-3.5 h-3.5" />} />
            <ToolBtn active={tool === "velocity"} onClick={() => setTool("velocity")} icon={<Sliders className="w-3.5 h-3.5" />} />
            <ToolBtn active={tool === "eraser"}   onClick={() => setTool("eraser")}   icon={<Trash2 className="w-3.5 h-3.5" />} />
          </div>
        </div>

        {/* Time Quantize */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Time Quantize</div>
          <select
            value={quantizeId}
            onChange={e => setQuantizeId(e.target.value)}
            className="w-full h-7 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-neutral-200 px-1"
          >
            {PR_QUANTIZE.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
        </div>

        {/* Strength + Swing */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span className="uppercase tracking-wider">Strength</span>
            <span className="text-teal-300">{strength}</span>
          </div>
          <input type="range" min={0} max={100} value={strength} onChange={e => setStrength(Number(e.target.value))} className="w-full accent-teal-400" />
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span className="uppercase tracking-wider">Swing</span>
            <span className="text-teal-300">{swing}</span>
          </div>
          <input type="range" min={0} max={100} value={swing} onChange={e => setSwing(Number(e.target.value))} className="w-full accent-teal-400" />
        </div>

        {/* Scale Quantize */}
        <div className="pt-1 border-t border-neutral-900">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 mt-2">Scale Quantize</div>
          <div className="grid grid-cols-2 gap-1 mb-1">
            <select
              value={scaleRoot}
              onChange={e => setScaleRoot(e.target.value)}
              disabled={scaleId === "off"}
              className="h-7 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-neutral-200 px-1 disabled:opacity-40"
            >
              {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={scaleId}
              onChange={e => setScaleId(e.target.value)}
              className="h-7 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-neutral-200 px-1"
            >
              {PR_SCALES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Velocity */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span className="uppercase tracking-wider">Velocity</span>
            <span className="text-purple-300">{Math.round(velocity * 127)}</span>
          </div>
          <input type="range" min={1} max={127} value={Math.round(velocity * 127)} onChange={e => setVelocity(Number(e.target.value) / 127)} className="w-full accent-purple-400" />
        </div>

        <button
          onClick={applyQuantize}
          className="w-full h-8 rounded text-[11px] font-medium bg-gradient-to-r from-teal-500/30 to-purple-500/30 border border-teal-500/40 text-teal-100 hover:from-teal-500/40 hover:to-purple-500/40"
        >Quantize Now</button>

        <button
          onClick={() => {
            if (!activeClip || notes.length < 2) return;
            const sorted = [...notes].sort((a, b) => a.start - b.start);
            const merged: MidiNote[] = [];
            for (const n of sorted) {
              const last = merged[merged.length - 1];
              if (last && last.pitch === n.pitch && Math.abs((last.start + last.length) - n.start) < 0.05) {
                last.length = (n.start + n.length) - last.start;
              } else merged.push({ ...n });
            }
            setNotes(merged);
          }}
          className="w-full h-7 rounded text-[11px] bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700"
        >Glue Notes</button>
      </div>


      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto relative bg-[#0a0a0c]" onPointerDown={handleDown}>
        <div className="relative" style={{ width: PR_BEATS * PR_PX_PER_BEAT + 40, height: PR_NOTES * PR_ROW_H }}>
          {/* Piano keys – proper white/black look matching the floating keyboard */}
          <div className="absolute left-0 top-0 w-12 h-full z-10 border-r border-neutral-700">
            {Array.from({ length: PR_NOTES }).map((_, r) => {
              const pitch = PR_TOP_PITCH - r;
              const isBlack = [1,3,6,8,10].includes(((pitch % 12) + 12) % 12);
              const isC = pitch % 12 === 0;
              return (
                <div
                  key={r}
                  onPointerDown={(e) => { e.stopPropagation(); triggerSynthNote(engine, trackId, pitch, 0.3, 0.8); }}
                  className={`text-[8px] border-b ${isBlack ? "bg-neutral-900 text-neutral-300 border-neutral-950" : "bg-gradient-to-r from-neutral-100 to-neutral-300 text-neutral-700 border-neutral-400"} px-1 grid items-center cursor-pointer hover:brightness-110`}
                  style={{ height: PR_ROW_H }}
                >
                  {isC ? `C${Math.floor(pitch / 12) - 1}` : isBlack ? "" : NOTE_NAMES[pitch % 12]}
                </div>
              );
            })}
          </div>
          {/* Rows */}
          <div className="absolute left-12 top-0 right-0 bottom-0">
            {Array.from({ length: PR_NOTES }).map((_, r) => {
              const pitch = PR_TOP_PITCH - r;
              const isBlack = [1,3,6,8,10].includes(((pitch % 12) + 12) % 12);
              const isC = pitch % 12 === 0;
              return <div key={r} className={`${isBlack ? "bg-neutral-900/70" : "bg-[#15151c]"} ${isC ? "border-b border-neutral-600/70" : "border-b border-neutral-700/40"}`} style={{ height: PR_ROW_H }} />;
            })}
            {/* Beat lines — brighter so they read on the dark grid */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: PR_BEATS + 1 }).map((_, b) => (
                <div key={b} className={`absolute top-0 bottom-0`} style={{ left: b * PR_PX_PER_BEAT, width: b % 4 === 0 ? 2 : 1, background: b % 4 === 0 ? "rgba(165,180,200,0.55)" : "rgba(120,130,150,0.30)" }} />
              ))}
            </div>
            {/* Notes */}
            {notes.map(n => (
              <div
                key={n.id}
                className="absolute rounded-sm bg-gradient-to-r from-purple-400 to-teal-300 border border-purple-300 shadow"
                style={{
                  left: n.start * PR_PX_PER_BEAT,
                  top: (PR_TOP_PITCH - n.pitch) * PR_ROW_H + 1,
                  width: Math.max(6, n.length * PR_PX_PER_BEAT - 2),
                  height: PR_ROW_H - 2,
                  opacity: 0.6 + n.velocity * 0.4,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (tool === "eraser") { setNotes(notes.filter(x => x.id !== n.id)); return; }
                  const start = { x: e.clientX, y: e.clientY, n: { ...n } };
                  const target = e.currentTarget;
                  const edge = e.nativeEvent.offsetX > target.clientWidth - 6;
                  const move = (ev: PointerEvent) => {
                    const dx = (ev.clientX - start.x) / PR_PX_PER_BEAT;
                    const dy = Math.round((ev.clientY - start.y) / PR_ROW_H);
                    if (edge) {
                      setNotes(notes.map(x => x.id === n.id ? { ...x, length: Math.max(snapBeats, Math.round((start.n.length + dx) / snapBeats) * snapBeats) } : x));
                    } else {
                      setNotes(notes.map(x => x.id === n.id ? {
                        ...x,
                        start: Math.max(0, Math.round((start.n.start + dx) / snapBeats) * snapBeats),
                        pitch: Math.max(0, Math.min(127, start.n.pitch - dy)),
                      } : x));
                    }
                  };
                  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 grid place-items-center rounded ${active ? "bg-teal-500/20 text-teal-200 border border-teal-500/40" : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
    >{icon}</button>
  );
}

/* ===================================================================== */
/* EFFECTS TAB                                                            */
/* ===================================================================== */

function EffectsTab({ trackId }: { trackId: string }) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 [&>div]:!static [&>div]:!w-full [&>div]:!h-full [&>div]:!border-0 [&>div]:!shadow-none">
        <FxRack trackId={trackId} onClose={() => {}} />
      </div>
    </div>
  );
}


/* ===================================================================== */
/* BEAT GRID TAB — Soundtrap-style step sequencer for drum tracks         */
/* ===================================================================== */

type DrumRow = { name: string; pitch: number; kind: "kick" | "snare" | "hat" | "clap" | "tom" | "perc" | "ride" | "crash" };
const DRUM_ROWS: DrumRow[] = [
  { name: "Kick",          pitch: 36, kind: "kick" },
  { name: "Snare",         pitch: 38, kind: "snare" },
  { name: "Clap",          pitch: 39, kind: "clap" },
  { name: "Hi-Hat Closed", pitch: 42, kind: "hat" },
  { name: "Hi-Hat Open",   pitch: 46, kind: "hat" },
  { name: "Crash",         pitch: 49, kind: "crash" },
  { name: "Ride",          pitch: 51, kind: "ride" },
  { name: "Low Tom",       pitch: 41, kind: "tom" },
  { name: "Mid Tom",       pitch: 45, kind: "tom" },
  { name: "High Tom",      pitch: 48, kind: "tom" },
];

function BeatGridTab({ engine, trackId }: { engine: DawEngine; trackId: string }) {
  const allClips = useDawStore(s => s.clips);
  const trackClips = useMemo(() => allClips.filter(c => c.trackId === trackId && c.notes), [allClips, trackId]);
  const addClip = useDawStore(s => s.addClip);
  const updateClip = useDawStore(s => s.updateClip);
  const bpm = useDawStore(s => s.transport.bpm);
  const playhead = useDawStore(s => s.transport.position);
  const [bars, setBars] = useState<1 | 2 | 4 | 8>(2);
  const [stepsPerBeat, setStepsPerBeat] = useState<2 | 4>(4);

  const beatsPerBar = useDawStore.getState().transport.timeSigNum || 4;
  const totalSteps = bars * beatsPerBar * stepsPerBeat;
  const stepBeats = 1 / stepsPerBeat;
  const secPerBeat = 60 / Math.max(1, bpm);

  const activeClip = useMemo(
    () => trackClips.find(c => playhead >= c.startTime && playhead < c.startTime + c.duration) ?? trackClips[0],
    [trackClips, playhead]
  );

  const ensureClip = (): string => {
    if (activeClip) return activeClip.id;
    const id = newId("clip");
    addClip({
      id, trackId,
      startTime: playhead,
      duration: bars * beatsPerBar * secPerBeat,
      offset: 0,
      name: "Beat Pattern",
      notes: [],
      color: "#22d3ee",
    });
    return id;
  };

  const hasStep = (pitch: number, step: number): boolean => {
    if (!activeClip?.notes) return false;
    const t = step * stepBeats;
    return activeClip.notes.some(n => n.pitch === pitch && Math.abs(n.start - t) < 0.001);
  };

  const toggleStep = (pitch: number, step: number) => {
    const id = activeClip?.id ?? ensureClip();
    const existing = useDawStore.getState().clips.find(c => c.id === id);
    const notes = existing?.notes ?? [];
    const t = step * stepBeats;
    const matchIdx = notes.findIndex(n => n.pitch === pitch && Math.abs(n.start - t) < 0.001);
    let next: MidiNote[];
    if (matchIdx >= 0) {
      next = notes.filter((_, i) => i !== matchIdx);
    } else {
      next = [...notes, { id: newId("n"), pitch, start: t, length: stepBeats * 0.9, velocity: 0.85 }];
      const row = DRUM_ROWS.find(r => r.pitch === pitch);
      if (row) triggerDrumHit(engine, trackId, row.kind);
    }
    updateClip(id, {
      notes: next,
      duration: Math.max(existing?.duration ?? 0, bars * beatsPerBar * secPerBeat),
    });
  };

  const clearPattern = () => { if (activeClip) updateClip(activeClip.id, { notes: [] }); };

  const playStep = useMemo(() => {
    if (!activeClip) return -1;
    const rel = playhead - activeClip.startTime;
    if (rel < 0 || rel > activeClip.duration) return -1;
    return Math.floor((rel / secPerBeat) / stepBeats);
  }, [playhead, activeClip, secPerBeat, stepBeats]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 flex items-center gap-3 border-b border-neutral-900 text-[11px] text-neutral-300">
        <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Beat Maker</span>
        <div className="h-4 w-px bg-neutral-800" />
        <label className="flex items-center gap-1.5">
          <span className="text-neutral-500">Bars</span>
          <select value={bars} onChange={e => setBars(Number(e.target.value) as any)} className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
            <option value={1}>1</option><option value={2}>2</option><option value={4}>4</option><option value={8}>8</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-neutral-500">Grid</span>
          <select value={stepsPerBeat} onChange={e => setStepsPerBeat(Number(e.target.value) as any)} className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
            <option value={2}>1/8</option><option value={4}>1/16</option>
          </select>
        </label>
        <div className="flex-1" />
        <button onClick={clearPattern} className="h-6 px-2 rounded border border-neutral-800 text-neutral-400 hover:text-neutral-100 hover:border-neutral-700">Clear</button>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="min-w-full inline-block">
          {DRUM_ROWS.map(row => (
            <div key={row.pitch} className="flex items-stretch border-b border-neutral-900">
              <div className="w-32 shrink-0 px-3 flex items-center text-[11px] text-neutral-300 bg-neutral-950 border-r border-neutral-800">
                <button
                  onClick={() => triggerDrumHit(engine, trackId, row.kind)}
                  className="w-5 h-5 grid place-items-center rounded-full bg-neutral-900 border border-neutral-800 hover:border-teal-400/60 text-teal-300 mr-2"
                  title={`Preview ${row.name}`}
                ><Play className="w-2.5 h-2.5" /></button>
                <span className="truncate">{row.name}</span>
              </div>
              <div className="flex flex-1 min-w-0">
                {Array.from({ length: totalSteps }).map((_, step) => {
                  const on = hasStep(row.pitch, step);
                  const isDownbeat = step % (beatsPerBar * stepsPerBeat) === 0;
                  const isBeat = step % stepsPerBeat === 0;
                  const isPlaying = step === playStep;
                  return (
                    <button
                      key={step}
                      onClick={() => toggleStep(row.pitch, step)}
                      className={`flex-1 min-w-[18px] h-8 m-[1px] rounded-sm transition-colors ${
                        on
                          ? "bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
                          : isBeat
                            ? "bg-neutral-800/80 hover:bg-neutral-700/80"
                            : "bg-neutral-900/80 hover:bg-neutral-800/80"
                      } ${isDownbeat ? "border-l border-neutral-700" : ""} ${isPlaying ? "ring-1 ring-emerald-400/70" : ""}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
