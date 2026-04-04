/* W.Studio DAW Workspace */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { TrackKind } from "./types";
import {
  EFFECT_PRESET_LABELS,
  EQ_PRESET_LABELS,
  LIBRARY_BY_CATEGORY,
  SPACE_PRESET_LABELS,
  faderToDbLabel,
  getTimelineEndSec,
} from "./audio";
import { MIC_CHAIN_PRESETS } from "./micPresets";
import { REMOTE_LIBRARY_BY_CATEGORY } from "./remoteLibrary";
import { DawProvider, INPUT_SOURCE_OPTIONS, useDaw } from "./DawContext";
import { PianoRoll } from "./PianoRoll";
import { WaveformCanvas } from "./WaveformCanvas";

const PX_PER_SEC = 52;
const TRACK_HEADER_W = 292;
const TIMELINE_BAR_LIMIT = 127;
const INSPECTOR_STRIP_W = 74;
const INSPECTOR_PANEL_W = INSPECTOR_STRIP_W * 2 + 1; /* 1px for border between strips */
/** Mixer layout — compact, aligned with classic console strips */
const MIXER_LABEL_W = 82;
const MIXER_STRIP_W = 74;
const MIXER_METER_H = 160;
const TRACK_ROW_MIN_H = 56;
const MIXER_LABEL_ROWS = [
  { label: "Setting", height: 22 },
  { label: "Gain Reduction", height: 20 },
  { label: "EQ", height: 20 },
  { label: "MIDI FX", height: 20 },
  { label: "Input", height: 22 },
  { label: "Audio FX", height: 60 },
  { label: "Sends", height: 34 },
  { label: "Output", height: 22 },
  { label: "Group", height: 20 },
  { label: "Automation", height: 24 },
  { label: "", height: 40 }, // instrument icon area
  { label: "Pan", height: 36 },
  { label: "dB", height: 24 },
  { label: "", height: MIXER_METER_H + 10 },
  { label: "", height: 22 },
  { label: "", height: 28 },
  { label: "", height: 24 },
] as const;
const MIXER_SCALE_MARKS = [
  "6",
  "3",
  "0",
  "-3",
  "-6",
  "-9",
  "-12",
  "-15",
  "-18",
  "-21",
  "-24",
  "-30",
  "-40",
  "-50",
  "-60",
];

/** Logic Pro X faithful palette — medium gray, not dark */
const LP = {
  appBg: "#56565a",
  panel: "#636366",
  panelHi: "#6e6e72",
  panelLo: "#4a4a4e",
  border: "#333336",
  borderHi: "#7a7a7e",
  text: "#f0f0f0",
  textMuted: "#b0b0b4",
  lcdBg: "#0c1420",
  lcdText: "#6ec8ff",
  lcdDim: "#4a8aba",
  accentBlue: "#3478f6",
  accentBlueHi: "#5a9eef",
  ruler: "#8a8a70",
  meterGreen: "#4eca4e",
  meterYel: "#d4c44a",
  meterRed: "#e24444",
  solo: "#e8d44a",
  muteOn: "#5ab0b0",
  record: "#e03030",
  readAuto: "#4a9a4a",
  slotBg: "#505054",
  slotBorder: "#3e3e42",
  stripBg: "linear-gradient(180deg, #636366 0%, #505054 100%)",
  channelLabelBg: "#3a3a3e",
} as const;

const ctrlBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border text-[#eee] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.25)] active:translate-y-[0.5px]";
const ctrlBtnBase = `${ctrlBtn} border-[#5a5a5e] bg-gradient-to-b from-[#727276] to-[#5a5a5e] hover:from-[#7e7e82] hover:to-[#636366]`;
const ctrlBtnActive = `${ctrlBtn} border-[#3478f6] bg-gradient-to-b from-[#4a78c8] to-[#3060a0]`;

function formatSMPTE(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.min(29, Math.floor((sec % 1) * 30));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

function formatLogicBars(sec: number, bpm: number, beatsPerBar: number) {
  const beats = sec * (bpm / 60);
  const bar = Math.floor(beats / beatsPerBar) + 1;
  const beatInBar = Math.floor(beats % beatsPerBar) + 1;
  const tick = Math.min(479, Math.floor((beats % 1) * 480));
  return `${String(bar).padStart(4, "0")} ${beatInBar} 1 ${String(tick).padStart(3, "0")}`;
}

function secPerBar(bpm: number, beatsPerBar: number) {
  return (60 / Math.max(40, bpm)) * beatsPerBar;
}

function peakToDbDisplay(p: number) {
  if (p < 0.001) return "-∞";
  const db = 20 * Math.log10(Math.max(p, 0.0001));
  return db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
}

function isAudioDropFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return /\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(file.name);
}

function firstAudioFileFromDataTransfer(dt: DataTransfer): File | undefined {
  const { files } = dt;
  for (let i = 0; i < files.length; i++) {
    const f = files.item(i);
    if (f && isAudioDropFile(f)) return f;
  }
  return undefined;
}

function formatBBT(sec: number, bpm: number, beatsPerBar: number) {
  const beats = sec * (bpm / 60);
  const whole = Math.floor(beats + 1e-9);
  const bar = Math.floor(whole / beatsPerBar) + 1;
  const beat = (whole % beatsPerBar) + 1;
  const tick = Math.min(479, Math.floor((beats % 1) * 480));
  return `${bar}:${beat}:${String(tick).padStart(3, "0")}`;
}

function formatMs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
}

function IconInspector({ open }: { open: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="12" height="16" rx="2" />
      <path d={open ? "M21 8l-4 4 4 4" : "M17 8v8"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExpand() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

/** Inspector channel strip — uses identical MixerSlotRow grid as mixer strips for perfect alignment */
function InspectorChannelStrip({ trackId, isStereoOut }: { trackId: string | null; isStereoOut?: boolean }) {
  const daw = useDaw();
  const tr = !isStereoOut && trackId ? daw.tracks.find((t) => t.id === trackId) : null;
  const peak = isStereoOut ? (daw.meterPeaks.__master__ ?? 0) : tr ? (daw.meterPeaks[tr.id] ?? 0) : 0;
  const vol = isStereoOut ? daw.masterVolume : (tr?.volume ?? 0.8);
  const pan = tr?.pan ?? 0;
  const name = isStereoOut ? "Stereo Out" : (tr?.name ?? "Track");
  const labelColor = isStereoOut ? "#4a9a4a" : (tr?.color ?? "#60a5fa");
  const updateVolume = (value: number) => {
    if (isStereoOut) daw.setMasterVolume(value);
    else if (tr) daw.setTrackVolume(tr.id, value);
  };

  const eqLabel = tr ? (EQ_PRESET_LABELS.find((o) => o.id === tr.eqPreset)?.label ?? "Chan EQ") : "Output EQ";
  const effectLabel = tr ? (EFFECT_PRESET_LABELS.find((o) => o.id === tr.effectPreset)?.label ?? "Off") : "";
  const spaceLabel = tr ? (SPACE_PRESET_LABELS.find((o) => o.id === tr.spacePreset)?.label ?? "") : "Space D";

  return (
    <div
      className="flex min-h-full shrink-0 flex-col"
      style={{ color: LP.text, width: INSPECTOR_STRIP_W, minWidth: INSPECTOR_STRIP_W }}
    >
      {/* Setting */}
      <MixerSlotRow label="Setting">
        <div className={mixerFieldDark} title={name}>
          {name}
        </div>
      </MixerSlotRow>
      {/* Gain Reduction */}
      <MixerSlotRow label="Gain Reduction">
        <div className="h-3 w-full rounded-[2px] border border-[#454549] bg-[#3a3a3e]" />
      </MixerSlotRow>
      {/* EQ */}
      <MixerSlotRow label="EQ">
        {tr ? (
          <select
            value={tr.eqPreset}
            onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)["eqPreset"])}
            className={`${mixerFieldGray} appearance-none outline-none`}
            title="Channel EQ"
          >
            {EQ_PRESET_LABELS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <div className={mixerFieldDark}>Output EQ</div>
        )}
      </MixerSlotRow>
      {/* MIDI FX */}
      <MixerSlotRow label="MIDI FX">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      {/* Input */}
      <MixerSlotRow label="Input">
        {!isStereoOut ? <div className={mixerFieldDark}>Input 1</div> : <div className="text-[9px] text-[#ccc]">∞</div>}
      </MixerSlotRow>
      {/* Audio FX */}
      <MixerSlotRow label="Audio FX">
        {tr ? (
          <div className="flex w-full flex-col gap-[2px]">
            <select
              value={tr.effectPreset}
              onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)["effectPreset"])}
              className={`${mixerFieldBlue} appearance-none outline-none`}
              title="Audio FX"
            >
              {EFFECT_PRESET_LABELS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <MixerStack items={[spaceLabel !== "Dry" ? spaceLabel : ""]} tone="blue" />
          </div>
        ) : (
          <MixerStack items={["Space D"]} tone="blue" />
        )}
      </MixerSlotRow>
      {/* Sends */}
      <MixerSlotRow label="Sends">
        <MixerStack items={!isStereoOut ? ["Sends"] : []} tone="gray" />
      </MixerSlotRow>
      {/* Output */}
      <MixerSlotRow label="Output">
        <div className={mixerFieldDark}>{isStereoOut ? "Output" : "St Out"}</div>
      </MixerSlotRow>
      {/* Group */}
      <MixerSlotRow label="Group">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      {/* Automation */}
      <MixerSlotRow label="Automation">
        <button type="button" className={`${mixerFieldGreen} font-bold`}>
          Read
        </button>
      </MixerSlotRow>
      {/* Instrument icon */}
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 40, height: 40 }}
      >
        {!isStereoOut && tr ? (
          <InstrumentIcon kind={tr.kind} color={tr.color} />
        ) : (
          <svg
            style={{ color: "#4a9a4a", width: 28, height: 28 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
          </svg>
        )}
      </div>
      {/* Pan */}
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 36, height: 36 }}
      >
        <PanKnob
          value={isStereoOut ? 0 : pan}
          onChange={(v) => !isStereoOut && tr && daw.setTrackPan(tr.id, v)}
          size={28}
          showValueLabel={false}
        />
      </div>
      {/* dB */}
      <div
        className="flex items-center justify-center gap-0.5 border-b px-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 24, height: 24 }}
      >
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">
          {isStereoOut ? "0.0" : faderToDbLabel(vol)}
        </span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">
          {peakToDbDisplay(peak)}
        </span>
      </div>
      {/* Fader + meters */}
      <div
        className="border-b"
        style={{ borderColor: "#4a4a4e", minHeight: MIXER_METER_H + 10, height: MIXER_METER_H + 10 }}
      >
        <VerticalMixerFader value={vol} peak={peak} onChange={updateVolume} ariaLabel={`${name} level`} />
      </div>
      {/* R I / Bnce */}
      {!isStereoOut ? (
        <div
          className="flex items-center justify-center gap-0.5 border-b py-[2px]"
          style={{ borderColor: "#4a4a4e", minHeight: 22, height: 22 }}
        >
          <button
            type="button"
            onClick={() => tr && daw.toggleRecordArm(tr.id)}
            className={`h-4 w-5 rounded-sm border text-[8px] font-bold ${tr?.recordArm ? "border-[#a22] bg-[#e03030] text-white" : "border-[#555] bg-[#4a4a4e] text-[#999]"}`}
          >
            R
          </button>
          <button
            type="button"
            className="h-4 w-5 rounded-sm border border-[#555] bg-[#4a4a4e] text-[8px] font-bold text-[#999]"
          >
            I
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-center border-b py-[2px]"
          style={{ borderColor: "#4a4a4e", minHeight: 22, height: 22 }}
        >
          <span className="text-[8px] text-[#999]">Bnce</span>
        </div>
      )}
      {/* M S */}
      <div
        className="flex items-center justify-center gap-1 border-b py-0.5"
        style={{ borderColor: "#4a4a4e", minHeight: 28, height: 28 }}
      >
        <button
          type="button"
          onClick={() => !isStereoOut && tr && daw.toggleMute(tr.id)}
          className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${!isStereoOut && tr?.muted ? "border-[#3a7a7a] bg-[#5ab0b0] text-[#022]" : "border-[#555] bg-[#4a4a4e] text-[#ddd]"}`}
        >
          M
        </button>
        {!isStereoOut && (
          <button
            type="button"
            onClick={() => tr && daw.toggleSolo(tr.id)}
            className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${tr?.solo ? "border-[#886600] bg-[#e8d44a] text-[#111]" : "border-[#555] bg-[#4a4a4e] text-[#ddd]"}`}
          >
            S
          </button>
        )}
      </div>
      {/* Track name label */}
      <div
        className="mt-auto flex items-center justify-center truncate border-t px-1 text-center text-[9px] font-semibold"
        style={{
          backgroundColor: labelColor,
          borderColor: LP.border,
          color: isStereoOut ? "#fff" : "#111",
          minHeight: 24,
        }}
        title={name}
      >
        {name}
      </div>
    </div>
  );
}

