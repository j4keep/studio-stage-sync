/* W.Studio DAW Workspace */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { BusId, StudioTrackType, Track, TrackKind } from "./types";
import { clipTrimEnd, clipTrimStart, MIXER_BUS_STRIPS, ROUTING_BUS_IDS } from "./types";
import {
  EFFECT_PRESET_LABELS,
  EQ_PRESET_LABELS,
  LIBRARY_BY_CATEGORY,
  SPACE_PRESET_LABELS,
  faderToDbLabel,
  getTimelineEndSec,
  linearGainToDbLabel,
} from "./audio";
import { MIC_CHAIN_PRESETS } from "./micPresets";
import { REMOTE_LIBRARY_BY_CATEGORY } from "./remoteLibrary";
import { Headphones } from "lucide-react";
import ChannelMeter from "./ChannelMeter";
import { resolveStereo, trackShowsStereoMeters, trackToChannelConfig } from "./channelConfig";
import { DawProvider, INPUT_SOURCE_OPTIONS, meterPeakLR, meterPeakScalar, useDaw, type DawMeterPeak } from "./DawContext";
import { InsertRowPlaceholder, TrackPluginSlots } from "./TrackPluginSlots";
import type { StudioToolSheetId } from "./studioSession";
import { PianoRoll } from "./PianoRoll";
import { LivePeaksCanvas } from "./LivePeaksCanvas";
import { WaveformCanvas } from "./WaveformCanvas";

const PX_PER_SEC = 52;
/** Timeline clip move snap (seconds). */
const SNAP_MOVE_SEC = 0.125;
const pxToSec = (px: number) => px / PX_PER_SEC;
const secToPx = (sec: number) => sec * PX_PER_SEC;
function snapMoveTime(t: number) {
  return Math.round(t / SNAP_MOVE_SEC) * SNAP_MOVE_SEC;
}
const BUS_LABELS: Record<BusId, string> = {
  master: "Master",
  reverbA: "Reverb A",
  drumBus: "Drum bus",
  vocalBus: "Vocal bus",
};
function timelineSecFromClient(clientX: number, scrollLeft: number, laneEl: HTMLElement | null) {
  if (!laneEl) return 0;
  const lr = laneEl.getBoundingClientRect();
  const x = scrollLeft + (clientX - lr.left);
  return Math.max(0, pxToSec(x));
}
const TRACK_HEADER_W = 276;
const TIMELINE_BAR_LIMIT = 127;
/** Compact Logic-like strip: ~72px wide, ~168px fader travel (not oversized vs real LP mixer) */
const MIXER_LABEL_W = 76;
const MIXER_STRIP_W = 72;
const MIXER_METER_H = 168;
const INSPECTOR_STRIP_W = MIXER_STRIP_W;
const INSPECTOR_PANEL_W = INSPECTOR_STRIP_W * 2 + 1; /* 1px for border between strips */
/** Arrange row: header + lane share this height so waveforms fill the lane (Logic-style alignment). */
const TRACK_ROW_MIN_H = 52;
/** Stable id so "New track → Import audio" can use <label htmlFor> (reliable file picker vs programmatic .click()). */
const WSTUDIO_AUDIO_FILE_INPUT_ID = "wstudio-audio-file-import";
const MIXER_LABEL_ROWS = [
  { label: "Setting", height: 19 },
  { label: "Gain Reduction", height: 15 },
  { label: "EQ", height: 21 },
  { label: "MIDI FX", height: 17 },
  { label: "Input", height: 32 },
  { label: "Audio FX", height: 98 },
  { label: "Sends", height: 26 },
  { label: "Output", height: 19 },
  { label: "Group", height: 17 },
  { label: "Automation", height: 21 },
  { label: "", height: 36 },
  { label: "Pan", height: 32 },
  { label: "dB", height: 21 },
  { label: "", height: MIXER_METER_H + 6 },
  { label: "", height: 22 },
  { label: "", height: 26 },
  { label: "", height: 22 },
] as const;
const STUDIO_TRACK_TYPE_LABELS: Record<StudioTrackType, string> = {
  audio: "Audio",
  vocal: "Vocal",
  instrument: "Instrument",
  beat: "Beat",
  loop: "Loop",
};

const STUDIO_TOOL_SHEET_COPY: Record<StudioToolSheetId, { title: string; blurb: string }> = {
  keyboard: { title: "Keyboard", blurb: "MIDI keyboard workflow — instrument panel coming soon." },
  beat_maker: { title: "Beat Maker", blurb: "Step/pad beat tools — placeholder for the beat lane." },
  loops_browser: { title: "Loops browser", blurb: "Browse and audition loops; drag-to-arrange hooks into the Library." },
  instruments: { title: "Instruments", blurb: "Instrument rack and presets — placeholder until sound engine lands." },
  fx_rack: { title: "FX rack / inserts", blurb: "Per-track inserts — use strip EQ / dynamics / space today; graph editor later." },
};

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

/** Logic Pro–style mixer strip chrome (charcoal + cyan inserts + green Read) */
const LOGIC_MIX = {
  stripGradient: "linear-gradient(180deg, #3d3d40 0%, #2a2a2c 38%, #222224 100%)",
  headerMini: "truncate text-center text-[9px] font-semibold leading-tight text-[#ececec]",
  rowLine: "#141416",
  fxBlue:
    "flex h-[18px] w-full shrink-0 cursor-pointer items-center justify-center truncate rounded-[4px] border border-[#0a3d5c] bg-gradient-to-b from-[#58ace0] to-[#2a78b8] px-0.5 text-center text-[8px] font-semibold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.2)] outline-none appearance-none",
  slotIn:
    "flex h-[18px] w-full shrink-0 cursor-pointer items-center justify-center truncate rounded-[4px] border border-[#343438] bg-gradient-to-b from-[#38383c] to-[#28282c] px-0.5 text-center text-[7px] font-medium text-[#eaeaea] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] outline-none appearance-none",
  slotDark:
    "flex h-[18px] w-full items-center justify-center rounded-[4px] border border-[#2a2a2e] bg-[#1c1c1f] text-[7px] text-[#5a5a5e] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]",
  readBtn:
    "flex h-[19px] w-full items-center justify-center rounded-[4px] border border-[#1f5a22] bg-gradient-to-b from-[#48b848] to-[#2a802d] text-[9px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
  eqThumb:
    "relative h-[18px] w-[22px] shrink-0 overflow-hidden rounded-[3px] border border-[#141416] bg-[#0e0e10] shadow-[inset_0_2px_5px_rgba(0,0,0,0.65)] isolate",
  iconWell:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#121214] bg-[#0c0c0e] shadow-[inset_0_2px_5px_rgba(0,0,0,0.65)]",
  grMeter:
    "h-1 w-full max-w-[60px] rounded-full bg-[#0a0a0c] shadow-[inset_0_1px_2px_rgba(0,0,0,0.95)]",
  readout:
    "min-w-0 flex-1 rounded border border-[#08080a] bg-[#040405] px-0.5 py-px text-center font-mono text-[8px] tabular-nums leading-none text-[#d8d8dc]",
  readoutPeak: "text-[#52d852]",
  meterBar: 3,
  meterGap: 2,
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

function dataTransferHasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  const types = Array.from(dt.types ?? []);
  if (types.includes("Files") || types.includes("application/x-moz-file")) return true;
  if (dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      if (dt.items[i]?.kind === "file") return true;
    }
  }
  return false;
}

