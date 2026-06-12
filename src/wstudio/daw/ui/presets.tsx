import { useMemo, useRef, useState } from "react";
import { Search, Play, X } from "lucide-react";
import { midiToFreq } from "../engine/DawEngine";

export type Preset = { name: string; wave: "sine" | "triangle" | "sawtooth" | "square"; cat: string; sub: string };

export const PRESET_CATS = ["My Presets", "Guitar", "Bass & 808s", "Orchestral", "Keys", "Synths", "Drums & Machines", "FX"] as const;

export const PRESETS: Preset[] = [
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

export function PresetModal({ currentName, onClose, onPick }: { currentName: string; onClose: () => void; onPick: (p: Preset) => void }) {
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
    <div className="fixed inset-0 z-[120] bg-black/70 grid place-items-center p-6" onClick={onClose}>
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
