import { useMemo, useRef, useState } from "react";
import { Search, Play, X } from "lucide-react";
import { midiToFreq, startSynthNote } from "../engine/DawEngine";
import { PRESETS, PRESET_CATS, type Preset } from "../engine/presetData";

export { PRESETS, PRESET_CATS };
export type { Preset };

export function PresetModal({ currentName, onClose, onPick }: { currentName: string; onClose: () => void; onPick: (p: Preset) => void }) {
  const [cat, setCat] = useState<string>("Leads");
  const [sub, setSub] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const subs = useMemo(() => Array.from(new Set(PRESETS.filter(p => p.cat === cat).map(p => p.sub))), [cat]);
  const list = useMemo(() => PRESETS.filter(p =>
    (cat === "My Presets" ? p.name === currentName : p.cat === cat) &&
    (!sub || p.sub === sub) &&
    (!q.trim() || p.name.toLowerCase().includes(q.toLowerCase()))
  ), [cat, sub, q, currentName]);

  // Preview uses the real synth engine via a tiny throwaway ctx-based chain.
  // For simplicity, we mount a hidden gain to the preview AudioContext destination
  // and call startSynthNote-equivalent inline.
  const previewCtx = useRef<AudioContext | null>(null);
  const previewPreset = (p: Preset) => {
    if (!previewCtx.current) previewCtx.current = new AudioContext();
    const ctx = previewCtx.current;
    // Synthesize a 3-note arpeggio using a simplified version of the engine voice.
    const playNote = (midi: number, when: number, dur: number) => {
      const oct = p.octave ?? 0;
      const freq = midiToFreq(midi + oct * 12);
      const unison = Math.max(1, Math.min(3, p.unison ?? 1));
      const oscs: OscillatorNode[] = [];
      const mix = ctx.createGain();
      for (let i = 0; i < unison; i++) {
        const o = ctx.createOscillator();
        o.type = p.wave;
        o.frequency.value = freq;
        if (unison > 1 && p.detune) o.detune.value = p.detune * ((i / (unison - 1)) * 2 - 1);
        else if (p.detune) o.detune.value = p.detune;
        const g = ctx.createGain(); g.gain.value = 1 / Math.sqrt(unison);
        o.connect(g).connect(mix);
        oscs.push(o);
      }
      if ((p.subLevel ?? 0) > 0.001) {
        const so = ctx.createOscillator(); so.type = "sine"; so.frequency.value = freq / 2;
        const sg = ctx.createGain(); sg.gain.value = p.subLevel!;
        so.connect(sg).connect(mix);
        oscs.push(so);
      }
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = p.filterHz ?? 8000;
      filter.Q.value = p.filterQ ?? 0.7;
      const env = ctx.createGain();
      const peak = (p.gain ?? 0.42) * 0.55;
      const a = Math.max(0.001, p.attack ?? 0.01);
      const d = Math.max(0.001, p.decay ?? 0.15);
      const s = Math.max(0, Math.min(1, p.sustain ?? 0.7));
      env.gain.setValueAtTime(0.0001, when);
      env.gain.linearRampToValueAtTime(peak, when + a);
      env.gain.linearRampToValueAtTime(peak * s, when + a + d);
      env.gain.setValueAtTime(env.gain.value, when + dur);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur + (p.release ?? 0.2));
      mix.connect(filter).connect(env).connect(ctx.destination);
      oscs.forEach(o => { o.start(when); o.stop(when + dur + (p.release ?? 0.2) + 0.05); });
    };
    const now = ctx.currentTime + 0.02;
    [60, 64, 67].forEach((m, i) => playNote(m, now + i * 0.18, 0.35));
    void startSynthNote; // avoid tree-shaking of import (engine is the source of truth)
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 grid place-items-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(960px,96vw)] h-[min(620px,86vh)] bg-[#0c0c10] border border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="h-12 border-b border-neutral-800 flex items-center px-4 gap-3">
          <div className="text-sm text-neutral-100 font-medium">Instrument Presets <span className="text-neutral-500 text-[10px] ml-2">{PRESETS.length} sounds</span></div>
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
          <div className="border-r border-neutral-800 overflow-y-auto py-2">
            {PRESET_CATS.map(c => (
              <button
                key={c}
                onClick={() => { setCat(c); setSub(null); }}
                className={`w-full text-left px-4 h-10 text-[12px] flex items-center gap-2 ${cat === c ? "bg-purple-500/10 text-purple-200" : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"}`}
              >{c}</button>
            ))}
          </div>
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