function firstAudioFileFromDataTransfer(dt: DataTransfer): File | undefined {
  const { files } = dt;
  for (let i = 0; i < files.length; i++) {
    const f = files.item(i);
    if (f && isAudioDropFile(f)) return f;
  }
  if (dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const it = dt.items[i];
      if (it?.kind !== "file") continue;
      const f = it.getAsFile();
      if (f && isAudioDropFile(f)) return f;
    }
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
  const meterPeak: DawMeterPeak = isStereoOut
    ? (daw.meterPeaks.__master__ ?? 0)
    : tr
      ? (daw.meterPeaks[tr.id] ?? 0)
      : 0;
  const peak = meterPeakScalar(meterPeak);
  const dualMeters = Boolean(isStereoOut || (tr != null && trackShowsStereoMeters(tr)));
  const vol = isStereoOut ? daw.masterVolume : (tr?.volume ?? 0.8);
  const pan = tr?.pan ?? 0;
  const name = isStereoOut ? "Stereo Out" : (tr?.name ?? "Track");
  const labelColor = isStereoOut ? "#4a9a4a" : (tr?.color ?? "#60a5fa");
  const updateVolume = (value: number) => {
    if (isStereoOut) daw.setMasterVolume(value);
    else if (tr) daw.setTrackVolume(tr.id, value);
  };

  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-r shadow-[inset_-1px_0_0_rgba(0,0,0,0.4)]"
      style={{
        color: LP.text,
        width: INSPECTOR_STRIP_W,
        minWidth: INSPECTOR_STRIP_W,
        background: LOGIC_MIX.stripGradient,
        borderColor: "#050506",
      }}
    >
      <MixerSlotRow label="Setting">
        <div className={`${LOGIC_MIX.headerMini} w-full rounded-[4px] border border-[#2a2a2e] bg-[#252528] py-0.5`} title={name}>
          {name}
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="flex w-full justify-center px-1">
          <div className={LOGIC_MIX.grMeter} />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        {tr ? (
          <div className="flex w-full items-center gap-1 px-0.5">
            <LogicMiniEqThumb presetId={tr.eqPreset} />
            <select
              value={tr.eqPreset}
              onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)["eqPreset"])}
              className={`${LOGIC_MIX.fxBlue} min-w-0 flex-1 text-[8px]`}
              title="Channel EQ"
            >
              {EQ_PRESET_LABELS.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#1a1a1e]">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={LOGIC_MIX.fxBlue}>Output EQ</div>
        )}
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className={LOGIC_MIX.slotDark}>{"—"}</div>
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        {!isStereoOut && tr ? (
          <div className="relative z-20 flex min-h-0 w-full flex-col gap-[3px]">
            <select
              value={tr.inputDeviceId ?? ""}
              title="Audio input"
              onChange={(e) => {
                const v = e.target.value;
                const sel = daw.inputDevices.find((d) => d.deviceId === v);
                daw.setTrackInputDevice(tr.id, v, sel?.label || "Input");
              }}
              className={LOGIC_MIX.slotIn}
            >
              <option value="" className="bg-[#1a1a1e]">
                Input
              </option>
              {daw.inputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId} className="bg-[#1a1a1e]">
                  {device.label || `In ${device.deviceId.slice(0, 4)}`}
                </option>
              ))}
            </select>
            <select
              title="Channel width"
              value={tr.channelMode}
              onChange={(e) => daw.setTrackChannelMode(tr.id, e.target.value as Track["channelMode"])}
              className={`${LOGIC_MIX.slotIn} text-[7px]`}
            >
              <option value="mono" className="bg-[#1a1a1e]">
                Mono
              </option>
              <option value="stereo" className="bg-[#1a1a1e]">
                Stereo
              </option>
              <option value="auto" className="bg-[#1a1a1e]">
                Auto
              </option>
            </select>
          </div>
        ) : (
          <div className={`${LOGIC_MIX.slotIn} text-[8px]`}>∞</div>
        )}
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        {tr ? (
          <div className="flex w-full flex-col gap-[2px]">
            <select
              value={tr.effectPreset}
              onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)["effectPreset"])}
              className={LOGIC_MIX.fxBlue}
              title="Dynamics / FX"
            >
              {EFFECT_PRESET_LABELS.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#1a1a1e]">
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={tr.spacePreset}
              onChange={(e) => daw.setTrackSpace(tr.id, e.target.value as (typeof tr)["spacePreset"])}
              className={LOGIC_MIX.fxBlue}
              title="Space"
            >
              {SPACE_PRESET_LABELS.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#1a1a1e]">
                  {o.label}
                </option>
              ))}
            </select>
            <TrackPluginSlots slots={tr.fxInserts} />
          </div>
        ) : (
          <MixerStack items={["Space D"]} tone="blue" />
        )}
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        {!isStereoOut && tr ? (
          <div className="flex items-center gap-1 rounded-[4px] border border-[#2e4a6a] bg-gradient-to-b from-[#4e8cc8] to-[#2a5a90] px-1 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <span className="shrink-0 text-[8px] font-semibold text-white">Rv</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((tr.sendReverb ?? 0.18) * 100)}
              onChange={(e) => daw.setTrackSendReverb(tr.id, Number(e.target.value) / 100)}
              className="h-1 min-w-0 flex-1 cursor-pointer"
              style={{ accentColor: "#b8e0ff" }}
            />
          </div>
        ) : (
          <div className={LOGIC_MIX.slotDark} />
        )}
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={LOGIC_MIX.slotIn}>{isStereoOut ? "Output" : "St Out"}</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className={`${LOGIC_MIX.slotDark} text-[#666]`}>Group</div>
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={LOGIC_MIX.readBtn}>
          Read
        </button>
      </MixerSlotRow>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 36, height: 36 }}
      >
        <div className={LOGIC_MIX.iconWell}>
          {!isStereoOut && tr ? (
            <InstrumentIcon kind={tr.kind} color={tr.color} />
          ) : (
            <svg
              style={{ color: "#4a9a4a", width: 22, height: 22 }}
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
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 32, height: 32 }}
      >
        <PanKnob
          value={isStereoOut ? 0 : pan}
          onChange={(v) => !isStereoOut && tr && daw.setTrackPan(tr.id, v)}
          size={26}
          showValueLabel={false}
        />
      </div>
      <div
        className="flex items-stretch justify-center gap-0.5 border-b px-0.5 py-px"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 21, height: 21 }}
      >
        <span className={LOGIC_MIX.readout}>{isStereoOut ? "0.0" : faderToDbLabel(vol)}</span>
        <span className={`${LOGIC_MIX.readout} ${LOGIC_MIX.readoutPeak}`}>{peakToDbDisplay(peak)}</span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: MIXER_METER_H + 6, height: MIXER_METER_H + 6 }}
      >
        <VerticalMixerFader
          value={vol}
          meterPeak={meterPeak}
          dualMeters={dualMeters}
          onChange={updateVolume}
          ariaLabel={`${name} level`}
        />
      </div>
      {!isStereoOut ? (
        <div
          className="flex items-center justify-center gap-1 border-b px-0.5 py-0.5"
          style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 22, height: 22 }}
        >
          <button
            type="button"
            disabled={!daw.sessionCapabilities.canArmRecord}
            onClick={() => tr && daw.sessionCapabilities.canArmRecord && daw.toggleRecordArm(tr.id)}
            className={`flex h-[19px] w-[28px] items-center justify-center rounded-[3px] border text-[8px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] disabled:opacity-40 ${
              tr?.recordArm
                ? "border-[#8b2020] bg-gradient-to-b from-[#e84848] to-[#a82020] text-white"
                : "border-[#3a3a40] bg-gradient-to-b from-[#4a4a52] to-[#323238] text-[#bbb]"
            }`}
          >
            R
          </button>
          <button
            type="button"
            title="Input monitoring"
            onClick={() => tr && daw.toggleInputMonitoring(tr.id)}
            className={`flex h-[19px] w-[28px] items-center justify-center rounded-[3px] border text-[8px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
              tr?.inputMonitoring
                ? "border-[#b86812] bg-gradient-to-b from-[#f0a030] to-[#c07018] text-[#1a0a00]"
                : "border-[#3a3a40] bg-gradient-to-b from-[#4a4a52] to-[#323238] text-[#bbb]"
            }`}
          >
            <Headphones size={12} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center justify-center border-b py-0.5"
          style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 22, height: 22 }}
        >
          <span className="text-[8px] font-medium text-[#888]">Bnce</span>
        </div>
      )}
      <div
        className="flex items-center justify-center gap-1.5 border-b px-1 py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 26, height: 26 }}
      >
        <button
          type="button"
          onClick={() => !isStereoOut && tr && daw.toggleMute(tr.id)}
          className={`h-7 w-8 rounded-[4px] border text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            !isStereoOut && tr?.muted
              ? "border-[#2a6a6a] bg-gradient-to-b from-[#5ec8c8] to-[#3a9898] text-[#022]"
              : "border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[#eee]"
          }`}
        >
          M
        </button>
        {!isStereoOut && (
          <button
            type="button"
            onClick={() => tr && daw.toggleSolo(tr.id)}
            className={`h-7 w-8 rounded-[4px] border text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
              tr?.solo
                ? "border-[#a08008] bg-gradient-to-b from-[#f0e060] to-[#c0a020] text-[#111]"
                : "border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[#eee]"
            }`}
          >
            S
          </button>
        )}
      </div>
      <div
        className="mt-auto flex min-h-[22px] items-center justify-center truncate border-t px-0.5 py-0.5 text-center text-[9px] font-bold leading-none tracking-tight text-white"
        style={{
          backgroundColor: labelColor,
          borderColor: "#000",
          textShadow: "0 1px 2px rgba(0,0,0,0.65)",
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
        {tr ? (
          <div className="mt-1.5 space-y-1">
            <label className="flex flex-col gap-0.5 text-[8px] text-[#888]">
              <span>Studio lane</span>
              <select
                className="rounded border px-1 py-0.5 text-[9px]"
                style={{ borderColor: LP.border, background: LP.panelLo, color: LP.text }}
                value={tr.studioTrackType}
                onChange={(e) => daw.setTrackStudioType(tr.id, e.target.value as StudioTrackType)}
              >
                {(Object.entries(STUDIO_TRACK_TYPE_LABELS) as [StudioTrackType, string][]).map(([id, lab]) => (
                  <option key={id} value={id}>
                    {lab}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-[8px] text-[#888]">
              Inserts
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {tr.fxInserts.map((s, i) => (
                  <span
                    key={s.id}
                    className="rounded border px-1 py-px text-[7px]"
                    style={{ borderColor: LP.border, color: s.pluginId ? LP.text : "#666" }}
                    title="FX slot placeholder"
                  >
                    {s.pluginId ?? `FX ${i + 1}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
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

const METER_SEGMENT_PCTS = [12, 28, 44, 60, 76] as const;

function PeakMeterStem({ peak, height, barWidth }: { peak: number; height: number; barWidth: number }) {
  const h = Math.min(100, peak * 112);
  return (
    <div
      className="relative overflow-hidden rounded-[2px] bg-[#060607]"
      style={{
        height,
        width: barWidth,
        boxShadow: "inset 0 3px 8px rgba(0,0,0,0.98), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {METER_SEGMENT_PCTS.map((pct) => (
        <div
          key={pct}
          className="pointer-events-none absolute left-0 right-0 border-t border-[#1a1a1c]"
          style={{ bottom: `${pct}%` }}
        />
      ))}
      <div
        className="absolute bottom-0 left-0 right-0 transition-[height] duration-75 ease-out"
        style={{
          height: `${h}%`,
          background: `linear-gradient(to top, ${LP.meterGreen} 0%, ${LP.meterYel} 68%, ${LP.meterRed} 100%)`,
          boxShadow: "0 0 3px rgba(80,210,80,0.2)",
        }}
      />
    </div>
  );
}

function SinglePeakMeter({
  peak,
  height = MIXER_METER_H,
  barWidth,
}: {
  peak: number;
  height?: number;
  barWidth: number;
}) {
  return (
    <div className="flex items-end" style={{ height }}>
      <PeakMeterStem peak={peak} height={height} barWidth={barWidth} />
    </div>
  );
}

function DualPeakMeters({
  peakL,
  peakR,
  height = MIXER_METER_H,
  barWidth = 10,
  barGap = 3,
}: {
  peakL: number;
  peakR: number;
  height?: number;
  barWidth?: number;
  /** Horizontal gap between L/R stems */
  barGap?: number;
}) {
  return (
    <div className="flex items-end" style={{ height, gap: barGap }}>
      <PeakMeterStem peak={peakL} height={height} barWidth={barWidth} />
      <PeakMeterStem peak={peakR} height={height} barWidth={barWidth} />
    </div>
  );
}

/** Logic-style dB ladder: ticks + numerals to the right of the meters */
function MixerFaderDbScale() {
  return (
    <div
      className="flex min-w-[28px] flex-col justify-between py-px pl-0.5 font-mono text-[6px] leading-none tracking-tight text-[#ceced2]"
      style={{ height: MIXER_METER_H }}
    >
      {MIXER_SCALE_MARKS.map((mark, i) => (
        <div key={mark} className="flex items-center justify-end gap-0.5">
          <div
            className="h-px shrink-0 bg-[#7a7a82]"
            style={{
              width: i === 0 || mark === "0" || mark === "-12" || mark === "-60" ? 9 : 6,
              opacity: 0.85,
            }}
          />
          <span className="w-[15px] text-right tabular-nums">{mark}</span>
        </div>
      ))}
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
  audioFileInputId,
  onPrepareImportAudio,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (k: TrackKind) => void;
  audioFileInputId: string;
  onPrepareImportAudio: () => void;
}) {
  if (!open) return null;
  const cellClass =
    "flex flex-col items-center rounded-lg border px-3 py-4 text-center transition hover:brightness-110";
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
          {MODAL_CELLS.map((c) =>
            c.kind === "import_audio" ? (
              <label
                key={c.kind}
                htmlFor={audioFileInputId}
                className={`${cellClass} cursor-pointer`}
                style={{ borderColor: LP.border, background: LP.panelLo }}
                onMouseDown={() => onPrepareImportAudio()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onPrepareImportAudio();
                }}
                onClick={() => setTimeout(() => onClose(), 0)}
              >
                <span className="mb-2 text-2xl" style={{ color: c.color }} aria-hidden>
                  ●
                </span>
                <span className="text-[13px] font-medium">{c.label}</span>
                <span className="mt-0.5 text-[10px]" style={{ color: LP.textMuted }}>
                  {c.hint}
                </span>
              </label>
            ) : (
              <button
                key={c.kind}
                type="button"
                className={cellClass}
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
            ),
          )}
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
  meterPeak,
  dualMeters,
  onChange,
  ariaLabel,
}: {
  value: number;
  meterPeak: DawMeterPeak;
  /** Stereo / master-style dual stems; mono sources get a single peak bar */
  dualMeters: boolean;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const { left: peakL, right: peakR } = meterPeakLR(meterPeak);
  const peakMono = meterPeakScalar(meterPeak);

  const updateFromClientY = (clientY: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    onChange(Math.max(0, Math.min(1, ratio)));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientY(event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientY(event.clientY);
  };

  const onPointerUpOrCancel = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* released */
    }
  };

  const capH = Math.round(MIXER_METER_H * 0.15);
  const handleTop = (1 - Math.max(0, Math.min(1, value))) * (MIXER_METER_H - capH);
  const meterClusterW = dualMeters ? LOGIC_MIX.meterBar * 2 + LOGIC_MIX.meterGap : LOGIC_MIX.meterBar;
  const capW = Math.min(26, Math.max(20, meterClusterW + 10));
  const grooveW = 6;

  return (
    <div className="flex h-full w-full max-w-full items-stretch justify-center gap-0.5 px-px py-0.5">
      {/* Logic order: thin track + cap → segmented meters → dB ladder (ticks + numbers) */}
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="relative w-[30px] shrink-0 cursor-ns-resize touch-none select-none outline-none"
        style={{ height: MIXER_METER_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrCancel}
        onPointerCancel={onPointerUpOrCancel}
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
          className="pointer-events-none absolute left-1/2 top-0.5 bottom-0.5 w-full max-w-[22px] -translate-x-1/2 rounded-[2px]"
          style={{
            background: "linear-gradient(180deg, #2e2e32 0%, #121214 45%, #070708 100%)",
            boxShadow:
              "inset 0 4px 8px rgba(0,0,0,0.88), inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 0 rgba(255,255,255,0.03)",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-[1] -translate-x-1/2 rounded-[2px] border border-[#050506]"
          style={{
            width: grooveW,
            background: "linear-gradient(90deg, #141418 0%, #08080a 55%, #020203 100%)",
            boxShadow:
              "inset 0 2px 6px rgba(0,0,0,0.95), inset 1px 0 0 rgba(255,255,255,0.04), inset -1px 0 0 rgba(0,0,0,0.55)",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-[2px] border border-x-[#4a4a50] border-y-[#8e8e96]"
          style={{
            top: handleTop,
            width: capW,
            height: capH,
            background: "linear-gradient(180deg, #f2f2f6 0%, #dcdce0 18%, #c0c0c8 50%, #a0a0a8 82%, #787880 100%)",
            boxShadow:
              "0 1px 1px rgba(0,0,0,0.4), 0 4px 7px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -2px 4px rgba(0,0,0,0.2)",
          }}
        >
          {/* Logic-style thumb notch */}
          <div
            className="pointer-events-none absolute left-[3px] right-[3px] top-1/2 h-[7px] -translate-y-1/2 rounded-[1px]"
            style={{
              background: "linear-gradient(180deg, #1a1a1e 0%, #0a0a0c 40%, #121214 100%)",
              boxShadow:
                "inset 0 2px 3px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </div>
      {dualMeters ? (
        <DualPeakMeters
          peakL={peakL}
          peakR={peakR}
          height={MIXER_METER_H}
          barWidth={LOGIC_MIX.meterBar}
          barGap={LOGIC_MIX.meterGap}
        />
      ) : (
        <SinglePeakMeter peak={peakMono} height={MIXER_METER_H} barWidth={LOGIC_MIX.meterBar} />
      )}
      <MixerFaderDbScale />
    </div>
  );
}

function MixerStack({ items, tone = "gray" }: { items: string[]; tone?: "gray" | "blue" }) {
  const blueCls = `${LOGIC_MIX.fxBlue} min-h-0`;
  const grayCls = LOGIC_MIX.slotDark;
  const visible = items.filter(Boolean).slice(0, 4);
  return (
    <div className="flex w-full flex-col gap-[2px]">
      {visible.length ? (
        visible.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className={tone === "blue" ? blueCls : grayCls}
            title={item}
          >
            {item}
          </div>
        ))
      ) : (
        <div className={grayCls} />
      )}
    </div>
  );
}

function MixerLabelColumn() {
  return (
    <div
      className="sticky left-0 z-10 flex shrink-0 flex-col border-r text-right text-[9px] font-medium text-[#97979c]"
      style={{
        width: MIXER_LABEL_W,
        borderColor: "#0a0a0b",
        background: "linear-gradient(180deg, #3a3a3d 0%, #2c2c2f 100%)",
      }}
    >
      {MIXER_LABEL_ROWS.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex items-center justify-end border-b px-2"
          style={{ borderColor: LOGIC_MIX.rowLine, minHeight: row.height, height: row.height }}
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

function MixerSlotRow({ label, children }: { label: string; children?: ReactNode }) {
  const rowHeights: Record<string, number> = {
    Setting: 19,
    "Gain Reduction": 15,
    EQ: 21,
    "MIDI FX": 17,
    Input: 32,
    "Audio FX": 92,
    Sends: 26,
    Output: 19,
    Group: 17,
    Automation: 21,
    Icon: 36,
    Pan: 32,
    dB: 21,
  };
  const rowHeight = rowHeights[label] ?? 20;
  return (
    <div
      className={`flex border-b px-0.5 ${label === "Audio FX" || label === "Sends" ? "items-start py-[3px]" : "items-center justify-center"}`}
      style={{ borderColor: LOGIC_MIX.rowLine, minHeight: rowHeight, height: rowHeight }}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function LogicMiniEqThumb({ presetId }: { presetId: string }) {
  const tilt = presetId === "flat" ? 0 : presetId.includes("bass") ? -12 : 8;
  return (
    <div className={LOGIC_MIX.eqThumb} title="EQ curve">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-2 opacity-90"
        style={{
          background: `linear-gradient(185deg, transparent 0%, rgba(80,160,240,0.25) 40%, rgba(120,200,255,0.55) 100%)`,
          transform: `skewY(${tilt}deg)`,
          transformOrigin: "center bottom",
        }}
      />
      <div className="pointer-events-none absolute inset-x-1 bottom-1 top-3 rounded-sm border border-[#2a2a2e] bg-[#0c0c0e]" />
    </div>
  );
}

/** Instrument icon SVGs for mixer strip display */
function InstrumentIcon({ kind, color }: { kind: string; color: string }) {
  const iconStyle = { color, width: 24, height: 24 };
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

type MixerStripProps = {
  track: Track;
  peak: DawMeterPeak;
  fileInputTrigger: () => void;
};

function MixerStrip({ track: tr, peak, fileInputTrigger }: MixerStripProps) {
  const daw = useDaw();

  const dbLabel = faderToDbLabel(tr.volume);
  const peakScalar = meterPeakScalar(peak);
  const peakDb = peakToDbDisplay(peakScalar);
  const sendItems = tr.kind === "instrument" ? ["Bus 4"] : [];
  void fileInputTrigger;

  return (
    <div
      className="relative z-10 flex min-h-full shrink-0 flex-col border-r shadow-[2px_0_8px_rgba(0,0,0,0.35)]"
      style={{
        width: MIXER_STRIP_W,
        borderColor: "#050506",
        background: LOGIC_MIX.stripGradient,
      }}
    >
      <MixerSlotRow label="Setting">
        <div
          className={`${LOGIC_MIX.headerMini} w-full truncate rounded-[4px] border border-[#2a2a2e] bg-[#252528] py-0.5`}
          title={tr.name}
        >
          {tr.name}
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="flex w-full justify-center px-1">
          <div className={LOGIC_MIX.grMeter} title="Gain reduction">
            <div
              className="h-full w-[30%] rounded-full bg-gradient-to-r from-[#3a6a3a] to-[#5acd5a] opacity-80"
              style={{ marginLeft: 0 }}
            />
          </div>
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className="flex w-full items-center gap-1 px-0.5">
          <LogicMiniEqThumb presetId={tr.eqPreset} />
          <select
            value={tr.eqPreset}
            onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)["eqPreset"])}
            className={`${LOGIC_MIX.fxBlue} min-w-0 flex-1 text-[8px]`}
            title="Channel EQ"
          >
            {EQ_PRESET_LABELS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#1a1a1e] text-[#eee]">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className={`${LOGIC_MIX.slotDark} opacity-90`}>{"—"}</div>
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className="relative z-20 flex min-h-0 w-full flex-col gap-[3px]" style={{ pointerEvents: "auto" }}>
          <select
            value={tr.inputDeviceId ?? ""}
            title="Audio input"
            onChange={(e) => {
              const v = e.target.value;
              const sel = daw.inputDevices.find((d) => d.deviceId === v);
              daw.setTrackInputDevice(tr.id, v, sel?.label || "Input");
            }}
            className={LOGIC_MIX.slotIn}
          >
            <option value="" className="bg-[#1a1a1e]">
              Input
            </option>
            {daw.inputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId} className="bg-[#1a1a1e]">
                {device.label || `In ${device.deviceId.slice(0, 4)}`}
              </option>
            ))}
          </select>
          <select
            title="Channel width"
            value={tr.channelMode}
            onChange={(e) => daw.setTrackChannelMode(tr.id, e.target.value as Track["channelMode"])}
            className={`${LOGIC_MIX.slotIn} text-[7px]`}
          >
            <option value="mono" className="bg-[#1a1a1e]">
              Mono
            </option>
            <option value="stereo" className="bg-[#1a1a1e]">
              Stereo
            </option>
            <option value="auto" className="bg-[#1a1a1e]">
              Auto
            </option>
          </select>
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <div className="flex w-full flex-col gap-[2px]">
          <select
            value={tr.effectPreset}
            onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)["effectPreset"])}
            className={LOGIC_MIX.fxBlue}
            title="Dynamics / FX"
          >
            {EFFECT_PRESET_LABELS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#1a1a1e]">
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={tr.spacePreset}
            onChange={(e) => daw.setTrackSpace(tr.id, e.target.value as (typeof tr)["spacePreset"])}
            className={LOGIC_MIX.fxBlue}
            title="Space"
          >
            {SPACE_PRESET_LABELS.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#1a1a1e]">
                {o.label}
              </option>
            ))}
          </select>
          <TrackPluginSlots slots={tr.fxInserts} />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <div className="flex w-full flex-col gap-[2px]">
          <div className="flex items-center gap-1 rounded-[4px] border border-[#2e4a6a] bg-gradient-to-b from-[#4e8cc8] to-[#2a5a90] px-1 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <span className="shrink-0 text-[8px] font-semibold text-white">Rv</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((tr.sendReverb ?? 0.18) * 100)}
              onChange={(e) => daw.setTrackSendReverb(tr.id, Number(e.target.value) / 100)}
              className="h-1 min-w-0 flex-1 cursor-pointer"
              style={{ accentColor: "#b8e0ff" }}
              title="Reverb send"
            />
          </div>
          {sendItems.length > 0 ? <MixerStack items={sendItems} tone="blue" /> : null}
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <select
          value={tr.outputBus ?? "master"}
          onChange={(e) => daw.setTrackOutputBus(tr.id, e.target.value as BusId)}
          className={LOGIC_MIX.slotIn}
          title="Output"
        >
          {ROUTING_BUS_IDS.map((id) => (
            <option key={id} value={id} className="bg-[#1a1a1e]">
              {BUS_LABELS[id]}
            </option>
          ))}
        </select>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className={`${LOGIC_MIX.slotDark} text-[#666]`}>Group</div>
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={LOGIC_MIX.readBtn} title="Automation">
          Read
        </button>
      </MixerSlotRow>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 36, height: 36 }}
      >
        <div className={LOGIC_MIX.iconWell}>
          <InstrumentIcon kind={tr.kind} color={tr.color} />
        </div>
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 32, height: 32 }}
      >
        <PanKnob value={tr.pan} onChange={(v) => daw.setTrackPan(tr.id, v)} size={26} showValueLabel={false} />
      </div>
      <div
        className="flex items-stretch justify-center gap-0.5 border-b px-0.5 py-px"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 21, height: 21 }}
      >
        <span className={LOGIC_MIX.readout}>{dbLabel}</span>
        <span className={`${LOGIC_MIX.readout} ${LOGIC_MIX.readoutPeak}`}>{peakDb}</span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: MIXER_METER_H + 6, height: MIXER_METER_H + 6 }}
      >
        <VerticalMixerFader
          value={tr.volume}
          meterPeak={peak}
          dualMeters={trackShowsStereoMeters(tr)}
          onChange={(value) => daw.setTrackVolume(tr.id, value)}
          ariaLabel={`${tr.name} level`}
        />
      </div>
      <div
        className="flex items-center justify-center gap-1 border-b px-0.5 py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 22, height: 22 }}
      >
        <button
          type="button"
          disabled={!daw.sessionCapabilities.canArmRecord}
          onClick={() => daw.sessionCapabilities.canArmRecord && daw.toggleRecordArm(tr.id)}
          className={`flex h-[19px] w-[28px] items-center justify-center rounded-[3px] border text-[8px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] disabled:opacity-40 ${
            tr.recordArm
              ? "border-[#8b2020] bg-gradient-to-b from-[#e84848] to-[#a82020] text-white"
              : "border-[#3a3a40] bg-gradient-to-b from-[#4a4a52] to-[#323238] text-[#bbb]"
          }`}
          title="Record enable"
        >
          R
        </button>
        <button
          type="button"
          title="Input monitoring"
          onClick={() => daw.toggleInputMonitoring(tr.id)}
          className={`flex h-[19px] w-[28px] items-center justify-center rounded-[3px] border text-[8px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            tr.inputMonitoring
              ? "border-[#b86812] bg-gradient-to-b from-[#f0a030] to-[#c07018] text-[#1a0a00]"
              : "border-[#3a3a40] bg-gradient-to-b from-[#4a4a52] to-[#323238] text-[#bbb]"
          }`}
        >
          <Headphones size={13} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <div
        className="flex items-center justify-center gap-1.5 border-b px-1 py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 26, height: 26 }}
      >
        <button
          type="button"
          title="Mute"
          onClick={() => daw.toggleMute(tr.id)}
          className={`h-7 w-8 rounded-[4px] border text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            tr.muted
              ? "border-[#2a6a6a] bg-gradient-to-b from-[#5ec8c8] to-[#3a9898] text-[#022]"
              : "border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[#eee]"
          }`}
        >
          M
        </button>
        <button
          type="button"
          title="Solo"
          onClick={() => daw.toggleSolo(tr.id)}
          className={`h-7 w-8 rounded-[4px] border text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            tr.solo
              ? "border-[#a08008] bg-gradient-to-b from-[#f0e060] to-[#c0a020] text-[#111]"
              : "border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[#eee]"
          }`}
        >
          S
        </button>
      </div>
      <div
        className="mt-auto flex min-h-[22px] items-center justify-center truncate border-t px-0.5 py-0.5 text-center text-[9px] font-bold leading-none tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        style={{
          backgroundColor: tr.color,
          borderColor: "#000",
          textShadow: "0 1px 2px rgba(0,0,0,0.65)",
        }}
        title={tr.name}
      >
        {tr.name || "Track"}
      </div>
    </div>
  );
}

