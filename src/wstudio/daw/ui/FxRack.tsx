import { X, Plus, Power } from "lucide-react";
import { useDawStore } from "../state/DawStore";
import { EFFECT_META } from "../engine/Effects";
import type { EffectId } from "../engine/types";
import { Knob } from "./Knob";

interface Props {
  trackId: string;
  onClose: () => void;
}

const ALL_FX: EffectId[] = ["eq3", "compressor", "reverb", "delay", "chorus", "distortion", "limiter", "pitch"];

export function FxRack({ trackId, onClose }: Props) {
  const track = useDawStore(s => s.tracks.find(t => t.id === trackId));
  const addEffect = useDawStore(s => s.addEffect);
  const removeEffect = useDawStore(s => s.removeEffect);
  const updateEffect = useDawStore(s => s.updateEffect);

  if (!track) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-neutral-950 border-l border-neutral-800 z-50 flex flex-col shadow-2xl">
      <div className="h-10 border-b border-neutral-800 flex items-center px-3 gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: track.color }} />
        <div className="text-sm text-neutral-200 font-medium truncate">{track.name} · FX</div>
        <div className="flex-1" />
        <button onClick={onClose} className="text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-3 border-b border-neutral-800">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Add Effect</div>
        <div className="grid grid-cols-4 gap-1">
          {ALL_FX.map(t => (
            <button
              key={t}
              onClick={() => addEffect(trackId, t)}
              className="h-8 text-[10px] uppercase tracking-wider bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 rounded flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> {EFFECT_META[t].label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-neutral-500">
          Upload custom plug-ins (WASM) in the Plug-ins panel.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {track.effects.length === 0 && (
          <div className="text-center text-neutral-600 text-xs py-8">No effects yet — add one above</div>
        )}
        {track.effects.map((fx) => {
          const meta = EFFECT_META[fx.type as keyof typeof EFFECT_META];
          if (!meta) return null;
          return (
            <div key={fx.id} className="border border-neutral-800 rounded-lg bg-neutral-900 p-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => updateEffect(trackId, fx.id, { enabled: !fx.enabled })}
                  className={`w-6 h-6 grid place-items-center rounded ${fx.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-800 text-neutral-500"}`}
                >
                  <Power className="w-3 h-3" />
                </button>
                <div className="text-sm text-neutral-200 font-medium">{meta.label}</div>
                <div className="flex-1" />
                <button onClick={() => removeEffect(trackId, fx.id)} className="text-neutral-500 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {meta.params.map(p => (
                  <Knob
                    key={p.id}
                    label={p.label}
                    unit={p.unit}
                    value={fx.params[p.id] ?? p.min}
                    min={p.min} max={p.max} step={p.step ?? 0.01}
                    onChange={(v) => updateEffect(trackId, fx.id, { params: { ...fx.params, [p.id]: v } })}
                    color={track.color}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