function TrackInspector({ trackId }: { trackId: string | null }) {
  const daw = useDaw();
  const tr = trackId ? daw.tracks.find((t) => t.id === trackId) : null;
  return (
    <div className="flex h-full flex-col text-[9px]" style={{ color: LP.text }}>
      {/* Region / Track headers */}
      <div className="border-b px-2 py-1" style={{ borderColor: LP.border }}>
        <div className="flex items-center gap-1 text-[9px]">
          <span className="text-[#888]">▶</span>
          <span className="font-semibold">Region:</span>
          <span className="text-[#b0b0b4]">Audio Defaults</span>
        </div>
      </div>
      <div className="border-b px-2 py-1" style={{ borderColor: LP.border }}>
        <div className="flex items-center gap-1 text-[9px]">
          <span className="text-[#888]">▶</span>
          <span className="font-semibold">Track:</span>
          <span className="text-[#b0b0b4]">{tr?.name ?? "Audio 1"}</span>
        </div>
      </div>
      {/* Two channel strips side by side */}
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
        <div className="flex shrink-0">
          <div className="border-r" style={{ borderColor: LP.border, width: INSPECTOR_STRIP_W }}>
            <InspectorChannelStrip trackId={trackId} />
          </div>
          <div style={{ width: INSPECTOR_STRIP_W }}>
            <InspectorChannelStrip trackId={null} isStereoOut />
          </div>
        </div>
      </div>
    </div>
  );
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

function IconLibraryDrawer() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M9 4v16" strokeLinecap="round" />
    </svg>
  );
}
function IconHelpQ() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 .2c0 2-2.5 1.8-2.5 3.8M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}
function IconSmartSliders() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M4 8h4M10 8h10M4 16h10M16 16h4" strokeLinecap="round" />
      <circle cx="7" cy="8" r="2" fill="currentColor" />
      <circle cx="14" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}
function IconMixerConsole() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7v8M12 5v10M16 8v7" strokeLinecap="round" />
    </svg>
  );
}
function IconEditorsWin() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9h18M9 5v14" strokeLinecap="round" />
    </svg>
  );
}
function IconToolbarRows() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  );
}
function IconListDoc() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M8 6h12M8 10h12M8 14h8M8 18h8" strokeLinecap="round" />
      <rect x="4" y="5" width="2" height="2" fill="currentColor" />
      <rect x="4" y="9" width="2" height="2" fill="currentColor" />
      <rect x="4" y="13" width="2" height="2" fill="currentColor" />
    </svg>
  );
}
function IconNotePad() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v4h4" />
    </svg>
  );
}
function IconLoopBrowser() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l3 2" strokeLinecap="round" />
    </svg>
  );
}
function IconMediaBrowser() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="9" cy="11" r="2.5" />
      <path d="M21 15l-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** Transport: jump to project start (|◀◀) */
function IconGoToStart() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="4" y="5" width="2.5" height="14" rx="0.5" />
      <path d="M19 18V6l-8 6 8 6z" />
      <path d="M11 18V6l-7 6 7 6z" />
    </svg>
  );
}
/** Transport: skip forward (~one beat) (▶▶) */
function IconFastForward() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 6v12l8.5-6L13 6z" />
      <path d="M3 6v12l8.5-6L3 6z" />
    </svg>
  );
}
/** Transport: jump to project end (▶▶|) */
function IconGoToEnd() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 18V6l8 6-8 6z" />
      <path d="M13 18V6l7 6-7 6z" />
      <rect x="17.5" y="5" width="2.5" height="14" rx="0.5" />
    </svg>
  );
}
function IconCountIn() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="14" width="3.5" height="6" rx="0.5" />
      <rect x="8" y="10" width="3.5" height="10" rx="0.5" />
      <rect x="13" y="12" width="3.5" height="8" rx="0.5" />
      <rect x="18" y="8" width="3.5" height="12" rx="0.5" />
    </svg>
  );
}
function IconScissors() {
  return (
    <svg
      className="h-[16px] w-[16px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <path d="M9 9l8 4-8 4M9 15l8-4" strokeLinecap="round" />
    </svg>
  );
}
function IconGlue() {
  return (
    <svg
      className="h-[16px] w-[16px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M8 12h8M10 8v8M14 8v8" strokeLinecap="round" />
    </svg>
  );
}
function IconWaveInst() {
  return (
    <svg
      className="h-[14px] w-[14px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M3 12h2l2-6 3 12 3-8 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStereoLink() {
  return (
    <svg
      className="h-[10px] w-[14px]"
      viewBox="0 0 24 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <circle cx="7" cy="6" r="4" />
      <circle cx="15" cy="6" r="4" />
    </svg>
  );
}

function PanKnob({
  value,
  onChange,
  size = 36,
  showValueLabel = true,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  showValueLabel?: boolean;
}) {
  const deg = value * 48;
  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <div
        className="relative rounded-full border border-[#333] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(160deg, #5a5a5a 0%, #3a3a3a 55%, #323232 100%)",
        }}
      >
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-label="Pan"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[42%] w-[3px] origin-bottom rounded-full"
          style={{
            background: "#8fdf7a",
            transform: `translate(-50%, -100%) rotate(${deg}deg)`,
            boxShadow: "0 0 2px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      {showValueLabel ? (
        <span className="mt-0.5 font-mono text-[7px] tabular-nums text-[#c8c8c8]">
          {Math.abs(value) < 0.05
            ? "0.0"
            : value < 0
              ? `-${Math.round(Math.abs(value) * 100)}`
              : `+${Math.round(value * 100)}`}
        </span>
      ) : null}
    </div>
  );
}