type BusMixerStripProps = {
  busId: Exclude<BusId, "master">;
};

function BusMixerStrip({ busId }: BusMixerStripProps) {
  const daw = useDaw();
  const meterPeak: DawMeterPeak = daw.meterPeaks[`bus:${busId}`] ?? 0;
  const peak = meterPeakScalar(meterPeak);
  const bm = daw.busMixer[busId];
  const title = BUS_LABELS[busId];
  const dbLabel = faderToDbLabel(bm.volume);
  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-l shadow-[2px_0_8px_rgba(0,0,0,0.35)]"
      style={{ width: MIXER_STRIP_W, borderColor: "#050506", background: LOGIC_MIX.stripGradient }}
    >
      <MixerSlotRow label="Setting">
        <div className={`${LOGIC_MIX.headerMini} w-full rounded-[4px] border border-[#2a2a2e] bg-[#252528] py-0.5`}>
          {title}
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="flex w-full justify-center px-1">
          <div className={LOGIC_MIX.grMeter} />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className={`${LOGIC_MIX.slotDark}`}>—</div>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className={`${LOGIC_MIX.slotDark}`}>{"—"}</div>
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className={`${LOGIC_MIX.slotIn} text-[8px] text-[#aaa]`}>Tracks</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <InsertRowPlaceholder />
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <div className={LOGIC_MIX.slotDark} />
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={LOGIC_MIX.slotIn}>Master</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className={`${LOGIC_MIX.slotDark} text-[#666]`}>Group</div>
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={LOGIC_MIX.readBtn}>
          Read
        </button>
      </MixerSlotRow>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 36, height: 36 }}
      >
        <div className={LOGIC_MIX.iconWell}>
          <svg style={{ color: "#6b8cbc", width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16v2M8 16v4M12 6v14M16 12v8M20 8v12" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 32, height: 32 }}
      >
        <PanKnob value={0} onChange={() => {}} size={26} showValueLabel={false} />
      </div>
      <div
        className="flex items-stretch justify-center gap-0.5 border-b px-0.5 py-px"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 21, height: 21 }}
      >
        <span className={LOGIC_MIX.readout}>{dbLabel}</span>
        <span className={`${LOGIC_MIX.readout} ${LOGIC_MIX.readoutPeak}`}>{peakToDbDisplay(peak)}</span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: MIXER_METER_H + 6, height: MIXER_METER_H + 6 }}
      >
        <VerticalMixerFader
          value={bm.volume}
          meterPeak={meterPeak}
          dualMeters
          onChange={(value) => daw.setBusVolume(busId, value)}
          ariaLabel={`${title} level`}
        />
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 22, height: 22 }}
      >
        <span className="text-[8px] font-medium text-[#888]">Aux</span>
      </div>
      <div
        className="flex items-center justify-center py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 26, height: 26, borderBottomWidth: 1, borderBottomStyle: "solid" }}
      >
        <button
          type="button"
          title="Mute bus"
          onClick={() => daw.toggleBusMute(busId)}
          className={`h-7 w-8 rounded-[4px] border text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            bm.muted
              ? "border-[#2a6a6a] bg-gradient-to-b from-[#5ec8c8] to-[#3a9898] text-[#022]"
              : "border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[#eee]"
          }`}
        >
          M
        </button>
      </div>
      <div
        className="mt-auto flex min-h-[22px] items-center justify-center truncate border-t px-0.5 py-0.5 text-center text-[9px] font-bold leading-none text-white"
        style={{
          backgroundColor: "#4a5a78",
          borderColor: "#000",
          textShadow: "0 1px 2px rgba(0,0,0,0.65)",
        }}
      >
        {title}
      </div>
    </div>
  );
}

