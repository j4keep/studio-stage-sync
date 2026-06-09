import { Play, Square, Circle, SkipBack, Repeat, Volume2, Download, Plus, Mic, Music2 } from "lucide-react";
import { useDawStore } from "../state/DawStore";

interface Props {
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onRewind: () => void;
  onExport: () => void;
  onAddAudio: () => void;
  onAddInstrument: () => void;
  onImport: () => void;
}

export function TransportBar({ onPlay, onStop, onRecord, onRewind, onExport, onAddAudio, onAddInstrument, onImport }: Props) {
  const transport = useDawStore(s => s.transport);
  const setTransport = useDawStore(s => s.setTransport);
  const view = useDawStore(s => s.view);
  const setView = useDawStore(s => s.setView);
  const masterVolume = useDawStore(s => s.masterVolume);
  const setMasterVolume = useDawStore(s => s.setMasterVolume);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  };

  const Btn = ({ children, onClick, active, className = "", title }: any) => (
    <button
      onClick={onClick}
      title={title}
      className={`h-9 w-9 grid place-items-center rounded-md border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition shadow-inner shadow-black/40 ${active ? "bg-neutral-700 text-white border-neutral-600" : "text-neutral-300 bg-gradient-to-b from-neutral-900 to-neutral-950"} ${className}`}
    >{children}</button>
  );

  return (
    <div className="h-14 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800 px-3 flex items-center gap-2 text-neutral-200 text-xs shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-1.5" title="Transport controls">
        <Btn onClick={onRewind} title="Return to Start (Enter)"><SkipBack className="w-4 h-4" /></Btn>
        <Btn onClick={onPlay} active={transport.isPlaying} className="!text-emerald-400" title="Play / Pause (Space)"><Play className="w-4 h-4 fill-current" /></Btn>
        <Btn onClick={onStop} title="Stop (Shift+Space)"><Square className="w-4 h-4" /></Btn>
        <Btn onClick={onRecord} active={transport.isRecording} className="!text-red-400" title="Record on armed track (R)"><Circle className="w-4 h-4 fill-current" /></Btn>
        <Btn onClick={() => setTransport({ loopEnabled: !transport.loopEnabled })} active={transport.loopEnabled} title="Cycle / Loop"><Repeat className="w-4 h-4" /></Btn>
      </div>

      <div
        title="Playhead position (mm:ss.cs)"
        className="mx-2 px-3 py-1.5 bg-black border border-neutral-800 rounded-md font-mono text-sm tabular-nums tracking-wider text-emerald-400 shadow-inner shadow-emerald-500/10"
      >
        {fmt(transport.position)}
      </div>

      <div className="flex items-center gap-1" title="Project tempo">
        <span className="text-[10px] uppercase text-neutral-500">BPM</span>
        <input
          type="number"
          value={transport.bpm}
          min={40} max={300}
          onChange={(e) => setTransport({ bpm: Number(e.target.value) || 120 })}
          className="w-14 h-7 bg-black border border-neutral-800 rounded px-2 text-center font-mono"
          title="Beats per minute"
        />
      </div>

      <button
        onClick={() => setTransport({ metronome: !transport.metronome })}
        title="Metronome — clicks on every beat at current BPM"
        className={`h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase ${transport.metronome ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "text-neutral-400"}`}
      >Metro</button>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button onClick={onAddAudio} title="Add new audio track" className="h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase flex items-center gap-1 hover:bg-neutral-800"><Mic className="w-3 h-3" /> Audio</button>
        <button onClick={onAddInstrument} title="Add new instrument (synth) track" className="h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase flex items-center gap-1 hover:bg-neutral-800"><Music2 className="w-3 h-3" /> Instr</button>
        <button onClick={onImport} title="Import audio file(s)" className="h-7 px-2 rounded border border-neutral-800 text-[10px] uppercase flex items-center gap-1 hover:bg-neutral-800"><Plus className="w-3 h-3" /> Import</button>
      </div>

      <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded overflow-hidden" title="Switch workspace view">
        {(["arrange", "mixer", "instrument"] as const).map(v => (
          <button
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

      <button onClick={onExport} title="Bounce project to WAV file" className="h-8 px-3 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs flex items-center gap-1.5 shadow-md shadow-cyan-900/30">
        <Download className="w-3.5 h-3.5" /> Export
      </button>
    </div>
  );
}
