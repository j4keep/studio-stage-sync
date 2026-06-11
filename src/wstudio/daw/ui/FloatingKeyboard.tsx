import { useEffect, useMemo, useRef, useState } from "react";
import { useDawStore } from "../state/DawStore";
import { triggerSynthNote, type DawEngine } from "../engine/DawEngine";
import { X, Minus, Plus, Music2, Piano, Keyboard as KeyboardIcon } from "lucide-react";


/**
 * On-screen MIDI keyboard. Sends notes to the currently selected (or first)
 * instrument track. Computer keyboard acts as a MIDI controller (A W S E D F T G Y H U J K).
 * Supports slide-to-play: hold mouse/touch and drag across keys to glissando.
 */

const KEYBOARD_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
};

interface Key {
  midi: number;
  label: string;
  black: boolean;
  whiteIndex: number; // index among white keys (for positioning)
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

interface Props {
  engine: DawEngine;
  onClose: () => void;
}

export function FloatingKeyboard({ engine, onClose }: Props) {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);

  const instruments = tracks.filter(t => t.kind === "instrument");
  const active =
    instruments.find(t => t.id === selectedTrackId) ||
    instruments[0] ||
    null;

  const [octaveStart, setOctaveStart] = useState(48); // C3
  const [octaves, setOctaves] = useState(3);
  const [mode, setMode] = useState<"piano" | "typing">("piano");
  const keys = useMemo(() => buildKeys(octaveStart, octaves), [octaveStart, octaves]);
  const whiteCount = keys.filter(k => !k.black).length;
  const WHITE_W = 26;
  const WHITE_H = 110;
  const BLACK_W = 16;
  const BLACK_H = 70;


  // Drag-to-move window
  const [pos, setPos] = useState({ x: 80, y: window.innerHeight - 220 });
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

  // Active key flash
  const [flashed, setFlashed] = useState<Set<number>>(new Set());
  const flash = (m: number) => {
    setFlashed(prev => {
      const n = new Set(prev);
      n.add(m);
      return n;
    });
    setTimeout(() => {
      setFlashed(prev => {
        const n = new Set(prev);
        n.delete(m);
        return n;
      });
    }, 220);
  };

  const playNote = (midi: number) => {
    let t = active;
    if (!t) {
      const id = addTrack("instrument", "Synth");
      updateTrack(id, { instrument: "synth" });
      selectTrack(id);
      // Defer note until next tick so chain exists
      setTimeout(() => triggerSynthNote(engine, id, midi), 30);
      flash(midi);
      return;
    }
    triggerSynthNote(engine, t.id, midi);
    flash(midi);
  };

  // Computer-keyboard MIDI input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const n = KEYBOARD_MAP[e.key.toLowerCase()];
      if (n != null && !e.repeat) {
        const base = octaveStart - 48; // offset from C3
        playNote(n + base);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [octaveStart, active?.id, engine]);

  // Slide-to-play: track if mouse is pressed
  const pressedRef = useRef(false);
  const lastNoteRef = useRef<number | null>(null);

  const onKeyDown = (m: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    pressedRef.current = true;
    lastNoteRef.current = m;
    playNote(m);
  };
  const onKeyEnter = (m: number) => () => {
    if (!pressedRef.current) return;
    if (lastNoteRef.current === m) return;
    lastNoteRef.current = m;
    playNote(m);
  };
  useEffect(() => {
    const up = () => { pressedRef.current = false; lastNoteRef.current = null; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const width = whiteCount * WHITE_W;

  return (
    <div
      className="fixed z-[80] rounded-lg border border-neutral-700 bg-neutral-950/95 backdrop-blur shadow-2xl shadow-black/60 select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        className="h-7 px-2 flex items-center gap-2 border-b border-neutral-800 cursor-move bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-t-lg"
      >
        <Music2 className="w-3 h-3 text-cyan-300" />
        <span className="text-[10px] uppercase tracking-wider text-neutral-300">
          Keyboard {active ? `— ${active.name}` : "— no instrument track"}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setOctaveStart(o => Math.max(0, o - 12))}
          className="w-5 h-5 grid place-items-center text-neutral-400 hover:text-cyan-300 rounded border border-neutral-800"
          title="Octave down"
        ><Minus className="w-3 h-3" /></button>
        <span className="text-[9px] text-neutral-500 tabular-nums">C{Math.floor(octaveStart / 12) - 1}</span>
        <button
          onClick={() => setOctaveStart(o => Math.min(96, o + 12))}
          className="w-5 h-5 grid place-items-center text-neutral-400 hover:text-cyan-300 rounded border border-neutral-800"
          title="Octave up"
        ><Plus className="w-3 h-3" /></button>
        <button
          onClick={() => setOctaves(o => Math.max(2, o - 1))}
          className="px-1 text-[9px] text-neutral-500 hover:text-neutral-300"
          title="Fewer octaves"
        >−</button>
        <span className="text-[9px] text-neutral-500">{octaves} oct</span>
        <button
          onClick={() => setOctaves(o => Math.min(5, o + 1))}
          className="px-1 text-[9px] text-neutral-500 hover:text-neutral-300"
          title="More octaves"
        >+</button>
        <button
          onClick={onClose}
          className="w-5 h-5 grid place-items-center text-neutral-400 hover:text-red-400 rounded border border-neutral-800"
          title="Close keyboard"
        ><X className="w-3 h-3" /></button>
      </div>

      <div className="p-2">
        <div className="relative touch-none" style={{ width, height: WHITE_H }}>
          {keys.filter(k => !k.black).map((k) => (
            <button
              key={k.midi}
              onPointerDown={onKeyDown(k.midi)}
              onPointerEnter={onKeyEnter(k.midi)}
              className={`absolute top-0 border border-neutral-300 rounded-b-sm transition-colors ${
                flashed.has(k.midi) ? "bg-cyan-200" : "bg-white hover:bg-neutral-100"
              }`}
              style={{ left: k.whiteIndex * WHITE_W, width: WHITE_W, height: WHITE_H }}
            >
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-neutral-500 pointer-events-none">
                {k.midi % 12 === 0 ? k.label : ""}
              </span>
            </button>
          ))}
          {keys.filter(k => k.black).map((k) => {
            // Position black key over the gap between current and previous white key
            const prevWhite = keys.filter(x => !x.black && x.midi < k.midi).length;
            const left = prevWhite * WHITE_W - BLACK_W / 2;
            return (
              <button
                key={k.midi}
                onPointerDown={onKeyDown(k.midi)}
                onPointerEnter={onKeyEnter(k.midi)}
                className={`absolute top-0 z-10 border border-neutral-700 rounded-b-sm transition-colors ${
                  flashed.has(k.midi) ? "bg-cyan-700" : "bg-neutral-900 hover:bg-neutral-800"
                }`}
                style={{ left, width: BLACK_W, height: BLACK_H }}
              />
            );
          })}
        </div>
        <div className="mt-1 text-[9px] text-neutral-500 text-center">
          Slide across keys to glissando · Computer keys: A W S E D F T G Y H U J K
        </div>
      </div>
    </div>
  );
}
