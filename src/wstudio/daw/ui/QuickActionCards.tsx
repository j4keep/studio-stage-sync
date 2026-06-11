import { Music, Grid3x3, Piano, Plus, Upload, UserPlus } from "lucide-react";

export function QuickActionCards({
  onBrowseLoops,
  onPatterns,
  onPlaySynth,
  onAddTrack,
  onImport,
}: {
  onBrowseLoops: () => void;
  onPatterns: () => void;
  onPlaySynth: () => void;
  onAddTrack: () => void;
  onImport: () => void;
}) {
  const card = "flex flex-col items-center justify-center gap-2 w-[110px] h-[110px] rounded-xl bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/40 text-neutral-300 hover:text-white transition-colors";
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="grid grid-cols-3 gap-3 pointer-events-auto">
        <button onClick={onBrowseLoops} className={card}>
          <Music className="w-5 h-5" />
          <div className="text-[11px] text-center leading-tight">Browse<br/>loops</div>
        </button>
        <button onClick={onPatterns} className={card}>
          <Grid3x3 className="w-5 h-5" />
          <div className="text-[11px] text-center leading-tight">Patterns<br/>Beatmaker</div>
        </button>
        <button onClick={onPlaySynth} className={card}>
          <Piano className="w-5 h-5" />
          <div className="text-[11px] text-center leading-tight">Play the<br/>synth</div>
        </button>
        <button onClick={onAddTrack} className={card}>
          <Plus className="w-5 h-5" />
          <div className="text-[11px] text-center leading-tight">Add new<br/>track</div>
        </button>
        <button onClick={onImport} className={card}>
          <Upload className="w-5 h-5" />
          <div className="text-[11px] text-center leading-tight">Import file</div>
        </button>
        <button className={`${card} opacity-50 cursor-not-allowed`} disabled>
          <UserPlus className="w-5 h-5" />
          <div className="text-[11px] text-center leading-tight">Invite a<br/>friend</div>
        </button>
      </div>
    </div>
  );
}
