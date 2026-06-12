import { Play, Square, Circle, SkipBack, SkipForward, Rewind, FastForward, Repeat, Volume2, Download, Plus, Mic, Music2, MousePointer2, Pencil, Eraser, Scissors, Combine, VolumeX, ZoomIn, Waves, BoxSelect, Timer, ChevronDown, Type, Activity, Move, MoveHorizontal, Piano, Sun, Moon, LayoutGrid, Keyboard as KeyboardIcon, FolderOpen, Users } from "lucide-react";
import { useShortcutLabel } from "../state/ShortcutsStore";
import { useDawStore, type DawTool } from "../state/DawStore";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { memo, useEffect, useState, type ReactNode } from "react";

/** Wraps any trigger with a hover tooltip (Tooltip provider is mounted globally in App). */
const Tip = ({ label, children, side = "bottom" }: { label: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) => (
  <Tooltip delayDuration={150}>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side} className="text-[11px] px-2 py-1">{label}</TooltipContent>
  </Tooltip>
);

interface Props {
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onRewind: () => void;
  onSeek?: (position: number) => void;
  onExport: () => void;
  onAddAudio: () => void;
  onAddInstrument: () => void;
  onAddMany?: (kind: "audio" | "instrument", count: number) => void;
  onImport: () => void;
  onToggleKeyboard?: () => void;
  keyboardOpen?: boolean;
  themeMode?: "light" | "dark";
  onToggleTheme?: () => void;
  onOpenShortcuts?: () => void;
  onToggleLibrary?: () => void;
  libraryOpen?: boolean;
  onToggleSession?: () => void;
  sessionOpen?: boolean;
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
  { id: "text", label: "Text Tool", Icon: Type, hint: "Click a clip to rename it" },
  { id: "scissors", label: "Scissors Tool", Icon: Scissors, hint: "Click a clip to split at point" },
  { id: "glue", label: "Glue Tool", Icon: Combine, hint: "Merge overlapping clips on a track" },
  { id: "trim", label: "Trim Tool", Icon: MoveHorizontal, hint: "Drag clip edges to trim length" },
  { id: "mute", label: "Mute Tool", Icon: VolumeX, hint: "Click clip to toggle mute" },
  { id: "zoom", label: "Zoom Tool", Icon: ZoomIn, hint: "Click to zoom in, Alt-click to zoom out" },
  { id: "fade", label: "Fade Tool", Icon: Waves, hint: "Drag edges to create fades" },
  { id: "automation", label: "Automation Select", Icon: Activity, hint: "Click a clip to toggle automation lane" },
  { id: "flex", label: "Flex Tool", Icon: Move, hint: "Time-stretch clip (drag right edge)" },
  { id: "marquee", label: "Marquee Tool", Icon: BoxSelect, hint: "Box-select a region" },
];

