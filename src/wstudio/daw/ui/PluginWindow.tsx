import { useEffect, useRef, useState } from "react";
import { X, Power } from "lucide-react";
import { useDawStore } from "../state/DawStore";
import { EFFECT_META } from "../engine/Effects";
import { Knob } from "./Knob";

interface Props {
  trackId: string;
  effectId: string;
  initialX?: number;
  initialY?: number;
  onClose: () => void;
  onFocus?: () => void;
  zIndex?: number;
}

/** Floating, draggable single-plug-in editor window (incognito-style). */
export function PluginWindow({ trackId, effectId, initialX = 200, initialY = 120, onClose, onFocus, zIndex = 60 }: Props) {
  const track = useDawStore(s => s.tracks.find(t => t.id === trackId));
  const fx = track?.effects.find(e => e.id === effectId);
  const updateEffect = useDawStore(s => s.updateEffect);

  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragRef.current.dx)),
        y: Math.max(40, Math.min(window.innerHeight - 80, e.clientY - dragRef.current.dy)),
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!track || !fx) return null;
  const meta = EFFECT_META[fx.type as keyof typeof EFFECT_META];
  if (!meta) return null;

  return (
    <div
      onMouseDown={() => onFocus?.()}
      className="fixed w-[380px] bg-neutral-950 border border-neutral-700 rounded-lg shadow-2xl flex flex-col"
      style={{ left: pos.x, top: pos.y, zIndex }}
    >
      {/* Title bar */}
      <div
        className="h-9 px-3 flex items-center gap-2 border-b border-neutral-800 cursor-move bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-t-lg select-none"
        onMouseDown={(e) => { dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: track.color }} />
        <div className="text-[11px] text-neutral-300 truncate">
          <span className="text-neutral-500">{track.name} · </span>
          <span className="font-semibold text-neutral-100">{meta.label}</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); updateEffect(trackId, fx.id, { enabled: !fx.enabled }); }}
          title={fx.enabled ? "Bypass" : "Enable"}
          className={`w-6 h-6 grid place-items-center rounded ${fx.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-500"}`}
        >
          <Power className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Close"
          className="w-6 h-6 grid place-items-center rounded text-neutral-400 hover:bg-red-500/30 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {meta.params.map(p => (
            <Knob
              key={p.id}
              label={p.label}
              unit={p.unit}
              value={fx.params[p.id] ?? p.min}
              min={p.min}
              max={p.max}
              step={p.step ?? 0.01}
              onChange={(v) => updateEffect(trackId, fx.id, { params: { ...fx.params, [p.id]: v } })}
              color={track.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
