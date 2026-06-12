import { useState } from "react";
import { Upload, Music, Puzzle, Folder, Grid3x3, Piano, Plus, Music2, UserPlus } from "lucide-react";

interface UserSample { name: string; url: string; }
interface UserPlugin { name: string; }

export function LibraryPanel({
  onImportFiles,
  onAddUserPlugin,
  onBrowseLoops,
  onPatterns,
  onPlaySynth,
  onAddTrack,
  onImport,
}: {
  onImportFiles: (files: FileList) => void;
  onAddUserPlugin: (name: string) => void;
  onBrowseLoops?: () => void;
  onPatterns?: () => void;
  onPlaySynth?: () => void;
  onAddTrack?: () => void;
  onImport?: () => void;
}) {
  const [tab, setTab] = useState<"samples" | "plugins">("samples");
  const [samples] = useState<UserSample[]>([]);
  const [plugins, setPlugins] = useState<UserPlugin[]>([]);
  const [pluginName, setPluginName] = useState("");

  const QuickBtn = ({ icon: Icon, label, onClick, grad }: { icon: any; label: string; onClick?: () => void; grad: string }) => (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl text-white overflow-hidden transition-transform hover:scale-[1.03] active:scale-95 shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
      style={{ background: grad }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/20 pointer-events-none" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/30 rounded-xl pointer-events-none" />
      <div className="relative w-8 h-8 grid place-items-center rounded-full bg-white/20 backdrop-blur-sm shadow-inner">
        <Icon className="w-4 h-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" strokeWidth={2.5} />
      </div>
      <div className="relative text-[10px] font-semibold text-center leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{label}</div>
    </button>
  );

  const GRADS = [
    "linear-gradient(135deg,#ff6b35 0%,#f7468a 50%,#a855f7 100%)",
    "linear-gradient(135deg,#f7468a 0%,#a855f7 50%,#3b82f6 100%)",
    "linear-gradient(135deg,#a855f7 0%,#3b82f6 50%,#06b6d4 100%)",
    "linear-gradient(135deg,#3b82f6 0%,#06b6d4 50%,#10b981 100%)",
    "linear-gradient(135deg,#06b6d4 0%,#10b981 50%,#f59e0b 100%)",
    "linear-gradient(135deg,#10b981 0%,#f59e0b 50%,#ff6b35 100%)",
  ];

  return (
    <div className="w-64 shrink-0 bg-neutral-950 border-r border-neutral-800 flex flex-col">
      <div className="h-8 border-b border-neutral-800 flex">
        <button
          onClick={() => setTab("samples")}
          className={`flex-1 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 ${tab === "samples" ? "bg-neutral-900 text-cyan-300" : "text-neutral-500 hover:text-neutral-300"}`}
        ><Folder className="w-3 h-3" /> Library</button>
        <button
          onClick={() => setTab("plugins")}
          className={`flex-1 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 border-l border-neutral-800 ${tab === "plugins" ? "bg-neutral-900 text-cyan-300" : "text-neutral-500 hover:text-neutral-300"}`}
        ><Puzzle className="w-3 h-3" /> Plug-ins</button>
      </div>

      {tab === "samples" && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <div className="text-[10px] uppercase text-neutral-500 px-1">Quick start</div>
          <div className="grid grid-cols-2 gap-1.5">
            <QuickBtn icon={Music2} label="Browse loops" onClick={onBrowseLoops} grad="from-orange-400 to-pink-500" />
            <QuickBtn icon={Grid3x3} label="Patterns Beatmaker" onClick={onPatterns} grad="from-pink-500 to-purple-600" />
            <QuickBtn icon={Piano} label="Play the synth" onClick={onPlaySynth} grad="from-purple-500 to-indigo-600" />
            <QuickBtn icon={Plus} label="Add new track" onClick={onAddTrack} grad="from-indigo-500 to-cyan-500" />
            <QuickBtn icon={Upload} label="Import file" onClick={onImport} grad="from-cyan-500 to-emerald-500" />
            <QuickBtn icon={UserPlus} label="Invite a friend" grad="from-emerald-500 to-yellow-400" />
          </div>

          <label className="block pt-2">
            <div className="border border-dashed border-neutral-800 rounded p-3 text-center cursor-pointer hover:border-cyan-500/60 hover:bg-neutral-900">
              <Upload className="w-4 h-4 mx-auto text-neutral-500 mb-1" />
              <div className="text-[10px] text-neutral-400">Upload samples</div>
              <div className="text-[9px] text-neutral-600">WAV, MP3, OGG, M4A</div>
            </div>
            <input
              type="file" multiple accept=".wav,.mp3,.ogg,.m4a,audio/*"
              className="hidden"
              onChange={(e) => e.target.files && onImportFiles(e.target.files)}
            />
          </label>
          <div className="text-[10px] uppercase text-neutral-500 mt-3 px-1">My Samples</div>
          {samples.length === 0 && <div className="text-[10px] text-neutral-600 text-center py-2">No samples uploaded</div>}
          {samples.map(s => (
            <div key={s.url} className="text-[11px] text-neutral-300 p-1.5 rounded hover:bg-neutral-900 cursor-grab flex items-center gap-1">
              <Music className="w-3 h-3 text-neutral-500" />
              <span className="truncate">{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "plugins" && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <div className="border border-dashed border-neutral-800 rounded p-3">
            <div className="text-[10px] text-neutral-400 mb-2">Add a Web (WASM) plug-in. Native VST/AU is not supported in browser DAWs.</div>
            <input
              type="text"
              value={pluginName}
              onChange={(e) => setPluginName(e.target.value)}
              placeholder="Plug-in name"
              className="w-full h-7 bg-black border border-neutral-800 rounded px-2 text-[11px] text-neutral-200 mb-1"
            />
            <label className="block">
              <div className="h-7 bg-neutral-900 border border-neutral-800 rounded text-[10px] uppercase text-cyan-300 hover:bg-neutral-800 flex items-center justify-center gap-1 cursor-pointer">
                <Upload className="w-3 h-3" /> Upload .wasm
              </div>
              <input
                type="file" accept=".wasm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0] && pluginName) {
                    setPlugins(p => [...p, { name: pluginName }]);
                    onAddUserPlugin(pluginName);
                    setPluginName("");
                  }
                }}
              />
            </label>
          </div>
          <div className="text-[10px] uppercase text-neutral-500 mt-3 px-1">My Plug-ins</div>
          {plugins.length === 0 && <div className="text-[10px] text-neutral-600 text-center py-4">None yet</div>}
          {plugins.map((p, i) => (
            <div key={i} className="text-[11px] text-neutral-300 p-1.5 rounded bg-neutral-900 flex items-center gap-1">
              <Puzzle className="w-3 h-3 text-purple-400" />
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