function DualPeakMeters({
  peak,
  height = MIXER_METER_H,
  barWidth = 8,
}: {
  peak: number;
  height?: number;
  barWidth?: number;
}) {
  const h = Math.min(100, peak * 112);
  const bar = (k: string) => (
    <div
      key={k}
      className="relative overflow-hidden rounded-[2px] bg-[#0a0a0a]"
      style={{
        height,
        width: barWidth,
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.95), inset 0 -1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {[12, 28, 44, 60, 76].map((pct) => (
        <div
          key={pct}
          className="pointer-events-none absolute left-0 right-0 border-t border-[#1f1f1f]"
          style={{ bottom: `${pct}%` }}
        />
      ))}
      <div
        className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
        style={{
          height: `${h}%`,
          background: `linear-gradient(to top, ${LP.meterGreen} 0%, ${LP.meterYel} 68%, ${LP.meterRed} 100%)`,
          boxShadow: "0 0 4px rgba(90,200,90,0.25)",
        }}
      />
    </div>
  );
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {bar("L")}
      {bar("R")}
    </div>
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-song-title"
    >
      <div
        className="relative w-full max-w-md rounded-lg border p-5 shadow-2xl"
        style={{ borderColor: LP.border, background: LP.panel, color: LP.text }}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded p-1 hover:bg-black/25"
          style={{ color: LP.textMuted }}
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <h2 id="start-song-title" className="mb-4 text-center text-lg font-semibold">
          New track
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {MODAL_CELLS.map((c) => (
            <button
              key={c.kind}
              type="button"
              className="flex flex-col items-center rounded-lg border px-3 py-4 text-center transition hover:brightness-110"
              style={{ borderColor: LP.border, background: LP.panelLo }}
              onClick={() => {
                onPick(c.kind);
                onClose();
              }}
            >
              <span className="mb-2 text-2xl" style={{ color: c.color }} aria-hidden>
                ●
              </span>
              <span className="text-[13px] font-medium">{c.label}</span>
              <span className="mt-0.5 text-[10px]" style={{ color: LP.textMuted }}>
                {c.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const slotBtn =
  "w-full truncate rounded-[2px] border px-1 py-[3px] text-[9px] text-[#ddd] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const slotEmpty = `${slotBtn} border-[${LP.slotBorder}] bg-[${LP.slotBg}]`;
const mixerFieldBase =
  "flex h-5 w-full items-center justify-center truncate rounded-[3px] border px-1 text-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]";
const mixerFieldGray = `${mixerFieldBase} border-[#4e4e52] bg-[#555558] text-[#ececec]`;
const mixerFieldDark = `${mixerFieldBase} border-[#454549] bg-[#4a4a4e] text-[#d9d9dc]`;
const mixerFieldBlue = `${mixerFieldBase} border-[#3568a8] bg-gradient-to-b from-[#5384c5] to-[#355f99] text-white`;
const mixerFieldGreen = `${mixerFieldBase} border-[#2e5a2e] bg-[#4a9a4a] text-[#efffef]`;

function VerticalMixerFader({
  value,
  peak,
  onChange,
  ariaLabel,
}: {
  value: number;
  peak: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const updateFromClientY = (clientY: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    onChange(Math.max(0, Math.min(1, ratio)));
  };

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateFromClientY(event.clientY);

    const handleMove = (moveEvent: MouseEvent) => updateFromClientY(moveEvent.clientY);
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleTop = (1 - Math.max(0, Math.min(1, value))) * (MIXER_METER_H - 30);

  return (
    <div className="flex h-full w-full items-stretch justify-center gap-[3px] px-[3px] py-1">
      <div className="flex flex-col items-end justify-between py-0.5 font-mono text-[6px] leading-none text-[#9f9fa3]">
        {MIXER_SCALE_MARKS.map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>
      <DualPeakMeters peak={peak} height={MIXER_METER_H} barWidth={6} />
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="relative w-[30px] cursor-ns-resize select-none outline-none"
        style={{ height: MIXER_METER_H }}
        onMouseDown={startDrag}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            onChange(Math.min(1, value + 0.02));
          }
          if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            onChange(Math.max(0, value - 0.02));
          }
        }}
      >
        <div
          className="absolute left-1/2 top-0 bottom-0 w-[10px] -translate-x-1/2 rounded-[3px] border border-[#17171a]"
          style={{
            background: "linear-gradient(90deg, #5a5a5e 0%, #3b3b40 45%, #2a2a2e 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-[4px] border border-[#8b8b8f]"
          style={{
            top: handleTop,
            width: 28,
            height: 30,
            background: "linear-gradient(180deg, #f2f2f2 0%, #cbcbcf 45%, #9b9b9f 100%)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.82)",
          }}
        >
          <div className="absolute inset-x-[5px] top-[8px] h-px bg-[#77777b]" />
          <div className="absolute inset-x-[5px] top-[14px] h-px bg-[#77777b]" />
          <div className="absolute inset-x-[5px] top-[20px] h-px bg-[#77777b]" />
        </div>
      </div>
    </div>
  );
}

function MixerStack({ items, tone = "gray" }: { items: string[]; tone?: "gray" | "blue" }) {
  const cls = tone === "blue" ? mixerFieldBlue : mixerFieldGray;
  const visible = items.filter(Boolean).slice(0, 4);
  return (
    <div className="flex w-full flex-col gap-1">
      {visible.length ? (
        visible.map((item, index) => (
          <div key={`${item}-${index}`} className={cls} title={item}>
            {item}
          </div>
        ))
      ) : (
        <div className="h-5 w-full rounded-[3px] border border-[#454549] bg-[#4a4a4e]" />
      )}
    </div>
  );
}

function MixerLabelColumn() {
  return (
    <div
      className="sticky left-0 z-10 flex shrink-0 flex-col border-r text-right text-[9px] text-[#b0b0b4]"
      style={{ width: MIXER_LABEL_W, borderColor: LP.border, background: LP.panel }}
    >
      {MIXER_LABEL_ROWS.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex items-center justify-end border-b px-2"
          style={{ borderColor: "#4a4a4e", minHeight: row.height, height: row.height }}
        >
          {row.label}
        </div>
      ))}
    </div>
  );
}

function LogicMixerFilterBar({ active, onPick }: { active: string; onPick: (s: string) => void }) {
  const filterItems = [
    "Single",
    "Tracks",
    "All",
    "Audio",
    "Inst",
    "Aux",
    "Bus",
    "Input",
    "Output",
    "Master/VCA",
    "MIDI",
  ] as const;
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5"
      style={{
        borderColor: LP.border,
        background: `linear-gradient(180deg, #434343 0%, ${LP.panelLo} 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Undo arrow */}
      <button type="button" className={`${ctrlBtnBase} h-6 w-6 text-[10px]`} title="Undo">
        ↺
      </button>
      {/* Edit / Options / View dropdowns */}
      {["Edit", "Options", "View"].map((m) => (
        <button
          key={m}
          type="button"
          className="flex items-center gap-0.5 rounded px-2 py-1 text-[10px] font-medium text-[#e4e4e4] hover:bg-black/20"
        >
          {m} <span className="text-[7px]">▾</span>
        </button>
      ))}
      <div className="mx-2 h-4 w-px bg-[#555]" />
      {/* Filter buttons */}
      {filterItems.map((x) => (
        <button
          key={x}
          type="button"
          title={`Mixer: ${x}`}
          onClick={() => onPick(x)}
          className={`rounded-[3px] px-2 py-1 text-[9px] font-semibold tracking-tight ${
            active === x ? `${ctrlBtnActive} min-h-[26px]` : "text-[#e4e4e4] hover:bg-black/20"
          }`}
        >
          {x}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        {/* Two view toggle icons */}
        <button type="button" className={ctrlBtnBase} title="Narrow strips">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="3" height="12" rx="0.5" />
            <rect x="5" y="2" width="3" height="12" rx="0.5" />
            <rect x="9" y="2" width="3" height="12" rx="0.5" />
          </svg>
        </button>
        <button type="button" className={ctrlBtnBase} title="Wide strips">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="2" width="5" height="12" rx="0.5" />
            <rect x="7" y="2" width="5" height="12" rx="0.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MixerSlotRow({ label, children }: { label: string; children?: React.ReactNode }) {
  const rowHeights: Record<string, number> = {
    Setting: 22,
    "Gain Reduction": 20,
    EQ: 20,
    "MIDI FX": 20,
    Input: 22,
    "Audio FX": 60,
    Sends: 34,
    Output: 22,
    Group: 20,
    Automation: 24,
    Icon: 40,
    Pan: 36,
    dB: 24,
  };
  const rowHeight = rowHeights[label] ?? 20;
  return (
    <div
      className={`flex border-b px-1 ${label === "Audio FX" || label === "Sends" ? "items-start py-[2px]" : "items-center justify-center"}`}
      style={{ borderColor: "#4a4a4e", minHeight: rowHeight, height: rowHeight }}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Instrument icon SVGs for mixer strip display */
function InstrumentIcon({ kind, color }: { kind: string; color: string }) {
  const iconStyle = { color, width: 28, height: 28 };
  if (kind === "instrument" || kind === "create_beat") {
    return (
      <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14a3 3 0 003 3h6a3 3 0 003-3V2l-1.5 1.5zM15 18H9a1 1 0 01-1-1v-1h8v1a1 1 0 01-1 1z" />
      </svg>
    );
  }
  if (kind === "play_drums") {
    return (
      <svg style={iconStyle} viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="14" rx="8" ry="4" />
        <path d="M4 14V9c0-2.2 3.6-4 8-4s8 1.8 8 4v5" />
      </svg>
    );
  }
  // Default: waveform / audio icon
  return (
    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12h2l2-6 3 12 3-8 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

  const dbLabel = faderToDbLabel(tr.volume);
  const peakDb = peakToDbDisplay(peak);
  const eqLabel = EQ_PRESET_LABELS.find((option) => option.id === tr.eqPreset)?.label ?? "Chan EQ";
  const effectLabel = EFFECT_PRESET_LABELS.find((option) => option.id === tr.effectPreset)?.label ?? "Comp";
  const spaceLabel = SPACE_PRESET_LABELS.find((option) => option.id === tr.spacePreset)?.label ?? "Space";
  const sendItems = tr.kind === "instrument" ? ["Bus 4"] : [];
  void fileInputTrigger;

  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-r"
      style={{ width: MIXER_STRIP_W, borderColor: LP.border, background: LP.stripBg }}
    >
      <MixerSlotRow label="Setting">
        <div className={mixerFieldDark} title={tr.name}>
          {tr.name}
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="h-3 w-full rounded-[2px] border border-[#454549] bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <select
          value={tr.eqPreset}
          onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)["eqPreset"])}
          className={`${mixerFieldGray} appearance-none outline-none`}
          title="Channel EQ"
        >
          {EQ_PRESET_LABELS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className={mixerFieldDark}>In 1</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <div className="flex w-full flex-col gap-[2px]">
          <select
            value={tr.effectPreset}
            onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)["effectPreset"])}
            className={`${mixerFieldBlue} appearance-none outline-none`}
            title="Audio FX"
          >
            {EFFECT_PRESET_LABELS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <MixerStack
            items={[spaceLabel !== "Dry" ? spaceLabel : "", effectLabel !== "None" ? effectLabel : ""]}
            tone="blue"
          />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <MixerStack items={sendItems} tone="blue" />
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={mixerFieldDark}>St Out</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={`${mixerFieldGreen} font-bold`} title="Automation mode">
          Read
        </button>
      </MixerSlotRow>
      {/* Instrument icon */}
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 40, height: 40 }}
      >
        <InstrumentIcon kind={tr.kind} color={tr.color} />
      </div>
      {/* Pan */}
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 36, height: 36 }}
      >
        <PanKnob value={tr.pan} onChange={(v) => daw.setTrackPan(tr.id, v)} size={28} showValueLabel={false} />
      </div>
      {/* dB */}
      <div
        className="flex items-center justify-center gap-0.5 border-b px-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 24, height: 24 }}
      >
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">
          {dbLabel}
        </span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">
          {peakDb}
        </span>
      </div>
      {/* Fader + meters */}
      <div
        className="border-b"
        style={{ borderColor: "#4a4a4e", minHeight: MIXER_METER_H + 10, height: MIXER_METER_H + 10 }}
      >
        <VerticalMixerFader
          value={tr.volume}
          peak={peak}
          onChange={(value) => daw.setTrackVolume(tr.id, value)}
          ariaLabel={`${tr.name} level`}
        />
      </div>
      {/* R I */}
      <div
        className="flex items-center justify-center gap-0.5 border-b py-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 22, height: 22 }}
      >
        <button
          type="button"
          onClick={() => daw.toggleRecordArm(tr.id)}
          className={`h-4 w-5 rounded-sm border text-[8px] font-bold ${tr.recordArm ? "border-[#a22] bg-[#e03030] text-white" : "border-[#555] bg-[#4a4a4e] text-[#999]"}`}
        >
          R
        </button>
        <button
          type="button"
          className="h-4 w-5 rounded-sm border border-[#555] bg-[#4a4a4e] text-[8px] font-bold text-[#999]"
        >
          I
        </button>
      </div>
      <div
        className="flex items-center justify-center gap-1 border-b py-0.5"
        style={{ borderColor: "#4a4a4e", minHeight: 28, height: 28 }}
      >
        <button
          type="button"
          title="Mute"
          onClick={() => daw.toggleMute(tr.id)}
          className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${
            tr.muted ? "border-[#3a7a7a] bg-[#5ab0b0] text-[#022]" : "border-[#555] bg-[#4a4a4e] text-[#ddd]"
          }`}
        >
          M
        </button>
        <button
          type="button"
          title="Solo"
          onClick={() => daw.toggleSolo(tr.id)}
          className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${
            tr.solo ? "border-[#886600] bg-[#e8d44a] text-[#111]" : "border-[#555] bg-[#4a4a4e] text-[#ddd]"
          }`}
        >
          S
        </button>
      </div>
      <div
        className="mt-auto flex items-center justify-center truncate border-t px-1 text-center text-[9px] font-semibold"
        style={{ backgroundColor: tr.color, borderColor: LP.border, color: "#111", minHeight: 24 }}
        title={tr.name}
      >
        {tr.name || "Track"}
      </div>
    </div>
  );
}

function StereoOutStrip() {
  const daw = useDaw();
  const peak = daw.meterPeaks.__master__ ?? 0;
  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-l"
      style={{ width: MIXER_STRIP_W, borderColor: LP.border, background: LP.stripBg }}
    >
      <MixerSlotRow label="Setting">
        <div className={mixerFieldDark}>Stereo Out</div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="h-3 w-full rounded-[2px] border border-[#454549] bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className={mixerFieldDark}>Output EQ</div>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className="text-[9px] text-[#ccc]">∞</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <MixerStack items={["Space D"]} tone="blue" />
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <MixerStack items={[]} tone="gray" />
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={mixerFieldDark}>St Out</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={`${mixerFieldGreen} font-bold`}>
          Read
        </button>
      </MixerSlotRow>
      {/* Icon area */}
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 40, height: 40 }}
      >
        <svg
          style={{ color: "#4a9a4a", width: 28, height: 28 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="7" />
          <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
        </svg>
      </div>
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 36, height: 36 }}
      >
        <PanKnob value={0} onChange={() => {}} size={28} showValueLabel={false} />
      </div>
      <div
        className="flex items-center justify-center gap-0.5 border-b px-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 24, height: 24 }}
      >
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">
          0.0
        </span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">
          {peakToDbDisplay(peak)}
        </span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: "#4a4a4e", minHeight: MIXER_METER_H + 10, height: MIXER_METER_H + 10 }}
      >
        <VerticalMixerFader
          value={daw.masterVolume}
          peak={peak}
          onChange={(value) => daw.setMasterVolume(value)}
          ariaLabel="Stereo out level"
        />
      </div>
      <div
        className="flex items-center justify-center border-b py-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 22, height: 22 }}
      >
        <span className="text-[8px] text-[#999]">Bnce</span>
      </div>
      <div
        className="flex items-center justify-center gap-0.5 border-b py-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 28, height: 28 }}
      >
        <button
          type="button"
          className="h-5 w-6 rounded-sm border border-[#555] bg-[#4a4a4e] text-[9px] font-bold text-[#ddd]"
        >
          M
        </button>
      </div>
      <div
        className="mt-auto flex items-center justify-center truncate border-t px-1 text-center text-[9px] font-semibold text-white"
        style={{ backgroundColor: "#4a9a4a", borderColor: LP.border, minHeight: 24 }}
      >
        Stereo Out
      </div>
    </div>
  );
}

function MasterMixerStrip() {
  const daw = useDaw();
  const peak = daw.meterPeaks.__master__ ?? 0;
  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-l"
      style={{ width: MIXER_STRIP_W, borderColor: LP.border, background: LP.stripBg }}
    >
      <MixerSlotRow label="Setting">
        <div className={mixerFieldDark}>Master</div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="h-3 w-full rounded-[2px] border border-[#454549] bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className={mixerFieldDark}>Limiter</div>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className="text-[9px] text-[#ccc]">∞</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <MixerStack items={["Limiter"]} tone="blue" />
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <MixerStack items={[]} tone="gray" />
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={mixerFieldDark}>Master</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className="h-4 w-full rounded-[2px] border border-[#454549] bg-[#4a4a4e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={`${mixerFieldGreen} font-bold`}>
          Read
        </button>
      </MixerSlotRow>
      {/* Icon area */}
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 40, height: 40 }}
      >
        <svg style={{ color: "#9b4d96", width: 28, height: 28 }} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.2L19.2 8 12 11.8 4.8 8 12 4.2z" />
        </svg>
      </div>
      <div
        className="flex items-center justify-center border-b"
        style={{ borderColor: "#4a4a4e", minHeight: 36, height: 36 }}
      >
        <PanKnob value={0} onChange={() => {}} size={28} showValueLabel={false} />
      </div>
      <div
        className="flex items-center justify-center gap-0.5 border-b px-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 24, height: 24 }}
      >
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">
          {faderToDbLabel(daw.masterVolume)}
        </span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">
          {peakToDbDisplay(peak)}
        </span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: "#4a4a4e", minHeight: MIXER_METER_H + 10, height: MIXER_METER_H + 10 }}
      >
        <VerticalMixerFader
          value={daw.masterVolume}
          peak={peak}
          onChange={(value) => daw.setMasterVolume(value)}
          ariaLabel="Master volume"
        />
      </div>
      <div
        className="flex items-center justify-center gap-0.5 border-b py-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 22, height: 22 }}
      >
        <button
          type="button"
          className="h-4 w-5 rounded-sm border border-[#555] bg-[#4a4a4e] text-[8px] font-bold text-[#ddd]"
        >
          M
        </button>
      </div>
      <div
        className="flex items-center justify-center gap-0.5 border-b py-[2px]"
        style={{ borderColor: "#4a4a4e", minHeight: 28, height: 28 }}
      >
        <button
          type="button"
          className="h-5 w-6 rounded-sm border border-[#555] bg-[#4a4a4e] text-[9px] font-bold text-[#ddd]"
        >
          M
        </button>
        <button
          type="button"
          className="h-5 w-6 rounded-sm border border-[#555] bg-[#4a4a4e] text-[9px] font-bold text-[#ddd]"
        >
          D
        </button>
      </div>
      <div
        className="mt-auto flex items-center justify-center truncate border-t px-1 text-center text-[9px] font-semibold text-white"
        style={{ backgroundColor: "#9b4d96", borderColor: LP.border, minHeight: 24 }}
      >
        Master
      </div>
    </div>
  );
}

/** Cycle Range + Ruler with draggable playhead thumb */
function CycleRangeRuler({
  barW,
  widthPx,
  end,
  tempo,
  beatsPerBar,
  currentTime,
  loopEnabled,
  onSeek,
  scrollLeft,
}: {
  barW: number;
  widthPx: number;
  end: number;
  tempo: number;
  beatsPerBar: number;
  currentTime: number;
  loopEnabled: boolean;
  onSeek: (t: number) => void;
  scrollLeft: number;
}) {
  const [cycleStart, setCycleStart] = useState(0); // in bars (0-indexed)
  const [cycleEnd, setCycleEnd] = useState(4); // in bars (0-indexed), so 4 bars = bars 1-4
  const [dragging, setDragging] = useState<"playhead" | "cycleLeft" | "cycleRight" | "cycleBody" | null>(null);
  const dragStartRef = useRef({ x: 0, cycleStart: 0, cycleEnd: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const totalBars = Math.max(TIMELINE_BAR_LIMIT, Math.ceil(end / secPerBar(tempo, beatsPerBar)) + 1);
  const maxBars = TIMELINE_BAR_LIMIT;

  const pxToBar = (px: number) => Math.max(0, Math.min(maxBars, px / barW));
  const pxToSec = (px: number) => Math.max(0, px / PX_PER_SEC);

  const handleMouseDown = (e: React.MouseEvent, type: "playhead" | "cycleLeft" | "cycleRight" | "cycleBody") => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    dragStartRef.current = { x: e.clientX, cycleStart, cycleEnd };

    const onMove = (ev: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relX = scrollLeft + (ev.clientX - rect.left);

      if (type === "playhead") {
        onSeek(pxToSec(relX));
      } else if (type === "cycleLeft") {
        const newStart = Math.round(pxToBar(relX));
        if (newStart < cycleEnd) setCycleStart(Math.max(0, newStart));
      } else if (type === "cycleRight") {
        const newEnd = Math.round(pxToBar(relX));
        if (newEnd > cycleStart) setCycleEnd(Math.min(maxBars, newEnd));
      } else if (type === "cycleBody") {
        const dx = ev.clientX - dragStartRef.current.x;
        const dBars = Math.round(dx / barW);
        const len = dragStartRef.current.cycleEnd - dragStartRef.current.cycleStart;
        let newStart = dragStartRef.current.cycleStart + dBars;
        newStart = Math.max(0, Math.min(maxBars - len, newStart));
        setCycleStart(newStart);
        setCycleEnd(newStart + len);
      }
    };

    const onUp = () => {
      setDragging(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const cycleLeftPx = cycleStart * barW;
  const cycleRightPx = cycleEnd * barW;
  const playheadPx = currentTime * PX_PER_SEC;
  void dragging;

  return (
    <div
      ref={containerRef}
      className="sticky top-0 z-20 flex shrink-0 flex-col border-b shadow-[inset_0_-1px_0_rgba(0,0,0,0.25)]"
      style={{ borderColor: LP.border }}
    >
      <div className="flex h-[18px] items-stretch" style={{ background: "#5a5a5e" }}>
        <div
          className="shrink-0 border-r"
          style={{ width: TRACK_HEADER_W, borderColor: "#8a7028", background: "rgba(0,0,0,0.08)" }}
        />
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="relative h-[18px]" style={{ width: widthPx, transform: `translateX(${-scrollLeft}px)` }}>
            <div
              className="absolute top-0 bottom-0 cursor-move"
              style={{
                left: cycleLeftPx,
                width: Math.max(8, cycleRightPx - cycleLeftPx),
                background: loopEnabled
                  ? "linear-gradient(180deg, #d4a82a 0%, #c49820 100%)"
                  : "linear-gradient(180deg, #8a7828 0%, #7a6820 100%)",
                borderRadius: "2px",
                boxShadow: loopEnabled ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                opacity: loopEnabled ? 1 : 0.72,
              }}
              onMouseDown={(e) => handleMouseDown(e, "cycleBody")}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, "cycleLeft");
                }}
                style={{ borderLeft: "2px solid #8a7028" }}
              />
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, "cycleRight");
                }}
                style={{ borderRight: "2px solid #8a7028" }}
              />
              {Array.from({ length: cycleEnd - cycleStart }).map((_, i) => (
                <span
                  key={i}
                  className="absolute top-0 font-mono text-[9px] font-bold"
                  style={{ left: i * barW + 4, color: loopEnabled ? "#5a3a10" : "#444" }}
                >
                  {cycleStart + i + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        className="flex h-[22px] items-stretch"
        style={{ background: `linear-gradient(180deg, ${LP.ruler}dd 0%, ${LP.ruler}88 100%)` }}
      >
        <div
          className="flex shrink-0 items-center border-r px-1 text-[9px] font-bold text-[#2a2418]"
          style={{ width: TRACK_HEADER_W, borderColor: "#8a7028", background: "rgba(0,0,0,0.08)" }}
        />
        <div
          className="relative min-w-0 flex-1 cursor-pointer overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onSeek(pxToSec(scrollLeft + (e.clientX - rect.left)));
          }}
        >
          <div className="relative h-[22px]" style={{ width: widthPx, transform: `translateX(${-scrollLeft}px)` }}>
            {Array.from({ length: totalBars }).map((_, i) => (
              <div key={i} className="absolute bottom-0 top-0" style={{ left: i * barW }}>
                <div className="absolute top-0 bottom-0 w-px bg-[#6a5a28]/70" />
                <span className="absolute left-1 top-0.5 font-mono text-[9px] font-semibold tabular-nums text-[#1a1508]">
                  {i + 1}
                </span>
                {Array.from({ length: beatsPerBar - 1 }).map((_, b) => {
                  const tickLeft = ((b + 1) / beatsPerBar) * barW;
                  return (
                    <div
                      key={b}
                      className="absolute bottom-0 w-px bg-[#6a5a28]/40"
                      style={{ left: tickLeft, height: b === Math.floor(beatsPerBar / 2) - 1 ? "60%" : "35%" }}
                    />
                  );
                })}
              </div>
            ))}
            <div
              className="pointer-events-none absolute bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
              style={{ left: playheadPx, top: 0, zIndex: 10 }}
            />
            <div
              className="absolute z-30 cursor-grab active:cursor-grabbing"
              style={{ left: playheadPx - 6, top: -4 }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, "playhead");
              }}
            >
              <svg width="13" height="16" viewBox="0 0 13 16">
                <polygon points="6.5,0 13,8 0,8" fill="#e0e0e0" stroke="#222" strokeWidth="0.8" />
                <line x1="6.5" y1="8" x2="6.5" y2="16" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogicMacroToolButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      className="flex min-w-[52px] max-w-[88px] flex-col items-center gap-0.5 rounded px-1 py-0.5 text-[#ccc] hover:bg-black/15"
    >
      <span className="flex h-[18px] items-center justify-center opacity-90 [&>svg]:h-[15px] [&>svg]:w-[15px]">
        {children}
      </span>
      <span className="max-w-[84px] text-center text-[8px] leading-[1.05]">{label}</span>
    </button>
  );
}

function DawChrome() {
  const daw = useDaw();
  const [editorTab, setEditorTab] = useState<"clip" | "piano">("clip");
  const [selection, setSelection] = useState<ClipSelection>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainView, setMainView] = useState<"arrange" | "mixer">("arrange");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [focusWorkbench, setFocusWorkbench] = useState(false);
  const [mixerFilter, setMixerFilter] = useState("Tracks");
  /** Control-bar-only toggles — full master solo/mute routing can wire later */
  const [ctrlBarMasterMute, setCtrlBarMasterMute] = useState(false);
  const [ctrlBarMasterSolo, setCtrlBarMasterSolo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const importTrackRef = useRef<string>("");
  const arrangeScrollRef = useRef<HTMLDivElement>(null);
  const [arrangeScrollLeft, setArrangeScrollLeft] = useState(0);

  /* responsive defaults handled in useState initializers above */

  const barW = secPerBar(daw.tempo, daw.beatsPerBar) * PX_PER_SEC;
  const minimumTimelineEnd = secPerBar(daw.tempo, daw.beatsPerBar) * TIMELINE_BAR_LIMIT;

  const end = useMemo(() => {
    return Math.max(90, minimumTimelineEnd, getTimelineEndSec(daw.tracks, daw.tempo));
  }, [daw.tracks, daw.tempo, minimumTimelineEnd]);

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

  useEffect(() => {
    if (mainView !== "arrange") return;
    const viewport = arrangeScrollRef.current;
    if (!viewport) return;

    const visibleTimelineWidth = Math.max(160, viewport.clientWidth - TRACK_HEADER_W);
    const playheadPx = daw.currentTime * PX_PER_SEC;
    const leftBuffer = 80;
    const rightBuffer = 140;
    const maxScroll = Math.max(0, widthPx - visibleTimelineWidth);
    let nextScrollLeft = viewport.scrollLeft;

    if (playheadPx < nextScrollLeft + leftBuffer) {
      nextScrollLeft = Math.max(0, playheadPx - leftBuffer);
    } else if (playheadPx > nextScrollLeft + visibleTimelineWidth - rightBuffer) {
      nextScrollLeft = Math.min(maxScroll, playheadPx - visibleTimelineWidth + rightBuffer);
    }

    if (Math.abs(nextScrollLeft - viewport.scrollLeft) > 1) {
      viewport.scrollLeft = nextScrollLeft;
      setArrangeScrollLeft(nextScrollLeft);
    }
  }, [daw.currentTime, mainView, widthPx]);

  return (
    <div
      className={`flex flex-col [@media(orientation:landscape)]:[.daw-main]:min-h-0 ${
        focusWorkbench ? "fixed inset-0 z-[140] min-h-[100dvh] min-w-0" : "h-screen min-h-[640px] min-w-0"
      }`}
      style={{ background: LP.appBg, color: LP.text }}
    >
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
      <input
        ref={projectFileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void f.text().then((t) => {
              void daw.importProjectJson(t);
            });
          e.target.value = "";
        }}
      />

      <StartSongModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onPick={(kind) => daw.addTrackWithKind(kind)}
      />

      <header
        className="flex shrink-0 flex-col border-b shadow-[0_1px_0_rgba(255,255,255,0.06)]"
        style={{ borderColor: LP.border, background: `linear-gradient(180deg, ${LP.panelHi} 0%, ${LP.panel} 100%)` }}
      >
        <div className="flex min-h-[52px] flex-wrap items-center gap-1.5 px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-0.5 border-r pr-2" style={{ borderColor: LP.border }}>
            <button
              type="button"
              title="Library"
              onClick={() => setLibraryOpen((v) => !v)}
              className={libraryOpen ? ctrlBtnActive : ctrlBtnBase}
            >
              <IconLibraryDrawer />
            </button>
            <button
              type="button"
              title="Inspector"
              onClick={() => setInspectorOpen((v) => !v)}
              className={inspectorOpen ? ctrlBtnActive : ctrlBtnBase}
            >
              <IconInspector open={inspectorOpen} />
            </button>
            <button type="button" title="Quick Help" className={ctrlBtnBase}>
              <IconHelpQ />
            </button>
            <button type="button" title="Toolbar" className={ctrlBtnBase}>
              <IconToolbarRows />
            </button>
            <button type="button" title="Smart Controls" className={ctrlBtnBase}>
              <IconSmartSliders />
            </button>
            <button
              type="button"
              title="Mixer"
              onClick={() => setMainView("mixer")}
              className={mainView === "mixer" ? ctrlBtnActive : ctrlBtnBase}
            >
              <IconMixerConsole />
            </button>
            <button
              type="button"
              title="Editors"
              onClick={() => setEditorsOpen((v) => !v)}
              className={editorsOpen ? ctrlBtnActive : ctrlBtnBase}
            >
              <IconEditorsWin />
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button type="button" title="Go to beginning" onClick={() => daw.rewindToStart()} className={ctrlBtnBase}>
              <IconGoToStart />
            </button>
            <button
              type="button"
              title="Rewind (one beat)"
              onClick={() => {
                const beatSec = 60 / Math.max(40, daw.tempo);
                daw.seek(Math.max(0, daw.currentTime - beatSec));
              }}
              className={ctrlBtnBase}
            >
              <IconRewind />
            </button>
            <button
              type="button"
              title="Fast forward (one beat)"
              onClick={() => {
                const beatSec = 60 / Math.max(40, daw.tempo);
                daw.seek(Math.min(end, daw.currentTime + beatSec));
              }}
              className={ctrlBtnBase}
            >
              <IconFastForward />
            </button>
            <button type="button" title="Go to end" onClick={() => daw.seek(end)} className={ctrlBtnBase}>
              <IconGoToEnd />
            </button>
            <button type="button" title="Stop" onClick={() => daw.stopTransport()} className={ctrlBtnBase}>
              <IconStop />
            </button>
            <button
              type="button"
              title="Play"
              onClick={() => daw.play()}
              className={`${daw.isPlaying ? ctrlBtnActive : ctrlBtnBase} min-w-[40px]`}
            >
              <IconPlay />
            </button>
            <button
              type="button"
              title={daw.isRecording ? "Stop recording" : "Record"}
              onClick={() => {
                if (daw.isRecording) daw.stopRecord();
                else void daw.startRecord();
              }}
              className={`${ctrlBtnBase} text-[#ffb0b0] ${daw.isRecording ? "ring-1 ring-red-500" : ""}`}
            >
              <IconRec />
            </button>
            <button
              type="button"
              title="Cycle / Loop"
              onClick={() => daw.setLoopEnabled(!daw.loopEnabled)}
              className={daw.loopEnabled ? `${ctrlBtnActive} min-w-[36px]` : ctrlBtnBase}
            >
              <IconLoop active={daw.loopEnabled} />
            </button>
          </div>

          {daw.isRecording ? (
            <div className="flex flex-col items-center px-1">
              <span className="text-[7px] font-bold uppercase text-[#faa]">In</span>
              <div
                className="relative mt-0.5 h-12 w-3 overflow-hidden rounded-sm border border-[#333] bg-black"
                title="Input level"
              >
                <div
                  className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
                  style={{
                    height: `${Math.min(100, (daw.meterPeaks.__mic__ ?? 0) * 110)}%`,
                    background: `linear-gradient(to top, ${LP.meterGreen}, ${LP.meterYel}, ${LP.meterRed})`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <div
            className="mx-1 flex min-h-[48px] min-w-[200px] max-w-[min(100%,480px)] flex-1 items-center rounded border shadow-[inset_0_2px_14px_rgba(0,0,0,0.72)] sm:min-w-[300px]"
            style={{
              borderColor: "#05080c",
              background: LP.lcdBg,
              backgroundImage:
                "repeating-linear-gradient(180deg, transparent, transparent 2px, rgba(110,200,255,0.04) 2px, rgba(110,200,255,0.04) 3px)",
            }}
          >
            {/* BAR / BEAT section */}
            <div className="flex flex-1 items-baseline gap-1 px-2">
              <div className="flex flex-col items-center">
                <span
                  className="font-mono text-[22px] font-bold leading-none tabular-nums"
                  style={{ color: "#e0e8f0" }}
                >
                  {String(Math.floor((daw.currentTime * (daw.tempo / 60)) / daw.beatsPerBar) + 1).padStart(3, "0")}
                </span>
                <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: LP.lcdDim }}>
                  Bar
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span
                  className="font-mono text-[22px] font-bold leading-none tabular-nums"
                  style={{ color: "#e0e8f0" }}
                >
                  {Math.floor((daw.currentTime * (daw.tempo / 60)) % daw.beatsPerBar) + 1}
                </span>
                <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: LP.lcdDim }}>
                  Beat
                </span>
              </div>
            </div>
            {/* Divider */}
            <div className="h-8 w-px bg-[#1a2a3a]" />
            {/* TEMPO section */}
            <div className="flex flex-col items-center px-3">
              <span className="font-mono text-[18px] font-bold leading-none tabular-nums" style={{ color: "#e0e8f0" }}>
                {Math.round(daw.tempo)}
              </span>
              <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: LP.lcdDim }}>
                Keep
              </span>
              <span className="text-[6px] uppercase tracking-widest" style={{ color: LP.lcdDim }}>
                Tempo
              </span>
            </div>
            {/* Divider */}
            <div className="h-8 w-px bg-[#1a2a3a]" />
            {/* TIME SIG / KEY section */}
            <div className="flex flex-col items-center px-3">
              <span className="font-mono text-[16px] font-bold leading-none" style={{ color: "#e0e8f0" }}>
                {daw.beatsPerBar}/4
              </span>
              <span className="text-[8px] font-medium" style={{ color: LP.lcdDim }}>
                Cmaj
              </span>
            </div>
            {/* Dropdown arrow */}
            <button type="button" className="px-1 text-[8px]" style={{ color: LP.lcdDim }} title="Display mode">
              ▾
            </button>
          </div>

          {/* Logic Pro: Master solos, then metronome / count-in (no stray “1234” clip / star) */}
          <div className="flex items-center gap-0.5 border-l pl-2" style={{ borderColor: LP.border }}>
            <button
              type="button"
              title="Master Solo (control bar)"
              onClick={() => setCtrlBarMasterSolo((v) => !v)}
              className={`h-7 min-w-[30px] rounded-[3px] border text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
                ctrlBarMasterSolo
                  ? "border-[#886600] bg-[#e8d44a] text-[#111]"
                  : `${ctrlBtn} border-[#5a5a5e] bg-gradient-to-b from-[#727276] to-[#5a5a5e] text-[#eee]`
              }`}
            >
              S
            </button>
            <button
              type="button"
              title="Master Mute (control bar)"
              onClick={() => setCtrlBarMasterMute((v) => !v)}
              className={`h-7 min-w-[30px] rounded-[3px] border text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
                ctrlBarMasterMute
                  ? "border-[#3a7a7a] bg-[#5ab0b0] text-[#022]"
                  : `${ctrlBtn} border-[#5a5a5e] bg-gradient-to-b from-[#727276] to-[#5a5a5e] text-[#eee]`
              }`}
            >
              M
            </button>
            <button
              type="button"
              title="Metronome"
              onClick={() => daw.setMetronomeOn(!daw.metronomeOn)}
              className={ctrlBtnBase}
            >
              <IconMetronome off={!daw.metronomeOn} />
            </button>
            <button type="button" title="Count-in (1 · 2 · 3 · 4)" className={ctrlBtnBase}>
              <IconCountIn />
            </button>
          </div>

          {/* Master volume slider */}
          <div className="flex min-w-[100px] max-w-[160px] items-center px-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={daw.masterVolume}
              onChange={(e) => daw.setMasterVolume(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer"
              style={{ accentColor: "#d0d0d0" }}
            />
          </div>

          {/* List · Notes · Loops · Media — matches Logic control bar browsers */}
          <div className="flex items-center gap-0.5 border-l pl-2" style={{ borderColor: LP.border }}>
            <button type="button" title="List editors" className={ctrlBtnBase}>
              <IconListDoc />
            </button>
            <button type="button" title="Notepad" className={ctrlBtnBase}>
              <IconNotePad />
            </button>
            <button type="button" title="Loop Browser" className={ctrlBtnBase}>
              <IconLoopBrowser />
            </button>
            <button type="button" title="Media Browser" className={ctrlBtnBase}>
              <IconMediaBrowser />
            </button>
          </div>

          {/* Functional buttons - kept for DAW features */}
          <div className="ml-1 flex flex-wrap items-center gap-0.5">
            <button
              type="button"
              title="Arrange / Edit"
              onClick={() => setMainView("arrange")}
              className={
                mainView === "arrange"
                  ? `${ctrlBtnActive} px-2 text-[9px] font-semibold`
                  : `${ctrlBtnBase} px-2 text-[9px]`
              }
            >
              Edit
            </button>
            <button
              type="button"
              title="Mixer view"
              onClick={() => setMainView("mixer")}
              className={
                mainView === "mixer"
                  ? `${ctrlBtnActive} px-2 text-[9px] font-semibold`
                  : `${ctrlBtnBase} px-2 text-[9px]`
              }
            >
              Mix
            </button>
            <button
              type="button"
              title="Export mix (WAV)"
              className={`${ctrlBtnBase} px-2 text-[9px]`}
              onClick={() => void daw.exportMixWav()}
            >
              Bnc
            </button>
            <button
              type="button"
              title="New track"
              className={`${ctrlBtnBase} px-2 text-[9px]`}
              onClick={() => setModalOpen(true)}
            >
              +Tr
            </button>
            <button
              type="button"
              title="Import audio"
              className={`${ctrlBtnBase} px-2 text-[9px]`}
              onClick={() => targetTrackId && openImport(targetTrackId)}
              disabled={!targetTrackId}
            >
              Imp
            </button>
            <button
              type="button"
              title="Fullscreen workspace"
              className={`${ctrlBtnBase} hidden lg:flex`}
              onClick={() => setFocusWorkbench((v) => !v)}
            >
              <IconExpand />
            </button>
            <button
              type="button"
              title="Save project JSON"
              className={`${ctrlBtnBase} px-2 text-[9px] text-[#9d9]`}
              onClick={() => daw.exportProjectJson()}
            >
              Save
            </button>
            <button
              type="button"
              title="Load project"
              className={`${ctrlBtnBase} px-2 text-[9px]`}
              onClick={() => projectFileRef.current?.click()}
            >
              Load
            </button>
          </div>
        </div>

        {/* Row 2: Logic-style macro buttons (icon above label, monochrome) */}
        <div
          className="flex flex-wrap items-end gap-x-2 gap-y-1 border-t px-2 py-1 overflow-x-auto"
          style={{ borderColor: LP.border, background: `linear-gradient(180deg, ${LP.panel} 0%, ${LP.panelLo} 100%)` }}
        >
          <LogicMacroToolButton label="Articulation">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path d="M2.5 12c2.5-5.2 5.5-7.5 11-5.5" strokeLinecap="round" />
              <path d="M10.5 3.8l3 2.2-1.2 2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Track Zoom">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <rect x="2" y="3" width="12" height="9" rx="1" />
              <path d="M5 7h6M8 4.5v5" strokeLinecap="round" />
              <path d="M4 13h8" strokeLinecap="round" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Note Repeat">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path
                d="M11 3v2.5c0 1.5-1.2 2-2.5 2h-2M4 11V8.5C4 7 5.2 6 6.5 6h2"
                strokeLinecap="round"
              />
              <path d="M12.5 4.5L11 3v3h3" fill="currentColor" stroke="none" />
              <path d="M3.5 11.5L5 13v-3H2" fill="currentColor" stroke="none" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Spot Erase">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <circle cx="8" cy="8" r="4.5" />
              <path d="M4.5 4.5l7 7" strokeLinecap="round" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Split by Playhead">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <circle cx="5.2" cy="8" r="1.8" />
              <circle cx="5.2" cy="12" r="1.8" />
              <path d="M7 5l4 6" strokeLinecap="round" />
              <path d="M8 2.5v11.5" strokeLinecap="round" opacity="0.55" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Split by Locators">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <circle cx="4.5" cy="6" r="1.5" />
              <circle cx="4.5" cy="11" r="1.5" />
              <path d="M6.5 4.5L11 8l-4.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12.5 2.5v11" strokeLinecap="round" opacity="0.45" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Bounce Regions">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path d="M3 4h10v6H3z" />
              <path d="M8 10v3M6 12.5h4" strokeLinecap="round" />
            </svg>
          </LogicMacroToolButton>
          <div className="mx-1 h-8 w-px shrink-0 bg-[#555] self-center" />
          <div className="flex items-center gap-1 px-0.5">
            <button type="button" className="text-[11px] text-[#aaa] hover:text-white" aria-label="Nudge down">
              ‹
            </button>
            <span className="rounded border border-[#555] bg-[#3a3a3e] px-2.5 py-0.5 text-[9px] font-medium text-[#ddd]">
              Tick
            </span>
            <button type="button" className="text-[11px] text-[#aaa] hover:text-white" aria-label="Nudge up">
              ›
            </button>
            <span className="ml-0.5 hidden text-[8px] text-[#999] sm:inline">Nudge Value</span>
          </div>
          <div className="mx-1 h-8 w-px shrink-0 bg-[#555] self-center" />
          <LogicMacroToolButton label="Repeat Section">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path d="M4 5h5M4 9h5M4 5v4" strokeLinecap="round" />
              <path d="M11.5 6.5a3 3 0 110 3" strokeLinecap="round" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Cut Section">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <rect x="3" y="5" width="6" height="5" rx="0.5" />
              <path d="M7 9l4.5 4.5" strokeLinecap="round" />
              <circle cx="4.5" cy="11.5" r="1.3" />
              <circle cx="4.5" cy="13.5" r="1.3" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Set Locators">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path d="M3 3v10M13 3v10" strokeLinecap="round" />
              <path d="M5 5h6M5 11h6" strokeLinecap="round" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Zoom">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <circle cx="7" cy="7" r="3.8" />
              <path d="M10 10l3.5 3.5" strokeLinecap="round" />
            </svg>
          </LogicMacroToolButton>
          <LogicMacroToolButton label="Colors">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden>
              <path d="M8 2l1.8 3.6 4 .7-2.9 2.8.7 4L8 12l-3.6 1.9.7-4-2.9-2.8 4-.7L8 2z" />
            </svg>
          </LogicMacroToolButton>
        </div>

        {/* Row 3: Arrange tools — Logic order: Pointer, Pencil, Eraser, Text, Scissors, Glue, Solo, Mute, Zoom, Automation, Flex */}
        <div
          className="flex min-h-[36px] flex-wrap items-center gap-x-1 gap-y-1 border-t px-2 py-1"
          style={{ borderColor: LP.border, background: LP.panelLo }}
        >
          <button type="button" className={`${ctrlBtnBase} h-6 w-6 text-[11px]`} title="Undo">
            ↺
          </button>
          {["Edit", "Functions", "View"].map((m) => (
            <button
              key={m}
              type="button"
              className="flex items-center gap-0.5 rounded px-2 py-1 text-[10px] font-medium text-[#e4e4e4] hover:bg-black/20"
            >
              {m} <span className="text-[7px]">▾</span>
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[#555]" />
          <button type="button" title="Pointer tool" className={ctrlBtnActive}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M3 1l9 6-4 1 2 5-2 1-2-5-3 3z" />
            </svg>
          </button>
          <button type="button" title="Pencil tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M10 2l4 4-9 9H1v-4z" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" title="Eraser tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path d="M9.2 2.5l4.3 4.3-6 6-3-1-1-3 5.7-6.3z" strokeLinejoin="round" />
              <path d="M3 14l3-1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Text tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M5 3h6M8 3v8M5 13h6" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Scissors" className={ctrlBtnBase}>
            <IconScissors />
          </button>
          <button type="button" title="Glue" className={ctrlBtnBase}>
            <IconGlue />
          </button>
          <button type="button" title="Solo (edit tool)" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path d="M2.5 10V6c0-2 2.5-3.8 5.5-3.8S13.5 4 13.5 6v4" strokeLinecap="round" />
              <path d="M2.5 10c0 2 2.5 3.5 5.5 3.5S13.5 12 13.5 10" strokeLinecap="round" />
              <path d="M8 14v1.8M6 16h4" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Mute (edit tool)" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path
                d="M3 6.5h3l3-2v9l-3-2H3V6.5z"
                strokeLinejoin="round"
              />
              <path d="M11.5 5.5l3 5M14.5 5.5l-3 5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Zoom tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <circle cx="7" cy="7" r="4" />
              <path d="M10 10l4 4" strokeLinecap="round" />
              <path d="M5 7h4M7 5v4" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Automation" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M1 12l4-8 4 6 6-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" title="Flex" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M2 8c2-4 4-4 6 0s4 4 6 0" strokeLinecap="round" />
            </svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#555]" />
          <label className="flex items-center gap-1 text-[8px] text-[#aaa]">
            Snap
            <select
              className="rounded border px-1 py-0.5 text-[8px]"
              style={{ borderColor: LP.border, background: "#3a3a3a", color: LP.text }}
            >
              <option>Smart</option>
              <option>Bar</option>
              <option>Beat</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-[8px] text-[#aaa]">
            Drag
            <select
              className="rounded border px-1 py-0.5 text-[8px]"
              style={{ borderColor: LP.border, background: "#3a3a3a", color: LP.text }}
            >
              <option>No Overlap</option>
              <option>X-Fade</option>
            </select>
          </label>
          <label className="ml-auto flex min-w-[120px] max-w-[240px] flex-1 items-center gap-2 sm:max-w-md">
            <span className="text-[8px] text-[#888] whitespace-nowrap">Playhead</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, end)}
              step={0.01}
              value={Math.min(daw.currentTime, end)}
              onChange={(e) => daw.seek(Number(e.target.value))}
              className="h-1 w-full min-w-[72px] cursor-pointer"
              style={{ accentColor: LP.accentBlueHi }}
            />
          </label>
        </div>
      </header>

      {mainView === "mixer" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: LP.panel }}>
          <LogicMixerFilterBar active={mixerFilter} onPick={setMixerFilter} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Inspector in mixer view */}
            {inspectorOpen && (
              <aside
                className="flex shrink-0 flex-col border-r"
                style={{ borderColor: LP.border, background: LP.panel, width: INSPECTOR_PANEL_W }}
              >
                <TrackInspector trackId={targetTrackId} />
              </aside>
            )}
            <div
              className="flex min-h-0 flex-1 items-stretch overflow-x-auto overflow-y-auto"
              style={{ background: LP.panelLo }}
            >
              <MixerLabelColumn />
              {daw.tracks.map((t) => (
                <MixerStrip
                  key={t.id}
                  trackId={t.id}
                  peak={daw.meterPeaks[t.id] ?? 0}
                  fileInputTrigger={() => openImport(t.id)}
                />
              ))}
              <StereoOutStrip />
              <MasterMixerStrip />
              <div className="min-w-[32px] flex-1" style={{ background: LP.panelLo }} aria-hidden />
            </div>
          </div>
        </div>
      ) : (
        <div className="daw-main flex min-h-0 flex-1 flex-row overflow-hidden">
          {inspectorOpen ? (
            <aside
              className="flex shrink-0 flex-col overflow-y-auto border-r"
              style={{ width: INSPECTOR_PANEL_W, borderColor: LP.border, background: LP.panel }}
            >
              <TrackInspector trackId={targetTrackId} />
            </aside>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            {libraryOpen ? (
              <aside
                className="flex w-[min(236px,42vw)] shrink-0 flex-col border-r sm:w-[236px]"
                style={{ borderColor: LP.border, background: LP.panel }}
              >
                <div
                  className="border-b px-2 py-2 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ borderColor: LP.border, color: LP.textMuted }}
                >
                  Library
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="mb-3 border-b pb-2" style={{ borderColor: LP.border }}>
                    <div className="mb-1 px-1 text-[10px]" style={{ color: LP.textMuted }}>
                      Mic / input chain (selected track)
                    </div>
                    <select
                      className="mb-2 w-full rounded border px-1 py-1 text-[10px]"
                      style={{ borderColor: LP.border, background: LP.panelLo, color: LP.text }}
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
                      <div className="mb-1 px-1 text-[10px]" style={{ color: LP.textMuted }}>
                        {grp.category}
                      </div>
                      <ul className="space-y-0.5">
                        {grp.items.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={!targetTrackId}
                              className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-black/20 disabled:opacity-40"
                              style={{ color: LP.text }}
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
                      <div className="mb-1 px-1 text-[10px]" style={{ color: LP.textMuted }}>
                        {grp.category} <span style={{ opacity: 0.65 }}>(web)</span>
                      </div>
                      <ul className="space-y-0.5">
                        {grp.items.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={!targetTrackId}
                              className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-black/20 disabled:opacity-40"
                              style={{ color: LP.text }}
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
                <p
                  className="border-t p-2 text-[10px] leading-snug"
                  style={{ borderColor: LP.border, color: LP.textMuted }}
                >
                  Built-in sounds are synthesized. Web samples need CORS; if one fails, try another or use{" "}
                  <strong style={{ color: LP.text }}>Import</strong>.
                </p>
              </aside>
            ) : null}

            <section className="flex min-w-0 flex-1 flex-col" style={{ background: LP.panelLo }}>
              {/* Cycle Range + Ruler */}
              <CycleRangeRuler
                barW={barW}
                widthPx={widthPx}
                end={end}
                tempo={daw.tempo}
                beatsPerBar={daw.beatsPerBar}
                currentTime={daw.currentTime}
                loopEnabled={daw.loopEnabled}
                onSeek={(t) => daw.seek(t)}
                scrollLeft={arrangeScrollLeft}
              />

              {/* +/Save/Dropdown row above tracks — matches Logic Pro */}
              <div
                className="flex shrink-0 items-center border-b"
                style={{ borderColor: LP.border, background: LP.panel }}
              >
                <div className="flex shrink-0 items-center gap-1 px-2 py-1" style={{ width: TRACK_HEADER_W }}>
                  <button
                    type="button"
                    title="New track"
                    onClick={() => setModalOpen(true)}
                    className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[12px] text-[#ccc] hover:bg-[#555]"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    title="Save"
                    className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[10px] text-[#ccc] hover:bg-[#555]"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 1h9l3 3v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm3 0v4h5V1zm1 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Options"
                    className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[9px] text-[#ccc] hover:bg-[#555]"
                  >
                    ▾
                  </button>
                </div>
              </div>

              <div
                ref={arrangeScrollRef}
                className="min-h-0 flex-1 overflow-auto"
                onScroll={(e) => setArrangeScrollLeft(e.currentTarget.scrollLeft)}
              >
                {daw.tracks.map((tr, ti) => (
                  <div
                    key={tr.id}
                    className="flex border-b"
                    style={{
                      minHeight: TRACK_ROW_MIN_H,
                      minWidth: TRACK_HEADER_W + widthPx,
                      borderColor: LP.border,
                      background: daw.selectedTrackId === tr.id ? "rgba(60,120,200,0.14)" : LP.panel,
                    }}
                  >
                    <div
                      className="sticky left-0 z-10 flex shrink-0 border-r"
                      style={{
                        width: TRACK_HEADER_W,
                        borderColor: LP.border,
                        background: daw.selectedTrackId === tr.id ? "rgba(92, 122, 168, 0.92)" : LP.panel,
                      }}
                    >
                      <div className="w-1 shrink-0" style={{ backgroundColor: tr.color }} />
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-1 py-1">
                        <div className="flex items-center gap-1">
                          <span className="w-3 text-center font-mono text-[8px] text-[#888]">{ti + 1}</span>
                          <IconWaveInst />
                          <input
                            className="min-w-0 flex-1 truncate border border-transparent bg-transparent text-[10px] font-semibold outline-none"
                            style={{ color: LP.text }}
                            value={tr.name}
                            onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
                            onClick={() => daw.setSelectedTrackId(tr.id)}
                          />
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title="Mute"
                            className="h-[18px] w-[18px] rounded-sm border text-[7px] font-bold"
                            style={{
                              borderColor: "#444",
                              background: tr.muted ? LP.muteOn : "#404040",
                              color: tr.muted ? "#022" : "#ccc",
                            }}
                            onClick={() => daw.toggleMute(tr.id)}
                          >
                            M
                          </button>
                          <button
                            type="button"
                            title="Solo"
                            className="h-[18px] w-[18px] rounded-sm border text-[7px] font-bold"
                            style={{
                              borderColor: "#444",
                              background: tr.solo ? LP.solo : "#404040",
                              color: tr.solo ? "#111" : "#ccc",
                            }}
                            onClick={() => daw.toggleSolo(tr.id)}
                          >
                            S
                          </button>
                          <button
                            type="button"
                            title="Record arm"
                            className="h-[18px] w-[18px] rounded-sm border text-[7px] font-bold"
                            style={{
                              borderColor: "#444",
                              background: tr.recordArm ? LP.record : "#404040",
                              color: tr.recordArm ? "#fff" : "#ccc",
                            }}
                            onClick={() => daw.toggleRecordArm(tr.id)}
                          >
                            R
                          </button>
                          {/* Volume fader with signal-dependent green fill */}
                          {(() => {
                            const peak = daw.meterPeaks[tr.id] ?? 0;
                            const signalPct = Math.min(100, peak * 110);
                            const volPct = tr.volume * 100;
                            return (
                              <div
                                className="relative mx-1 h-4 min-w-[56px] flex-1 overflow-hidden rounded-full"
                                style={{ background: "#2a2a2a", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)" }}
                              >
                                {/* Signal-level green fill (only shows when audio is flowing) */}
                                {signalPct > 0.5 && (
                                  <div
                                    className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-75"
                                    style={{
                                      width: `${Math.min(volPct, signalPct)}%`,
                                      background: "linear-gradient(to right, #3a8a3a, #5cb85c)",
                                    }}
                                  />
                                )}
                                {/* Gray volume bar background showing fader position */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 rounded-full"
                                  style={{
                                    width: `${volPct}%`,
                                    background:
                                      signalPct > 0.5 ? "transparent" : "linear-gradient(to right, #4a4a4e, #5a5a5e)",
                                    opacity: signalPct > 0.5 ? 0 : 0.6,
                                  }}
                                />
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={tr.volume}
                                  onChange={(e) => daw.setTrackVolume(tr.id, Number(e.target.value))}
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                                <div
                                  className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[#888] bg-gradient-to-b from-[#ccc] to-[#888] shadow"
                                  style={{ left: `calc(${volPct}% - 6px)` }}
                                />
                              </div>
                            );
                          })()}
                          <PanKnob value={tr.pan} onChange={(v) => daw.setTrackPan(tr.id, v)} size={26} />
                        </div>
                      </div>
                    </div>

                    <div
                      className="relative shrink-0"
                      style={{ width: widthPx, minHeight: TRACK_ROW_MIN_H }}
                      onDragOver={(e) => {
                        if ([...e.dataTransfer.types].includes("Files")) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "copy";
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = firstAudioFileFromDataTransfer(e.dataTransfer);
                        if (file) void daw.importAudioFile(tr.id, file);
                      }}
                    >
                      <div
                        className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-px bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]"
                        style={{ left: daw.currentTime * PX_PER_SEC }}
                      />
                      <div
                        className="relative h-full"
                        style={{
                          width: widthPx,
                          minHeight: TRACK_ROW_MIN_H,
                          backgroundColor: LP.panelLo,
                          backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${Math.max(1, barW - 1)}px, rgba(0,0,0,0.12) ${Math.max(1, barW - 1)}px, rgba(0,0,0,0.12) ${barW}px)`,
                        }}
                        onDragOver={(e) => {
                          if ([...e.dataTransfer.types].includes("Files")) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = firstAudioFileFromDataTransfer(e.dataTransfer);
                          if (file) void daw.importAudioFile(tr.id, file);
                        }}
                      >
                        {(() => {
                          const spb = 60 / Math.max(40, daw.tempo);
                          return tr.midiNotes.map((n) => {
                            const left = n.startBeats * spb * PX_PER_SEC;
                            const w = Math.max(8, n.durationBeats * spb * PX_PER_SEC);
                            return (
                              <div
                                key={n.id}
                                className="pointer-events-none absolute rounded-sm opacity-85"
                                style={{
                                  left,
                                  top: 62,
                                  width: w,
                                  height: 10,
                                  backgroundColor: tr.color,
                                }}
                                title="MIDI"
                              />
                            );
                          });
                        })()}
                        {tr.clips.map((c) => {
                          const w = Math.max(24, c.buffer.duration * PX_PER_SEC);
                          const h = 54;
                          const isSel = selection?.trackId === tr.id && selection?.clipId === c.id;
                          return (
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={0}
                              className={`group absolute top-1.5 cursor-pointer overflow-hidden rounded-[3px] border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none focus-visible:ring-2 ${
                                isSel ? "ring-2 ring-[#5a9eef]/80" : "hover:brightness-105"
                              }`}
                              style={{
                                left: c.startTime * PX_PER_SEC,
                                width: w,
                                height: h,
                                backgroundColor: `${tr.color}22`,
                                borderColor: isSel ? LP.accentBlueHi : LP.border,
                              }}
                              onDragOver={(e) => {
                                if ([...e.dataTransfer.types].includes("Files")) {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "copy";
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = firstAudioFileFromDataTransfer(e.dataTransfer);
                                if (file) void daw.importAudioFile(tr.id, file);
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
        </div>
      )}

      {editorsOpen ? (
        <footer
          className={`flex shrink-0 flex-col border-t ${
            editorTab === "piano" ? "min-h-[240px] flex-1 lg:h-[min(320px,40vh)] lg:max-h-[420px]" : "h-[148px]"
          }`}
          style={{ borderColor: LP.border, background: LP.panelLo }}
        >
          <div className="flex border-b text-[10px]" style={{ borderColor: LP.border, background: LP.panel }}>
            {(
              [
                { id: "clip" as const, label: "Audio editor" },
                { id: "piano" as const, label: "Piano Roll" },
                { id: "score" as const, label: "Score" },
                { id: "step" as const, label: "Step Seq." },
                { id: "smart" as const, label: "Smart Tempo" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={t.id !== "clip" && t.id !== "piano"}
                title={t.id !== "clip" && t.id !== "piano" ? "Reserved for future editor" : undefined}
                className={`border-r px-3 py-1.5 font-medium ${
                  (t.id === "clip" && editorTab === "clip") || (t.id === "piano" && editorTab === "piano")
                    ? "text-white"
                    : "text-[#999] hover:bg-black/15 disabled:opacity-35"
                }`}
                style={{
                  borderColor: LP.border,
                  background:
                    (t.id === "clip" && editorTab === "clip") || (t.id === "piano" && editorTab === "piano")
                      ? LP.accentBlue
                      : "transparent",
                }}
                onClick={() => {
                  if (t.id === "clip" || t.id === "piano") setEditorTab(t.id);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 items-stretch">
            {editorTab === "clip" && selectedClip && selectedTrack ? (
              <div className="flex flex-1 items-center gap-3 p-3">
                <div className="h-1 w-10 shrink-0 rounded" style={{ backgroundColor: selectedTrack.color }} />
                <div
                  className="min-h-0 flex-1 rounded border"
                  style={{ borderColor: LP.border, background: "#2a2a2a" }}
                >
                  <WaveformCanvas
                    buffer={selectedClip.buffer}
                    width={Math.min(1200, editorWavWidth)}
                    height={96}
                    color="#e8e8e8"
                    fill="rgba(0,0,0,0.45)"
                  />
                </div>
              </div>
            ) : editorTab === "clip" ? (
              <p className="flex flex-1 items-center px-4 text-[12px]" style={{ color: LP.textMuted }}>
                Select a clip in the timeline for the audio editor.
              </p>
            ) : (
              <PianoRoll trackId={targetTrackId} playheadSec={daw.currentTime} tempo={daw.tempo} />
            )}
          </div>
          {daw.status ? (
            <div
              className="border-t px-3 py-1.5 text-[11px]"
              style={{ borderColor: LP.border, background: LP.panel, color: LP.textMuted }}
            >
              {daw.status}
            </div>
          ) : null}
        </footer>
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

export type DawQuickHelpModalProps = {
  open: boolean;
  onClose: () => void;
  /** Dialog title */
  title?: string;
  /** If set, replaces the default bullet list */
  children?: ReactNode;
  /** Appended to the inner panel `className` (e.g. your theme tokens) */
  panelClassName?: string;
  /** Merged onto the inner panel (overrides e.g. background when matching app chrome) */
  panelStyle?: CSSProperties;
};

function DefaultHelpBody() {
  return (
    <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-zinc-400">
      <li>
        <span className="text-zinc-100">Transport:</span> Play, Stop, go to start/end, rewind & fast-forward by beat,
        Record, Loop, Metronome.
      </li>
      <li>
        <span className="text-zinc-100">Audio:</span> Import, drag files onto a track, or add sounds from your library
        UI.
      </li>
      <li>
        <span className="text-zinc-100">Project:</span> Save / Load JSON; export mix as stereo WAV when your UI calls
        it.
      </li>
      <li>
        <span className="text-zinc-100">Tracks:</span> M / S / R, volume and pan via{" "}
        <code className="text-zinc-300">useDaw()</code>.
      </li>
      <li>
        <span className="text-zinc-100">Editors:</span> Wire your own clip editor / Piano Roll using kit components if
        needed.
      </li>
    </ul>
  );
}

/**
 * Drop-in help dialog for custom Lovable layouts (no DawWorkspace required).
 *
 * @example
 * const [helpOpen, setHelpOpen] = useState(false);
 * return (
 *   <>
 *     <button type="button" onClick={() => setHelpOpen(true)}>Help</button>
 *     <DawQuickHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
 *   </>
 * );
 */
export function DawQuickHelpModal({
  open,
  onClose,
  title = "Quick help",
  children,
  panelClassName = "",
  panelStyle,
}: DawQuickHelpModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daw-help-title"
    >
      <div
        className={`relative w-full max-w-md rounded-lg border border-zinc-600 bg-zinc-800 p-5 text-zinc-100 shadow-2xl ${panelClassName}`}
        style={panelStyle}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
        <h2 id="daw-help-title" className="mb-3 text-lg font-semibold">
          {title}
        </h2>
        {children ?? <DefaultHelpBody />}
      </div>
    </div>
  );
}
