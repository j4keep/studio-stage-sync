import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Play, Pause, Plus, Heart, X, Music2, Lock, Loader2 } from "lucide-react";
import { ALL_LOOPS, CATEGORY_CHIPS, LOOP_PACKS } from "../lib/loopCatalog";
import { generateLoop, type LoopDef } from "../lib/loopGenerator";
import { computePeaks } from "../engine/Peaks";
import { useDawStore, newId } from "../state/DawStore";
import type { DawEngine } from "../engine/DawEngine";
import { useProGate } from "@/hooks/use-pro-gate";
import {
  listUserSounds, userRowToLoopDef, fetchAndDecodeUserSound, type UserSoundRow,
} from "@/lib/userSoundLibrary";

const bufferCache = new Map<string, AudioBuffer>();
function getOrGenerate(def: LoopDef): AudioBuffer {
  const c = bufferCache.get(def.id);
  if (c) return c;
  const buf = generateLoop(def);
  bufferCache.set(def.id, buf);
  return buf;
}

export function SoundLibraryPanel({
  engine,
  open,
  onClose,
  initialTab = "sounds",
}: {
  engine: DawEngine;
  open: boolean;
  onClose: () => void;
  initialTab?: "sounds" | "packs";
}) {
  const [tab, setTab] = useState<"sounds" | "packs">(initialTab);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<LoopDef["category"] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [activePack, setActivePack] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const addTrack = useDawStore(s => s.addTrack);
  const addClip = useDawStore(s => s.addClip);

  useEffect(() => () => { sourceRef.current?.stop(); sourceRef.current = null; }, []);
  useEffect(() => { if (!open) { sourceRef.current?.stop(); setPlayingId(null); } }, [open]);

  const list = useMemo(() => {
    let items = ALL_LOOPS;
    if (tab === "packs" && activePack) items = items.filter(l => l.pack.toLowerCase() === activePack.toLowerCase());
    if (cat) items = items.filter(l => l.category === cat);
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(l => l.name.toLowerCase().includes(q) || l.pack.toLowerCase().includes(q) || l.genre.toLowerCase().includes(q));
    }
    return items;
  }, [tab, activePack, cat, query]);

  const preview = async (def: LoopDef) => {
    await engine.resume();
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} sourceRef.current = null; }
    if (playingId === def.id) { setPlayingId(null); return; }
    const buf = getOrGenerate(def);
    const src = engine.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(engine.ctx.destination);
    src.onended = () => { if (sourceRef.current === src) { sourceRef.current = null; setPlayingId(null); } };
    src.start();
    sourceRef.current = src;
    setPlayingId(def.id);
  };

  const addToTimeline = (def: LoopDef) => {
    const buf = getOrGenerate(def);
    const trackId = addTrack("audio", def.name.split(" - ")[1]?.replace(/[()]/g, "").trim() || def.name, { inputEnabled: false });
    setTimeout(() => {
      addClip({
        id: newId("clip"),
        trackId,
        startTime: useDawStore.getState().transport.position,
        duration: buf.duration,
        offset: 0,
        buffer: buf,
        peaks: computePeaks(buf),
        name: def.name,
        color: def.color,
      });
    }, 20);
  };

  const toggleFav = (id: string) => {
    setFavs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[360px] bg-neutral-950 border-l border-neutral-800 flex flex-col z-30">
      <div className="h-10 border-b border-neutral-800 flex items-center px-3">
        <Music2 className="w-4 h-4 text-cyan-300 mr-2" />
        <div className="text-sm font-medium text-neutral-100">Sound library</div>
        <div className="flex-1" />
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex border-b border-neutral-800">
        <button onClick={() => { setTab("sounds"); setActivePack(null); }} className={`flex-1 h-9 text-xs ${tab === "sounds" ? "text-cyan-300 border-b border-cyan-300" : "text-neutral-400"}`}>♪ Sounds</button>
        <button onClick={() => setTab("packs")} className={`flex-1 h-9 text-xs ${tab === "packs" ? "text-cyan-300 border-b border-cyan-300" : "text-neutral-400"}`}>▣ Packs</button>
      </div>

      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder={tab === "packs" && activePack ? activePack : "Search loops..."}
            className="w-full h-8 bg-neutral-900 border border-neutral-800 rounded pl-8 pr-7 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50"
          />
          {query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"><X className="w-3 h-3" /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button onClick={() => setCat(null)} className={`h-6 px-2 rounded text-[10px] border ${!cat ? "border-cyan-500/60 text-cyan-300 bg-cyan-500/10" : "border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>All</button>
          {CATEGORY_CHIPS.map(c => (
            <button key={c.cat} onClick={() => setCat(c.cat === cat ? null : c.cat)} className={`h-6 px-2 rounded text-[10px] border ${cat === c.cat ? "border-cyan-500/60 text-cyan-300 bg-cyan-500/10" : "border-neutral-800 text-neutral-400 hover:text-neutral-200"}`}>{c.label}</button>
          ))}
        </div>
      </div>

      {tab === "packs" && !activePack && (
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
          {LOOP_PACKS.map(p => (
            <button key={p.id} onClick={() => setActivePack(p.name)} className="text-left rounded-lg border border-neutral-800 hover:border-cyan-500/40 bg-neutral-900 overflow-hidden group">
              <div className="aspect-square grid place-items-center text-xl font-bold tracking-tight" style={{ background: `linear-gradient(135deg, ${p.color}40, ${p.color}10)`, color: p.color }}>
                {p.name}
              </div>
              <div className="p-2">
                <div className="text-[11px] text-neutral-200 font-medium">{p.name}</div>
                <div className="text-[9px] text-neutral-500 line-clamp-2">{p.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {(tab === "sounds" || (tab === "packs" && activePack)) && (
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {tab === "packs" && activePack && (
            <button onClick={() => setActivePack(null)} className="text-[11px] text-neutral-400 hover:text-cyan-300 mb-2 px-1">‹ Back to packs</button>
          )}
          {list.length === 0 && <div className="text-center text-neutral-600 text-xs py-8">No loops match</div>}
          {list.map(l => {
            const isPlaying = playingId === l.id;
            return (
              <div key={l.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-900">
                <button onClick={() => preview(l)} className="w-7 h-7 rounded-full grid place-items-center text-neutral-300 hover:text-white border border-neutral-800 hover:border-cyan-500/60 shrink-0">
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                </button>
                <div className="w-1 h-6 rounded shrink-0" style={{ background: l.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-neutral-200 truncate">{l.name}</div>
                  <div className="text-[9px] text-neutral-500">{l.bpm} BPM · {l.genre}</div>
                </div>
                <button onClick={() => toggleFav(l.id)} className={`opacity-60 hover:opacity-100 ${favs.has(l.id) ? "text-pink-400 opacity-100" : "text-neutral-500"}`}>
                  <Heart className="w-3.5 h-3.5" fill={favs.has(l.id) ? "currentColor" : "none"} />
                </button>
                <button onClick={() => addToTimeline(l)} title="Add to track" className="w-6 h-6 rounded grid place-items-center text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
