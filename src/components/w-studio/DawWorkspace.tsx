import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackKind } from "./types";
import {
  EFFECT_PRESET_LABELS,
  EQ_PRESET_LABELS,
  LIBRARY_BY_CATEGORY,
  SPACE_PRESET_LABELS,
  faderToDbLabel,
} from "./audio";
import { MIC_CHAIN_PRESETS } from "./micPresets";
import { REMOTE_LIBRARY_BY_CATEGORY } from "./remoteLibrary";
import { DawProvider, INPUT_SOURCE_OPTIONS, useDaw } from "./DawContext";
import { WaveformCanvas } from "./WaveformCanvas";

const PX_PER_SEC = 52;

function formatBBT(sec: number, bpm: number, beatsPerBar: number) {
  const beats = sec * (bpm / 60);
  const whole = Math.floor(beats + 1e-9);
  const bar = Math.floor(whole / beatsPerBar) + 1;
  const beat = (whole % beatsPerBar) + 1;
  const tick = Math.min(479, Math.floor((beats % 1) * 480));
  return `${bar}:${beat}:${String(tick).padStart(3, "0")}`;
}

function IconPlay() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

function IconRec() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

function IconRewind() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 18V6l-8.5 6zm10 0V6l-8.5 6z" />
    </svg>
  );
}

function IconLoop({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? "text-[#facc15]" : "text-[#9ca3af]"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M17 3h4v4M3 17v4h4M21 11a8 8 0 0 0-14.12-4.88L3 11M3 13a8 8 0 0 0 14.12 4.88L21 13" />
    </svg>
  );
}

