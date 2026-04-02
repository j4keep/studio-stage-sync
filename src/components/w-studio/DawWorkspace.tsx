import { useEffect, useMemo, useRef, useState } from 'react';
import type { TrackKind } from './types';
import {
  EFFECT_PRESET_LABELS,
  EQ_PRESET_LABELS,
  LIBRARY_BY_CATEGORY,
  SPACE_PRESET_LABELS,
  faderToDbLabel,
  getTimelineEndSec,
} from './audio';
import { MIC_CHAIN_PRESETS } from './micPresets';
import { REMOTE_LIBRARY_BY_CATEGORY } from './remoteLibrary';
import { DawProvider, INPUT_SOURCE_OPTIONS, useDaw } from './DawContext';
import { PianoRoll } from './PianoRoll';
import { WaveformCanvas } from './WaveformCanvas';

const PX_PER_SEC = 52;
const TRACK_HEADER_W = 438;
/** Mixer layout — aligned with classic console strips */
const MIXER_STRIP_W = 92;
const MIXER_OUT_STRIP_W = 102;
const MIXER_METER_H = 182;
const TRACK_ROW_MIN_H = 68;

/** Logic Pro X faithful palette — medium gray, not dark */
const LP = {
  appBg: '#56565a',
  panel: '#636366',
  panelHi: '#6e6e72',
  panelLo: '#4a4a4e',
  border: '#333336',
  borderHi: '#7a7a7e',
  text: '#f0f0f0',
  textMuted: '#b0b0b4',
  lcdBg: '#0c1420',
  lcdText: '#6ec8ff',
  lcdDim: '#4a8aba',
  accentBlue: '#3478f6',
  accentBlueHi: '#5a9eef',
  ruler: '#8a8a70',
  meterGreen: '#4eca4e',
  meterYel: '#d4c44a',
  meterRed: '#e24444',
  solo: '#e8d44a',
  muteOn: '#5ab0b0',
  record: '#e03030',
  readAuto: '#4a9a4a',
  slotBg: '#505054',
  slotBorder: '#3e3e42',
  stripBg: 'linear-gradient(180deg, #636366 0%, #505054 100%)',
  channelLabelBg: '#3a3a3e',
} as const;

const ctrlBtn =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border text-[#eee] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.25)] active:translate-y-[0.5px]';
const ctrlBtnBase = `${ctrlBtn} border-[#5a5a5e] bg-gradient-to-b from-[#727276] to-[#5a5a5e] hover:from-[#7e7e82] hover:to-[#636366]`;
const ctrlBtnActive = `${ctrlBtn} border-[#3478f6] bg-gradient-to-b from-[#4a78c8] to-[#3060a0]`;

function formatSMPTE(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.min(29, Math.floor((sec % 1) * 30));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

function formatLogicBars(sec: number, bpm: number, beatsPerBar: number) {
  const beats = sec * (bpm / 60);
  const bar = Math.floor(beats / beatsPerBar) + 1;
  const beatInBar = Math.floor(beats % beatsPerBar) + 1;
  const tick = Math.min(479, Math.floor((beats % 1) * 480));
  return `${String(bar).padStart(4, '0')} ${beatInBar} 1 ${String(tick).padStart(3, '0')}`;
}

function secPerBar(bpm: number, beatsPerBar: number) {
  return (60 / Math.max(40, bpm)) * beatsPerBar;
}

function peakToDbDisplay(p: number) {
  if (p < 0.001) return '-∞';
  const db = 20 * Math.log10(Math.max(p, 0.0001));
  return db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
}

function isAudioDropFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
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
  return `${bar}:${beat}:${String(tick).padStart(3, '0')}`;
}

function formatMs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
}

