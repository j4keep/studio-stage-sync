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

        {/* Mode toggle (piano vs musical-typing) — mirrors Logic's two icons */}
        <div className="ml-2 flex items-center rounded border border-neutral-800 overflow-hidden">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMode("piano"); }}
            title="Piano view"
            className={`w-6 h-5 grid place-items-center ${mode === "piano" ? "bg-cyan-500/30 text-cyan-200" : "text-neutral-500 hover:text-neutral-300"}`}
          ><Piano className="w-3 h-3" /></button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setMode("typing"); }}
            title="Musical typing (computer keyboard)"
            className={`w-6 h-5 grid place-items-center border-l border-neutral-800 ${mode === "typing" ? "bg-cyan-500/30 text-cyan-200" : "text-neutral-500 hover:text-neutral-300"}`}
          ><KeyboardIcon className="w-3 h-3" /></button>
        </div>

        <div className="flex-1" />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOctaveStart(o => Math.max(0, o - 12)); }}
          className="w-5 h-5 grid place-items-center text-neutral-400 hover:text-cyan-300 rounded border border-neutral-800"
          title="Octave down"
        ><Minus className="w-3 h-3" /></button>
        <span className="text-[9px] text-neutral-500 tabular-nums">C{Math.floor(octaveStart / 12) - 1}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOctaveStart(o => Math.min(96, o + 12)); }}
          className="w-5 h-5 grid place-items-center text-neutral-400 hover:text-cyan-300 rounded border border-neutral-800"
          title="Octave up"
        ><Plus className="w-3 h-3" /></button>
        {mode === "piano" && (
          <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setOctaves(o => Math.max(2, o - 1)); }}
              className="px-1 text-[9px] text-neutral-500 hover:text-neutral-300"
              title="Fewer octaves"
            >−</button>
            <span className="text-[9px] text-neutral-500">{octaves} oct</span>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setOctaves(o => Math.min(5, o + 1)); }}
              className="px-1 text-[9px] text-neutral-500 hover:text-neutral-300"
              title="More octaves"
            >+</button>
          </>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-5 h-5 grid place-items-center text-neutral-400 hover:text-red-400 rounded border border-neutral-800"
          title="Close keyboard"
        ><X className="w-3 h-3" /></button>
      </div>

      {mode === "piano" ? (
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
      ) : (
        <TypingView
          octaveStart={octaveStart}
          flashed={flashed}
          onTap={(m) => playNote(m)}
        />
      )}
    </div>
  );
}

/** Musical-typing layout — shows the computer-keyboard mapping like Logic Pro's musical typing. */
function TypingView({
  octaveStart,
  flashed,
  onTap,
}: {
  octaveStart: number;
  flashed: Set<number>;
  onTap: (midi: number) => void;
}) {
  // Layout based on Logic's musical typing
  // Top row (black-key-ish): W E _ T Y U _ O P
  // Bottom row (white keys): A S D F G H J K L ;
  const base = octaveStart - 48; // offset relative to C3 baseline (KEYBOARD_MAP is C3 based)
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
  const KEY_W = 36;
  return (
    <div className="p-3">
      <div className="flex gap-1 mb-1 ml-[18px]">
        {blackRow.map((b, i) => (
          b.midi != null ? (
            <button
              key={i}
              onPointerDown={(e) => { e.stopPropagation(); onTap(b.midi!); }}
              style={{ width: KEY_W, height: 42 }}
              className={`rounded text-[10px] font-semibold ${flashed.has(b.midi) ? "bg-cyan-500 text-black" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700 border border-neutral-700"}`}
            >{b.key}</button>
          ) : (
            <div key={i} style={{ width: KEY_W, height: 42 }} />
          )
        ))}
      </div>
      <div className="flex gap-1">
        {whiteRow.map((w) => (
          <button
            key={w.key}
            onPointerDown={(e) => { e.stopPropagation(); onTap(w.midi); }}
            style={{ width: KEY_W, height: 56 }}
            className={`rounded text-[11px] font-semibold border ${flashed.has(w.midi) ? "bg-cyan-300 text-black border-cyan-200" : "bg-white text-neutral-700 hover:bg-neutral-100 border-neutral-300"}`}
          >{w.key}</button>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-neutral-500 text-center">
        Press the highlighted keys on your computer keyboard to play
      </div>
    </div>
  );
}

