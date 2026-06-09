import { useState } from "react";
import { Upload, Music, Puzzle, Folder } from "lucide-react";

interface UserSample { name: string; url: string; }
interface UserPlugin { name: string; }

export function LibraryPanel({ onImportFiles, onAddUserPlugin }: {
  onImportFiles: (files: FileList) => void;
  onAddUserPlugin: (name: string) => void;
}) {
  const [tab, setTab] = useState<"samples" | "plugins">("samples");
  const [samples] = useState<UserSample[]>([]);
  const [plugins, setPlugins] = useState<UserPlugin[]>([]);
  const [pluginName, setPluginName] = useState("");

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
          <label className="block">
            <div className="border border-dashed border-neutral-800 rounded p-4 text-center cursor-pointer hover:border-cyan-500/60 hover:bg-neutral-900">
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
          {samples.length === 0 && <div className="text-[10px] text-neutral-600 text-center py-4">No samples uploaded</div>}
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
