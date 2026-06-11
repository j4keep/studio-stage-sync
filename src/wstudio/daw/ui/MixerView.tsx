import { useDawStore } from "../state/DawStore";
import { ChannelStrip } from "./ChannelStrip";
import { Fader, formatGainDb } from "./Fader";
import { Meter } from "./Meter";
import type { DawEngine } from "../engine/DawEngine";

const ROW_LABELS = [
  { key: "setting", label: "Setting", h: 26 },
  { key: "eq", label: "EQ", h: 50 },
  { key: "input", label: "Input", h: 26 },
  { key: "fx", label: "Audio FX", h: 60 },
  { key: "sends", label: "Sends", h: 50 },
  { key: "output", label: "Output", h: 26 },
  { key: "group", label: "Group", h: 22 },
  { key: "auto", label: "Automation", h: 26 },
  { key: "pan", label: "Pan", h: 50 },
  { key: "db", label: "dB", h: 26 },
  { key: "fader", label: "", h: 220 },
];

export function MixerView({ engine, onOpenFx, onArmToggle }: { engine: DawEngine; onOpenFx: (trackId: string) => void; onArmToggle: (trackId: string) => void }) {
  const tracks = useDawStore(s => s.tracks);
  const masterVolume = useDawStore(s => s.masterVolume);
  const setMasterVolume = useDawStore(s => s.setMasterVolume);

  return (
    <div className="flex-1 bg-neutral-900 overflow-hidden flex flex-col">
      <div className="h-8 border-b border-neutral-800 bg-neutral-950 flex items-center px-3 text-[10px] uppercase tracking-wider text-neutral-400">
        Mixer · {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-auto flex">
        {/* Row label column (Logic-style) */}
        <div className="w-24 shrink-0 bg-neutral-950 border-r border-neutral-800 text-[10px] text-neutral-500 uppercase tracking-wider select-none">
          <div className="h-6 border-b border-neutral-800" />
          {ROW_LABELS.map(r => (
            <div key={r.key} className="border-b border-neutral-900 px-2 flex items-center" style={{ height: r.h }}>{r.label}</div>
          ))}
        </div>

        {tracks.length === 0 && (
          <div className="flex-1 grid place-items-center text-neutral-600 text-sm">No tracks yet — add one from the toolbar.</div>
        )}
        {tracks.map(t => (
          <ChannelStrip key={t.id} track={t} engine={engine} onOpenFx={() => onOpenFx(t.id)} onArmToggle={onArmToggle} rows={ROW_LABELS} />
        ))}
        {/* Master strip */}
        {tracks.length > 0 && (
          <div className="w-28 shrink-0 bg-neutral-950 border-l-2 border-cyan-500/40 flex flex-col items-center text-[10px] text-neutral-400">
            <div className="h-6 w-full border-b border-neutral-800 grid place-items-center text-cyan-300 font-bold">MASTER</div>
            {ROW_LABELS.slice(0, -2).map(r => (
              <div key={r.key} className="w-full border-b border-neutral-900 grid place-items-center text-neutral-700" style={{ height: r.h }}>—</div>
            ))}
            <div className="border-b border-neutral-900 w-full grid place-items-center" style={{ height: 26 }}>
              <span className="tabular-nums text-[9px]">{formatGainDb(masterVolume)} dB</span>
            </div>
            <div className="flex items-end gap-1.5 py-3" style={{ height: 220 }}>
              <Fader value={masterVolume} onChange={setMasterVolume} color="#22d3ee" height={200} />
              <Meter analyser={engine.getMasterAnalyser()} height={200} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
