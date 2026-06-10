import { Play, Square, Circle, SkipBack, SkipForward, Rewind, FastForward, Repeat, Volume2, Download, Plus, Mic, Music2, MousePointer2, Pencil, Eraser, Scissors, Combine, VolumeX, ZoomIn, Waves, BoxSelect, Timer, ChevronDown } from "lucide-react";
import { useDawStore, type DawTool } from "../state/DawStore";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { memo, useEffect, useState } from "react";

interface Props {
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onRewind: () => void;
  onSeek?: (position: number) => void;
  onExport: () => void;
  onAddAudio: () => void;
  onAddInstrument: () => void;
  onImport: () => void;
}

// CRITICAL: defined OUTSIDE the component to avoid remount-on-every-render
// (which was eating clicks when the position RAF re-rendered the bar).
const TBtn = memo(function TBtn({ children, onClick, active, className = "", title }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-9 w-9 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition shadow-inner shadow-black/40 ${active ? "bg-neutral-700 text-white border-neutral-600" : "text-neutral-300 bg-gradient-to-b from-neutral-900 to-neutral-950"} ${className}`}
    >{children}</button>
  );
});

const TOOLS: { id: DawTool; label: string; Icon: any; hint: string }[] = [
  { id: "pointer", label: "Pointer Tool", Icon: MousePointer2, hint: "Select, move, resize clips" },
  { id: "pencil", label: "Pencil Tool", Icon: Pencil, hint: "Draw / create clips" },
  { id: "eraser", label: "Eraser Tool", Icon: Eraser, hint: "Click a clip to delete" },
  { id: "scissors", label: "Scissors Tool", Icon: Scissors, hint: "Click a clip to split at point" },
  { id: "glue", label: "Glue Tool", Icon: Combine, hint: "Merge overlapping clips on a track" },
  { id: "mute", label: "Mute Tool", Icon: VolumeX, hint: "Click clip to toggle mute" },
  { id: "zoom", label: "Zoom Tool", Icon: ZoomIn, hint: "Click to zoom in, Alt-click to zoom out" },
  { id: "fade", label: "Fade Tool", Icon: Waves, hint: "Drag edges to create fades" },
  { id: "marquee", label: "Marquee Tool", Icon: BoxSelect, hint: "Box-select a region" },
];

export function TransportBar({ onPlay, onStop, onRecord, onRewind, onSeek, onExport, onAddAudio, onAddInstrument, onImport }: Props) {
  const transport = useDawStore(s => s.transport);
  const setTransport = useDawStore(s => s.setTransport);
  const view = useDawStore(s => s.view);
  const setView = useDawStore(s => s.setView);
  const masterVolume = useDawStore(s => s.masterVolume);
  const setMasterVolume = useDawStore(s => s.setMasterVolume);
  const tool = useDawStore(s => s.tool);
  const setTool = useDawStore(s => s.setTool);

  // Bar.Beat from seconds + BPM using current time signature
  const beatsPerBar = transport.timeSigNum || 4;
  const totalBeats = (transport.position / 60) * transport.bpm;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  const sub = Math.floor((totalBeats * 4) % 4) + 1;
  const ActiveToolIcon = TOOLS.find(t => t.id === tool)?.Icon ?? MousePointer2;

  const KEY_ROOTS: import("../engine/types").KeyRoot[] = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const TIME_SIGS: Array<[number, number]> = [[2,4],[3,4],[4,4],[5,4],[6,8],[7,8],[12,8]];
  const TEMPO_MODES: Array<{ id: import("../engine/types").TempoMode; label: string; hint: string }> = [
    { id: "keep", label: "KEEP", hint: "Imported audio follows the project tempo" },
    { id: "adapt", label: "ADAPT", hint: "Project tempo follows the imported audio" },
    { id: "auto", label: "AUTO", hint: "DAW decides automatically" },
  ];

  return (
    <div className="h-14 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800 px-3 flex items-center gap-2 text-neutral-200 text-xs shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-1" title="Transport controls">
        <TBtn onClick={onRewind} title="Return to Start (Enter)"><Rewind className="w-4 h-4" /></TBtn>
        <TBtn onClick={() => onSeek ? onSeek(transport.position + 5) : setTransport({ position: transport.position + 5 })} title="Forward 5s"><FastForward className="w-4 h-4" /></TBtn>
        <TBtn onClick={() => onSeek ? onSeek(Math.max(0, transport.position - 5)) : setTransport({ position: Math.max(0, transport.position - 5) })} title="Back 5s"><SkipBack className="w-4 h-4" /></TBtn>
        <TBtn onClick={onPlay} active={transport.isPlaying} className="!text-emerald-400" title="Play / Pause (Space)"><Play className="w-4 h-4 fill-current" /></TBtn>
        <TBtn onClick={onStop} title="Stop (Shift+Space)"><Square className="w-4 h-4" /></TBtn>
        <button
          type="button"
          onClick={onRecord}
          title="Record on armed track (R)"
          className={`h-9 w-9 grid place-items-center rounded-md border transition relative ${
            transport.isRecording
              ? "bg-red-600 border-red-400 text-white shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse"
              : "bg-gradient-to-b from-neutral-900 to-neutral-950 border-neutral-800 text-red-400 hover:bg-neutral-800 hover:border-red-500/50"
          }`}
        >
          <Circle className="w-4 h-4 fill-current" />
          {transport.isRecording && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400 animate-ping" />
          )}
        </button>
        <TBtn onClick={() => setTransport({ loopEnabled: !transport.loopEnabled })} active={transport.loopEnabled} className={transport.loopEnabled ? "!text-amber-300" : ""} title="Cycle / Loop"><Repeat className="w-4 h-4" /></TBtn>
      </div>

      {/* Logic-style BBT display */}
      <div
        title="Bar . Beat . Subdivision / Tempo / Signature / Key"
        className="mx-2 px-3 py-1.5 bg-black border border-amber-500/30 rounded-md font-mono text-[13px] tabular-nums tracking-wider text-amber-300 shadow-inner shadow-amber-500/10 flex items-center gap-3 select-none"
      >
        <div className="leading-none">
          <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Bar</div>
          <div className="text-amber-300">{String(bar).padStart(3, "0")}</div>
        </div>
        <div className="leading-none">
          <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Beat</div>
          <div className="text-amber-300">{beat}.{sub}</div>
        </div>
        <div className="w-px h-7 bg-neutral-800" />
        <div className="leading-none">
          <div className="text-[8px] text-neutral-500 uppercase tracking-widest flex items-center gap-1">
            <span>Tempo</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                title={`Smart Tempo: ${transport.tempoMode.toUpperCase()} — how imported audio behaves`}
                className="text-[8px] uppercase tracking-widest text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5 leading-none"
              >
                <span>· {transport.tempoMode}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
                {TEMPO_MODES.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setTransport({ tempoMode: m.id })}
                    className="flex flex-col items-start gap-0.5 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="uppercase tracking-wider text-[10px] text-amber-300">{m.label}</span>
                      {transport.tempoMode === m.id && <span className="text-cyan-300 text-[10px]">●</span>}
                    </div>
                    <span className="text-[10px] text-neutral-500">{m.hint}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <input
            type="number"
            value={transport.bpm}
            min={40} max={300}
            onChange={(e) => setTransport({ bpm: Number(e.target.value) || 120 })}
            className="w-12 bg-transparent border-none outline-none text-amber-300 font-mono text-[13px] p-0"
            title="BPM"
          />
        </div>
        <div className="leading-none">
          <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Sig</div>
          <select
            value={`${transport.timeSigNum}/${transport.timeSigDen}`}
            onChange={(e) => {
              const [n, d] = e.target.value.split("/").map(Number);
              setTransport({ timeSigNum: n, timeSigDen: d });
            }}
            className="bg-transparent border-none outline-none text-amber-300 font-mono text-[13px] p-0 cursor-pointer"
            title="Time signature"
          >
            {TIME_SIGS.map(([n, d]) => (
              <option key={`${n}/${d}`} value={`${n}/${d}`} className="bg-neutral-900">{n}/{d}</option>
            ))}
          </select>
        </div>
        <div className="leading-none">
          <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Key</div>
          <div className="flex items-center gap-0.5">
            <select
              value={transport.keyRoot}
              onChange={(e) => setTransport({ keyRoot: e.target.value as any })}
              className="bg-transparent border-none outline-none text-amber-300 font-mono text-[13px] p-0 cursor-pointer"
              title="Key root"
            >
              {KEY_ROOTS.map(k => <option key={k} value={k} className="bg-neutral-900">{k}</option>)}
            </select>
            <select
              value={transport.keyMode}
              onChange={(e) => setTransport({ keyMode: e.target.value as any })}
              className="bg-transparent border-none outline-none text-amber-300 font-mono text-[13px] p-0 cursor-pointer"
              title="Major / minor"
            >
              <option value="major" className="bg-neutral-900">maj</option>
              <option value="minor" className="bg-neutral-900">min</option>
            </select>
          </div>
        </div>
      </div>

      <MetronomePopover />

      {/* Smart Tempo mode (compact dropdown to save header space) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Smart Tempo — how imported audio behaves"
          className="h-7 px-2 rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-[10px] uppercase tracking-wider text-neutral-300 flex items-center gap-1"
        >
          <span className="text-neutral-500">Tempo:</span>
          <span className="text-amber-300">{transport.tempoMode}</span>
          <ChevronDown className="w-3 h-3 text-neutral-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
          {TEMPO_MODES.map(m => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => setTransport({ tempoMode: m.id })}
              className="flex flex-col items-start gap-0.5 text-[12px]"
            >
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wider text-[10px] text-amber-300">{m.label}</span>
                {transport.tempoMode === m.id && <span className="text-cyan-300 text-[10px]">●</span>}
              </div>
              <span className="text-[10px] text-neutral-500">{m.hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>


      {/* Tool palette (Logic-style) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          title={`Tool: ${TOOLS.find(t => t.id === tool)?.label}`}
          className="h-9 px-2 rounded-md border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 hover:bg-neutral-800 flex items-center gap-1.5 text-neutral-200 text-[11px]"
        >
          <ActiveToolIcon className="w-4 h-4 text-cyan-300" />
          <span className="uppercase tracking-wider text-[10px]">{tool}</span>
          <span className="text-neutral-500">▾</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
          {TOOLS.map(({ id, label, Icon, hint }) => (
            <DropdownMenuItem
              key={id}
              onClick={() => setTool(id)}
              className="flex items-center gap-2 text-[12px]"
              title={hint}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1">{label}</span>
              {tool === id && <span className="text-cyan-300 text-[10px]">●</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button type="button" onClick={onAddAudio} title="Add new audio track" className="h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase flex items-center gap-1 hover:bg-neutral-800"><Mic className="w-3 h-3" /> Audio</button>
        <button type="button" onClick={onAddInstrument} title="Add new instrument (synth) track" className="h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase flex items-center gap-1 hover:bg-neutral-800"><Music2 className="w-3 h-3" /> Instr</button>
        <button type="button" onClick={onImport} title="Import audio file(s)" className="h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase flex items-center gap-1 hover:bg-neutral-800"><Plus className="w-3 h-3" /> Import</button>
      </div>

      <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded overflow-hidden" title="Switch workspace view">
        {(["arrange", "mixer", "instrument"] as const).map(v => (
          <button
            type="button"
            key={v}
            onClick={() => setView(v)}
            title={`Switch to ${v} view`}
            className={`px-3 h-7 text-[10px] uppercase tracking-wider ${view === v ? "bg-cyan-500/20 text-cyan-300" : "text-neutral-400 hover:bg-neutral-800"}`}
          >{v}</button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 ml-2" title="Master output volume">
        <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
        <input
          type="range" min={0} max={1} step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          className="w-20 accent-cyan-500"
        />
      </div>

      <button type="button" onClick={onExport} title="Bounce project to WAV file" className="h-8 px-3 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs flex items-center gap-1.5 shadow-md shadow-cyan-900/30">
        <Download className="w-3.5 h-3.5" /> Export
      </button>
    </div>
  );
}

// ===================== Metronome popover (all click settings) =====================
function MetronomePopover() {
  const transport = useDawStore(s => s.transport);
  const setTransport = useDawStore(s => s.setTransport);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setOutputs(devs.filter(d => d.kind === "audiooutput"));
      } catch { /* ignore */ }
    };
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
    };
  }, []);

  const countOptions = [0, 1, 2, 4];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Metronome — click to open settings"
          className={`h-7 px-2 rounded border text-[10px] uppercase tracking-wider flex items-center gap-1 ${
            transport.metronome
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
              : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <Timer className="w-3 h-3" />
          Metro
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 bg-neutral-900 border-neutral-800 text-neutral-200 p-3 space-y-3"
      >
        {/* On/off */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-400">Metronome</div>
            <div className="text-[10px] text-neutral-500">Click on every beat at project tempo</div>
          </div>
          <button
            type="button"
            onClick={() => setTransport({ metronome: !transport.metronome })}
            className={`h-6 px-2 rounded text-[10px] uppercase tracking-wider border ${
              transport.metronome ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-neutral-800 text-neutral-400 border-neutral-700"
            }`}
          >{transport.metronome ? "On" : "Off"}</button>
        </div>

        {/* Volume */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
            <span className="uppercase tracking-wider">Volume</span>
            <span className="text-amber-300">{Math.round(transport.metronomeVolume * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={transport.metronomeVolume}
            onChange={(e) => setTransport({ metronomeVolume: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </div>

        {/* Accent */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-400">Accent downbeat</div>
            <div className="text-[10px] text-neutral-500">Higher pitch on beat 1 of each bar</div>
          </div>
          <button
            type="button"
            onClick={() => setTransport({ metroAccent: !transport.metroAccent })}
            className={`h-6 px-2 rounded text-[10px] uppercase tracking-wider border ${
              transport.metroAccent ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-neutral-800 text-neutral-400 border-neutral-700"
            }`}
          >{transport.metroAccent ? "On" : "Off"}</button>
        </div>

        {/* Count-in */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
            <span className="uppercase tracking-wider">Count-in (precount)</span>
            <span className="text-[10px] text-neutral-500">Bars before record</span>
          </div>
          <div className="flex items-center gap-1">
            {countOptions.map(n => (
              <button
                type="button"
                key={n}
                onClick={() => setTransport({ metroCountInBars: n })}
                className={`flex-1 h-7 rounded border text-[10px] uppercase tracking-wider ${
                  transport.metroCountInBars === n
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700"
                }`}
              >{n === 0 ? "Off" : `${n} bar${n > 1 ? "s" : ""}`}</button>
            ))}
          </div>
        </div>

        {/* Separate click output */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-1">Click output</div>
          <select
            value={transport.metroOutputDeviceId ?? ""}
            onChange={(e) => setTransport({ metroOutputDeviceId: e.target.value || undefined })}
            className="w-full h-7 rounded bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-200 px-2"
          >
            <option value="">Master output (mixed)</option>
            {outputs.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Output ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-neutral-500 mt-1">
            Route the click to a separate physical output (e.g. headphones only).
            Browser support: Chrome/Edge.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

