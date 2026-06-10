import { create } from "zustand";
import type { Track, Clip, TransportState, EffectInstance, EffectId } from "../engine/types";
import { EFFECT_DEFAULTS } from "../engine/Effects";

const TRACK_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

let trackCounter = 0;
let clipCounter = 0;

export const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const METRO_LS_KEY = "wstudio:daw:metro";
function loadPersistedMetro(): Partial<TransportState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(METRO_LS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    const out: Partial<TransportState> = {};
    if (typeof p.metronome === "boolean") out.metronome = p.metronome;
    if (typeof p.metronomeVolume === "number") out.metronomeVolume = p.metronomeVolume;
    if (typeof p.metroAccent === "boolean") out.metroAccent = p.metroAccent;
    if (typeof p.metroCountInBars === "number") out.metroCountInBars = p.metroCountInBars;
    if (typeof p.metroOutputDeviceId === "string") out.metroOutputDeviceId = p.metroOutputDeviceId;
    if (p.bbtDisplayMode === "beats-project" || p.bbtDisplayMode === "beats-time" || p.bbtDisplayMode === "beats" || p.bbtDisplayMode === "time") {
      out.bbtDisplayMode = p.bbtDisplayMode;
    }
    return out;
  } catch { return {}; }
}
function persistMetro(t: TransportState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(METRO_LS_KEY, JSON.stringify({
      metronome: t.metronome,
      metronomeVolume: t.metronomeVolume,
      metroAccent: t.metroAccent,
      metroCountInBars: t.metroCountInBars,
      metroOutputDeviceId: t.metroOutputDeviceId,
      bbtDisplayMode: t.bbtDisplayMode,
    }));
  } catch {}
}

export type DawTool =
  | "pointer" | "pencil" | "eraser" | "scissors" | "glue"
  | "mute" | "zoom" | "fade" | "marquee"
  | "text" | "automation" | "flex" | "trim";

type HistorySnap = { tracks: Track[]; clips: Clip[] };
const HISTORY_LIMIT = 80;