function IconMetronome({ off }: { off: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${off ? "text-[#52525b] line-through decoration-2" : "text-[#d4d4d8]"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M12 3v18M8 21h8M6 8l6-3 6 3v12H6z" />
    </svg>
  );
}

const MODAL_CELLS: {
  kind: TrackKind;
  label: string;
  hint: string;
  color: string;
}[] = [
  { kind: "record_audio", label: "Record audio", hint: "Mic / line", color: "#60a5fa" },
  { kind: "create_beat", label: "Create a beat", hint: "Pattern + drums", color: "#fb7185" },
  { kind: "instrument", label: "Instrument", hint: "Keys / synth", color: "#f8fafc" },
  { kind: "use_loops", label: "Use loops", hint: "Library", color: "#fb923c" },
  { kind: "import_audio", label: "Import audio file", hint: "WAV / MP3", color: "#4ade80" },
  { kind: "play_drums", label: "Play drums", hint: "Pads", color: "#2dd4bf" },
];

type ClipSelection = { trackId: string; clipId: string } | null;

function StartSongModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (k: TrackKind) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-song-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#2a2a32] bg-[#121214] p-5 shadow-2xl">
        <button
          type="button"
          className="absolute right-3 top-3 rounded p-1 text-[#6b7280] hover:bg-[#1a1a1f] hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <h2 id="start-song-title" className="mb-4 text-center text-lg font-semibold text-white">
          Start your song…
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MODAL_CELLS.map((c) => (
            <button
              key={c.kind}
              type="button"
              className="flex flex-col items-center rounded-xl border border-[#2a2a32] bg-[#18181c] px-3 py-4 text-center transition hover:border-[#404048] hover:bg-[#1f1f24]"
              onClick={() => {
                onPick(c.kind);
                onClose();
              }}
            >
              <span className="mb-2 text-2xl" style={{ color: c.color }} aria-hidden>
                ●
              </span>
              <span className="text-[13px] font-medium text-white">{c.label}</span>
              <span className="mt-0.5 text-[10px] text-[#6b7280]">{c.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MixerStrip({
  trackId,
  peak,
  fileInputTrigger,
}: {
  trackId: string;
  peak: number;
  fileInputTrigger: () => void;
}) {
  const daw = useDaw();
  const tr = daw.tracks.find((t) => t.id === trackId);
  if (!tr) return null;

  return (
    <div
      className="flex w-[108px] shrink-0 flex-col border-r border-[#25252b] bg-[#141416]"
      style={{ borderTopColor: tr.color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between border-b border-[#25252b] px-1 py-1">
        <span className="mt-0.5 text-[10px] opacity-70" aria-hidden>
          ♪
        </span>
        <button
          type="button"
          className="rounded px-1 text-[12px] text-[#6b7280] hover:bg-[#2a1a1a] hover:text-red-400"
          title="Remove track"
          onClick={() => daw.removeTrack(tr.id)}
        >
          ×
        </button>
      </div>
      <div
        className="border-b border-[#25252b] px-1.5 py-1"
        style={{ borderBottomColor: tr.color, borderBottomWidth: 2 }}
      >
        <input
          value={tr.name}
          onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
          className="w-full truncate bg-transparent text-[11px] font-semibold text-white outline-none placeholder:text-[#52525b]"
          placeholder="Name…"
        />
      </div>
      <select
        value={tr.inputSource}
        onChange={(e) => daw.setTrackInputSource(tr.id, e.target.value)}
        className="mx-1 mt-1 truncate rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-1 text-[9px] text-[#d4d4d8]"
      >
        {INPUT_SOURCE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex justify-center gap-1 px-1">
        <button
          type="button"
          title="Mute"
          onClick={() => daw.toggleMute(tr.id)}
          className={`h-7 w-7 rounded border text-[10px] font-bold ${tr.muted ? "border-[#6b2a2a] bg-[#3f1f1f] text-[#fca5a5]" : "border-[#333] bg-[#1e1e22] text-[#a1a1aa]"}`}
        >
          M
        </button>
        <button
          type="button"
          title="Solo"
          onClick={() => daw.toggleSolo(tr.id)}
          className={`h-7 w-7 rounded border text-[10px] font-bold ${tr.solo ? "border-[#6b5a2a] bg-[#3a3420] text-[#fde047]" : "border-[#333] bg-[#1e1e22] text-[#a1a1aa]"}`}
        >
          S
        </button>
        <button
          type="button"
          title="Record arm"
          onClick={() => daw.toggleRecordArm(tr.id)}
          className={`h-7 w-7 rounded-full border text-[10px] font-bold ${tr.recordArm ? "border-red-500 bg-[#4a1515] text-red-300" : "border-[#444] bg-[#252528] text-[#888]"}`}
        >
          R
        </button>
      </div>
      <div className="mt-2 px-1">
        <div className="mb-0.5 flex justify-between text-[9px] text-[#6b7280]">
          <span>Pan</span>
          <span className="font-mono tabular-nums text-[#9ca3af]">{tr.pan.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={tr.pan}
          onChange={(e) => daw.setTrackPan(tr.id, Number(e.target.value))}
          className="h-1 w-full accent-[#a78bfa]"
        />
      </div>
      <select
        value={tr.eqPreset}
        onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)["eqPreset"])}
        className="mx-1 mt-1 rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-0.5 text-[8px] text-[#c4c4c4]"
        title="EQ"
      >
        {EQ_PRESET_LABELS.map((o) => (
          <option key={o.id} value={o.id}>
            EQ: {o.label}
          </option>
        ))}
      </select>
      <select
        value={tr.effectPreset}
        onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)["effectPreset"])}
        className="mx-1 mt-0.5 rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-0.5 text-[8px] text-[#c4c4c4]"
        title="Dynamics / effects"
      >
        {EFFECT_PRESET_LABELS.map((o) => (
          <option key={o.id} value={o.id}>
            FX: {o.label}
          </option>
        ))}
      </select>
      <select
        value={tr.spacePreset}
        onChange={(e) => daw.setTrackSpace(tr.id, e.target.value as (typeof tr)["spacePreset"])}
        className="mx-1 mt-0.5 rounded border border-[#2a2a32] bg-[#0e0e10] px-0.5 py-0.5 text-[8px] text-[#c4c4c4]"
        title="Reverb / space (post dynamics)"
      >
        {SPACE_PRESET_LABELS.map((o) => (
          <option key={o.id} value={o.id}>
            Space: {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="mx-1 mt-1 rounded border border-[#333] py-0.5 text-[8px] text-[#93c5fd] hover:bg-[#1a1a1f]"
        onClick={fileInputTrigger}
      >
        Import file
      </button>

      <div className="mt-2 flex flex-1 items-stretch justify-center gap-1.5 px-1 pb-2">
        <div className="flex flex-col items-end justify-between py-1 pr-0.5 text-[8px] font-mono leading-tight text-[#52525b]">
          <span>0</span>
          <span>-10</span>
          <span>-20</span>
          <span>-30</span>
          <span>-40</span>
          <span>-∞</span>
        </div>
        <div className="relative flex w-5 flex-col justify-end">
          <div className="relative h-[140px] w-full overflow-hidden rounded-sm bg-[#0a0a0c]">
            <div
              className="absolute bottom-0 left-0 right-0 opacity-90 transition-[height] duration-75"
              style={{
                height: `${Math.min(100, peak * 115)}%`,
                background: `linear-gradient(to top, #16a34a 0%, #eab308 70%, #dc2626 100%)`,
              }}
            />
          </div>
        </div>
        <div className="relative flex h-[148px] w-9 items-center justify-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={tr.volume}
            onChange={(e) => daw.setTrackVolume(tr.id, Number(e.target.value))}
            className="absolute w-[120px] -rotate-90 cursor-pointer accent-[#3b82f6]"
            aria-label="Volume fader"
          />
        </div>
      </div>
      <div className="border-t border-[#25252b] py-1 text-center font-mono text-[9px] tabular-nums text-[#94a3b8]">
        {faderToDbLabel(tr.volume)}
      </div>
    </div>
  );
}

function DawChrome() {
  const daw = useDaw();
  const [editorTab, setEditorTab] = useState<"clip" | "piano">("clip");
  const [selection, setSelection] = useState<ClipSelection>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainView, setMainView] = useState<"arrange" | "mixer">("arrange");
  const fileRef = useRef<HTMLInputElement>(null);
  const importTrackRef = useRef<string>("");

  const end = useMemo(() => {
    if (daw.tracks.length === 0) return 90;
    return Math.max(90, ...daw.tracks.flatMap((t) => t.clips.map((c) => c.startTime + c.buffer.duration)));
  }, [daw.tracks]);

  const widthPx = Math.ceil(end * PX_PER_SEC) + 160;

  const selectedClip =
    selection && daw.tracks.find((t) => t.id === selection.trackId)?.clips.find((c) => c.id === selection.clipId);

  const selectedTrack = daw.selectedTrackId ? daw.tracks.find((t) => t.id === daw.selectedTrackId) : null;

  const targetTrackId = daw.selectedTrackId ?? daw.tracks[0]?.id ?? "";

  const [editorWavWidth, setEditorWavWidth] = useState(880);
  useEffect(() => {
    const w = () => setEditorWavWidth(Math.max(320, window.innerWidth - 360));
    w();
    window.addEventListener("resize", w);
    return () => window.removeEventListener("resize", w);
  }, []);

  const openImport = (trackId: string) => {
    importTrackRef.current = trackId;
    fileRef.current?.click();
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col bg-[#0a0a0c] text-[#e4e4e8]">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.m4a"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const tid = importTrackRef.current || targetTrackId;
          if (f && tid) void daw.importAudioFile(tid, f);
          e.target.value = "";
        }}
      />

      <StartSongModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPick={(kind) => daw.addTrackWithKind(kind)}
      />

      {/* Transport — n-Track style */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#25252b] bg-[#161618] px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={daw.isRecording ? "Stop recording" : "Record"}
            className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[#f87171] hover:bg-[#3f2020] ${
              daw.isRecording ? "border-red-500 bg-[#4a1818] ring-2 ring-red-500/60" : "border-[#7f1d1d] bg-[#292020]"
            }`}
            onClick={() => {
              if (daw.isRecording) daw.stopRecord();
              else void daw.startRecord();
            }}
          >
            <IconRec />
          </button>
          <button
            type="button"
            title="Play (works while recording — hear backing tracks)"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] text-[#e5e5e5] hover:bg-[#2a2a30]"
            onClick={() => daw.play()}
          >
            <IconPlay />
          </button>
          <button
            type="button"
            title="Stop playback (recording continues until you stop Record)"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] text-[#a3a3a3] hover:bg-[#2a2a30]"
            onClick={() => daw.stopTransport()}
          >
            <IconStop />
          </button>
          <button
            type="button"
            title="Return to start"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] text-[#a3a3a3] hover:bg-[#2a2a30]"
            onClick={() => daw.rewindToStart()}
          >
            <IconRewind />
          </button>
          <button
            type="button"
            title={daw.loopEnabled ? "Loop on" : "Loop off"}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border ${daw.loopEnabled ? "border-[#854d0e] bg-[#422006]" : "border-[#333] bg-[#222226]"}`}
            onClick={() => daw.setLoopEnabled(!daw.loopEnabled)}
          >
            <IconLoop active={daw.loopEnabled} />
          </button>
        </div>

        <div className="mx-1 hidden h-8 w-px bg-[#333] sm:block" />

        <div className="flex flex-col items-center px-2">
          <span className="text-[9px] uppercase tracking-wider text-[#6b7280]">Bars : beats : ticks</span>
          <span className="font-mono text-[15px] font-medium tabular-nums text-[#93c5fd]">
            {formatBBT(daw.currentTime, daw.tempo, daw.beatsPerBar)}
          </span>
        </div>

        <button
          type="button"
          title={daw.metronomeOn ? "Metronome on" : "Metronome off"}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#333] bg-[#222226] hover:bg-[#2a2a30]"
          onClick={() => daw.setMetronomeOn(!daw.metronomeOn)}
        >
          <IconMetronome off={!daw.metronomeOn} />
        </button>

        <label className="flex items-center gap-1 text-[10px] text-[#6b7280]">
          BPM
          <input
            type="number"
            min={40}
            max={240}
            value={daw.tempo}
            onChange={(e) => daw.setTempo(Number(e.target.value) || 120)}
            className="w-14 rounded border border-[#333] bg-[#1a1a1c] px-1 py-0.5 font-mono text-[11px] text-white"
          />
        </label>

        <label className="ml-auto flex min-w-[140px] max-w-[200px] flex-1 items-center gap-2 sm:max-w-xs">
          <span className="text-[9px] text-[#6b7280]">Pos</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, end)}
            step={0.01}
            value={Math.min(daw.currentTime, end)}
            onChange={(e) => daw.seek(Number(e.target.value))}
            className="h-1 w-full cursor-pointer grow accent-[#4d9fff]"
          />
        </label>

        <div className="flex items-center gap-1 border-l border-[#333] pl-2">
          <button
            type="button"
            className={`rounded px-2 py-2 text-[10px] font-medium uppercase ${mainView === "arrange" ? "bg-[#2a2a32] text-white" : "text-[#888] hover:bg-[#222]"}`}
            onClick={() => setMainView("arrange")}
          >
            Timeline
          </button>
          <button
            type="button"
            className={`rounded px-2 py-2 text-[10px] font-medium uppercase ${mainView === "mixer" ? "bg-[#2a2a32] text-white" : "text-[#888] hover:bg-[#222]"}`}
            onClick={() => setMainView("mixer")}
          >
            Mixer
          </button>
        </div>

        <button
          type="button"
          className="rounded border border-[#31318a] bg-[#252542] px-2 py-2 text-[10px] font-medium text-[#c7d2fe] hover:bg-[#2f2f55]"
          onClick={() => void daw.exportMixWav()}
        >
          Export
        </button>
        <button
          type="button"
          className="rounded border border-[#2a2a32] px-2 py-2 text-[10px] text-[#9ca3af] hover:bg-[#1a1a1e]"
          onClick={() => setModalOpen(true)}
        >
          + Track
        </button>
        <button
          type="button"
          className="rounded border border-[#333] px-2 py-2 text-[10px] text-[#93c5fd]"
          onClick={() => targetTrackId && openImport(targetTrackId)}
          disabled={!targetTrackId}
        >
          Import
        </button>
      </header>

      {mainView === "mixer" ? (
        <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-[#101012]">
          {daw.tracks.map((t) => (
            <MixerStrip
              key={t.id}
              trackId={t.id}
              peak={daw.meterPeaks[t.id] ?? 0}
              fileInputTrigger={() => openImport(t.id)}
            />
          ))}
          <div className="min-w-[120px] flex-1 bg-[#0c0c0e]" aria-hidden />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#25252b] bg-[#0e0e10]">
            <div className="border-b border-[#25252b] px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7280]">
              Sound library
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="mb-3 border-b border-[#25252b] pb-2">
                <div className="mb-1 px-1 text-[10px] text-[#9ca3af]">Mic / input chain (selected track)</div>
                <select
                  className="mb-2 w-full rounded border border-[#2a2a32] bg-[#141416] px-1 py-1 text-[10px] text-[#d4d4d8]"
                  value=""
                  disabled={!targetTrackId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && targetTrackId)
                      daw.applyMicChainPreset(targetTrackId, v as (typeof MIC_CHAIN_PRESETS)[number]["id"]);
                    e.target.value = "";
                  }}
                >
                  <option value="">Apply mic preset…</option>
                  {MIC_CHAIN_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              {LIBRARY_BY_CATEGORY.map((grp) => (
                <div key={grp.category} className="mb-3">
                  <div className="mb-1 px-1 text-[10px] text-[#9ca3af]">{grp.category}</div>
                  <ul className="space-y-0.5">
                    {grp.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!targetTrackId}
                          className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-[#1a1a1f] disabled:opacity-40"
                          onClick={() => targetTrackId && daw.addLibraryClip(targetTrackId!, item.id)}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {REMOTE_LIBRARY_BY_CATEGORY.map((grp) => (
                <div key={grp.category} className="mb-3">
                  <div className="mb-1 px-1 text-[10px] text-[#9ca3af]">
                    {grp.category} <span className="text-[#52525b]">(web)</span>
                  </div>
                  <ul className="space-y-0.5">
                    {grp.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!targetTrackId}
                          className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[#d1d5db] hover:bg-[#1a1a1f] disabled:opacity-40"
                          onClick={() => targetTrackId && void daw.addRemoteLibraryClip(targetTrackId!, item.id)}
                          title={item.source}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="border-t border-[#25252b] p-2 text-[10px] leading-snug text-[#6b7280]">
              Built-in sounds are synthesized. Web samples need CORS; if one fails, try another or use{" "}
              <strong className="text-[#9ca3af]">Import file</strong>.
            </p>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-[#0a0a0c]">
            <div className="sticky top-0 z-20 flex h-7 shrink-0 items-end border-b border-[#25252b] bg-[#0c0c0f]">
              <div className="w-[188px] shrink-0 border-r border-[#25252b] bg-[#0c0c0f]" />
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div className="relative h-7" style={{ width: widthPx }}>
                  {Array.from({ length: Math.ceil(end / 4) + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute bottom-0 top-0 border-l border-[#1f1f24] pl-1 text-[9px] leading-none text-[#52525b]"
                      style={{ left: i * 4 * PX_PER_SEC }}
                    >
                      <span className="inline-block translate-y-0.5">{i * 4}s</span>
                    </div>
                  ))}
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#4d9fff]"
                    style={{ left: daw.currentTime * PX_PER_SEC, zIndex: 10 }}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {daw.tracks.map((tr) => (
                <div
                  key={tr.id}
                  className={`flex border-b border-[#1a1a1e] ${daw.selectedTrackId === tr.id ? "bg-[#0f141c]" : "bg-[#0a0a0c]"}`}
                >
                  <div className="flex w-[188px] shrink-0 border-r border-[#25252b]">
                    <div className="w-1 shrink-0" style={{ backgroundColor: tr.color }} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 py-1.5">
                      <input
                        className="w-full truncate border border-transparent bg-transparent text-[12px] font-medium text-white outline-none focus:border-[#2a2a32]"
                        value={tr.name}
                        onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
                      />
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={`h-6 w-6 rounded text-[10px] font-bold ${tr.muted ? "bg-[#3f1f1f] text-[#fca5a5]" : "bg-[#1a1a1f] text-[#9ca3af]"}`}
                          onClick={() => daw.toggleMute(tr.id)}
                        >
                          M
                        </button>
                        <button
                          type="button"
                          className={`h-6 w-6 rounded text-[10px] font-bold ${tr.solo ? "bg-[#3a3420] text-[#fde047]" : "bg-[#1a1a1f] text-[#9ca3af]"}`}
                          onClick={() => daw.toggleSolo(tr.id)}
                        >
                          S
                        </button>
                        <button
                          type="button"
                          className={`h-6 w-6 rounded-full text-[9px] font-bold ${tr.recordArm ? "bg-[#4a1515] text-red-300" : "bg-[#1a1a1f] text-[#9ca3af]"}`}
                          onClick={() => daw.toggleRecordArm(tr.id)}
                        >
                          R
                        </button>
                        <button
                          type="button"
                          className="ml-auto text-[9px] text-[#6b7280] hover:text-white"
                          onClick={() => daw.setSelectedTrackId(tr.id)}
                        >
                          Select
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-left text-[9px] text-[#6b7280] hover:text-[#a1a1aa]"
                        onClick={() => daw.removeTrack(tr.id)}
                      >
                        Delete track
                      </button>
                    </div>
                  </div>

                  <div className="relative min-h-[56px] min-w-0 flex-1">
                    <div
                      className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-px bg-[#4d9fff]"
                      style={{ left: daw.currentTime * PX_PER_SEC }}
                    />
                    <div className="relative h-full min-h-[56px]" style={{ width: widthPx }}>
                      {tr.clips.map((c) => {
                        const w = Math.max(24, c.buffer.duration * PX_PER_SEC);
                        const h = 48;
                        const isSel = selection?.trackId === tr.id && selection?.clipId === c.id;
                        return (
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            className={`group absolute top-1 cursor-pointer overflow-hidden rounded-sm border text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa] ${
                              isSel
                                ? "border-[#93c5fd] ring-1 ring-[#60a5fa]/50"
                                : "border-[#2a2a32] hover:border-[#404040]"
                            }`}
                            style={{
                              left: c.startTime * PX_PER_SEC,
                              width: w,
                              height: h,
                              backgroundColor: `${tr.color}22`,
                            }}
                            onClick={() => setSelection({ trackId: tr.id, clipId: c.id })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setSelection({ trackId: tr.id, clipId: c.id });
                            }}
                          >
                            <WaveformCanvas
                              buffer={c.buffer}
                              width={Math.floor(w)}
                              height={h}
                              color={tr.color}
                              fill="rgba(0,0,0,0.35)"
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 z-10 hidden rounded-bl bg-black/55 px-1.5 py-0.5 text-[11px] text-white group-hover:inline"
                              aria-label="Remove clip"
                              onClick={(e) => {
                                e.stopPropagation();
                                daw.deleteClip(tr.id, c.id);
                                setSelection((s) => (s?.clipId === c.id && s.trackId === tr.id ? null : s));
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <footer className="flex h-[140px] shrink-0 flex-col border-t border-[#25252b] bg-[#101012]">
        <div className="flex border-b border-[#25252b] text-[11px]">
          <button
            type="button"
            className={`px-4 py-1.5 font-medium ${editorTab === "clip" ? "bg-[#1a1a1f] text-white" : "text-[#9ca3af] hover:bg-[#16161a]"}`}
            onClick={() => setEditorTab("clip")}
          >
            Clip / waveform
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 font-medium ${editorTab === "piano" ? "bg-[#1a1a1f] text-white" : "text-[#9ca3af] hover:bg-[#16161a]"}`}
            onClick={() => setEditorTab("piano")}
          >
            Piano roll
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch">
          {editorTab === "clip" && selectedClip && selectedTrack ? (
            <div className="flex flex-1 items-center gap-3 p-3">
              <div className="h-1 w-10 shrink-0 rounded" style={{ backgroundColor: selectedTrack.color }} />
              <div className="min-h-0 flex-1 rounded border border-[#25252b] bg-[#0a0a0c]">
                <WaveformCanvas
                  buffer={selectedClip.buffer}
                  width={Math.min(1200, editorWavWidth)}
                  height={96}
                  color="#e2e8f0"
                  fill="rgba(0,0,0,0.5)"
                />
              </div>
            </div>
          ) : editorTab === "clip" ? (
            <p className="flex flex-1 items-center px-4 text-[12px] text-[#6b7280]">
              Select a clip in the timeline for a zoomed waveform.
            </p>
          ) : (
            <div className="flex flex-1 flex-col p-2">
              <div
                className="flex-1 rounded border border-[#1f1f24] bg-[#0a0a0c]"
                style={{
                  backgroundImage:
                    "linear-gradient(#1a1a1e 1px, transparent 1px), linear-gradient(90deg, #141418 1px, transparent 1px)",
                  backgroundSize: "100% 14px, 32px 100%",
                }}
              />
            </div>
          )}
        </div>
      </footer>

      {daw.status ? (
        <div className="border-t border-[#25252b] bg-[#0e0e10] px-3 py-1.5 text-[11px] text-[#9ca3af]">
          {daw.status}
        </div>
      ) : null}
    </div>
  );
}

export function DawWorkspacePage() {
  return (
    <DawProvider>
      <DawChrome />
    </DawProvider>
  );
}
