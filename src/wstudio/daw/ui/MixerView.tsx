import { useDawStore } from "../state/DawStore";
import { ChannelStrip } from "./ChannelStrip";
import { Fader } from "./Fader";
import { Meter } from "./Meter";
import type { DawEngine } from "../engine/DawEngine";

export function MixerView({ engine, onOpenFx }: { engine: DawEngine; onOpenFx: (trackId: string) => void }) {
  const tracks = useDawStore(s => s.tracks);
  const masterVolume = useDawStore(s => s.masterVolume);
  const setMasterVolume = useDawStore(s => s.setMasterVolume);

  return (
    <div className="flex-1 bg-neutral-900 overflow-hidden flex flex-col">
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 text-[10px] uppercase tracking-wider text-neutral-400">
        Mixer · {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex">
        {tracks.length === 0 && (
          <div className="flex-1 grid place-items-center text-neutral-600 text-sm">No tracks yet</div>
        )}
        {tracks.map(t => (
          <ChannelStrip key={t.id} track={t} engine={engine} onOpenFx={() => onOpenFx(t.id)} />
        ))}
        {/* Master strip */}
        <div className="w-28 shrink-0 bg-neutral-950 px-2 py-3 flex flex-col items-center gap-2 border-l-2 border-cyan-500/40">
          <div className="w-full h-1.5 rounded bg-cyan-500" />
          <div className="text-[10px] text-cyan-300 font-bold w-full text-center">MASTER</div>
          <div className="flex-1" />
          <div className="flex items-end gap-1.5 mt-3">
            <Fader value={masterVolume} onChange={setMasterVolume} color="#22d3ee" height={200} />
            <Meter analyser={engine.getMasterAnalyser()} height={200} />
          </div>
          <div className="text-[9px] text-neutral-500 tabular-nums mt-1">
            {(20 * Math.log10(masterVolume + 1e-9)).toFixed(1)} dB
          </div>
        </div>
      </div>
    </div>
  );
}
