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
  /** Vertical zoom factor applied to track rows in the arrange view (0.5–3). */
  verticalZoom: number;
  setVerticalZoom: (v: number) => void;
  /** Current project name shown in the header. */
  projectName: string;
  setProjectName: (name: string) => void;
  /** Optional file handle for "Save" (when using File System Access API). */
  projectFileHandle: any | null;
  setProjectFileHandle: (h: any | null) => void;
  /** Wipe tracks/clips and reset transport position — used by New / Open. */
  resetProject: (name?: string) => void;
  /** Replace entire project state at once — used by Open. */
  loadProject: (data: { name: string; tracks: Track[]; clips: Clip[]; transport?: Partial<TransportState>; pxPerSec?: number; verticalZoom?: number }) => void;
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
  addEffect: (trackId: string, type: EffectId) => string | null;
  removeEffect: (trackId: string, effectId: string) => void;
  updateEffect: (trackId: string, effectId: string, patch: Partial<EffectInstance>) => void;
  replaceEffectAtSlot: (trackId: string, slotIndex: number, type: EffectId | null) => string | null;
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
  masterVolume: 1,
  pxPerSec: 60,
  verticalZoom: 1,
  setVerticalZoom: (v) => set({ verticalZoom: Math.max(0.5, Math.min(3, v)) }),
  projectName: (typeof window !== "undefined" && localStorage.getItem("wstudio:daw:projectName")) || "Untitled Project",
  setProjectName: (name) => {
    const safe = (name || "Untitled Project").slice(0, 80);
    set({ projectName: safe });
    if (typeof window !== "undefined") { try { localStorage.setItem("wstudio:daw:projectName", safe); } catch {} }
  },
  projectFileHandle: null,
  setProjectFileHandle: (h) => set({ projectFileHandle: h }),
  resetProject: (name) => set({
    tracks: [], clips: [], selectedTrackId: null, selectedClipId: null,
    clipboard: null, _past: [], _future: [],
    projectName: name ?? "Untitled Project",
    projectFileHandle: null,
    transport: { ...get().transport, position: 0, isPlaying: false, isRecording: false },
  }),
  loadProject: (data) => set({
    tracks: data.tracks, clips: data.clips,
    selectedTrackId: null, selectedClipId: null, clipboard: null,
    _past: [], _future: [],
    projectName: data.name || "Untitled Project",
    pxPerSec: data.pxPerSec ?? get().pxPerSec,
    verticalZoom: data.verticalZoom ?? 1,
    transport: { ...get().transport, ...(data.transport ?? {}), position: 0, isPlaying: false, isRecording: false },
  }),
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
      inputEnabled: options?.inputEnabled ?? true,
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      volume: 1,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      effects: [],
      reverbSend: 0,
      delaySend: 0,
      instrument: kind === "instrument" ? "synth" : undefined,
      instrumentPreset: kind === "instrument" ? "Platinum Anthem Lead" : undefined,
      synthWave: kind === "instrument" ? "sawtooth" : undefined,
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
        ? get().tracks.map(t => t.id === clip.trackId && t.kind === "audio" ? { ...t, inputEnabled: false, armed: false } : t)
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
    const track = get().tracks.find(t => t.id === trackId);
    if (!track) return null;
    // No duplicate plug-in type per track (user constraint)
    if (track.effects.some(e => e.type === type)) return null;
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
    return fx.id;
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

  replaceEffectAtSlot: (trackId, slotIndex, type) => {
    const track = get().tracks.find(t => t.id === trackId);
    if (!track) return null;
    const existing = track.effects[slotIndex];
    // Clearing slot → remove
    if (type === null) {
      if (!existing) return null;
      snap(get, set);
      set({
        tracks: get().tracks.map(t =>
          t.id === trackId ? { ...t, effects: t.effects.filter((_, i) => i !== slotIndex) } : t
        ),
      });
      return null;
    }
    // Prevent duplicates anywhere on this track unless it's the same slot keeping its type
    if (track.effects.some((e, i) => e.type === type && i !== slotIndex)) return null;
    snap(get, set);
    const fx: EffectInstance = existing && existing.type === type ? existing : {
      id: newId("fx"),
      type,
      enabled: true,
      params: { ...(EFFECT_DEFAULTS[type] || {}) },
    };
    const newEffects = [...track.effects];
    if (existing) newEffects[slotIndex] = fx;
    else {
      while (newEffects.length < slotIndex) newEffects.push(undefined as any);
      newEffects[slotIndex] = fx;
    }
    // Strip undefined holes
    const compact = newEffects.filter(Boolean);
    set({
      tracks: get().tracks.map(t =>
        t.id === trackId ? { ...t, effects: compact } : t
      ),
    });
    return fx.id;
  },

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
  setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(2, v)) }),
  setMetronomeVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v));
    const next = { ...get().transport, metronomeVolume: vol };
    set({ transport: next });
    persistMetro(next);
  },
  toggleAutomationLane: (trackId) => set({
    tracks: get().tracks.map(t => t.id === trackId ? { ...t, automationOpen: !t.automationOpen, automationParam: t.automationParam ?? "volume" } : t),
  }),
  setAutomationParam: (trackId, param) => set({
    tracks: get().tracks.map(t => t.id === trackId ? { ...t, automationParam: param } : t),
  }),
  addAutomationPoint: (trackId, point) => { snap(get, set); set({
    tracks: get().tracks.map(t => {
      if (t.id !== trackId) return t;
      const param = t.automationParam ?? "volume";
      const lane = [...(t.automation?.[param] ?? []), point].sort((a, b) => a.t - b.t);
      return { ...t, automation: { ...(t.automation ?? {}), [param]: lane } };
    }),
  }); },
  updateAutomationPoint: (trackId, idx, patch) => { set({
    tracks: get().tracks.map(t => {
      if (t.id !== trackId) return t;
      const param = t.automationParam ?? "volume";
      const lane = (t.automation?.[param] ?? []).slice();
      if (!lane[idx]) return t;
      lane[idx] = { ...lane[idx], ...patch };
      lane.sort((a, b) => a.t - b.t);
      return { ...t, automation: { ...(t.automation ?? {}), [param]: lane } };
    }),
  }); },
  removeAutomationPoint: (trackId, idx) => { snap(get, set); set({
    tracks: get().tracks.map(t => {
      if (t.id !== trackId) return t;
      const param = t.automationParam ?? "volume";
      const lane = (t.automation?.[param] ?? []).filter((_, i) => i !== idx);
      return { ...t, automation: { ...(t.automation ?? {}), [param]: lane } };
    }),
  }); },
}));