export interface DawState {
  tool: DawTool;
  setTool: (t: DawTool) => void;
  tracks: Track[];
  clips: Clip[];
  transport: TransportState;
  selectedTrackId: string | null;
  selectedClipId: string | null;
  clipboard: Clip | null;
  view: "arrange" | "mixer" | "instrument";
  masterVolume: number;
  pxPerSec: number;
  _past: HistorySnap[];
  _future: HistorySnap[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  addTrack: (kind?: "audio" | "instrument", name?: string, options?: Partial<Pick<Track, "inputEnabled">>) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  reorderTracks: (fromId: string, toId: string) => void;
  moveClipToTrack: (clipId: string, trackId: string) => void;
  addClip: (clip: Clip) => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  removeClip: (id: string) => void;
  splitClipAt: (id: string, time: number) => void;
  copyClip: (id: string) => void;
  cutClip: (id: string) => void;
  pasteClipAt: (trackId: string, time: number) => void;
  duplicateClip: (id: string) => void;
  addEffect: (trackId: string, type: EffectId) => void;
  removeEffect: (trackId: string, effectId: string) => void;
  updateEffect: (trackId: string, effectId: string, patch: Partial<EffectInstance>) => void;
  setTransport: (patch: Partial<TransportState>) => void;
  setView: (view: DawState["view"]) => void;
  selectTrack: (id: string | null) => void;
  selectClip: (id: string | null) => void;
  setPxPerSec: (v: number) => void;
  setMasterVolume: (v: number) => void;
  setMetronomeVolume: (v: number) => void;
  toggleAutomationLane: (trackId: string) => void;
  setAutomationParam: (trackId: string, param: import("../engine/types").AutomationParam) => void;
  addAutomationPoint: (trackId: string, point: import("../engine/types").AutomationPoint) => void;
  updateAutomationPoint: (trackId: string, idx: number, patch: Partial<import("../engine/types").AutomationPoint>) => void;
  removeAutomationPoint: (trackId: string, idx: number) => void;
}
function snap(get: any, set: any) {
  const s = get();
  set({
    _past: [...s._past, { tracks: s.tracks, clips: s.clips }].slice(-HISTORY_LIMIT),
    _future: [],
  });
}



export const useDawStore = create<DawState>((set, get) => ({
  tool: "pointer",
  setTool: (t) => set({ tool: t }),
  tracks: [],
  clips: [],
  transport: {
    isPlaying: false,
    isRecording: false,
    position: 0,
    bpm: 120,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 8,
    metronome: false,
    metronomeVolume: 0.5,
    metroAccent: true,
    metroCountInBars: 0,
    metroOutputDeviceId: undefined,
    keyRoot: "C",
    keyMode: "major",
    timeSigNum: 4,
    timeSigDen: 4,
    tempoMode: "keep",
    bbtDisplayMode: "beats-project",
    ...loadPersistedMetro(),
  },
  selectedTrackId: null,
  selectedClipId: null,
  clipboard: null,
  view: "arrange",
  masterVolume: 0.85,
  pxPerSec: 60,
  _past: [],
  _future: [],
  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,
  undo: () => {
    const { _past, _future, tracks, clips } = get();
    if (_past.length === 0) return;
    const prev = _past[_past.length - 1];
    set({
      _past: _past.slice(0, -1),
      _future: [..._future, { tracks, clips }],
      tracks: prev.tracks,
      clips: prev.clips,
    });
  },
  redo: () => {
    const { _past, _future, tracks, clips } = get();
    if (_future.length === 0) return;
    const next = _future[_future.length - 1];
    set({
      _future: _future.slice(0, -1),
      _past: [..._past, { tracks, clips }].slice(-HISTORY_LIMIT),
      tracks: next.tracks,
      clips: next.clips,
    });
  },

  addTrack: (kind = "audio", name, options) => {
    snap(get, set);
    const id = newId("trk");
    const idx = get().tracks.length;
    const track: Track = {
      id,
      name: name ?? `${kind === "audio" ? "Audio" : "Instrument"} ${++trackCounter}`,
      kind,
      inputEnabled: options?.inputEnabled ?? kind === "audio",
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      effects: [],
      reverbSend: 0,
      delaySend: 0,
      instrument: kind === "instrument" ? "synth" : undefined,
    };
    set({ tracks: [...get().tracks, track], selectedTrackId: id });
    return id;
  },

  removeTrack: (id) => { snap(get, set); set({
    tracks: get().tracks.filter(t => t.id !== id),
    clips: get().clips.filter(c => c.trackId !== id),
    selectedTrackId: get().selectedTrackId === id ? null : get().selectedTrackId,
  }); },

  updateTrack: (id, patch) => { snap(get, set); set({
    tracks: get().tracks.map(t => t.id === id ? { ...t, ...patch } : t),
  }); },

  reorderTracks: (fromId, toId) => {
    const list = [...get().tracks];
    const from = list.findIndex(t => t.id === fromId);
    const to = list.findIndex(t => t.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    snap(get, set);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    set({ tracks: list });
  },

  moveClipToTrack: (clipId, trackId) => { snap(get, set); set({
    clips: get().clips.map(c => c.id === clipId ? { ...c, trackId } : c),
  }); },

  copyClip: (id) => {
    const c = get().clips.find(x => x.id === id);
    if (c) set({ clipboard: { ...c } });
  },

  cutClip: (id) => {
    const c = get().clips.find(x => x.id === id);
    if (!c) return;
    snap(get, set);
    set({ clipboard: { ...c }, clips: get().clips.filter(x => x.id !== id) });
  },

  pasteClipAt: (trackId, time) => {
    const cb = get().clipboard;
    if (!cb) return;
    snap(get, set);
    const clip: Clip = { ...cb, id: newId("clip"), trackId, startTime: Math.max(0, time) };
    set({ clips: [...get().clips, clip] });
  },

  duplicateClip: (id) => {
    const c = get().clips.find(x => x.id === id);
    if (!c) return;
    snap(get, set);
    const clip: Clip = { ...c, id: newId("clip"), startTime: c.startTime + c.duration };
    set({ clips: [...get().clips, clip] });
  },

  addClip: (clip) => {
    snap(get, set);
    const importedAudioFile = !!clip.buffer && clip.name !== "Recording";
    set({
      clips: [...get().clips, clip],
      tracks: importedAudioFile
        ? get().tracks.map(t => t.id === clip.trackId ? { ...t, inputEnabled: false, armed: false } : t)
        : get().tracks,
    });
  },

  updateClip: (id, patch) => { snap(get, set); set({
    clips: get().clips.map(c => c.id === id ? { ...c, ...patch } : c),
  }); },

  removeClip: (id) => { snap(get, set); set({
    clips: get().clips.filter(c => c.id !== id),
    selectedClipId: get().selectedClipId === id ? null : get().selectedClipId,
  }); },

  splitClipAt: (id, time) => {
    const clip = get().clips.find(c => c.id === id);
    if (!clip) return;
    if (time <= clip.startTime || time >= clip.startTime + clip.duration) return;
    snap(get, set);
    const splitOffset = time - clip.startTime;
    const left = { ...clip, duration: splitOffset };
    const right: Clip = {
      ...clip,
      id: newId("clip"),
      startTime: time,
      offset: clip.offset + splitOffset,
      duration: clip.duration - splitOffset,
    };
    set({ clips: get().clips.map(c => c.id === id ? left : c).concat(right) });
  },

  addEffect: (trackId, type) => {
    snap(get, set);
    const fx: EffectInstance = {
      id: newId("fx"),
      type,
      enabled: true,
      params: { ...(EFFECT_DEFAULTS[type] || {}) },
    };
    set({
      tracks: get().tracks.map(t =>
        t.id === trackId ? { ...t, effects: [...t.effects, fx] } : t
      ),
    });
  },

  removeEffect: (trackId, effectId) => { snap(get, set); set({
    tracks: get().tracks.map(t =>
      t.id === trackId ? { ...t, effects: t.effects.filter(e => e.id !== effectId) } : t
    ),
  }); },

  updateEffect: (trackId, effectId, patch) => { snap(get, set); set({
    tracks: get().tracks.map(t =>
      t.id === trackId
        ? { ...t, effects: t.effects.map(e => e.id === effectId ? { ...e, ...patch, params: { ...e.params, ...(patch.params ?? {}) } } : e) }
        : t
    ),
  }); },

  setTransport: (patch) => {
    const next = { ...get().transport, ...patch };
    set({ transport: next });
    const metroKeys = ["metronome","metronomeVolume","metroAccent","metroCountInBars","metroOutputDeviceId","bbtDisplayMode"];
    if (metroKeys.some(k => k in patch)) persistMetro(next);
  },
  setView: (view) => set({ view }),
  selectTrack: (id) => set({ selectedTrackId: id }),
  selectClip: (id) => set({ selectedClipId: id }),
  setPxPerSec: (v) => set({ pxPerSec: Math.max(20, Math.min(400, v)) }),
  setMasterVolume: (v) => set({ masterVolume: v }),
  setMetronomeVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    const next = { ...get().transport, metronomeVolume: vol };
    set({ transport: next });
    persistMetro(next);
  },
}));