export function TransportBar({ onPlay, onStop, onRecord, onRewind, onSeek, onExport, onAddAudio, onAddInstrument, onAddMany, onImport, onToggleKeyboard, keyboardOpen, themeMode, onToggleTheme, onOpenShortcuts, onToggleLibrary, libraryOpen, onToggleSession, sessionOpen }: Props) {
  const transport = useDawStore(s => s.transport);
  const setTransport = useDawStore(s => s.setTransport);
  const view = useDawStore(s => s.view);
  const setView = useDawStore(s => s.setView);
  const masterVolume = useDawStore(s => s.masterVolume);
  const setMasterVolume = useDawStore(s => s.setMasterVolume);
  const tool = useDawStore(s => s.tool);
  const setTool = useDawStore(s => s.setTool);

  // Live shortcut labels (reflect any user customization)
  const kPlay = useShortcutLabel("play");
  const kStop = useShortcutLabel("stop");
  const kRecord = useShortcutLabel("record");
  const kRewind = useShortcutLabel("rewind");
  const kFwd = useShortcutLabel("forward5");
  const kBack = useShortcutLabel("back5");
  const kLoop = useShortcutLabel("loop");
  const kExport = useShortcutLabel("export");
  const kKeyboard = useShortcutLabel("toggleKeyboard");
  const kTheme = useShortcutLabel("toggleTheme");
  const kViewEdit = useShortcutLabel("viewEdit");
  const kViewMixer = useShortcutLabel("viewMixer");
  const kShortcuts = useShortcutLabel("openShortcuts");

  // Bar.Beat from seconds + BPM using current time signature
  const beatsPerBar = transport.timeSigNum || 4;
  const totalBeats = (transport.position / 60) * transport.bpm;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  const sub = Math.floor((totalBeats * 4) % 4) + 1;
  const tickFrac = Math.floor(((totalBeats * 4) % 1) * 1000);
  // Absolute time
  const secs = transport.position;
  const hh = Math.floor(secs / 3600);
  const mm = Math.floor((secs % 3600) / 60);
  const ss = Math.floor(secs % 60);
  const ms = Math.floor((secs - Math.floor(secs)) * 1000);
  const ActiveToolIcon = TOOLS.find(t => t.id === tool)?.Icon ?? MousePointer2;

  const KEY_ROOTS: import("../engine/types").KeyRoot[] = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const TIME_SIGS: Array<[number, number]> = [[2,4],[3,4],[4,4],[5,4],[6,8],[7,8],[12,8]];
  const TEMPO_MODES: Array<{ id: import("../engine/types").TempoMode; label: string; hint: string }> = [
    { id: "keep", label: "KEEP", hint: "Imported audio follows the project tempo" },
    { id: "adapt", label: "ADAPT", hint: "Project tempo follows the imported audio" },
    { id: "auto", label: "AUTO", hint: "DAW decides automatically" },
  ];
  const BBT_MODES: Array<{ id: import("../engine/types").BBTDisplayMode; label: string; hint: string }> = [
    { id: "beats-project", label: "Beats & Project", hint: "Bar.Beat plus tempo/sig/key" },
    { id: "beats-time",    label: "Beats & Time",    hint: "Bar.Beat plus absolute time" },
    { id: "beats",         label: "Beats",           hint: "Bar.Beat.Sub.Tick only" },
    { id: "time",          label: "Time",            hint: "Absolute HH:MM:SS.ms only" },
  ];
  const bbtMode = transport.bbtDisplayMode;

  return (
    <div className="h-14 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800 px-3 flex items-center gap-2 text-neutral-200 text-xs shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-1">
        <Tip label={`Return to Start  ·  ${kRewind}`}><TBtn onClick={onRewind}><Rewind className="w-4 h-4" /></TBtn></Tip>
        <Tip label={`Forward 5s  ·  ${kFwd}`}><TBtn onClick={() => onSeek ? onSeek(transport.position + 5) : setTransport({ position: transport.position + 5 })}><FastForward className="w-4 h-4" /></TBtn></Tip>
        <Tip label={`Back 5s  ·  ${kBack}`}><TBtn onClick={() => onSeek ? onSeek(Math.max(0, transport.position - 5)) : setTransport({ position: Math.max(0, transport.position - 5) })}><SkipBack className="w-4 h-4" /></TBtn></Tip>
        <Tip label={`Play / Pause  ·  ${kPlay}`}><TBtn onClick={onPlay} active={transport.isPlaying} className="!text-emerald-400"><Play className="w-4 h-4 fill-current" /></TBtn></Tip>
        <Tip label={`Stop  ·  ${kStop}`}><TBtn onClick={onStop}><Square className="w-4 h-4" /></TBtn></Tip>
        <Tip label={`Record on armed track  ·  ${kRecord}`}>
          <button
            type="button"
            onClick={onRecord}
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
        </Tip>
        <Tip label={`Cycle / Loop  ·  ${kLoop}`}><TBtn onClick={() => setTransport({ loopEnabled: !transport.loopEnabled })} active={transport.loopEnabled} className={transport.loopEnabled ? "!text-amber-300" : ""}><Repeat className="w-4 h-4" /></TBtn></Tip>
      </div>


      {/* Logic-style BBT display (mode-switchable via dropdown on the right) */}
      <div
        title="Position display — click ▾ to change format"
        className="mx-2 px-3 py-1.5 bg-black border border-amber-500/30 rounded-md font-mono text-[13px] tabular-nums tracking-wider text-amber-300 shadow-inner shadow-amber-500/10 flex items-center gap-3 select-none"
      >
        {/* Bar / Beat (shown in beats-project, beats-time, beats) */}
        {bbtMode !== "time" && (
          <>
            <div className="leading-none">
              <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Bar</div>
              <div className="text-amber-300">{String(bar).padStart(3, "0")}</div>
            </div>
            <div className="leading-none">
              <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Beat</div>
              <div className="text-amber-300">
                {bbtMode === "beats"
                  ? `${beat}.${sub}.${String(tickFrac).padStart(3, "0")}`
                  : `${beat}.${sub}`}
              </div>
            </div>
          </>
        )}

        {/* Absolute time (shown in beats-time and time) */}
        {(bbtMode === "beats-time" || bbtMode === "time") && (
          <>
            {bbtMode === "beats-time" && <div className="w-px h-7 bg-neutral-800" />}
            <div className="leading-none">
              <div className="text-[8px] text-neutral-500 uppercase tracking-widest">HR</div>
              <div className="text-amber-300">{String(hh).padStart(2, "0")}</div>
            </div>
            <div className="leading-none">
              <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Min</div>
              <div className="text-amber-300">{String(mm).padStart(2, "0")}</div>
            </div>
            <div className="leading-none">
              <div className="text-[8px] text-neutral-500 uppercase tracking-widest">Sec</div>
              <div className="text-amber-300">{String(ss).padStart(2, "0")}.{String(ms).padStart(3, "0")}</div>
            </div>
          </>
        )}

        {/* Tempo / Sig / Key only in "beats-project" (Logic's default) */}
        {bbtMode === "beats-project" && (
          <>
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
                        onSelect={() => setTransport({ tempoMode: m.id })}
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
          </>
        )}

        {/* Display-mode picker (Logic's Beats & Project / Beats & Time / Beats / Time) */}
        <div className="w-px h-7 bg-neutral-800" />
        <DropdownMenu>
          <DropdownMenuTrigger
            title="Position display format"
            className="text-amber-300/80 hover:text-amber-200 flex items-center"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
            {BBT_MODES.map(m => (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => setTransport({ bbtDisplayMode: m.id })}
                className="flex flex-col items-start gap-0.5 text-[12px]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">{m.label}</span>
                  {bbtMode === m.id && <span className="text-cyan-300 text-[10px]">●</span>}
                </div>
                <span className="text-[10px] text-neutral-500">{m.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MetronomePopover />

      {onToggleKeyboard && (
        <Tip label={`On-screen keyboard  ·  ${kKeyboard}  (computer keys A W S E D F T G Y H U J K play MIDI)`}>
          <button
            type="button"
            onClick={onToggleKeyboard}
            aria-label="Toggle on-screen keyboard"
            className={`h-9 w-9 grid place-items-center rounded-md border transition ${
              keyboardOpen
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <Piano className="w-4 h-4" />
          </button>
        </Tip>
      )}

      {onToggleTheme && (
        <Tip label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode  ·  ${kTheme}`}>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="h-9 w-9 grid place-items-center rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
          >
            {themeMode === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-cyan-300" />}
          </button>
        </Tip>
      )}

      {onToggleLibrary && (
        <Tip label={`${libraryOpen ? "Hide" : "Show"} sound library`}>
          <button
            type="button"
            onClick={onToggleLibrary}
            aria-label="Toggle library"
            className={`h-9 w-9 grid place-items-center rounded-md border transition ${libraryOpen ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"}`}
          ><FolderOpen className="w-4 h-4" /></button>
        </Tip>
      )}
      {onToggleSession && (
        <Tip label={`${sessionOpen ? "Hide" : "Show"} session & video chat`}>
          <button
            type="button"
            onClick={onToggleSession}
            aria-label="Toggle session panel"
            className={`h-9 w-9 grid place-items-center rounded-md border transition ${sessionOpen ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"}`}
          ><Users className="w-4 h-4" /></button>
        </Tip>
      )}


      {/* Tool palette (icon only) */}
      <DropdownMenu>
        <Tip label={`Tool: ${TOOLS.find(t => t.id === tool)?.label ?? "Pointer"}  ·  T  (V pointer, B pencil, E eraser, S scissors)`}>
          <DropdownMenuTrigger
            aria-label="Choose tool"
            className="h-9 w-9 grid place-items-center rounded-md border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 hover:bg-neutral-800 text-cyan-300"
          >
            <ActiveToolIcon className="w-4 h-4" />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[220px]">
          {TOOLS.map(({ id, label, Icon, hint }) => (
            <DropdownMenuItem
              key={id}
              onSelect={() => setTool(id)}
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

      <DropdownMenu>
        <Tip label="Add track or import audio  ·  ⌥⌘A audio  ·  ⌥⌘S instrument  ·  ⌘O import">
          <DropdownMenuTrigger
            aria-label="Add track"
            className="h-9 w-9 grid place-items-center rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-cyan-300"
          >
            <Plus className="w-4 h-4" />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[200px]">
          <DropdownMenuItem onSelect={onAddAudio} className="flex items-center gap-2 text-[12px]">
            <Mic className="w-3.5 h-3.5 text-emerald-300" />
            <span className="flex-1">Audio Track</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAddInstrument} className="flex items-center gap-2 text-[12px]">
            <Music2 className="w-3.5 h-3.5 text-purple-300" />
            <span className="flex-1">Instrument Track</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onImport} className="flex items-center gap-2 text-[12px]">
            <Plus className="w-3.5 h-3.5 text-cyan-300" />
            <span className="flex-1">Import Audio File…</span>
          </DropdownMenuItem>
          {onAddMany && <BulkAddRow onAddMany={onAddMany} />}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <Tip label={`View: ${view === "arrange" ? "Edit" : view.charAt(0).toUpperCase() + view.slice(1)}  ·  ${kViewEdit} edit  ·  ${kViewMixer} mixer`}>
          <DropdownMenuTrigger
            aria-label="Switch view"
            className="h-9 w-9 grid place-items-center rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-cyan-300"
          >
            <LayoutGrid className="w-4 h-4" />
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-neutral-200 min-w-[160px]">
          {(["arrange", "mixer", "instrument"] as const).map(v => (
            <DropdownMenuItem
              key={v}
              onSelect={() => setView(v)}
              className="flex items-center justify-between text-[12px] uppercase tracking-wider"
            >
              <span>{v === "arrange" ? "edit" : v}</span>
              {view === v && <span className="text-cyan-300 text-[10px]">●</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Tip label={`Master output volume — ${Math.round(masterVolume * 50)}%`}>
        <div className="flex items-center gap-1.5 ml-2 h-9 px-2 rounded-md border border-neutral-800 bg-neutral-900">
          <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
          <input
            type="range" min={0} max={2} step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            className="w-20 accent-cyan-500"
          />
        </div>
      </Tip>

      {onOpenShortcuts && (
        <Tip label={`Keyboard shortcuts cheat sheet  ·  ${kShortcuts}`}>
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label="Open keyboard shortcuts"
            className="h-9 w-9 grid place-items-center rounded-md border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 focus-visible:ring-2 focus-visible:ring-cyan-500/60 outline-none"
          >
            <KeyboardIcon className="w-4 h-4" />
          </button>
        </Tip>
      )}

      <Tip label={`Export / bounce project to WAV  ·  ${kExport}`}>
        <button
          type="button"
          onClick={onExport}
          aria-label="Export to WAV"
          className="h-9 w-9 grid place-items-center rounded-md bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/30"
        >
          <Download className="w-4 h-4" />
        </button>
      </Tip>
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
      <Tip label={`Metronome ${transport.metronome ? "On" : "Off"}  ·  K-metronome shortcut (click for settings)`}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Metronome settings"
            className={`h-9 w-9 grid place-items-center rounded-md border ${
              transport.metronome
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <Timer className="w-4 h-4" />
          </button>
        </PopoverTrigger>
      </Tip>
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

// ===================== Bulk-add row (Add N tracks at once) =====================
function BulkAddRow({ onAddMany }: { onAddMany: (kind: "audio" | "instrument", count: number) => void }) {
  const [count, setCount] = useState(4);
  const [kind, setKind] = useState<"audio" | "instrument">("audio");
  return (
    <div
      className="px-2 py-2 border-t border-neutral-800 mt-1"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Add multiple</div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={32}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
          className="w-12 h-7 bg-neutral-950 border border-neutral-700 rounded text-[11px] text-neutral-200 px-1 text-center"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "audio" | "instrument")}
          className="flex-1 h-7 bg-neutral-950 border border-neutral-700 rounded text-[11px] text-neutral-200 px-1"
        >
          <option value="audio">Audio</option>
          <option value="instrument">Instrument</option>
        </select>
        <button
          onClick={() => onAddMany(kind, count)}
          className="h-7 px-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] uppercase tracking-wider"
        >Add</button>
      </div>
    </div>
  );
}