function StereoOutStrip() {
  const daw = useDaw();
  const meterPeak: DawMeterPeak = daw.meterPeaks.__master__ ?? 0;
  const peak = meterPeakScalar(meterPeak);
  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-l shadow-[2px_0_8px_rgba(0,0,0,0.35)]"
      style={{ width: MIXER_STRIP_W, borderColor: "#050506", background: LOGIC_MIX.stripGradient }}
    >
      <MixerSlotRow label="Setting">
        <div className={`${LOGIC_MIX.headerMini} w-full rounded-[4px] border border-[#2a2a2e] bg-[#252528] py-0.5`}>
          Stereo Out
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="flex w-full justify-center px-1">
          <div className={LOGIC_MIX.grMeter} />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className={LOGIC_MIX.fxBlue}>Output EQ</div>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className={LOGIC_MIX.slotDark}>{"—"}</div>
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className={`${LOGIC_MIX.slotIn} text-[8px]`}>∞</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <MixerStack items={["Space D"]} tone="blue" />
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <div className={LOGIC_MIX.slotDark} />
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={LOGIC_MIX.slotIn}>St Out</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className={`${LOGIC_MIX.slotDark} text-[#666]`}>Group</div>
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={LOGIC_MIX.readBtn}>
          Read
        </button>
      </MixerSlotRow>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 36, height: 36 }}
      >
        <div className={LOGIC_MIX.iconWell}>
          <svg
            style={{ color: "#4a9a4a", width: 22, height: 22 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 32, height: 32 }}
      >
        <PanKnob value={0} onChange={() => {}} size={26} showValueLabel={false} />
      </div>
      <div
        className="flex items-stretch justify-center gap-0.5 border-b px-0.5 py-px"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 21, height: 21 }}
      >
        <span className={LOGIC_MIX.readout}>0.0</span>
        <span className={`${LOGIC_MIX.readout} ${LOGIC_MIX.readoutPeak}`}>{peakToDbDisplay(peak)}</span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: MIXER_METER_H + 6, height: MIXER_METER_H + 6 }}
      >
        <VerticalMixerFader
          value={daw.masterVolume}
          meterPeak={meterPeak}
          dualMeters
          onChange={(value) => daw.setMasterVolume(value)}
          ariaLabel="Stereo out level"
        />
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 22, height: 22 }}
      >
        <span className="text-[8px] font-medium text-[#888]">Bnce</span>
      </div>
      <div
        className="flex items-center justify-center py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 26, height: 26, borderBottomWidth: 1, borderBottomStyle: "solid" }}
      >
        <button
          type="button"
          className="h-7 w-8 rounded-[4px] border border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[11px] font-bold text-[#eee] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        >
          M
        </button>
      </div>
      <div
        className="mt-auto flex min-h-[22px] items-center justify-center truncate border-t px-0.5 py-0.5 text-center text-[9px] font-bold leading-none text-white"
        style={{
          backgroundColor: "#3d8f50",
          borderColor: "#000",
          textShadow: "0 1px 2px rgba(0,0,0,0.65)",
        }}
      >
        Stereo Out
      </div>
    </div>
  );
}