function IconInspector({ open }: { open: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="12" height="16" rx="2" />
      <path d={open ? 'M21 8l-4 4 4 4' : 'M17 8v8'} strokeLinecap="round" strokeLinejoin="round" />
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

function InspectorChannelStrip({ trackId, isStereoOut }: { trackId: string | null; isStereoOut?: boolean }) {
  const daw = useDaw();
  const tr = !isStereoOut && trackId ? daw.tracks.find((t) => t.id === trackId) : null;
  const peak = isStereoOut ? (daw.meterPeaks.__master__ ?? 0) : (tr ? (daw.meterPeaks[tr.id] ?? 0) : 0);
  const vol = isStereoOut ? daw.masterVolume : (tr?.volume ?? 0.8);
  const pan = tr?.pan ?? 0;
  const name = isStereoOut ? 'Stereo Out' : (tr?.name ?? 'Track');
  const labelColor = isStereoOut ? '#4a9a4a' : (tr?.color ?? '#60a5fa');

  return (
    <div className="flex flex-col text-[10px]" style={{ color: LP.text, minWidth: 80 }}>
      {/* Number + pan knob */}
      <div className="flex items-center gap-2 border-b px-2 py-1.5" style={{ borderColor: LP.border }}>
        <span className="rounded border border-[#555] bg-[#3a3a3e] px-2 py-0.5 font-mono text-[10px]">0</span>
        {!isStereoOut ? <PanKnob value={pan} onChange={(v) => tr && daw.setTrackPan(tr.id, v)} size={24} /> : <PanKnob value={0} onChange={() => {}} size={24} />}
      </div>
      {/* Slot rows */}
      <SlotRow label="Setting"><div className="h-4 rounded-sm bg-[#3a3a3e]" /></SlotRow>
      <SlotRow label="EQ">
        {!isStereoOut && tr ? (
          <select value={tr.eqPreset} onChange={(e) => daw.setTrackEq(tr.id, e.target.value as any)} className="w-full rounded-[2px] border border-[#4e4e52] bg-[#555558] px-1 py-[2px] text-[9px] text-[#ddd]">
            {EQ_PRESET_LABELS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : <div className="h-4 rounded-sm bg-[#3a3a3e]" />}
      </SlotRow>
      {!isStereoOut ? (
        <SlotRow label="Input">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#999]">○</span>
            <span className="text-[9px] text-[#ddd]">Input 1</span>
          </div>
        </SlotRow>
      ) : (
        <SlotRow label="">
          <div className="flex h-4 w-4 items-center justify-center text-[10px] text-[#ccc]">∞</div>
        </SlotRow>
      )}
      <SlotRow label="Audio FX">
        {!isStereoOut && tr ? (
          <select value={tr.effectPreset} onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as any)} className="w-full rounded-[2px] border border-[#4e4e52] bg-[#555558] px-1 py-[2px] text-[9px] text-[#ddd]">
            {EFFECT_PRESET_LABELS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : <div className="h-4 rounded-sm bg-[#3a3a3e]" />}
      </SlotRow>
      {!isStereoOut && (
        <SlotRow label="Sends">
          <div className="flex items-center gap-1"><div className="h-3 flex-1 rounded-sm bg-[#3a3a3e]" /><span className="h-3 w-3 rounded-full bg-[#555]" /></div>
        </SlotRow>
      )}
      {!isStereoOut && <SlotRow label="Stereo Out"><div className="h-4 rounded-sm bg-[#3a3a3e]" /></SlotRow>}
      <SlotRow label="Group"><div className="h-4 rounded-sm bg-[#3a3a3e]" /></SlotRow>
      {/* Read automation */}
      <div className="flex items-center border-b px-2 py-[3px]" style={{ borderColor: '#4a4a4e' }}>
        <button type="button" className="w-full rounded-[2px] border border-[#2d5a2d] px-3 py-[2px] text-[9px] font-bold text-[#c8ffc8]" style={{ background: LP.readAuto }}>Read</button>
      </div>
      {/* Pan knob large */}
      <div className="flex flex-col items-center py-2">
        {!isStereoOut ? <PanKnob value={pan} onChange={(v) => tr && daw.setTrackPan(tr.id, v)} size={44} /> : <PanKnob value={0} onChange={() => {}} size={44} />}
      </div>
      {/* dB display */}
      <div className="flex items-center justify-center gap-1 px-2 py-1">
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#e0e0e0]">{isStereoOut ? '0.0' : faderToDbLabel(vol)}</span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#4eca4e]">{peakToDbDisplay(peak)}</span>
      </div>
      {/* Fader + meters */}
      <div className="flex items-stretch justify-center gap-1 px-2 py-1" style={{ minHeight: 140 }}>
        <div className="flex flex-col items-end justify-between py-1 pr-0.5 font-mono text-[6px] leading-tight text-[#999]">
          {['0','3','6','9','12','15','18','21','24','30','35','40','45','50','60'].map(v => <span key={v}>{v}</span>)}
        </div>
        <DualPeakMeters peak={peak} height={120} />
        <div className="relative flex w-8 items-center justify-center">
          <div className="absolute rounded-sm border border-[#1a1a1a]" style={{ height: 120, width: 8, background: 'linear-gradient(90deg, #5a5a5a 0%, #3a3a3a 50%, #2a2a2a 100%)' }} />
          <input type="range" min={0} max={1} step={0.005} value={vol} onChange={(e) => { const v = Number(e.target.value); if (isStereoOut) daw.setMasterVolume(v); else if (tr) daw.setTrackVolume(tr.id, v); }} className="absolute cursor-pointer" style={{ width: 120, height: 24, transform: 'rotate(-90deg)', accentColor: '#d8d8d8' }} aria-label="Volume" />
        </div>
      </div>
      {/* R I / M S buttons */}
      {!isStereoOut ? (
        <>
          <div className="flex justify-center gap-1 py-0.5">
            <button type="button" onClick={() => tr && daw.toggleRecordArm(tr.id)} className={`h-5 w-6 rounded-sm border text-[9px] font-bold ${tr?.recordArm ? 'border-[#a22] bg-[#e03030] text-white' : 'border-[#555] bg-[#4a4a4e] text-[#999]'}`}>R</button>
            <button type="button" className="h-5 w-6 rounded-sm border border-[#555] bg-[#4a4a4e] text-[9px] font-bold text-[#999]">I</button>
          </div>
          <div className="flex justify-center gap-1 py-0.5">
            <button type="button" onClick={() => tr && daw.toggleMute(tr.id)} className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${tr?.muted ? 'border-[#3a7a7a] bg-[#5ab0b0] text-[#022]' : 'border-[#555] bg-[#4a4a4e] text-[#ddd]'}`}>M</button>
            <button type="button" onClick={() => tr && daw.toggleSolo(tr.id)} className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${tr?.solo ? 'border-[#886600] bg-[#e8d44a] text-[#111]' : 'border-[#555] bg-[#4a4a4e] text-[#ddd]'}`}>S</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-center py-0.5"><span className="text-[8px] text-[#999]">Bnce</span></div>
          <div className="flex justify-center gap-1 py-0.5">
            <button type="button" className="h-6 w-7 rounded-sm border border-[#555] bg-[#4a4a4e] text-[10px] font-bold text-[#ddd]">M</button>
          </div>
        </>
      )}
      {/* Track name */}
      <div className="mt-auto truncate border-t px-1 py-1.5 text-center text-[10px] font-semibold" style={{ backgroundColor: labelColor, borderColor: LP.border, color: isStereoOut ? '#fff' : '#111' }}>
        {name}
      </div>
    </div>
  );
}

function SlotRow({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center border-b px-2 py-[3px]" style={{ borderColor: '#4a4a4e' }}>
      {label && <span className="w-[50px] shrink-0 text-right pr-1 text-[9px] text-[#b0b0b4]">{label}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function TrackInspector({ trackId }: { trackId: string | null }) {
  return (
    <div className="flex flex-col text-[10px]" style={{ color: LP.text }}>
      {/* Region / Track headers */}
      <div className="border-b px-2 py-1.5" style={{ borderColor: LP.border }}>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-[#888]">▶</span>
          <span className="font-semibold">Region:</span>
          <span className="text-[#b0b0b4]">Audio Defaults</span>
        </div>
      </div>
      <div className="border-b px-2 py-1.5" style={{ borderColor: LP.border }}>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="text-[#888]">▶</span>
          <span className="font-semibold">Track:</span>
          <span className="text-[#b0b0b4]">Audio 1</span>
        </div>
      </div>
      {/* Two channel strips side by side */}
      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="flex-1 border-r" style={{ borderColor: LP.border }}>
          <InspectorChannelStrip trackId={trackId} />
        </div>
        <div className="flex-1">
          <InspectorChannelStrip trackId={null} isStereoOut />
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
      className={`h-5 w-5 ${active ? 'text-[#facc15]' : 'text-[#9ca3af]'}`}
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
      className={`h-5 w-5 ${off ? 'text-[#52525b] line-through decoration-2' : 'text-[#d4d4d8]'}`}
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
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M9 4v16" strokeLinecap="round" />
    </svg>
  );
}
function IconHelpQ() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 .2c0 2-2.5 1.8-2.5 3.8M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}
function IconSmartSliders() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 8h4M10 8h10M4 16h10M16 16h4" strokeLinecap="round" />
      <circle cx="7" cy="8" r="2" fill="currentColor" />
      <circle cx="14" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}
function IconMixerConsole() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7v8M12 5v10M16 8v7" strokeLinecap="round" />
    </svg>
  );
}
function IconEditorsWin() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="M3 9h18M9 5v14" strokeLinecap="round" />
    </svg>
  );
}
function IconToolbarRows() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  );
}
function IconListDoc() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M8 6h12M8 10h12M8 14h8M8 18h8" strokeLinecap="round" />
      <rect x="4" y="5" width="2" height="2" fill="currentColor" />
      <rect x="4" y="9" width="2" height="2" fill="currentColor" />
      <rect x="4" y="13" width="2" height="2" fill="currentColor" />
    </svg>
  );
}
function IconNotePad() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M14 4v4h4" />
    </svg>
  );
}
function IconLoopBrowser() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l3 2" strokeLinecap="round" />
    </svg>
  );
}
function IconMediaBrowser() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="9" cy="11" r="2.5" />
      <path d="M21 15l-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconForwardEnd() {
  return (
    <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6zm4 0l10 6-10 6z" />
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
    <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <path d="M9 9l8 4-8 4M9 15l8-4" strokeLinecap="round" />
    </svg>
  );
}
function IconGlue() {
  return (
    <svg className="h-[16px] w-[16px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 12h8M10 8v8M14 8v8" strokeLinecap="round" />
    </svg>
  );
}
function IconWaveInst() {
  return (
    <svg className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 12h2l2-6 3 12 3-8 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStereoLink() {
  return (
    <svg className="h-[10px] w-[14px]" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="7" cy="6" r="4" />
      <circle cx="15" cy="6" r="4" />
    </svg>
  );
}

function PanKnob({
  value,
  onChange,
  size = 36,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const deg = value * 48;
  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <div
        className="relative rounded-full border border-[#333] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(160deg, #5a5a5a 0%, #3a3a3a 55%, #323232 100%)',
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
            background: '#8fdf7a',
            transform: `translate(-50%, -100%) rotate(${deg}deg)`,
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          }}
        />
      </div>
      <span className="mt-0.5 font-mono text-[7px] tabular-nums text-[#c8c8c8]">
        {Math.abs(value) < 0.05 ? '0.0' : value < 0 ? `-${Math.round(Math.abs(value) * 100)}` : `+${Math.round(value * 100)}`}
      </span>
    </div>
  );
}