function MasterMixerStrip() {
  const daw = useDaw();
  const meterPeak: DawMeterPeak = daw.meterPeaks.__master__ ?? 0;
  const peak = meterPeakScalar(meterPeak);
  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-l shadow-[2px_0_8px_rgba(0,0,0,0.35)]"
      style={{ width: MIXER_STRIP_W, borderColor: "#050506", background: LOGIC_MIX.stripGradient }}
    >
      <MixerSlotRow label="Setting">
        <div className={`${LOGIC_MIX.headerMini} w-full rounded-[4px] border border-[#2a2a2e] bg-[#252528] py-0.5`}>
          Master
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Gain Reduction">
        <div className="flex w-full justify-center px-1">
          <div className={LOGIC_MIX.grMeter} />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className={LOGIC_MIX.fxBlue}>Limiter</div>
      </MixerSlotRow>
      <MixerSlotRow label="MIDI FX">
        <div className={LOGIC_MIX.slotDark}>{"—"}</div>
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className={`${LOGIC_MIX.slotIn} text-[8px]`}>∞</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <div className="flex w-full flex-col gap-[2px]">
          <MixerStack items={["Limiter"]} tone="blue" />
          <InsertRowPlaceholder />
        </div>
      </MixerSlotRow>
      <MixerSlotRow label="Sends">
        <div className={LOGIC_MIX.slotDark} />
      </MixerSlotRow>
      <MixerSlotRow label="Output">
        <div className={LOGIC_MIX.slotIn}>Master</div>
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className={`${LOGIC_MIX.slotDark} text-[#666]`}>Group</div>
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button type="button" className={LOGIC_MIX.readBtn}>
          Read
        </button>
      </MixerSlotRow>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 36, height: 36 }}
      >
        <div className={LOGIC_MIX.iconWell}>
          <svg style={{ color: "#9b4d96", width: 22, height: 22 }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.2L19.2 8 12 11.8 4.8 8 12 4.2z" />
          </svg>
        </div>
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 32, height: 32 }}
      >
        <PanKnob value={0} onChange={() => {}} size={26} showValueLabel={false} />
      </div>
      <div
        className="flex items-stretch justify-center gap-0.5 border-b px-0.5 py-px"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 21, height: 21 }}
      >
        <span className={LOGIC_MIX.readout}>{faderToDbLabel(daw.masterVolume)}</span>
        <span className={`${LOGIC_MIX.readout} ${LOGIC_MIX.readoutPeak}`}>{peakToDbDisplay(peak)}</span>
      </div>
      <div
        className="border-b"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: MIXER_METER_H + 6, height: MIXER_METER_H + 6 }}
      >
        <VerticalMixerFader
          value={daw.masterVolume}
          meterPeak={meterPeak}
          dualMeters
          onChange={(value) => daw.setMasterVolume(value)}
          ariaLabel="Master volume"
        />
      </div>
      <div
        className="flex items-center justify-center border-b py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 22, height: 22 }}
        aria-hidden
      >
        <span className="text-[8px] font-medium text-[#555]">&#8203;</span>
      </div>
      <div
        className="flex items-center justify-center gap-1.5 py-0.5"
        style={{ borderColor: LOGIC_MIX.rowLine, minHeight: 26, height: 26, borderBottomWidth: 1, borderBottomStyle: "solid" }}
      >
        <button
          type="button"
          className="h-7 w-8 rounded-[4px] border border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[11px] font-bold text-[#eee] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          title="Mute"
        >
          M
        </button>
        <button
          type="button"
          className="h-7 w-8 rounded-[4px] border border-[#3a3a40] bg-gradient-to-b from-[#4f4f56] to-[#36363c] text-[11px] font-bold text-[#eee] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          title="Dim"
        >
          D
        </button>
      </div>
      <div
        className="mt-auto flex min-h-[22px] items-center justify-center truncate border-t px-0.5 py-0.5 text-center text-[9px] font-bold leading-none text-white"
        style={{
          backgroundColor: "#8b3d8a",
          borderColor: "#000",
          textShadow: "0 1px 2px rgba(0,0,0,0.65)",
        }}
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
  loopStartSec,
  loopEndSec,
  setLoopRegionSec,
  onSeek,
  scrollLeft,
  scrollContainerRef,
}: {
  barW: number;
  widthPx: number;
  end: number;
  tempo: number;
  beatsPerBar: number;
  currentTime: number;
  loopEnabled: boolean;
  loopStartSec: number;
  loopEndSec: number;
  setLoopRegionSec: (a: number, b: number) => void;
  onSeek: (t: number) => void;
  scrollLeft: number;
  /** Main arrange scroll element — live scrollLeft fixes drag while scrolled; must exclude track header from X math. */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const dragStartRef = useRef({
    x: 0,
    loopStart: 0,
    loopEnd: 0,
    /** Seconds: playhead time minus timeline sec at pointer (grabs triangle, not only line). */
    playheadOffsetSec: 0,
    /** Timeline content px at cycle-body drag start. */
    startTimelinePx: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const totalBars = Math.max(TIMELINE_BAR_LIMIT, Math.ceil(end / secPerBar(tempo, beatsPerBar)) + 1);

  const pxToSecLocal = (px: number) => Math.max(0, px / PX_PER_SEC);

  /** X position in timeline content space (0 = bar 1 origin), same as ruler click-seek. */
  const timelineContentXFromClient = (clientX: number) => {
    const outer = containerRef.current?.getBoundingClientRect();
    if (!outer) return 0;
    const timelineViewportLeft = outer.left + TRACK_HEADER_W;
    const sc = scrollContainerRef.current?.scrollLeft ?? scrollLeft;
    return sc + (clientX - timelineViewportLeft);
  };

  const handleMouseDown = (e: MouseEvent, type: "playhead" | "cycleLeft" | "cycleRight" | "cycleBody") => {
    e.preventDefault();
    e.stopPropagation();
    const tx0 = timelineContentXFromClient(e.clientX);
    if (type === "playhead") {
      dragStartRef.current = {
        x: e.clientX,
        loopStart: loopStartSec,
        loopEnd: loopEndSec,
        playheadOffsetSec: currentTime - pxToSecLocal(tx0),
        startTimelinePx: 0,
      };
    } else if (type === "cycleBody") {
      dragStartRef.current = {
        x: e.clientX,
        loopStart: loopStartSec,
        loopEnd: loopEndSec,
        playheadOffsetSec: 0,
        startTimelinePx: tx0,
      };
    } else {
      dragStartRef.current = {
        x: e.clientX,
        loopStart: loopStartSec,
        loopEnd: loopEndSec,
        playheadOffsetSec: 0,
        startTimelinePx: 0,
      };
    }

    const onMove = (ev: globalThis.MouseEvent) => {
      const tx = timelineContentXFromClient(ev.clientX);

      if (type === "playhead") {
        onSeek(Math.max(0, pxToSecLocal(tx) + dragStartRef.current.playheadOffsetSec));
      } else if (type === "cycleLeft") {
        const hi = dragStartRef.current.loopEnd;
        const t = Math.max(0, Math.min(pxToSecLocal(tx), hi - 0.05));
        setLoopRegionSec(t, hi);
      } else if (type === "cycleRight") {
        const lo = dragStartRef.current.loopStart;
        setLoopRegionSec(lo, Math.max(lo + 0.05, pxToSecLocal(tx)));
      } else if (type === "cycleBody") {
        const dSec = (tx - dragStartRef.current.startTimelinePx) / PX_PER_SEC;
        const lo = dragStartRef.current.loopStart + dSec;
        const hi = dragStartRef.current.loopEnd + dSec;
        setLoopRegionSec(lo, hi);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const cycleLeftPx = loopStartSec * PX_PER_SEC;
  const cycleRightPx = loopEndSec * PX_PER_SEC;
  const playheadPx = currentTime * PX_PER_SEC;
  const spbLoop = secPerBar(tempo, beatsPerBar);
  const cycleStartBar = Math.floor(loopStartSec / spbLoop);
  const cycleEndBar = Math.max(cycleStartBar + 1, Math.ceil(loopEndSec / spbLoop));

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
              className="absolute top-0 bottom-0 cursor-move select-none"
              title={loopEnabled ? "Drag cycle region" : "Drag cycle region (enable Cycle)"}
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
                title="Drag cycle start"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, "cycleLeft");
                }}
                style={{ borderLeft: "2px solid #8a7028" }}
              />
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                title="Drag cycle end"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, "cycleRight");
                }}
                style={{ borderRight: "2px solid #8a7028" }}
              />
              {Array.from({ length: cycleEndBar - cycleStartBar }).map((_, i) => (
                <span
                  key={i}
                  className="absolute top-0 font-mono text-[9px] font-bold"
                  style={{ left: i * barW + 4, color: loopEnabled ? "#5a3a10" : "#444" }}
                >
                  {cycleStartBar + i + 1}
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

type ArrangeEditTool =
  | "pointer"
  | "pencil"
  | "eraser"
  | "text"
  | "scissors"
  | "glue"
  | "solo"
  | "mute"
  | "zoom"
  | "automation"
  | "flex";

function DawChrome() {
  const daw = useDaw();
  const [editorTab, setEditorTab] = useState<"clip" | "piano">("clip");
  const [selection, setSelection] = useState<ClipSelection>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainView, setMainView] = useState<"studio" | "edit" | "mixer">("studio");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [focusWorkbench, setFocusWorkbench] = useState(false);
  const [mixerFilter, setMixerFilter] = useState("Tracks");
  const [arrangeTool, setArrangeTool] = useState<ArrangeEditTool>("pointer");
  const fileRef = useRef<HTMLInputElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const importTrackRef = useRef<string>("");
  const arrangeScrollRef = useRef<HTMLDivElement>(null);
  const [arrangeScrollLeft, setArrangeScrollLeft] = useState(0);
  const [, setClipDragTick] = useState(0);
  const clipDragRef = useRef<{
    trackId: string;
    clipId: string;
    origStart: number;
    startClientX: number;
    scroll0: number;
    previewStart: number;
    grabOffsetSec: number;
  } | null>(null);
  const trimDragRef = useRef<{
    clipId: string;
    trackId: string;
    edge: "left" | "right";
    startClientX: number;
    scroll0: number;
    previewDeltaSec: number;
  } | null>(null);
  const [, setTrimDragTick] = useState(0);

  /* responsive defaults handled in useState initializers above */

  const barW = secPerBar(daw.tempo, daw.beatsPerBar) * PX_PER_SEC;
  const minimumTimelineEnd = secPerBar(daw.tempo, daw.beatsPerBar) * TIMELINE_BAR_LIMIT;

  const end = useMemo(() => {
    return Math.max(90, minimumTimelineEnd, getTimelineEndSec(daw.tracks, daw.tempo));
  }, [daw.tracks, daw.tempo, minimumTimelineEnd]);

  const widthPx = Math.ceil(end * PX_PER_SEC) + 160;

  const exclusiveSoloSelection = useMemo(() => {
    const sel = daw.selectedTrackId;
    if (!sel) return false;
    const soloed = daw.tracks.filter((t) => t.solo);
    return soloed.length === 1 && soloed[0].id === sel;
  }, [daw.tracks, daw.selectedTrackId]);

  const arrangeToolBtn = (id: ArrangeEditTool) =>
    arrangeTool === id ? ctrlBtnActive : ctrlBtnBase;

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
    const onMove = (e: globalThis.MouseEvent) => {
      const d = clipDragRef.current;
      if (!d) return;
      const scrollEl = arrangeScrollRef.current;
      if (!scrollEl) return;
      const lane = document.querySelector(`[data-timeline-lane="${d.trackId}"]`) as HTMLElement | null;
      const sc = scrollEl.scrollLeft;
      const pointerSec = timelineSecFromClient(e.clientX, sc, lane);
      d.previewStart = Math.max(0, pointerSec - d.grabOffsetSec);
      setClipDragTick((t) => t + 1);
    };
    const onUp = () => {
      const d = clipDragRef.current;
      clipDragRef.current = null;
      if (d) {
        const nextStart = Math.max(0, snapMoveTime(d.previewStart));
        daw.moveClip(d.trackId, d.clipId, nextStart);
      }
      setClipDragTick((t) => t + 1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [daw]);

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      const d = trimDragRef.current;
      if (!d) return;
      const sc = arrangeScrollRef.current?.scrollLeft ?? 0;
      const dxPx = e.clientX - d.startClientX + (sc - d.scroll0);
      d.previewDeltaSec = pxToSec(dxPx);
      setTrimDragTick((t) => t + 1);
    };
    const onUp = () => {
      const d = trimDragRef.current;
      trimDragRef.current = null;
      if (d && d.previewDeltaSec !== 0) daw.trimClipEdge(d.clipId, d.edge, d.previewDeltaSec);
      setTrimDragTick((t) => t + 1);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [daw]);

  useEffect(() => {
    if (mainView === "mixer") return;
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
      onDragEnter={(e: DragEvent) => {
        if (!dataTransferHasFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e: DragEvent) => {
        if (!dataTransferHasFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e: DragEvent) => {
        if (!dataTransferHasFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        const file = firstAudioFileFromDataTransfer(e.dataTransfer);
        if (!file) return;
        const newId = daw.addTrackWithKind("import_audio");
        void daw.importAudioFile(newId, file);
      }}
    >
      <input
        id={WSTUDIO_AUDIO_FILE_INPUT_ID}
        ref={fileRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac,.webm,audio/wav,audio/x-wav"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const tid = importTrackRef.current || targetTrackId;
          importTrackRef.current = "";
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
        audioFileInputId={WSTUDIO_AUDIO_FILE_INPUT_ID}
        onPrepareImportAudio={() => {
          const id = daw.addTrackWithKind("import_audio");
          importTrackRef.current = id;
        }}
        onPick={(kind) => {
          daw.addTrackWithKind(kind);
        }}
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
              title="Mixer / Console"
              onClick={() => daw.sessionCapabilities.canOpenFullMixer && setMainView("mixer")}
              disabled={!daw.sessionCapabilities.canOpenFullMixer}
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
            <button
              type="button"
              title="Stop"
              onClick={() => {
                if (daw.isRecording) daw.stopRecord();
                daw.stopTransport();
              }}
              className={ctrlBtnBase}
            >
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
              disabled={!daw.isRecording && !daw.sessionCapabilities.canArmRecord}
              onClick={() => {
                if (daw.isRecording) daw.stopRecord();
                else void daw.startRecord();
              }}
              className={`${ctrlBtnBase} text-[#ffb0b0] ${daw.isRecording ? "animate-pulse ring-2 ring-red-500 ring-offset-1 ring-offset-[#5a5a5e]" : ""} disabled:opacity-40`}
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

          {daw.isRecording || daw.tracks.some((t) => t.recordArm) ? (
            <div className="flex flex-col items-center px-1">
              <span
                className={`text-[7px] font-bold uppercase ${daw.isRecording ? "text-[#faa]" : "text-[#9ad]"}`}
              >
                {daw.isRecording ? "In" : "Mic"}
              </span>
              {(() => {
                const armed = daw.tracks.find((t) => t.recordArm);
                const stereo = armed ? resolveStereo(trackToChannelConfig(armed)) : false;
                const lv = daw.isRecording
                  ? (() => {
                      const m = daw.meterPeaks.__mic__;
                      if (m != null && typeof m === "object" && "left" in m)
                        return m as { left: number; right: number };
                      const s = meterPeakScalar(m);
                      return { left: s, right: s };
                    })()
                  : daw.armedMicLevels;
                const maxPeak = Math.max(lv.left, lv.right);
                const isClipping = maxPeak >= 0.98;
                const hotLevel = maxPeak >= 0.92;
                return (
                  <div className="mt-0.5 flex flex-col items-center gap-0.5" title="Dry input level — aim ~−12 to −6 dBFS; no limiter on record path">
                    <ChannelMeter
                      levelL={lv.left}
                      levelR={lv.right}
                      isStereo={stereo}
                      height={48}
                      barWidth={stereo ? 5 : 8}
                    />
                    {isClipping ? (
                      <span className="max-w-[56px] text-center text-[6px] font-bold leading-tight text-[#ff3b30]">
                        Clip — lower gain
                      </span>
                    ) : hotLevel ? (
                      <span className="max-w-[56px] text-center text-[6px] font-semibold text-[#ffcc00]">Hot</span>
                    ) : armed?.kind === "record_audio" && maxPeak > 0.02 && maxPeak < 0.2 ? (
                      <span className="max-w-[56px] text-center text-[6px] text-[#9ad]">Raise toward −12…−6 dB</span>
                    ) : null}
                  </div>
                );
              })()}
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
              title="Solo selected track only (toggle)"
              onClick={() => daw.toggleExclusiveSoloSelection()}
              className={`h-7 min-w-[30px] rounded-[3px] border text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
                exclusiveSoloSelection
                  ? "border-[#886600] bg-[#e8d44a] text-[#111]"
                  : `${ctrlBtn} border-[#5a5a5e] bg-gradient-to-b from-[#727276] to-[#5a5a5e] text-[#eee]`
              }`}
            >
              S
            </button>
            <button
              type="button"
              title="Mute main mix (master)"
              onClick={() => daw.setMasterMuted(!daw.masterMuted)}
              className={`h-7 min-w-[30px] rounded-[3px] border text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ${
                daw.masterMuted
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
              disabled={!daw.sessionCapabilities.canAdjustMaster}
              onChange={(e) => daw.setMasterVolume(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer disabled:opacity-40"
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
            <button
              type="button"
              title="Loop Browser"
              disabled={!daw.sessionCapabilities.canBrowseLoops}
              onClick={() =>
                daw.sessionCapabilities.canBrowseLoops &&
                daw.setStudioToolSheet(daw.studioToolSheet === "loops_browser" ? null : "loops_browser")
              }
              className={daw.studioToolSheet === "loops_browser" ? ctrlBtnActive : ctrlBtnBase}
            >
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
              title="Studio — tracking & tools"
              onClick={() => {
                setMainView("studio");
                setEditorsOpen(false);
              }}
              className={
                mainView === "studio"
                  ? `${ctrlBtnActive} px-2 text-[9px] font-semibold`
                  : `${ctrlBtnBase} px-2 text-[9px]`
              }
            >
              Studio
            </button>
            <button
              type="button"
              title="Edit — timeline tools & editors"
              onClick={() => {
                setMainView("edit");
                setEditorsOpen(true);
              }}
              className={
                mainView === "edit"
                  ? `${ctrlBtnActive} px-2 text-[9px] font-semibold`
                  : `${ctrlBtnBase} px-2 text-[9px]`
              }
            >
              Edit
            </button>
            <button
              type="button"
              title="Mixer"
              onClick={() => daw.sessionCapabilities.canOpenFullMixer && setMainView("mixer")}
              disabled={!daw.sessionCapabilities.canOpenFullMixer}
              className={
                mainView === "mixer"
                  ? `${ctrlBtnActive} px-2 text-[9px] font-semibold`
                  : `${ctrlBtnBase} px-2 text-[9px]`
              }
            >
              Mixer
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
              disabled={!daw.sessionCapabilities.canManageTracks}
              onClick={() => daw.sessionCapabilities.canManageTracks && setModalOpen(true)}
            >
              +Tr
            </button>
            <button
              type="button"
              title="Import audio file into new track"
              className={`${ctrlBtnBase} px-2 text-[9px]`}
              onClick={() => {
                const newId = daw.addTrackWithKind("import_audio");
                openImport(newId);
              }}
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
              disabled={!daw.sessionCapabilities.canImportExportProject}
              onClick={() => daw.sessionCapabilities.canImportExportProject && daw.exportProjectJson()}
            >
              Save
            </button>
            <button
              type="button"
              title="Load project"
              className={`${ctrlBtnBase} px-2 text-[9px]`}
              disabled={!daw.sessionCapabilities.canImportExportProject}
              onClick={() =>
                daw.sessionCapabilities.canImportExportProject && projectFileRef.current?.click()
              }
            >
              Load
            </button>
          </div>
        </div>

        {mainView === "studio" ? (
          <div
            className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t px-2 py-1"
            style={{ borderColor: LP.border, background: LP.panelLo }}
          >
            <span
              className="mr-1 text-[8px] font-semibold uppercase tracking-wide"
              style={{ color: LP.textMuted }}
            >
              Studio tools
            </span>
            {(
              [
                { id: "keyboard" as const, label: "Keyboard" },
                { id: "beat_maker" as const, label: "Beat maker" },
                { id: "loops_browser" as const, label: "Loops" },
                { id: "instruments" as const, label: "Instruments" },
                { id: "fx_rack" as const, label: "FX rack" },
              ] as const
            ).map((tool) => {
              const disabled =
                (tool.id === "keyboard" && !daw.sessionCapabilities.canOpenKeyboard) ||
                (tool.id === "beat_maker" && !daw.sessionCapabilities.canOpenBeatTools) ||
                (tool.id === "loops_browser" && !daw.sessionCapabilities.canBrowseLoops) ||
                (tool.id === "instruments" && !daw.sessionCapabilities.canOpenKeyboard) ||
                (tool.id === "fx_rack" && !daw.sessionCapabilities.canManageFxRack);
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.label}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    daw.setStudioToolSheet(daw.studioToolSheet === tool.id ? null : tool.id);
                  }}
                  className={
                    daw.studioToolSheet === tool.id
                      ? `${ctrlBtnActive} px-2 text-[9px] font-medium`
                      : `${ctrlBtnBase} px-2 text-[9px]`
                  }
                >
                  {tool.label}
                </button>
              );
            })}
            <button
              type="button"
              title="Sample / loop library drawer"
              className={`${ctrlBtnBase} ml-auto px-2 text-[9px]`}
              onClick={() => setLibraryOpen(true)}
            >
              Library
            </button>
          </div>
        ) : null}

        {mainView === "edit" ? (
          <>
            {/* Row 2: Logic-style macro buttons (icon above label, monochrome) */}
            <div
              className="flex flex-wrap items-end gap-x-2 gap-y-1 border-t px-2 py-1 overflow-x-auto"
              style={{
                borderColor: LP.border,
                background: `linear-gradient(180deg, ${LP.panel} 0%, ${LP.panelLo} 100%)`,
              }}
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
          <button type="button" title="Pointer tool" className={arrangeToolBtn("pointer")} onClick={() => setArrangeTool("pointer")}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M3 1l9 6-4 1 2 5-2 1-2-5-3 3z" />
            </svg>
          </button>
          <button type="button" title="Pencil tool" className={arrangeToolBtn("pencil")} onClick={() => setArrangeTool("pencil")}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M10 2l4 4-9 9H1v-4z" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" title="Eraser tool" className={arrangeToolBtn("eraser")} onClick={() => setArrangeTool("eraser")}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
              <path d="M9.2 2.5l4.3 4.3-6 6-3-1-1-3 5.7-6.3z" strokeLinejoin="round" />
              <path d="M3 14l3-1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Text tool" className={arrangeToolBtn("text")} onClick={() => setArrangeTool("text")}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M5 3h6M8 3v8M5 13h6" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Scissors" className={arrangeToolBtn("scissors")} onClick={() => setArrangeTool("scissors")}>
            <IconScissors />
          </button>
          <button type="button" title="Glue" className={arrangeToolBtn("glue")} onClick={() => setArrangeTool("glue")}>
            <IconGlue />
          </button>
          <button
            type="button"
            title="Solo tool (region-style editing — mode only for now)"
            className={arrangeToolBtn("solo")}
            onClick={() => setArrangeTool("solo")}
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path d="M2.5 10V6c0-2 2.5-3.8 5.5-3.8S13.5 4 13.5 6v4" strokeLinecap="round" />
              <path d="M2.5 10c0 2 2.5 3.5 5.5 3.5S13.5 12 13.5 10" strokeLinecap="round" />
              <path d="M8 14v1.8M6 16h4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            title="Mute tool (region-style editing — mode only for now)"
            className={arrangeToolBtn("mute")}
            onClick={() => setArrangeTool("mute")}
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path
                d="M3 6.5h3l3-2v9l-3-2H3V6.5z"
                strokeLinejoin="round"
              />
              <path d="M11.5 5.5l3 5M14.5 5.5l-3 5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Zoom tool" className={arrangeToolBtn("zoom")} onClick={() => setArrangeTool("zoom")}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <circle cx="7" cy="7" r="4" />
              <path d="M10 10l4 4" strokeLinecap="round" />
              <path d="M5 7h4M7 5v4" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" title="Automation" className={arrangeToolBtn("automation")} onClick={() => setArrangeTool("automation")}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
              <path d="M1 12l4-8 4 6 6-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" title="Flex" className={arrangeToolBtn("flex")} onClick={() => setArrangeTool("flex")}>
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
          </>
        ) : null}
      </header>

      {daw.studioToolSheet && mainView !== "mixer" ? (
        <div
          className="flex shrink-0 flex-col gap-1 border-b px-3 py-2"
          style={{ borderColor: LP.border, background: LP.panel }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold" style={{ color: LP.text }}>
              {STUDIO_TOOL_SHEET_COPY[daw.studioToolSheet].title}
            </span>
            <button
              type="button"
              className="rounded border px-2 py-0.5 text-[9px]"
              style={{ borderColor: LP.border, color: LP.textMuted }}
              onClick={() => daw.setStudioToolSheet(null)}
            >
              Close
            </button>
          </div>
          <p className="text-[9px] leading-snug" style={{ color: LP.textMuted }}>
            {STUDIO_TOOL_SHEET_COPY[daw.studioToolSheet].blurb}
          </p>
        </div>
      ) : null}

      {mainView === "mixer" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "#2c2c2f" }}>
          <LogicMixerFilterBar active={mixerFilter} onPick={setMixerFilter} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Inspector in mixer view */}
            {inspectorOpen && (
              <aside
                className="flex shrink-0 flex-col border-r"
                style={{ borderColor: "#0a0a0b", background: "#2a2a2d", width: INSPECTOR_PANEL_W }}
              >
                <TrackInspector trackId={targetTrackId} />
              </aside>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 items-stretch" style={{ background: "#262628" }}>
              <div
                className="flex min-h-0 min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-auto"
                style={{ background: "#262628" }}
              >
                <MixerLabelColumn />
                {daw.tracks.map((t) => (
                  <MixerStrip
                    key={t.id}
                    track={t}
                    peak={daw.meterPeaks[t.id] ?? 0}
                    fileInputTrigger={() => openImport(t.id)}
                  />
                ))}
                {MIXER_BUS_STRIPS.map((bid) => (
                  <BusMixerStrip key={bid} busId={bid} />
                ))}
                <div className="min-w-[32px] shrink-0 grow" style={{ background: "#262628" }} aria-hidden />
              </div>
              <div
                className="flex shrink-0 self-stretch border-l border-[#0a0a0a] shadow-[-6px_0_14px_rgba(0,0,0,0.35)]"
                style={{ background: "#262628" }}
              >
                <StereoOutStrip />
                <MasterMixerStrip />
              </div>
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
                loopStartSec={daw.loopStartSec}
                loopEndSec={daw.loopEndSec}
                setLoopRegionSec={daw.setLoopRegionSec}
                onSeek={(t) => daw.seek(t)}
                scrollLeft={arrangeScrollLeft}
                scrollContainerRef={arrangeScrollRef}
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
                    disabled={!daw.sessionCapabilities.canManageTracks}
                    onClick={() => daw.sessionCapabilities.canManageTracks && setModalOpen(true)}
                    className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[12px] text-[#ccc] hover:bg-[#555] disabled:opacity-40"
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
                onDragEnter={(e: DragEvent) => {
                  if (!dataTransferHasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragOver={(e: DragEvent) => {
                  if (!dataTransferHasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e: DragEvent) => {
                  if (!dataTransferHasFiles(e.dataTransfer)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const file = firstAudioFileFromDataTransfer(e.dataTransfer);
                  if (!file) return;
                  const newId = daw.addTrackWithKind("import_audio");
                  void daw.importAudioFile(newId, file);
                }}
              >
                {daw.tracks.map((tr, ti) => (
                  <div
                    key={tr.id}
                    className="flex shrink-0 border-b"
                    style={{
                      height: TRACK_ROW_MIN_H,
                      minHeight: TRACK_ROW_MIN_H,
                      minWidth: TRACK_HEADER_W + widthPx,
                      borderColor: LP.border,
                      background: daw.selectedTrackId === tr.id ? "rgba(60,120,200,0.14)" : LP.panel,
                    }}
                    onDragOver={(e: DragEvent) => {
                      if (!dataTransferHasFiles(e.dataTransfer)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(e: DragEvent) => {
                      if (!dataTransferHasFiles(e.dataTransfer)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const file = firstAudioFileFromDataTransfer(e.dataTransfer);
                      if (file) void daw.importAudioFile(tr.id, file);
                    }}
                  >
                    <div
                      className="sticky left-0 z-10 flex h-full shrink-0 border-r"
                      style={{
                        width: TRACK_HEADER_W,
                        borderColor: LP.border,
                        background: daw.selectedTrackId === tr.id ? "rgba(92, 122, 168, 0.92)" : LP.panel,
                      }}
                    >
                      <div className="w-1 shrink-0 self-stretch" style={{ backgroundColor: tr.color }} />
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0 px-1 py-0">
                        <div className="flex items-center gap-0.5">
                          <span className="w-3 shrink-0 text-center font-mono text-[7px] text-[#888]">{ti + 1}</span>
                          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                            <IconWaveInst />
                          </span>
                          <input
                            className="min-w-0 flex-1 truncate border border-transparent bg-transparent text-[9px] font-semibold leading-tight outline-none"
                            style={{ color: LP.text }}
                            value={tr.name}
                            onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
                            onClick={() => daw.setSelectedTrackId(tr.id)}
                          />
                        </div>
                        <div className="flex h-[22px] shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            title="Mute"
                            className="h-4 w-4 shrink-0 rounded-full border text-[6px] font-bold"
                            style={{
                              borderColor: "#3a3a3e",
                              background: tr.muted ? LP.muteOn : "#3a3a3e",
                              color: tr.muted ? "#022" : "#bbb",
                            }}
                            onClick={() => daw.toggleMute(tr.id)}
                          >
                            M
                          </button>
                          <button
                            type="button"
                            title="Solo"
                            className="h-4 w-4 shrink-0 rounded-full border text-[6px] font-bold"
                            style={{
                              borderColor: "#3a3a3e",
                              background: tr.solo ? LP.solo : "#3a3a3e",
                              color: tr.solo ? "#111" : "#bbb",
                            }}
                            onClick={() => daw.toggleSolo(tr.id)}
                          >
                            S
                          </button>
                          <button
                            type="button"
                            title="Record arm"
                            disabled={!daw.sessionCapabilities.canArmRecord}
                            className="h-4 w-4 shrink-0 rounded-full border text-[6px] font-bold disabled:opacity-40"
                            style={{
                              borderColor: "#3a3a3e",
                              background: tr.recordArm ? LP.record : "#3a3a3e",
                              color: tr.recordArm ? "#fff" : "#bbb",
                            }}
                            onClick={() =>
                              daw.sessionCapabilities.canArmRecord && daw.toggleRecordArm(tr.id)
                            }
                          >
                            R
                          </button>
                          <button
                            type="button"
                            title="Input monitoring (headphones) — live to master; not recorded"
                            onClick={() => daw.toggleInputMonitoring(tr.id)}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                            style={{
                              borderColor: tr.inputMonitoring ? "#4a78c8" : "#3a3a3e",
                              background: tr.inputMonitoring ? "#3478f6" : "#3a3a3e",
                              color: tr.inputMonitoring ? "#fff" : "#bbb",
                              zIndex: 20,
                              pointerEvents: "auto",
                              cursor: "pointer",
                            }}
                          >
                            <Headphones size={10} strokeWidth={2.2} aria-hidden />
                          </button>
                          {(() => {
                            const peak = meterPeakScalar(daw.meterPeaks[tr.id]);
                            const signalPct = Math.min(100, peak * 110);
                            const volPct = tr.volume * 100;
                            return (
                              <>
                                <div
                                  className="relative h-3.5 w-1 shrink-0 overflow-hidden rounded-sm border border-[#1f1f22] bg-[#0a0a0c]"
                                  style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)" }}
                                  title="Level"
                                >
                                  <div
                                    className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
                                    style={{
                                      height: `${Math.min(100, signalPct)}%`,
                                      background: `linear-gradient(to top, ${LP.meterGreen}, ${LP.meterYel})`,
                                    }}
                                  />
                                </div>
                                <div
                                  className="relative mx-0.5 h-3 min-w-[48px] flex-1 overflow-hidden rounded-full"
                                  style={{ background: "#2a2a2e", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.65)" }}
                                >
                                  {signalPct > 0.5 && (
                                    <div
                                      className="absolute bottom-0 left-0 top-0 rounded-full transition-[width] duration-75"
                                      style={{
                                        width: `${Math.min(volPct, signalPct)}%`,
                                        background: "linear-gradient(to right, #2d6a2d, #4ecb4e)",
                                      }}
                                    />
                                  )}
                                  <div
                                    className="absolute bottom-0 left-0 top-0 rounded-full"
                                    style={{
                                      width: `${volPct}%`,
                                      background:
                                        signalPct > 0.5
                                          ? "transparent"
                                          : "linear-gradient(to right, #4a4a50, #5c5c64)",
                                      opacity: signalPct > 0.5 ? 0 : 0.65,
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
                                    className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-[#666] bg-gradient-to-b from-[#ddd] to-[#888] shadow"
                                    style={{ left: `calc(${volPct}% - 5px)` }}
                                  />
                                </div>
                              </>
                            );
                          })()}
                          <PanKnob value={tr.pan} onChange={(v) => daw.setTrackPan(tr.id, v)} size={22} />
                        </div>
                      </div>
                    </div>

                    <div
                      className="relative h-full min-h-0 shrink-0"
                      data-timeline-lane={tr.id}
                      style={{ width: widthPx, height: TRACK_ROW_MIN_H }}
                      onDragOver={(e: DragEvent) => {
                        if (!dataTransferHasFiles(e.dataTransfer)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e: DragEvent) => {
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
                        className="relative h-full min-h-0"
                        style={{
                          width: widthPx,
                          height: TRACK_ROW_MIN_H,
                          backgroundColor: LP.panelLo,
                          backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${Math.max(1, barW - 1)}px, rgba(0,0,0,0.12) ${Math.max(1, barW - 1)}px, rgba(0,0,0,0.12) ${barW}px)`,
                        }}
                        onDragOver={(e: DragEvent) => {
                          if (!dataTransferHasFiles(e.dataTransfer)) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e: DragEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
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
                                  top: Math.max(4, Math.round((TRACK_ROW_MIN_H - 10) / 2)),
                                  width: w,
                                  height: 10,
                                  backgroundColor: tr.color,
                                }}
                                title="MIDI"
                              />
                            );
                          });
                        })()}
                        {daw.isRecording && daw.recordingTrackId === tr.id && daw.recordingPunchInTime != null ? (
                          <div
                            className="pointer-events-none absolute z-[5] overflow-hidden rounded-[3px] border shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                            style={{
                              left: daw.recordingPunchInTime * PX_PER_SEC,
                              width: Math.max(
                                12,
                                (daw.currentTime - daw.recordingPunchInTime) * PX_PER_SEC,
                              ),
                              height: TRACK_ROW_MIN_H - 4,
                              top: 2,
                              borderColor: "rgba(248,113,113,0.85)",
                              backgroundColor: "rgba(80,20,20,0.45)",
                            }}
                            title="Live input"
                          >
                            <LivePeaksCanvas
                              peaks={daw.recordingLivePeaks}
                              width={Math.max(
                                24,
                                Math.floor((daw.currentTime - daw.recordingPunchInTime) * PX_PER_SEC),
                              )}
                              height={TRACK_ROW_MIN_H - 4}
                              color="#fca5a5"
                              fill="rgba(0,0,0,0.2)"
                            />
                          </div>
                        ) : null}
                        {tr.clips.map((c) => {
                          const ts0 = clipTrimStart(c);
                          const te0 = clipTrimEnd(c);
                          let dispTs = ts0;
                          let dispTe = te0;
                          let clipLeftSec = c.startTime;
                          const trd = trimDragRef.current;
                          if (trd && trd.clipId === c.id) {
                            if (trd.edge === "left") {
                              const newTs = Math.max(0, Math.min(te0 - 0.05, ts0 + trd.previewDeltaSec));
                              const diff = newTs - ts0;
                              dispTs = newTs;
                              dispTe = te0;
                              clipLeftSec = c.startTime + diff;
                            } else {
                              dispTs = ts0;
                              dispTe = Math.max(ts0 + 0.05, Math.min(c.buffer.duration, te0 + trd.previewDeltaSec));
                              clipLeftSec = c.startTime;
                            }
                          }
                          const d = clipDragRef.current;
                          if (d && d.trackId === tr.id && d.clipId === c.id) {
                            clipLeftSec = d.previewStart;
                          }
                          const vis = Math.max(0.001, dispTe - dispTs);
                          const w = Math.max(24, vis * PX_PER_SEC);
                          const h = TRACK_ROW_MIN_H - 4;
                          const isSel = selection?.trackId === tr.id && selection?.clipId === c.id;
                          return (
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={0}
                              className={`group absolute top-[2px] cursor-default overflow-hidden rounded-[3px] border text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none focus-visible:ring-2 ${
                                isSel ? "ring-2 ring-[#5a9eef]/80" : "hover:brightness-105"
                              }`}
                              style={{
                                left: secToPx(clipLeftSec),
                                width: w,
                                height: h,
                                backgroundColor: `${tr.color}22`,
                                borderColor: isSel ? LP.accentBlueHi : LP.border,
                              }}
                              onDragOver={(e: DragEvent) => {
                                if (!dataTransferHasFiles(e.dataTransfer)) return;
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "copy";
                              }}
                              onDrop={(e: DragEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
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
                                viewStartSec={dispTs}
                                viewEndSec={dispTe}
                              />
                              <div
                                className="absolute left-2 right-12 top-0 z-[15] cursor-grab active:cursor-grabbing"
                                style={{ height: h }}
                                onMouseDown={(e) => {
                                  if (e.button !== 0) return;
                                  e.stopPropagation();
                                  const lane = (e.currentTarget as HTMLElement).closest(
                                    "[data-timeline-lane]",
                                  ) as HTMLElement | null;
                                  const sc = arrangeScrollRef.current?.scrollLeft ?? 0;
                                  const pointerSec = timelineSecFromClient(e.clientX, sc, lane);
                                  const grabOff = pointerSec - clipLeftSec;
                                  clipDragRef.current = {
                                    trackId: tr.id,
                                    clipId: c.id,
                                    origStart: c.startTime,
                                    startClientX: e.clientX,
                                    scroll0: sc,
                                    previewStart: clipLeftSec,
                                    grabOffsetSec: grabOff,
                                  };
                                  setClipDragTick((t) => t + 1);
                                }}
                              />
                              <div
                                className="absolute left-0 top-0 z-20 h-full w-2 cursor-ew-resize bg-white/20 hover:bg-white/35"
                                title="Trim start"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  trimDragRef.current = {
                                    clipId: c.id,
                                    trackId: tr.id,
                                    edge: "left",
                                    startClientX: e.clientX,
                                    scroll0: arrangeScrollRef.current?.scrollLeft ?? 0,
                                    previewDeltaSec: 0,
                                  };
                                  setTrimDragTick((t) => t + 1);
                                }}
                              />
                              <div
                                className="absolute right-0 top-0 z-20 h-full w-2 cursor-ew-resize bg-white/20 hover:bg-white/35"
                                title="Trim end"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  trimDragRef.current = {
                                    clipId: c.id,
                                    trackId: tr.id,
                                    edge: "right",
                                    startClientX: e.clientX,
                                    scroll0: arrangeScrollRef.current?.scrollLeft ?? 0,
                                    previewDeltaSec: 0,
                                  };
                                  setTrimDragTick((t) => t + 1);
                                }}
                              />
                              <button
                                type="button"
                                className="absolute right-2 top-0 z-30 hidden rounded-bl bg-black/55 px-1.5 py-0.5 text-[11px] text-white group-hover:inline"
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

      {editorsOpen && daw.sessionCapabilities.canEditTimeline ? (
        <footer
          className={`flex shrink-0 flex-col border-t ${
            editorTab === "piano" ? "min-h-[240px] flex-1 lg:h-[min(320px,40vh)] lg:max-h-[420px]" : "h-[180px]"
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
            {editorTab === "clip" && selectedClip && selectedTrack && selection ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                <div className="flex min-h-0 flex-1 items-center gap-3">
                  <div className="h-1 w-10 shrink-0 rounded" style={{ backgroundColor: selectedTrack.color }} />
                  <div
                    className="min-h-0 min-w-0 flex-1 rounded border"
                    style={{ borderColor: LP.border, background: "#2a2a2a" }}
                  >
                    <WaveformCanvas
                      buffer={selectedClip.buffer}
                      width={Math.min(1200, editorWavWidth)}
                      height={88}
                      color="#e8e8e8"
                      fill="rgba(0,0,0,0.45)"
                      viewStartSec={clipTrimStart(selectedClip)}
                      viewEndSec={clipTrimEnd(selectedClip)}
                    />
                  </div>
                </div>
                <div
                  className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3"
                  style={{ color: LP.text }}
                >
                  <span className="min-w-0 text-[10px] font-semibold uppercase tracking-wide" style={{ color: LP.textMuted }}>
                    {selectedClip.name ?? "Clip"}
                  </span>
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px]" htmlFor="wstudio-clip-gain">
                    <span className="shrink-0" style={{ color: LP.textMuted }}>
                      Gain
                    </span>
                    <input
                      id="wstudio-clip-gain"
                      type="range"
                      min={0}
                      max={4}
                      step={0.01}
                      value={selectedClip.clipGain ?? 1}
                      onChange={(e) =>
                        daw.setClipGain(selection.trackId, selection.clipId, Number(e.target.value))
                      }
                      className="h-1.5 min-w-[120px] flex-1 cursor-pointer accent-[#5a9eef]"
                    />
                    <span className="w-[72px] shrink-0 tabular-nums" title="Linear gain → dB">
                      {linearGainToDbLabel(selectedClip.clipGain ?? 1)}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded border px-2 py-0.5 text-[10px] hover:bg-white/5"
                      style={{ borderColor: LP.border, color: LP.textMuted }}
                      onClick={() => daw.setClipGain(selection.trackId, selection.clipId, 1)}
                    >
                      0 dB
                    </button>
                  </label>
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
        Record, Loop, Metronome. While recording (without Play), the playhead advances and a live waveform strip grows on
        the armed track. <span className="text-zinc-100">Control bar S</span> solos the selected track only;{" "}
        <span className="text-zinc-100">M</span> mutes the main mix. Drag clips horizontally to move them in time.
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