function DualPeakMeters({ peak, height = MIXER_METER_H }: { peak: number; height?: number }) {
  const h = Math.min(100, peak * 112);
  const bar = (k: string) => (
    <div
      key={k}
      className="relative overflow-hidden rounded-[2px] bg-[#0a0a0a]"
      style={{
        height,
        width: 8,
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.95), inset 0 -1px 0 rgba(255,255,255,0.04)',
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
          boxShadow: '0 0 4px rgba(90,200,90,0.25)',
        }}
      />
    </div>
  );
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {bar('L')}
      {bar('R')}
    </div>
  );
}

const MODAL_CELLS: {
  kind: TrackKind;
  label: string;
  hint: string;
  color: string;
}[] = [
  { kind: 'record_audio', label: 'Record audio', hint: 'Mic / line', color: '#60a5fa' },
  { kind: 'create_beat', label: 'Create a beat', hint: 'Pattern + drums', color: '#fb7185' },
  { kind: 'instrument', label: 'Instrument', hint: 'Keys / synth', color: '#f8fafc' },
  { kind: 'use_loops', label: 'Use loops', hint: 'Library', color: '#fb923c' },
  { kind: 'import_audio', label: 'Import audio file', hint: 'WAV / MP3', color: '#4ade80' },
  { kind: 'play_drums', label: 'Play drums', hint: 'Pads', color: '#2dd4bf' },
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
      style={{ background: 'rgba(0,0,0,0.55)' }}
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



const slotBtn = 'w-full truncate rounded-[2px] border px-1 py-[3px] text-[9px] text-[#ddd] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
const slotEmpty = `${slotBtn} border-[${LP.slotBorder}] bg-[${LP.slotBg}]`;

function LogicMixerFilterBar({ active, onPick }: { active: string; onPick: (s: string) => void }) {
  const filterItems = ['Single', 'Tracks', 'All', 'Audio', 'Inst', 'Aux', 'Bus', 'Input', 'Output', 'Master/VCA', 'MIDI'] as const;
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5"
      style={{
        borderColor: LP.border,
        background: `linear-gradient(180deg, #434343 0%, ${LP.panelLo} 100%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Undo arrow */}
      <button type="button" className={`${ctrlBtnBase} h-6 w-6 text-[10px]`} title="Undo">↺</button>
      {/* Edit / Options / View dropdowns */}
      {['Edit', 'Options', 'View'].map((m) => (
        <button key={m} type="button" className="flex items-center gap-0.5 rounded px-2 py-1 text-[10px] font-medium text-[#e4e4e4] hover:bg-black/20">
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
            active === x ? `${ctrlBtnActive} min-h-[26px]` : 'text-[#e4e4e4] hover:bg-black/20'
          }`}
        >
          {x}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        {/* Two view toggle icons */}
        <button type="button" className={ctrlBtnBase} title="Narrow strips">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="3" height="12" rx="0.5" /><rect x="5" y="2" width="3" height="12" rx="0.5" /><rect x="9" y="2" width="3" height="12" rx="0.5" /></svg>
        </button>
        <button type="button" className={ctrlBtnBase} title="Wide strips">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="5" height="12" rx="0.5" /><rect x="7" y="2" width="5" height="12" rx="0.5" /></svg>
        </button>
      </div>
    </div>
  );
}

function MixerSlotRow({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center border-b px-1 py-[3px]" style={{ borderColor: '#4a4a4e' }}>
      <span className="w-[60px] shrink-0 text-right text-[9px] text-[#b0b0b4] pr-2">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
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

  const dbLabel = faderToDbLabel(tr.volume);
  const peakDb = peakToDbDisplay(peak);

  return (
    <div
      className="flex min-h-full shrink-0 flex-col border-r"
      style={{ width: MIXER_STRIP_W, borderColor: LP.border, background: LP.stripBg }}
    >
      {/* Setting */}
      <MixerSlotRow label="Setting">
        <button type="button" className={`${slotBtn} border-[#4e4e52] bg-[#555558]`} title="Channel setting">
          Setting
        </button>
      </MixerSlotRow>
      {/* Gain Reduction */}
      <MixerSlotRow label="Gain Reduction">
        <div className="h-3 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      {/* EQ */}
      <MixerSlotRow label="EQ">
        <select
          value={tr.eqPreset}
          onChange={(e) => daw.setTrackEq(tr.id, e.target.value as (typeof tr)['eqPreset'])}
          className={`${slotBtn} border-[#4e4e52] bg-[#555558]`}
          title="Channel EQ"
        >
          {EQ_PRESET_LABELS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </MixerSlotRow>
      {/* Input */}
      <MixerSlotRow label="Input">
        <div className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#666] text-[8px] text-[#ccc]">○</span>
          <select
            value={tr.inputSource}
            onChange={(e) => daw.setTrackInputSource(tr.id, e.target.value)}
            className={`${slotBtn} flex-1 border-[#4e4e52] bg-[#555558]`}
            title="Input source"
          >
            {INPUT_SOURCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </MixerSlotRow>
      {/* Audio FX */}
      <MixerSlotRow label="Audio FX">
        <select
          value={tr.effectPreset}
          onChange={(e) => daw.setTrackEffect(tr.id, e.target.value as (typeof tr)['effectPreset'])}
          className={`${slotBtn} border-[#4e4e52] bg-[#555558]`}
          title="Audio FX"
        >
          {EFFECT_PRESET_LABELS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </MixerSlotRow>
      {/* Sends */}
      <MixerSlotRow label="Sends">
        <div className="flex items-center gap-1">
          <div className="h-3 flex-1 rounded-sm bg-[#3a3a3e]" />
          <span className="h-3 w-3 rounded-full bg-[#555]" />
        </div>
      </MixerSlotRow>
      {/* Output */}
      <MixerSlotRow label="Output">
        <button type="button" className={`${slotBtn} border-[#4e4e52] bg-[#555558]`}>St Out</button>
      </MixerSlotRow>
      {/* Group */}
      <MixerSlotRow label="Group">
        <div className="h-4 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      {/* Automation */}
      <MixerSlotRow label="Automation">
        <button
          type="button"
          className="w-full rounded-[2px] border border-[#2d5a2d] px-1 py-[3px] text-[9px] font-bold text-[#c8ffc8]"
          style={{ background: LP.readAuto }}
          title="Automation mode"
        >
          Read
        </button>
      </MixerSlotRow>
      {/* Waveform icon */}
      <div className="flex justify-center py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#3060a0] bg-gradient-to-b from-[#4a6fa8] to-[#355a8a]">
          <IconWaveInst />
        </div>
      </div>
      {/* Pan */}
      <div className="flex flex-col items-center border-t py-1" style={{ borderColor: '#4a4a4e' }}>
        <span className="text-[8px] text-[#b0b0b4]">Pan</span>
        <PanKnob value={tr.pan} onChange={(v) => daw.setTrackPan(tr.id, v)} size={42} />
      </div>
      {/* dB */}
      <div className="flex items-center justify-center gap-1 border-t px-1 py-1" style={{ borderColor: '#4a4a4e' }}>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">
          {dbLabel}
        </span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">
          {peakDb}
        </span>
      </div>
      {/* Fader + Meters */}
      <div
        className="flex items-stretch justify-center gap-1 px-1 py-1"
        style={{ minHeight: MIXER_METER_H + 16 }}
      >
        <div className="flex flex-col items-end justify-between py-1 pr-0.5 font-mono text-[7px] leading-tight text-[#999]">
          {['6','3','0','-3','-6','-9','-12','-15','-18','-21','-24','-30','-35','-40','-45','-50','-60'].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <DualPeakMeters peak={peak} height={MIXER_METER_H} />
        <div className="relative flex w-8 items-center justify-center">
          <div
            className="absolute rounded-sm border border-[#1a1a1a]"
            style={{
              height: MIXER_METER_H,
              width: 8,
              background: 'linear-gradient(90deg, #5a5a5a 0%, #3a3a3a 50%, #2a2a2a 100%)',
            }}
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={tr.volume}
            onChange={(e) => daw.setTrackVolume(tr.id, Number(e.target.value))}
            className="absolute cursor-pointer"
            style={{
              width: MIXER_METER_H,
              height: 24,
              transform: 'rotate(-90deg)',
              accentColor: '#d8d8d8',
            }}
            aria-label="Volume fader"
          />
        </div>
      </div>
      {/* R I buttons */}
      <div className="flex justify-center gap-1 py-0.5">
        <button
          type="button"
          title="Record enable"
          onClick={() => daw.toggleRecordArm(tr.id)}
          className={`h-5 w-6 rounded-sm border text-[9px] font-bold ${
            tr.recordArm ? 'border-[#a22] bg-[#e03030] text-white' : 'border-[#555] bg-[#4a4a4e] text-[#999]'
          }`}
        >
          R
        </button>
        <button
          type="button"
          title="Input monitoring"
          className="h-5 w-6 rounded-sm border border-[#555] bg-[#4a4a4e] text-[9px] font-bold text-[#999]"
        >
          I
        </button>
      </div>
      {/* M S buttons */}
      <div className="flex justify-center gap-1 py-0.5">
        <button
          type="button"
          title="Mute"
          onClick={() => daw.toggleMute(tr.id)}
          className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${
            tr.muted ? 'border-[#3a7a7a] bg-[#5ab0b0] text-[#022]' : 'border-[#555] bg-[#4a4a4e] text-[#ddd]'
          }`}
        >
          M
        </button>
        <button
          type="button"
          title="Solo"
          onClick={() => daw.toggleSolo(tr.id)}
          className={`h-6 w-7 rounded-sm border text-[10px] font-bold ${
            tr.solo ? 'border-[#886600] bg-[#e8d44a] text-[#111]' : 'border-[#555] bg-[#4a4a4e] text-[#ddd]'
          }`}
        >
          S
        </button>
      </div>
      {/* Track name label */}
      <div
        className="mt-auto truncate border-t px-1 py-1.5 text-center text-[10px] font-semibold"
        style={{ backgroundColor: tr.color, borderColor: LP.border, color: '#111' }}
        title={tr.name}
      >
        {tr.name || 'Track'}
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
        <button type="button" className={`${slotBtn} border-[#4e4e52] bg-[#555558]`}>Setting</button>
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className="h-4 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Input">
        <div className="flex h-4 w-4 items-center justify-center text-[10px] text-[#ccc]">∞</div>
      </MixerSlotRow>
      <MixerSlotRow label="Audio FX">
        <div className="h-4 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Group">
        <div className="h-4 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button
          type="button"
          className="w-full rounded-[2px] border border-[#2d5a2d] px-1 py-[3px] text-[9px] font-bold text-[#c8ffc8]"
          style={{ background: LP.readAuto }}
        >
          Read
        </button>
      </MixerSlotRow>
      <div className="flex justify-center py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#3060a0] bg-gradient-to-b from-[#4a6fa8] to-[#355a8a]">
          <IconWaveInst />
        </div>
      </div>
      <div className="flex flex-col items-center border-t py-1" style={{ borderColor: '#4a4a4e' }}>
        <span className="text-[8px] text-[#b0b0b4]">Pan</span>
        <PanKnob value={0} onChange={() => {}} size={42} />
      </div>
      <div className="flex items-center justify-center gap-1 border-t px-1 py-1" style={{ borderColor: '#4a4a4e' }}>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">0.0</span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">{peakToDbDisplay(peak)}</span>
      </div>
      <div className="flex items-stretch justify-center gap-1 px-1 py-1" style={{ minHeight: MIXER_METER_H + 16 }}>
        <div className="flex flex-col items-end justify-between py-1 pr-0.5 font-mono text-[7px] leading-tight text-[#999]">
          {['6','3','0','-3','-6','-9','-12','-15','-18','-21','-24','-30','-35','-40','-45','-50','-60'].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <DualPeakMeters peak={peak} height={MIXER_METER_H} />
        <div className="relative flex w-8 items-center justify-center">
          <div className="absolute rounded-sm border border-[#1a1a1a]" style={{ height: MIXER_METER_H, width: 8, background: 'linear-gradient(90deg, #5a5a5a 0%, #3a3a3a 50%, #2a2a2a 100%)' }} />
          <input type="range" min={0} max={1} step={0.005} value={daw.masterVolume} onChange={(e) => daw.setMasterVolume(Number(e.target.value))} className="absolute cursor-pointer" style={{ width: MIXER_METER_H, height: 24, transform: 'rotate(-90deg)', accentColor: '#e8e8e8' }} aria-label="Stereo out level" />
        </div>
      </div>
      <div className="flex justify-center gap-1 py-0.5">
        <span className="text-[8px] text-[#999]">Bnce</span>
      </div>
      <div className="flex justify-center gap-1 py-0.5">
        <button type="button" className="h-6 w-7 rounded-sm border border-[#555] bg-[#4a4a4e] text-[10px] font-bold text-[#ddd]">M</button>
      </div>
      <div className="mt-auto truncate border-t px-1 py-1.5 text-center text-[10px] font-semibold text-white" style={{ backgroundColor: '#4a9a4a', borderColor: LP.border }}>
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
        <div className="h-4 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="EQ">
        <div className="h-4 rounded-sm bg-[#3a3a3e]" />
      </MixerSlotRow>
      <MixerSlotRow label="Automation">
        <button
          type="button"
          className="w-full rounded-[2px] border border-[#2d5a2d] px-1 py-[3px] text-[9px] font-bold text-[#c8ffc8]"
          style={{ background: LP.readAuto }}
        >
          Read
        </button>
      </MixerSlotRow>
      <div className="flex justify-center py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#3060a0] bg-gradient-to-b from-[#4a6fa8] to-[#355a8a]">
          <IconWaveInst />
        </div>
      </div>
      <div className="flex flex-col items-center border-t py-1" style={{ borderColor: '#4a4a4e' }}>
        <span className="text-[8px] text-[#b0b0b4]">Pan</span>
        <PanKnob value={0} onChange={() => {}} size={42} />
      </div>
      <div className="flex items-center justify-center gap-1 border-t px-1 py-1" style={{ borderColor: '#4a4a4e' }}>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#e0e0e0]">
          {faderToDbLabel(daw.masterVolume)}
        </span>
        <span className="rounded border border-[#222] bg-[#0a0a0a] px-1 py-0.5 font-mono text-[9px] tabular-nums text-[#4eca4e]">
          {peakToDbDisplay(peak)}
        </span>
      </div>
      <div className="flex items-stretch justify-center gap-1 px-1 py-1" style={{ minHeight: MIXER_METER_H + 16 }}>
        <div className="flex flex-col items-end justify-between py-1 pr-0.5 font-mono text-[7px] leading-tight text-[#999]">
          {['6','3','0','-3','-6','-9','-12','-15','-18','-21','-24','-30','-35','-40','-45','-50','-60'].map(v => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <DualPeakMeters peak={peak} height={MIXER_METER_H} />
        <div className="relative flex w-8 items-center justify-center">
          <div className="absolute rounded-sm border border-[#1a1a1a]" style={{ height: MIXER_METER_H, width: 8, background: 'linear-gradient(90deg, #5a5a5a 0%, #3a3a3a 50%, #2a2a2a 100%)' }} />
          <input type="range" min={0} max={1} step={0.005} value={daw.masterVolume} onChange={(e) => daw.setMasterVolume(Number(e.target.value))} className="absolute cursor-pointer" style={{ width: MIXER_METER_H, height: 24, transform: 'rotate(-90deg)', accentColor: '#f0f0f0' }} aria-label="Master volume" />
        </div>
      </div>
      <div className="flex justify-center gap-1 py-0.5">
        <button type="button" className="h-6 w-7 rounded-sm border border-[#555] bg-[#4a4a4e] text-[10px] font-bold text-[#ddd]">M</button>
        <button type="button" className="h-6 w-7 rounded-sm border border-[#555] bg-[#4a4a4e] text-[10px] font-bold text-[#ddd]">D</button>
      </div>
      <div className="mt-auto truncate border-t px-1 py-1.5 text-center text-[10px] font-semibold text-white" style={{ backgroundColor: '#9b4d96', borderColor: LP.border }}>
        Master
      </div>
    </div>
  );
}

function DawChrome() {
  const daw = useDaw();
  const [editorTab, setEditorTab] = useState<'clip' | 'piano'>('clip');
  const [selection, setSelection] = useState<ClipSelection>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mainView, setMainView] = useState<'arrange' | 'mixer'>('arrange');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [focusWorkbench, setFocusWorkbench] = useState(false);
  const [mixerFilter, setMixerFilter] = useState('Tracks');
  const fileRef = useRef<HTMLInputElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const importTrackRef = useRef<string>('');

  /* responsive defaults handled in useState initializers above */

  const end = useMemo(() => {
    return Math.max(90, getTimelineEndSec(daw.tracks, daw.tempo));
  }, [daw.tracks, daw.tempo]);

  const widthPx = Math.ceil(end * PX_PER_SEC) + 160;

  const selectedClip =
    selection &&
    daw.tracks
      .find((t) => t.id === selection.trackId)
      ?.clips.find((c) => c.id === selection.clipId);

  const selectedTrack = daw.selectedTrackId
    ? daw.tracks.find((t) => t.id === daw.selectedTrackId)
    : null;

  const targetTrackId = daw.selectedTrackId ?? daw.tracks[0]?.id ?? '';

  const [editorWavWidth, setEditorWavWidth] = useState(880);
  useEffect(() => {
    const w = () => setEditorWavWidth(Math.max(320, window.innerWidth - 360));
    w();
    window.addEventListener('resize', w);
    return () => window.removeEventListener('resize', w);
  }, []);

  const openImport = (trackId: string) => {
    importTrackRef.current = trackId;
    fileRef.current?.click();
  };

  const barW = secPerBar(daw.tempo, daw.beatsPerBar) * PX_PER_SEC;

  return (
    <div
      className={`flex flex-col [@media(orientation:landscape)]:[.daw-main]:min-h-0 ${
        focusWorkbench
          ? 'fixed inset-0 z-[140] min-h-[100dvh] min-w-0'
          : 'h-screen min-h-[640px] min-w-0'
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
          e.target.value = '';
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
          e.target.value = '';
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
            <button type="button" title="Library" onClick={() => setLibraryOpen((v) => !v)} className={libraryOpen ? ctrlBtnActive : ctrlBtnBase}>
              <IconLibraryDrawer />
            </button>
            <button type="button" title="Inspector" onClick={() => setInspectorOpen((v) => !v)} className={inspectorOpen ? ctrlBtnActive : ctrlBtnBase}>
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
              onClick={() => setMainView('mixer')}
              className={mainView === 'mixer' ? ctrlBtnActive : ctrlBtnBase}
            >
              <IconMixerConsole />
            </button>
            <button type="button" title="Editors" onClick={() => setEditorsOpen((v) => !v)} className={editorsOpen ? ctrlBtnActive : ctrlBtnBase}>
              <IconEditorsWin />
            </button>
          </div>

          <div className="flex items-center gap-0.5">
            <button type="button" title="Go to beginning" onClick={() => daw.rewindToStart()} className={ctrlBtnBase}>
              <IconRewind />
            </button>
            <button type="button" title="Go to end" onClick={() => daw.seek(end)} className={ctrlBtnBase}>
              <IconForwardEnd />
            </button>
            <button type="button" title="Stop" onClick={() => daw.stopTransport()} className={ctrlBtnBase}>
              <IconStop />
            </button>
            <button type="button" title="Play" onClick={() => daw.play()} className={`${ctrlBtnBase} min-w-[40px]`}>
              <IconPlay />
            </button>
            <button
              type="button"
              title={daw.isRecording ? 'Stop recording' : 'Record'}
              onClick={() => {
                if (daw.isRecording) daw.stopRecord();
                else void daw.startRecord();
              }}
              className={`${ctrlBtnBase} text-[#ffb0b0] ${daw.isRecording ? 'ring-1 ring-red-500' : ''}`}
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
              borderColor: '#05080c',
              background: LP.lcdBg,
              backgroundImage:
                'repeating-linear-gradient(180deg, transparent, transparent 2px, rgba(110,200,255,0.04) 2px, rgba(110,200,255,0.04) 3px)',
            }}
          >
            {/* BAR / BEAT section */}
            <div className="flex flex-1 items-baseline gap-1 px-2">
              <div className="flex flex-col items-center">
                <span className="font-mono text-[22px] font-bold leading-none tabular-nums" style={{ color: '#e0e8f0' }}>
                  {String(Math.floor((daw.currentTime * (daw.tempo / 60)) / daw.beatsPerBar) + 1).padStart(3, '0')}
                </span>
                <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: LP.lcdDim }}>Bar</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-mono text-[22px] font-bold leading-none tabular-nums" style={{ color: '#e0e8f0' }}>
                  {Math.floor((daw.currentTime * (daw.tempo / 60)) % daw.beatsPerBar) + 1}
                </span>
                <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: LP.lcdDim }}>Beat</span>
              </div>
            </div>
            {/* Divider */}
            <div className="h-8 w-px bg-[#1a2a3a]" />
            {/* TEMPO section */}
            <div className="flex flex-col items-center px-3">
              <span className="font-mono text-[18px] font-bold leading-none tabular-nums" style={{ color: '#e0e8f0' }}>
                {Math.round(daw.tempo)}
              </span>
              <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: LP.lcdDim }}>
                Keep
              </span>
              <span className="text-[6px] uppercase tracking-widest" style={{ color: LP.lcdDim }}>Tempo</span>
            </div>
            {/* Divider */}
            <div className="h-8 w-px bg-[#1a2a3a]" />
            {/* TIME SIG / KEY section */}
            <div className="flex flex-col items-center px-3">
              <span className="font-mono text-[16px] font-bold leading-none" style={{ color: '#e0e8f0' }}>
                {daw.beatsPerBar}/4
              </span>
              <span className="text-[8px] font-medium" style={{ color: LP.lcdDim }}>Cmaj</span>
            </div>
            {/* Dropdown arrow */}
            <button type="button" className="px-1 text-[8px]" style={{ color: LP.lcdDim }} title="Display mode">▾</button>
          </div>

          {/* Right of LCD: Metronome, 1234 purple, flag */}
          <div className="flex items-center gap-0.5 border-l pl-2" style={{ borderColor: LP.border }}>
            <button type="button" title="Metronome" onClick={() => daw.setMetronomeOn(!daw.metronomeOn)} className={ctrlBtnBase}>
              <IconMetronome off={!daw.metronomeOn} />
            </button>
            <button type="button" title="Count-in" className={ctrlBtnBase}>
              <IconCountIn />
            </button>
            <button type="button" title="MIDI activity" className={`${ctrlBtn} border-[#6a3eaa] bg-gradient-to-b from-[#7a4eba] to-[#5a2ea0] text-[10px] font-bold`} style={{ minWidth: 36 }}>
              1234
            </button>
            <button type="button" title="Notifications" className={ctrlBtnBase}>
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1 3h3l-2.5 2 1 3L8 7.5 5.5 9l1-3L4 4h3z"/></svg>
            </button>
          </div>

          {/* Master volume slider */}
          <div className="flex min-w-[100px] max-w-[160px] items-center px-2">
            <input type="range" min={0} max={1} step={0.01} value={daw.masterVolume} onChange={(e) => daw.setMasterVolume(Number(e.target.value))} className="h-1.5 w-full cursor-pointer" style={{ accentColor: '#d0d0d0' }} />
          </div>

          {/* Far right 4 icons — matches Logic Pro */}
          <div className="flex items-center gap-0.5 border-l pl-2" style={{ borderColor: LP.border }}>
            <button type="button" title="List editors" className={ctrlBtnBase}>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" /></svg>
            </button>
            <button type="button" title="Notepad" className={ctrlBtnBase}>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h6M9 11h6M9 15h3" strokeLinecap="round" /></svg>
            </button>
            <button type="button" title="Comments" className={ctrlBtnBase}>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
            </button>
            <button type="button" title="Lock" className={ctrlBtnBase}>
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="11" width="14" height="10" rx="1.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            </button>
          </div>

          {/* Functional buttons - kept for DAW features */}
          <div className="ml-1 flex flex-wrap items-center gap-0.5">
            <button type="button" title="Arrange / Edit" onClick={() => setMainView('arrange')} className={mainView === 'arrange' ? `${ctrlBtnActive} px-2 text-[9px] font-semibold` : `${ctrlBtnBase} px-2 text-[9px]`}>Edit</button>
            <button type="button" title="Mixer view" onClick={() => setMainView('mixer')} className={mainView === 'mixer' ? `${ctrlBtnActive} px-2 text-[9px] font-semibold` : `${ctrlBtnBase} px-2 text-[9px]`}>Mix</button>
            <button type="button" title="Export mix (WAV)" className={`${ctrlBtnBase} px-2 text-[9px]`} onClick={() => void daw.exportMixWav()}>Bnc</button>
            <button type="button" title="New track" className={`${ctrlBtnBase} px-2 text-[9px]`} onClick={() => setModalOpen(true)}>+Tr</button>
            <button type="button" title="Import audio" className={`${ctrlBtnBase} px-2 text-[9px]`} onClick={() => targetTrackId && openImport(targetTrackId)} disabled={!targetTrackId}>Imp</button>
            <button type="button" title="Fullscreen workspace" className={`${ctrlBtnBase} hidden lg:flex`} onClick={() => setFocusWorkbench((v) => !v)}><IconExpand /></button>
            <button type="button" title="Save project JSON" className={`${ctrlBtnBase} px-2 text-[9px] text-[#9d9]`} onClick={() => daw.exportProjectJson()}>Save</button>
            <button type="button" title="Load project" className={`${ctrlBtnBase} px-2 text-[9px]`} onClick={() => projectFileRef.current?.click()}>Load</button>
          </div>
        </div>

        {/* Row 2: Icon+Label toolbar — matches Logic Pro screenshot exactly */}
        <div
          className="flex flex-wrap items-end gap-3 border-t px-3 py-1 overflow-x-auto"
          style={{ borderColor: LP.border, background: `linear-gradient(180deg, ${LP.panel} 0%, ${LP.panelLo} 100%)` }}
        >
          {[
            { icon: '∿λ', label: 'Articulation' },
            { icon: '⊞↕', label: 'Track Zoom' },
            { icon: '♫↻', label: 'Note Repeat' },
            { icon: '⊘', label: 'Spot Erase' },
            { icon: '✂▎', label: 'Split by Playhead' },
            { icon: '✂⟨⟩', label: 'Split by Locators' },
            { icon: '⤓', label: 'Bounce Regions' },
          ].map((b) => (
            <button key={b.label} type="button" title={b.label} className="flex flex-col items-center gap-0.5 rounded px-1.5 py-0.5 text-[#ccc] hover:bg-black/15">
              <span className="text-[14px] leading-none">{b.icon}</span>
              <span className="text-[8px] whitespace-nowrap">{b.label}</span>
            </button>
          ))}
          <div className="mx-1 h-8 w-px bg-[#555] self-center" />
          {/* Nudge Value */}
          <div className="flex items-center gap-1">
            <button type="button" className="text-[12px] text-[#aaa] hover:text-white">‹</button>
            <span className="rounded border border-[#555] bg-[#3a3a3e] px-3 py-0.5 text-[10px] text-[#ddd]">Tick</span>
            <button type="button" className="text-[12px] text-[#aaa] hover:text-white">›</button>
            <span className="ml-0.5 text-[8px] text-[#999]">Nudge Value</span>
          </div>
          <div className="mx-1 h-8 w-px bg-[#555] self-center" />
          {[
            { icon: '⟳§', label: 'Repeat Section' },
            { icon: '✂§', label: 'Cut Section' },
            { icon: '⟨⟩', label: 'Set Locators' },
            { icon: '🔍', label: 'Zoom' },
            { icon: '🎨', label: 'Colors' },
          ].map((b) => (
            <button key={b.label} type="button" title={b.label} className="flex flex-col items-center gap-0.5 rounded px-1.5 py-0.5 text-[#ccc] hover:bg-black/15">
              <span className="text-[14px] leading-none">{b.icon}</span>
              <span className="text-[8px] whitespace-nowrap">{b.label}</span>
            </button>
          ))}
        </div>

        <div
          className="flex min-h-[36px] flex-wrap items-center gap-x-1 gap-y-1 border-t px-2 py-1"
          style={{ borderColor: LP.border, background: LP.panelLo }}
        >
          {/* Undo arrow */}
          <button type="button" className={`${ctrlBtnBase} h-6 w-6 text-[10px]`} title="Undo">↺</button>
          {/* Edit / Functions / View dropdowns */}
          {['Edit', 'Functions', 'View'].map((m) => (
            <button key={m} type="button" className="flex items-center gap-0.5 rounded px-2 py-1 text-[10px] font-medium text-[#e4e4e4] hover:bg-black/20">
              {m} <span className="text-[7px]">▾</span>
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[#555]" />
          {/* Grid / List / Linear view icons */}
          <button type="button" title="Grid view" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="6" y="1" width="4" height="4" rx="0.5"/><rect x="11" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="6" width="4" height="4" rx="0.5"/><rect x="6" y="6" width="4" height="4" rx="0.5"/><rect x="11" y="6" width="4" height="4" rx="0.5"/></svg>
          </button>
          <button type="button" title="List view" className={ctrlBtnActive}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="0.5"/><rect x="1" y="6" width="14" height="3" rx="0.5"/><rect x="1" y="10" width="14" height="3" rx="0.5"/></svg>
          </button>
          <button type="button" title="Linear view" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8h12" strokeLinecap="round"/><path d="M2 4h12M2 12h12" strokeLinecap="round" opacity="0.4"/></svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#555]" />
          {/* Pen / Auto / Flex tool icons */}
          <button type="button" title="Pencil tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M10 2l4 4-9 9H1v-4z" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" title="Automation" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 12l4-8 4 6 6-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button type="button" title="Flex" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 8c2-4 4-4 6 0s4 4 6 0" strokeLinecap="round"/></svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#555]" />
          {/* Pointer / Crosshair / Plus tools */}
          <button type="button" title="Pointer tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1l9 6-4 1 2 5-2 1-2-5-3 3z"/></svg>
          </button>
          <button type="button" title="Crosshair / Marquee" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M8 1v14M1 8h14" strokeLinecap="round"/></svg>
          </button>
          <button type="button" title="Zoom tool" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7" cy="7" r="4"/><path d="M10 10l4 4" strokeLinecap="round"/><path d="M5 7h4M7 5v4" strokeLinecap="round"/></svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#555]" />
          {/* Gear / waveform / quantize */}
          <button type="button" title="Settings" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" strokeLinecap="round"/></svg>
          </button>
          <button type="button" title="Audio analysis" className={ctrlBtnBase}><IconWaveInst /></button>
          <button type="button" title="Quantize" className={ctrlBtnBase}>
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="1.5" height="10"/><rect x="5.5" y="3" width="1.5" height="10"/><rect x="9" y="3" width="1.5" height="10"/><rect x="12.5" y="3" width="1.5" height="10"/></svg>
          </button>
          <div className="mx-1 h-4 w-px bg-[#555]" />
          {/* Zoom vertical/horizontal with delta arrows */}
          <button type="button" title="Zoom out vertical" className={`${ctrlBtnBase} h-6 w-5 text-[10px]`}>↕</button>
          <button type="button" title="Zoom out horizontal" className={`${ctrlBtnBase} h-6 w-5 text-[10px]`}>↔</button>
          <div className="mx-1 h-4 w-px bg-[#555]" />
          {/* Snap / Drag */}
          <label className="flex items-center gap-1 text-[8px] text-[#aaa]">
            Snap
            <select className="rounded border px-1 py-0.5 text-[8px]" style={{ borderColor: LP.border, background: '#3a3a3a', color: LP.text }}>
              <option>Smart</option><option>Bar</option><option>Beat</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-[8px] text-[#aaa]">
            Drag
            <select className="rounded border px-1 py-0.5 text-[8px]" style={{ borderColor: LP.border, background: '#3a3a3a', color: LP.text }}>
              <option>No Overlap</option><option>X-Fade</option>
            </select>
          </label>
          <label className="ml-auto flex min-w-[120px] max-w-[240px] flex-1 items-center gap-2 sm:max-w-md">
            <span className="text-[8px] text-[#888]">Pos</span>
            <input type="range" min={0} max={Math.max(1, end)} step={0.01} value={Math.min(daw.currentTime, end)} onChange={(e) => daw.seek(Number(e.target.value))} className="h-1 w-full cursor-pointer" style={{ accentColor: LP.accentBlueHi }} />
          </label>
        </div>
      </header>

      {mainView === 'mixer' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: LP.panel }}>
          <LogicMixerFilterBar active={mixerFilter} onPick={setMixerFilter} />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Inspector in mixer view */}
            {inspectorOpen && (
              <aside className="flex shrink-0 overflow-y-auto border-r" style={{ borderColor: LP.border, background: LP.panel, width: 304 }}>
                <div className="flex min-h-0 flex-1">
                  <div className="flex-1 border-r" style={{ borderColor: LP.border }}>
                    <InspectorChannelStrip trackId={targetTrackId} />
                  </div>
                  <div className="flex-1">
                    <InspectorChannelStrip trackId={null} isStereoOut />
                  </div>
                </div>
              </aside>
            )}
            <div
              className="flex min-h-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden lg:min-h-[min(640px,72vh)]"
              style={{ background: LP.panelLo }}
            >
              {/* Label column */}
              <div className="flex shrink-0 flex-col border-r text-right text-[9px] text-[#b0b0b4]" style={{ width: 80, borderColor: LP.border, background: LP.panel }}>
                {['Setting', 'Gain Reduction', 'EQ', 'Input', 'Audio FX', 'Sends', 'Output', 'Group', 'Automation', '', 'Pan', 'dB', '', '', ''].map((l, i) => (
                  <div key={i} className="border-b px-2 py-[3px]" style={{ borderColor: '#4a4a4e', minHeight: l === '' ? (i >= 12 ? 40 : 20) : 20 }}>{l}</div>
                ))}
              </div>
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
              className="flex w-[304px] shrink-0 flex-col overflow-y-auto border-r"
              style={{ borderColor: LP.border, background: LP.panel }}
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
                    if (v && targetTrackId) daw.applyMicChainPreset(targetTrackId, v as (typeof MIC_CHAIN_PRESETS)[number]['id']);
                    e.target.value = '';
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
                          onClick={() =>
                            targetTrackId && void daw.addRemoteLibraryClip(targetTrackId!, item.id)
                          }
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
            <p className="border-t p-2 text-[10px] leading-snug" style={{ borderColor: LP.border, color: LP.textMuted }}>
              Built-in sounds are synthesized. Web samples need CORS; if one fails, try another or use{' '}
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
            />

            {/* +/Save/Dropdown row above tracks — matches Logic Pro */}
            <div className="flex shrink-0 items-center border-b" style={{ borderColor: LP.border, background: LP.panel }}>
              <div className="flex shrink-0 items-center gap-1 px-2 py-1" style={{ width: TRACK_HEADER_W }}>
                <button type="button" title="New track" onClick={() => setModalOpen(true)} className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[12px] text-[#ccc] hover:bg-[#555]">+</button>
                <button type="button" title="Save" className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[10px] text-[#ccc] hover:bg-[#555]">
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1h9l3 3v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm3 0v4h5V1zm1 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/></svg>
                </button>
                <button type="button" title="Options" className="flex h-5 w-5 items-center justify-center rounded border border-[#555] bg-[#4a4a4e] text-[9px] text-[#ccc] hover:bg-[#555]">▾</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {daw.tracks.map((tr, ti) => (
                <div
                  key={tr.id}
                  className="flex border-b"
                  style={{
                    minHeight: TRACK_ROW_MIN_H,
                    borderColor: LP.border,
                    background: daw.selectedTrackId === tr.id ? 'rgba(60,120,200,0.14)' : LP.panel,
                  }}
                >
                   <div className="flex shrink-0 border-r" style={{ width: TRACK_HEADER_W, borderColor: LP.border }}>
                     <div className="w-1 shrink-0" style={{ backgroundColor: tr.color }} />
                     <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-1.5 py-1.5">
                       <div className="flex items-center gap-1">
                         <span className="w-4 text-center font-mono text-[9px] text-[#888]">{ti + 1}</span>
                         <IconWaveInst />
                         <input
                           className="min-w-0 flex-1 truncate border border-transparent bg-transparent text-[11px] font-semibold outline-none"
                           style={{ color: LP.text }}
                           value={tr.name}
                           onChange={(e) => daw.renameTrack(tr.id, e.target.value)}
                           onClick={() => daw.setSelectedTrackId(tr.id)}
                         />
                       </div>
                       <div className="flex items-center gap-1">
                         <button type="button" title="Mute" className="h-5 w-5 rounded-sm border text-[8px] font-bold" style={{ borderColor: '#444', background: tr.muted ? LP.muteOn : '#404040', color: tr.muted ? '#022' : '#ccc' }} onClick={() => daw.toggleMute(tr.id)}>M</button>
                         <button type="button" title="Solo" className="h-5 w-5 rounded-sm border text-[8px] font-bold" style={{ borderColor: '#444', background: tr.solo ? LP.solo : '#404040', color: tr.solo ? '#111' : '#ccc' }} onClick={() => daw.toggleSolo(tr.id)}>S</button>
                         <button type="button" title="Record arm" className="h-5 w-5 rounded-sm border text-[8px] font-bold" style={{ borderColor: '#444', background: tr.recordArm ? LP.record : '#404040', color: tr.recordArm ? '#fff' : '#ccc' }} onClick={() => daw.toggleRecordArm(tr.id)}>R</button>
                         {/* Volume fader with signal-dependent green fill */}
                         {(() => {
                           const peak = daw.meterPeaks[tr.id] ?? 0;
                           const signalPct = Math.min(100, peak * 110);
                           const volPct = tr.volume * 100;
                           return (
                             <div className="relative mx-1 h-5 min-w-[60px] flex-1 overflow-hidden rounded-full" style={{ background: '#2a2a2a', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)' }}>
                               {/* Signal-level green fill (only shows when audio is flowing) */}
                               {signalPct > 0.5 && (
                                 <div className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-75" style={{ width: `${Math.min(volPct, signalPct)}%`, background: 'linear-gradient(to right, #3a8a3a, #5cb85c)' }} />
                               )}
                               {/* Gray volume bar background showing fader position */}
                               <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${volPct}%`, background: signalPct > 0.5 ? 'transparent' : 'linear-gradient(to right, #4a4a4e, #5a5a5e)', opacity: signalPct > 0.5 ? 0 : 0.6 }} />
                               <input type="range" min={0} max={1} step={0.01} value={tr.volume} onChange={(e) => daw.setTrackVolume(tr.id, Number(e.target.value))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                               <div className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-[#888] bg-gradient-to-b from-[#ccc] to-[#888] shadow" style={{ left: `calc(${volPct}% - 7px)` }} />
                             </div>
                           );
                         })()}
                         <PanKnob value={tr.pan} onChange={(v) => daw.setTrackPan(tr.id, v)} size={32} />
                       </div>
                     </div>
                   </div>

                  <div
                    className="relative min-w-0 flex-1"
                    style={{ minHeight: TRACK_ROW_MIN_H }}
                    onDragOver={(e) => {
                      if ([...e.dataTransfer.types].includes('Files')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
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
                        if ([...e.dataTransfer.types].includes('Files')) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
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
                              isSel
                                ? 'ring-2 ring-[#5a9eef]/80'
                                : 'hover:brightness-105'
                            }`}
                            style={{
                              left: c.startTime * PX_PER_SEC,
                              width: w,
                              height: h,
                              backgroundColor: `${tr.color}22`,
                              borderColor: isSel ? LP.accentBlueHi : LP.border,
                            }}
                            onDragOver={(e) => {
                              if ([...e.dataTransfer.types].includes('Files')) {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = firstAudioFileFromDataTransfer(e.dataTransfer);
                              if (file) void daw.importAudioFile(tr.id, file);
                            }}
                            onClick={() => setSelection({ trackId: tr.id, clipId: c.id })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ')
                                setSelection({ trackId: tr.id, clipId: c.id });
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
                                setSelection((s) =>
                                  s?.clipId === c.id && s.trackId === tr.id ? null : s,
                                );
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

      {editorsOpen ? <footer
        className={`flex shrink-0 flex-col border-t ${
          editorTab === 'piano' ? 'min-h-[240px] flex-1 lg:h-[min(320px,40vh)] lg:max-h-[420px]' : 'h-[148px]'
        }`}
        style={{ borderColor: LP.border, background: LP.panelLo }}
      >
        <div className="flex border-b text-[10px]" style={{ borderColor: LP.border, background: LP.panel }}>
          {(
            [
              { id: 'clip' as const, label: 'Audio editor' },
              { id: 'piano' as const, label: 'Piano Roll' },
              { id: 'score' as const, label: 'Score' },
              { id: 'step' as const, label: 'Step Seq.' },
              { id: 'smart' as const, label: 'Smart Tempo' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={t.id !== 'clip' && t.id !== 'piano'}
              title={t.id !== 'clip' && t.id !== 'piano' ? 'Reserved for future editor' : undefined}
              className={`border-r px-3 py-1.5 font-medium ${
                (t.id === 'clip' && editorTab === 'clip') || (t.id === 'piano' && editorTab === 'piano')
                  ? 'text-white'
                  : 'text-[#999] hover:bg-black/15 disabled:opacity-35'
              }`}
              style={{
                borderColor: LP.border,
                background:
                  (t.id === 'clip' && editorTab === 'clip') || (t.id === 'piano' && editorTab === 'piano')
                    ? LP.accentBlue
                    : 'transparent',
              }}
              onClick={() => {
                if (t.id === 'clip' || t.id === 'piano') setEditorTab(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 items-stretch">
          {editorTab === 'clip' && selectedClip && selectedTrack ? (
            <div className="flex flex-1 items-center gap-3 p-3">
              <div className="h-1 w-10 shrink-0 rounded" style={{ backgroundColor: selectedTrack.color }} />
              <div className="min-h-0 flex-1 rounded border" style={{ borderColor: LP.border, background: '#2a2a2a' }}>
                <WaveformCanvas
                  buffer={selectedClip.buffer}
                  width={Math.min(1200, editorWavWidth)}
                  height={96}
                  color="#e8e8e8"
                  fill="rgba(0,0,0,0.45)"
                />
              </div>
            </div>
          ) : editorTab === 'clip' ? (
            <p className="flex flex-1 items-center px-4 text-[12px]" style={{ color: LP.textMuted }}>
              Select a clip in the timeline for the audio editor.
            </p>
          ) : (
            <PianoRoll trackId={targetTrackId} playheadSec={daw.currentTime} tempo={daw.tempo} />
          )}
        </div>
        {daw.status ? (
          <div className="border-t px-3 py-1.5 text-[11px]" style={{ borderColor: LP.border, background: LP.panel, color: LP.textMuted }}>
            {daw.status}
          </div>
        ) : null}
      </footer> : null}
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
