import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  anySolo,
  audioBufferFromStereoFloat,
  audioBufferToStereo,
  configureCompressor,
  configureEq,
  configureReverbSend,
  createLibrarySound,
  createWaveformData,
  encodeWavFromAudioBuffer,
  faderToGain,
  getTimelineEndSec,
  mergeStereoChunks,
  midiNoteToFreq,
  offlineRenderMix,
  trackAudible,
  type LibrarySoundId,
} from './audio';
import { DAWEngine } from './dawEngine';
import { MIC_CHAIN_PRESETS, type MicChainPresetId } from './micPresets';
import { hydrateProject, parseProjectJSON, serializeProject } from './projectIO';
import { REMOTE_LIBRARY_FLAT } from './remoteLibrary';
import {
  clipTrimEnd,
  clipTrimStart,
  newTrack,
  type BusId,
  type Clip,
  type ClipSourceMeta,
  type EffectPresetId,
  type EqPresetId,
  type MidiNote,
  type SpacePresetId,
  type Track,
  type TrackKind,
} from './types';

type PlaySession = { t0: number; p0: number };

type TrackNodes = {
  fader: GainNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  dryGain: GainNode;
  sendGain: GainNode;
  conv: ConvolverNode;
  revWet: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
};

type BusNodes = {
  gain: GainNode;
  analyser: AnalyserNode;
};

type NonMasterBus = Exclude<BusId, 'master'>;

type BusMixerState = Record<NonMasterBus, { volume: number; muted: boolean }>;

export const INPUT_SOURCE_OPTIONS = [
  'Built-in microphone',
  'Default input',
  'USB microphone',
  'Line in',
  'Aggregate device',
] as const;

type DawContextValue = {
  tracks: Track[];
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  currentTime: number;
  isPlaying: boolean;
  isRecording: boolean;
  loopEnabled: boolean;
  setLoopEnabled: (v: boolean) => void;
  loopStartSec: number;
  loopEndSec: number;
  setLoopRegionSec: (startSec: number, endSec: number) => void;
  metronomeOn: boolean;
  setMetronomeOn: (v: boolean) => void;
  tempo: number;
  setTempo: (bpm: number) => void;
  beatsPerBar: number;
  /** Normalized 0–1 peaks (track ids, `__master__`, `__mic__`, `bus:<id>`) */
  meterPeaks: Record<string, number>;
  /** Per-sub-bus fader + mute (vocal, drum, reverb aux). */
  busMixer: BusMixerState;
  setBusVolume: (busId: NonMasterBus, v: number) => void;
  toggleBusMute: (busId: NonMasterBus) => void;
  masterVolume: number;
  setMasterVolume: (v: number) => void;
  /** Hard-mutes the main mix at the master gain (Logic-style control-bar M). */
  masterMuted: boolean;
  setMasterMuted: (v: boolean) => void;
  /** Solo only the selected track, or clear all solos if already in that state. */
  toggleExclusiveSoloSelection: () => void;
  status: string;
  addTrackWithKind: (kind: TrackKind) => void;
  removeTrack: (id: string) => void;
  renameTrack: (id: string, name: string) => void;
  setTrackInputSource: (id: string, label: string) => void;
  setTrackVolume: (id: string, v: number) => void;
  setTrackPan: (id: string, p: number) => void;
  setTrackEq: (id: string, preset: EqPresetId) => void;
  setTrackEffect: (id: string, preset: EffectPresetId) => void;
  setTrackSpace: (id: string, preset: SpacePresetId) => void;
  setTrackOutputBus: (trackId: string, busId: BusId) => void;
  setTrackSendReverb: (trackId: string, amount: number) => void;
  applyMicChainPreset: (trackId: string, preset: MicChainPresetId) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  toggleRecordArm: (id: string) => void;
  seek: (t: number) => void;
  rewindToStart: () => void;
  play: () => void;
  stopTransport: () => void;
  startRecord: () => Promise<void>;
  stopRecord: () => void;
  deleteClip: (trackId: string, clipId: string) => void;
  addClipFromBuffer: (
    trackId: string,
    buffer: AudioBuffer,
    startTime?: number,
    sourceMeta?: ClipSourceMeta,
  ) => void;
  addLibraryClip: (trackId: string, preset: LibrarySoundId) => void;
  addRemoteLibraryClip: (trackId: string, remoteId: string) => Promise<void>;
  importAudioFile: (trackId: string, file: File) => Promise<void>;
  exportMixWav: () => Promise<void>;
  exportProjectJson: () => void;
  importProjectJson: (json: string) => Promise<void>;
  addMidiNote: (trackId: string, note: Omit<MidiNote, 'id'>) => void;
  removeMidiNote: (trackId: string, noteId: string) => void;
  updateMidiNote: (trackId: string, noteId: string, patch: Partial<Omit<MidiNote, 'id'>>) => void;
  setBeatsPerBar: (n: number) => void;
  /** Lane receiving input while recording (for live waveform overlay). */
  recordingTrackId: string | null;
  /** Normalized mic peaks while recording (for live strip). */
  recordingLivePeaks: number[];
  /** Timeline time when the current take started (punch-in). */
  recordingPunchInTime: number | null;
  moveClip: (trackId: string, clipId: string, startTime: number) => void;
  trimClipEdge: (clipId: string, edge: 'left' | 'right', deltaSec: number) => void;
  /** Linear gain before the track fader (1 = unity, 0 = mute, max 4 ≈ +12 dB). */
  setClipGain: (trackId: string, clipId: string, gain: number) => void;
};

const DawContext = createContext<DawContextValue | null>(null);

function ensureAudioCtx(ref: React.MutableRefObject<AudioContext | null>) {
  if (!ref.current) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ref.current = new Ctx();
  }
  return ref.current;
}

export function DawProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>(() => [
    newTrack('Audio 1', 0, 'record_audio'),
    newTrack('Audio 2', 1, 'import_audio'),
  ]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStartSec, setLoopStartSec] = useState(0);
  const [loopEndSec, setLoopEndSec] = useState(() => (60 / 120) * 4 * 4);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [meterPeaks, setMeterPeaks] = useState<Record<string, number>>({});
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [masterMuted, setMasterMutedState] = useState(false);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const [recordingLivePeaks, setRecordingLivePeaks] = useState<number[]>([]);
  const [recordingPunchInTime, setRecordingPunchInTime] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [busMixer, setBusMixer] = useState<BusMixerState>(() => ({
    reverbA: { volume: 0.88, muted: false },
    drumBus: { volume: 0.88, muted: false },
    vocalBus: { volume: 0.88, muted: false },
  }));

  const loopEnabledRef = useRef(loopEnabled);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  const loopStartSecRef = useRef(loopStartSec);
  const loopEndSecRef = useRef(loopEndSec);
  useEffect(() => {
    loopStartSecRef.current = loopStartSec;
  }, [loopStartSec]);
  useEffect(() => {
    loopEndSecRef.current = loopEndSec;
  }, [loopEndSec]);

  const setLoopRegionSec = useCallback((a: number, b: number) => {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.max(lo + 0.05, Math.max(a, b));
    setLoopStartSec(lo);
    setLoopEndSec(hi);
  }, []);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const trackNodesRef = useRef(new Map<string, TrackNodes>());
  const busNodesRef = useRef(new Map<string, BusNodes>());
  const activeSourcesRef = useRef<AudioScheduledSourceNode[]>([]);
  const playSessionRef = useRef<PlaySession | null>(null);
  const rafRef = useRef<number>(0);
  const metroIntervalRef = useRef<number>(0);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  const masterVolumeRef = useRef(masterVolume);
  useEffect(() => {
    masterVolumeRef.current = masterVolume;
  }, [masterVolume]);

  const masterMutedRef = useRef(masterMuted);
  useEffect(() => {
    masterMutedRef.current = masterMuted;
  }, [masterMuted]);

  const busMixerRef = useRef(busMixer);
  useEffect(() => {
    busMixerRef.current = busMixer;
  }, [busMixer]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    for (const [busId, nodes] of busNodesRef.current.entries()) {
      const bm = busMixer[busId as NonMasterBus];
      if (!bm) continue;
      nodes.gain.gain.value = bm.muted ? 0 : faderToGain(bm.volume);
    }
  }, [busMixer]);

  useEffect(() => {
    if (tracks.length && !selectedTrackId) {
      setSelectedTrackId(tracks[0].id);
    }
  }, [tracks, selectedTrackId]);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /** Seed first two tracks once per browser tab so lanes show waveforms (avoids Strict Mode double-insert). */
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wstudio_arrange_demo_v1') === '1') return;
    const ctx = ensureAudioCtx(audioCtxRef);
    void ctx.resume().then(() => {
      const kick = createLibrarySound(ctx, 'kick');
      const snare = createLibrarySound(ctx, 'snare');
      setTracks((prev) => {
        if (prev.length < 2) return prev;
        if (prev[0]!.clips.length > 0 || prev[1]!.clips.length > 0) return prev;
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('wstudio_arrange_demo_v1', '1');
        return prev.map((tr, i) => {
          if (i === 0) {
            return {
              ...tr,
              clips: [{ id: crypto.randomUUID(), startTime: 0, buffer: kick }],
            };
          }
          if (i === 1) {
            return {
              ...tr,
              clips: [{ id: crypto.randomUUID(), startTime: 1.15, buffer: snare }],
            };
          }
          return tr;
        });
      });
    });
    return undefined;
  }, []);

  const disposeTrackNodes = useCallback((ctx: AudioContext) => {
    for (const n of trackNodesRef.current.values()) {
      try {
        n.fader.disconnect();
        n.low.disconnect();
        n.mid.disconnect();
        n.high.disconnect();
        n.comp.disconnect();
        n.dryGain.disconnect();
        n.sendGain.disconnect();
        n.conv.disconnect();
        n.revWet.disconnect();
        n.pan.disconnect();
        n.analyser.disconnect();
      } catch {
        /* ignore */
      }
    }
    trackNodesRef.current.clear();
    for (const b of busNodesRef.current.values()) {
      try {
        b.gain.disconnect();
        b.analyser.disconnect();
      } catch {
        /* ignore */
      }
    }
    busNodesRef.current.clear();
    try {
      masterGainRef.current?.disconnect();
      masterAnalyserRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    masterGainRef.current = null;
    masterAnalyserRef.current = null;
  }, []);

  const applyMasterGain = useCallback(() => {
    const ctx = audioCtxRef.current;
    const g = masterGainRef.current;
    if (!ctx || !g) return;
    const vol = Math.max(0, Math.min(1, masterVolumeRef.current));
    const eff = masterMutedRef.current ? 0 : vol;
    try {
      g.gain.setValueAtTime(eff, ctx.currentTime);
    } catch {
      g.gain.value = eff;
    }
  }, []);

  const ensureMaster = useCallback((ctx: AudioContext) => {
    if (!masterGainRef.current || !masterAnalyserRef.current) {
      const mg = ctx.createGain();
      const vol = Math.max(0, Math.min(1, masterVolumeRef.current));
      mg.gain.value = masterMutedRef.current ? 0 : vol;
      const ma = ctx.createAnalyser();
      ma.fftSize = 1024;
      ma.smoothingTimeConstant = 0.55;
      mg.connect(ma);
      ma.connect(ctx.destination);
      masterGainRef.current = mg;
      masterAnalyserRef.current = ma;
    }
    return masterGainRef.current;
  }, []);

  const ensureBusNodes = useCallback((ctx: AudioContext, busId: NonMasterBus, master: GainNode) => {
    const existing = busNodesRef.current.get(busId);
    if (existing) return existing;
    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);
    analyser.connect(master);
    const nodes = { gain, analyser };
    busNodesRef.current.set(busId, nodes);
    return nodes;
  }, []);

  const ensureTrackNodes = useCallback((ctx: AudioContext, trackId: string) => {
    let t = trackNodesRef.current.get(trackId);
    if (!t) {
      void ensureMaster(ctx);
      const fader = ctx.createGain();
      const low = ctx.createBiquadFilter();
      const mid = ctx.createBiquadFilter();
      const high = ctx.createBiquadFilter();
      const comp = ctx.createDynamicsCompressor();
      const dryGain = ctx.createGain();
      const sendGain = ctx.createGain();
      const conv = ctx.createConvolver();
      const revWet = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.62;
      low.connect(mid);
      mid.connect(high);
      high.connect(comp);
      comp.connect(dryGain);
      dryGain.connect(pan);
      comp.connect(sendGain);
      sendGain.connect(conv);
      conv.connect(revWet);
      revWet.connect(pan);
      pan.connect(fader);
      fader.connect(analyser);
      t = { fader, low, mid, high, comp, dryGain, sendGain, conv, revWet, pan, analyser };
      trackNodesRef.current.set(trackId, t);
    }
    return t;
  }, [ensureMaster]);

  const syncTrackNodeParams = useCallback(
    (ctx: AudioContext, track: Track, soloAny: boolean) => {
      const nodes = ensureTrackNodes(ctx, track.id);
      const audible = trackAudible(track, soloAny);
      nodes.fader.gain.value = audible ? faderToGain(track.volume) : 0;
      nodes.pan.pan.value = track.pan;
      configureEq(nodes.low, nodes.mid, nodes.high, track.eqPreset, ctx);
      configureCompressor(nodes.comp, track.effectPreset);
      configureReverbSend(nodes.conv, nodes.revWet, track.spacePreset, ctx);
      nodes.sendGain.gain.value = track.spacePreset === 'off' ? 0 : (track.sendReverb ?? 0.18);
      nodes.dryGain.gain.value = 1;

      const masterIn = masterGainRef.current;
      if (!masterIn) return;
      nodes.analyser.disconnect();
      const busId = track.outputBus ?? 'master';
      if (busId === 'master') {
        nodes.analyser.connect(masterIn);
      } else {
        const bus = ensureBusNodes(ctx, busId, masterIn);
        const bm = busMixerRef.current[busId];
        nodes.analyser.connect(bus.gain);
        bus.gain.gain.value = bm.muted ? 0 : faderToGain(bm.volume);
      }
    },
    [ensureTrackNodes, ensureBusNodes],
  );

  const schedulePlayback = useCallback(
    (ctx: AudioContext, t0: number, p0: number) => {
      const soloAny = anySolo(tracksRef.current);
      const tempo = Math.max(40, tempoRef.current);
      const spb = 60 / tempo;
      for (const tr of tracksRef.current) {
        syncTrackNodeParams(ctx, tr, soloAny);
        if (!trackAudible(tr, soloAny)) continue;
        const nodes = ensureTrackNodes(ctx, tr.id);
        for (const clip of tr.clips) {
          const src = DAWEngine.scheduleClipIfAudible(ctx, clip, nodes.low, t0, p0);
          if (src) activeSourcesRef.current.push(src);
        }
        for (const note of tr.midiNotes) {
          const ns = note.startBeats * spb;
          const ne = ns + note.durationBeats * spb;
          if (ne <= p0) continue;
          const playFrom = Math.max(p0, ns);
          const dur = ne - playFrom;
          if (dur <= 0) continue;
          const when = t0 + (playFrom - p0);
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          const vel = Math.max(0.08, Math.min(1, note.velocity)) * 0.12;
          osc.type = 'triangle';
          osc.frequency.value = midiNoteToFreq(note.pitch);
          osc.connect(env);
          env.connect(nodes.low);
          env.gain.setValueAtTime(0, when);
          env.gain.linearRampToValueAtTime(vel, when + 0.008);
          env.gain.setValueAtTime(vel, when + Math.max(0.012, dur - 0.025));
          env.gain.exponentialRampToValueAtTime(0.0008, when + dur);
          osc.start(when);
          osc.stop(when + dur + 0.03);
          activeSourcesRef.current.push(osc);
        }
      }
    },
    [ensureTrackNodes, syncTrackNodeParams],
  );

  const stopPlaybackSources = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try {
        s.stop();
        s.disconnect();
      } catch {
        /* ignore */
      }
    }
    activeSourcesRef.current = [];
  }, []);

  const stopPlayheadRaf = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const restartPlaybackAt = useCallback(
    async (p0: number) => {
      const ctx = ensureAudioCtx(audioCtxRef);
      if (ctx.state === 'suspended') await ctx.resume();

      stopPlaybackSources();

      const t0 = ctx.currentTime + 0.01;
      playSessionRef.current = { t0, p0 };
      schedulePlayback(ctx, t0, p0);
      setCurrentTime(p0);
    },
    [schedulePlayback, stopPlaybackSources],
  );

  const tickPlayhead = useCallback(() => {
    const ctx = audioCtxRef.current;
    const sess = playSessionRef.current;
    if (!ctx || !sess) return;

    const raw = sess.p0 + (ctx.currentTime - sess.t0);
    const safeRaw = Math.max(0, raw);
    const ls = loopStartSecRef.current;
    const le = loopEndSecRef.current;
    const end = getTimelineEndSec(tracksRef.current, tempoRef.current);

    if (loopEnabledRef.current && le > ls + 0.01) {
      if (safeRaw >= le) {
        void restartPlaybackAt(ls);
        setStatus('Loop…');
        rafRef.current = requestAnimationFrame(tickPlayhead);
        return;
      }
      setCurrentTime(Math.min(safeRaw, le));
      rafRef.current = requestAnimationFrame(tickPlayhead);
      return;
    }

    if (end > 0.02 && safeRaw >= end) {
      stopPlaybackSources();
      stopPlayheadRaf();
      playSessionRef.current = null;
      setIsPlaying(false);
      setCurrentTime(end);
      setStatus('End of timeline.');
      return;
    }

    setCurrentTime(safeRaw);
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [restartPlaybackAt, stopPlaybackSources, stopPlayheadRaf]);

  const stopTransport = useCallback(() => {
    if (metroIntervalRef.current) {
      clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = 0;
    }
    playSessionRef.current = null;
    stopPlaybackSources();
    stopPlayheadRaf();
    setIsPlaying(false);
  }, [stopPlaybackSources, stopPlayheadRaf]);

  const play = useCallback(() => {
    void (async () => {
      const ctx = ensureAudioCtx(audioCtxRef);
      if (ctx.state === 'suspended') await ctx.resume();
      stopTransport();
      await restartPlaybackAt(currentTimeRef.current);
      setIsPlaying(true);
      setStatus((s) => (s.startsWith('Recording') ? 'Recording + playback…' : ''));
      rafRef.current = requestAnimationFrame(tickPlayhead);
    })();
  }, [restartPlaybackAt, stopTransport, tickPlayhead]);

  useEffect(() => {
    if (!isPlaying || !metronomeOn) {
      if (metroIntervalRef.current) {
        clearInterval(metroIntervalRef.current);
        metroIntervalRef.current = 0;
      }
      return;
    }
    const ctx = ensureAudioCtx(audioCtxRef);
    void ctx.resume();
    const tick = () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1100;
      g.gain.value = 0.07;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      o.start(now);
      o.stop(now + 0.04);
    };
    const ms = (60 / tempoRef.current) * 1000;
    metroIntervalRef.current = window.setInterval(tick, ms);
    return () => {
      if (metroIntervalRef.current) clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = 0;
    };
  }, [isPlaying, metronomeOn]);

  const meterHoldRef = useRef<Record<string, number>>({});
  useEffect(() => {
    let id = 0;
    const sample = () => {
      const out: Record<string, number> = {};
      for (const [tid, nodes] of trackNodesRef.current.entries()) {
        const a = nodes.analyser;
        const buf = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]! - 128) / 128;
          if (v > peak) peak = v;
        }
        const prev = meterHoldRef.current[tid] ?? 0;
        const v = Math.max(peak, prev * 0.88);
        meterHoldRef.current[tid] = v;
        out[tid] = v;
      }
      const ma = masterAnalyserRef.current;
      if (ma) {
        const buf = new Uint8Array(ma.fftSize);
        ma.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]! - 128) / 128;
          if (v > peak) peak = v;
        }
        const prev = meterHoldRef.current.__master__ ?? 0;
        const v = Math.max(peak, prev * 0.88);
        meterHoldRef.current.__master__ = v;
        out.__master__ = v;
      }
      for (const [bid, bnodes] of busNodesRef.current.entries()) {
        const a = bnodes.analyser;
        const buf = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]! - 128) / 128;
          if (v > peak) peak = v;
        }
        const key = `bus:${bid}`;
        const prev = meterHoldRef.current[key] ?? 0;
        const v = Math.max(peak, prev * 0.88);
        meterHoldRef.current[key] = v;
        out[key] = v;
      }
      const micA = micInputAnalyserRef.current;
      if (micA && isRecordingRef.current) {
        const buf = new Uint8Array(micA.fftSize);
        micA.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]! - 128) / 128;
          if (v > peak) peak = v;
        }
        const prev = meterHoldRef.current.__mic__ ?? 0;
        const v = Math.max(peak, prev * 0.85);
        meterHoldRef.current.__mic__ = v;
        out.__mic__ = v;
        const nowWall = performance.now();
        if (nowWall - lastRecWavePushRef.current > 48) {
          lastRecWavePushRef.current = nowWall;
          recordingHistoryRef.current.push(Math.min(1, peak * 2.2));
          if (recordingHistoryRef.current.length > 360) recordingHistoryRef.current.shift();
          setRecordingLivePeaks(recordingHistoryRef.current.slice());
        }
      } else {
        meterHoldRef.current.__mic__ = 0;
      }

      const actx = audioCtxRef.current;
      const tAnchor = recordTimelineAnchorRef.current;
      if (tAnchor && actx && isRecordingRef.current && !isPlayingRef.current) {
        const tLin = tAnchor.timeline + (actx.currentTime - tAnchor.ctx);
        setCurrentTime(Math.max(0, tLin));
      }

      setMeterPeaks(out);
      id = requestAnimationFrame(sample);
    };
    id = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(id);
  }, []);

  const seek = useCallback(
    (t: number) => {
      void (async () => {
        const next = Math.max(0, t);
        if (isPlayingRef.current) {
          await restartPlaybackAt(next);
        } else {
          setCurrentTime(next);
        }
      })();
    },
    [restartPlaybackAt],
  );

  const rewindToStart = useCallback(() => {
    seek(0);
  }, [seek]);

  const micStreamRef = useRef<MediaStream | null>(null);
  const recordStereoChunksRef = useRef<{ L: Float32Array; R: Float32Array }[]>([]);
  const recordProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const recordSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordMuteRef = useRef<GainNode | null>(null);
  const micInputAnalyserRef = useRef<AnalyserNode | null>(null);
  const micInputSilentRef = useRef<GainNode | null>(null);
  const recordStartTimeRef = useRef(0);
  const recordingActiveRef = useRef(false);
  /** Sync playhead while recording: timeline = timeline0 + (ctxNow - ctx0) */
  const recordTimelineAnchorRef = useRef<{ ctx: number; timeline: number } | null>(null);
  const recordingHistoryRef = useRef<number[]>([]);
  const lastRecWavePushRef = useRef(0);

  const teardownMicGraph = useCallback(() => {
    recordingActiveRef.current = false;
    recordTimelineAnchorRef.current = null;
    setRecordingTrackId(null);
    setRecordingPunchInTime(null);
    setRecordingLivePeaks([]);
    recordingHistoryRef.current = [];
    try {
      recordProcessorRef.current?.disconnect();
      recordSourceRef.current?.disconnect();
      recordMuteRef.current?.disconnect();
      micInputAnalyserRef.current?.disconnect();
      micInputSilentRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    recordProcessorRef.current = null;
    recordSourceRef.current = null;
    recordMuteRef.current = null;
    micInputAnalyserRef.current = null;
    micInputSilentRef.current = null;
    micStreamRef.current?.getTracks().forEach((x) => x.stop());
    micStreamRef.current = null;
    recordStereoChunksRef.current = [];
  }, []);

  const startRecord = useCallback(async () => {
    if (isRecording) return;
    const armed = tracksRef.current.find((x) => x.recordArm);
    const targetId = armed?.id ?? selectedTrackId ?? tracksRef.current[0]?.id;
    if (!targetId) {
      setStatus('No track to record. Arm a track (R) or select one.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: { ideal: 2 },
        },
        video: false,
      });
      const ctx = ensureAudioCtx(audioCtxRef);
      if (ctx.state === 'suspended') await ctx.resume();

      ensureMaster(ctx);
      recordStartTimeRef.current = currentTimeRef.current;
      recordStereoChunksRef.current = [];
      recordingHistoryRef.current = [];
      lastRecWavePushRef.current = performance.now();
      setRecordingLivePeaks([]);
      setRecordingPunchInTime(currentTimeRef.current);
      recordTimelineAnchorRef.current = { ctx: ctx.currentTime, timeline: currentTimeRef.current };
      setRecordingTrackId(targetId);

      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 2, 2);
      const mute = ctx.createGain();
      mute.gain.value = 0;

      proc.onaudioprocess = (e) => {
        if (!recordingActiveRef.current) return;
        const ib = e.inputBuffer;
        const L = new Float32Array(ib.getChannelData(0));
        const R =
          ib.numberOfChannels > 1
            ? new Float32Array(ib.getChannelData(1))
            : new Float32Array(L);
        recordStereoChunksRef.current.push({ L, R });
      };

      const inputAnalyser = ctx.createAnalyser();
      inputAnalyser.fftSize = 512;
      inputAnalyser.smoothingTimeConstant = 0.45;
      const inputSilent = ctx.createGain();
      inputSilent.gain.value = 0;
      src.connect(inputAnalyser);
      inputAnalyser.connect(inputSilent);
      inputSilent.connect(ctx.destination);

      src.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);

      micStreamRef.current = stream;
      recordSourceRef.current = src;
      recordProcessorRef.current = proc;
      recordMuteRef.current = mute;
      micInputAnalyserRef.current = inputAnalyser;
      micInputSilentRef.current = inputSilent;
      recordingActiveRef.current = true;

      setIsRecording(true);
      setStatus(
        isPlaying
          ? 'Recording… (stereo where supported; meter shows input).'
          : 'Recording… Use Play for overdub. Watch input meter.',
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Mic error: ${msg}`);
    }
  }, [ensureMaster, isPlaying, isRecording, selectedTrackId]);

  const stopRecord = useCallback(() => {
    if (!isRecording) return;
    const ctx = audioCtxRef.current;
    const armed = tracksRef.current.find((x) => x.recordArm);
    const targetId = armed?.id ?? selectedTrackId ?? tracksRef.current[0]?.id;
    const startSec = recordStartTimeRef.current;
    const chunks = recordStereoChunksRef.current.slice();
    recordingActiveRef.current = false;
    teardownMicGraph();
    setIsRecording(false);

    if (!ctx || !targetId) {
      setStatus('Recording stopped.');
      return;
    }

    if (chunks.length === 0) {
      setStatus('No audio captured — check mic permission.');
      return;
    }

    const merged = mergeStereoChunks(chunks);
    if (merged.L.length < 64) {
      setStatus('Take too short — nothing saved.');
      return;
    }

    const buf = audioBufferFromStereoFloat(ctx, merged.L, merged.R, ctx.sampleRate);
    let peaks: number[];
    try {
      peaks = createWaveformData(buf, 120);
    } catch {
      peaks = [];
    }
    const clip: Clip = {
      id: crypto.randomUUID(),
      startTime: startSec,
      buffer: buf,
      name: 'Take 1',
      trimStart: 0,
      trimEnd: buf.duration,
      clipGain: 1,
      waveformPeaks: peaks,
    };

    setTracks((prev) =>
      prev.map((tr) => (tr.id === targetId ? { ...tr, clips: [...tr.clips, clip] } : tr)),
    );
    setCurrentTime(startSec + buf.duration);
    const nm = tracksRef.current.find((t) => t.id === targetId)?.name ?? 'track';
    setStatus(`Saved stereo clip (${buf.duration.toFixed(2)}s) on ${nm}.`);
  }, [isRecording, selectedTrackId, teardownMicGraph]);

  const setMasterVolume = useCallback(
    (v: number) => {
      const nv = Math.max(0, Math.min(1, v));
      setMasterVolumeState(nv);
      masterVolumeRef.current = nv;
      applyMasterGain();
    },
    [applyMasterGain],
  );

  const setMasterMuted = useCallback(
    (muted: boolean) => {
      setMasterMutedState(muted);
      masterMutedRef.current = muted;
      applyMasterGain();
    },
    [applyMasterGain],
  );

  const addTrackWithKind = useCallback((kind: TrackKind) => {
    setTracks((prev) => [...prev, newTrack('', prev.length, kind)]);
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.id !== id);
    });
    setSelectedTrackId((cur) => (cur === id ? null : cur));
    const nodes = trackNodesRef.current.get(id);
    if (nodes) {
      try {
        nodes.fader.disconnect();
        nodes.low.disconnect();
        nodes.mid.disconnect();
        nodes.high.disconnect();
        nodes.comp.disconnect();
        nodes.dryGain.disconnect();
        nodes.sendGain.disconnect();
        nodes.conv.disconnect();
        nodes.revWet.disconnect();
        nodes.pan.disconnect();
        nodes.analyser.disconnect();
      } catch {
        /* ignore */
      }
      trackNodesRef.current.delete(id);
    }
  }, []);

  const renameTrack = useCallback((id: string, name: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const setTrackInputSource = useCallback((id: string, label: string) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, inputSource: label } : t)));
  }, []);

  const setTrackVolume = useCallback(
    (id: string, v: number) => {
      const vol = Math.max(0, Math.min(1, v));
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, volume: vol } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackPan = useCallback(
    (id: string, p: number) => {
      const pan = Math.max(-1, Math.min(1, p));
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, pan } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackEq = useCallback(
    (id: string, preset: EqPresetId) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, eqPreset: preset } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackEffect = useCallback(
    (id: string, preset: EffectPresetId) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, effectPreset: preset } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackSpace = useCallback(
    (id: string, preset: SpacePresetId) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, spacePreset: preset } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackOutputBus = useCallback(
    (id: string, busId: BusId) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, outputBus: busId } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setTrackSendReverb = useCallback(
    (id: string, amount: number) => {
      const v = Math.max(0, Math.min(1, amount));
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, sendReverb: v } : t));
        if (ctx) {
          const tr = next.find((t) => t.id === id);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const setBusVolume = useCallback((busId: NonMasterBus, vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setBusMixer((prev) => ({
      ...prev,
      [busId]: { ...prev[busId], volume: v },
    }));
  }, []);

  const toggleBusMute = useCallback((busId: NonMasterBus) => {
    setBusMixer((prev) => ({
      ...prev,
      [busId]: { ...prev[busId], muted: !prev[busId].muted },
    }));
  }, []);

  const applyMicChainPreset = useCallback(
    (trackId: string, micId: MicChainPresetId) => {
      const chain = MIC_CHAIN_PRESETS.find((p) => p.id === micId);
      if (!chain) return;
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) =>
          t.id === trackId
            ? { ...t, eqPreset: chain.eq, effectPreset: chain.fx, spacePreset: chain.space }
            : t,
        );
        if (ctx) {
          const tr = next.find((t) => t.id === trackId);
          if (tr) syncTrackNodeParams(ctx, tr, anySolo(next));
        }
        return next;
      });
      setStatus(`Mic chain: ${chain.label}`);
    },
    [syncTrackNodeParams],
  );

  const toggleMute = useCallback(
    (id: string) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t));
        if (ctx) {
          const soloAny = anySolo(next);
          for (const tr of next) syncTrackNodeParams(ctx, tr, soloAny);
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const toggleSolo = useCallback(
    (id: string) => {
      const ctx = audioCtxRef.current;
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t));
        if (ctx) {
          const soloAny = anySolo(next);
          for (const tr of next) syncTrackNodeParams(ctx, tr, soloAny);
        }
        return next;
      });
    },
    [syncTrackNodeParams],
  );

  const toggleExclusiveSoloSelection = useCallback(() => {
    const ctx = audioCtxRef.current;
    const sel = selectedTrackId;
    if (!sel) return;
    setTracks((prev) => {
      const soloed = prev.filter((t) => t.solo);
      const onlyThis = soloed.length === 1 && soloed[0].id === sel;
      const next = onlyThis
        ? prev.map((t) => ({ ...t, solo: false }))
        : prev.map((t) => ({ ...t, solo: t.id === sel }));
      if (ctx) {
        const soloAny = anySolo(next);
        for (const tr of next) syncTrackNodeParams(ctx, tr, soloAny);
      }
      return next;
    });
  }, [selectedTrackId, syncTrackNodeParams]);

  const toggleRecordArm = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return { ...t, recordArm: false };
        return { ...t, recordArm: !t.recordArm };
      }),
    );
    setSelectedTrackId(id);
  }, []);

  const deleteClip = useCallback((trackId: string, clipId: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t,
      ),
    );
  }, []);

  const moveClip = useCallback((trackId: string, clipId: string, startTime: number) => {
    const t = Math.max(0, startTime);
    setTracks((prev) =>
      prev.map((tr) =>
        tr.id !== trackId
          ? tr
          : { ...tr, clips: tr.clips.map((c) => (c.id === clipId ? { ...c, startTime: t } : c)) },
      ),
    );
  }, []);

  const trimClipEdge = useCallback((clipId: string, edge: 'left' | 'right', deltaSec: number) => {
    setTracks((prev) =>
      prev.map((tr) => ({
        ...tr,
        clips: tr.clips.map((c) => {
          if (c.id !== clipId) return c;
          const ts = clipTrimStart(c);
          const te = clipTrimEnd(c);
          const bufMax = c.buffer.duration;
          if (edge === 'left') {
            const newTrimStart = Math.max(0, ts + deltaSec);
            const maxTs = te - 0.05;
            const safeTS = Math.min(newTrimStart, maxTs);
            const diff = safeTS - ts;
            return {
              ...c,
              trimStart: safeTS,
              startTime: c.startTime + diff,
            };
          }
          const newTrimEnd = te + deltaSec;
          const minTe = ts + 0.05;
          const safeTE = Math.max(newTrimEnd, minTe);
          const capped = Math.min(safeTE, bufMax);
          return { ...c, trimEnd: capped };
        }),
      })),
    );
  }, []);

  const setClipGain = useCallback((trackId: string, clipId: string, gain: number) => {
    const g = Math.max(0, Math.min(4, gain));
    setTracks((prev) =>
      prev.map((tr) =>
        tr.id !== trackId
          ? tr
          : {
              ...tr,
              clips: tr.clips.map((c) => (c.id === clipId ? { ...c, clipGain: g } : c)),
            },
      ),
    );
  }, []);

  const addClipFromBuffer = useCallback(
    (trackId: string, buffer: AudioBuffer, startTime?: number, sourceMeta?: ClipSourceMeta) => {
      const at = startTime ?? currentTimeRef.current;
      let peaks: number[];
      try {
        peaks = createWaveformData(buffer, 100);
      } catch {
        peaks = [];
      }
      const clip: Clip = {
        id: crypto.randomUUID(),
        startTime: Math.max(0, at),
        buffer,
        trimStart: 0,
        trimEnd: buffer.duration,
        clipGain: 1,
        waveformPeaks: peaks,
        ...(sourceMeta ? { sourceMeta } : {}),
      };
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)),
      );
      setStatus(`Added clip (${buffer.duration.toFixed(2)}s) at ${at.toFixed(2)}s.`);
    },
    [],
  );

  const addLibraryClip = useCallback(
    (trackId: string, preset: LibrarySoundId) => {
      const ctx = ensureAudioCtx(audioCtxRef);
      void ctx.resume();
      const buf = createLibrarySound(ctx, preset);
      addClipFromBuffer(trackId, buf, undefined, { type: 'library', soundId: preset });
    },
    [addClipFromBuffer],
  );

  const addRemoteLibraryClip = useCallback(
    async (trackId: string, remoteId: string) => {
      const item = REMOTE_LIBRARY_FLAT.find((x) => x.id === remoteId);
      if (!item) {
        setStatus('Unknown remote sample.');
        return;
      }
      try {
        setStatus(`Loading ${item.name}…`);
        const ctx = ensureAudioCtx(audioCtxRef);
        await ctx.resume();
        const res = await fetch(item.url, { mode: 'cors' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const ab = await res.arrayBuffer();
        const raw = await ctx.decodeAudioData(ab.slice(0));
        const buf = audioBufferToStereo(ctx, raw);
        addClipFromBuffer(trackId, buf, undefined, { type: 'remote', remoteId: item.id });
        setStatus(`Added: ${item.name} (${item.source})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`Remote sample failed (${item.name}): ${msg}`);
      }
    },
    [addClipFromBuffer],
  );

  const importAudioFile = useCallback(
    async (trackId: string, file: File) => {
      try {
        const ctx = ensureAudioCtx(audioCtxRef);
        await ctx.resume();
        const ab = await file.arrayBuffer();
        const raw = await ctx.decodeAudioData(ab.slice(0));
        const buf = audioBufferToStereo(ctx, raw);
        addClipFromBuffer(trackId, buf, currentTimeRef.current);
        setStatus(`Imported ${file.name} (${buf.numberOfChannels} ch) at playhead.`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`Import failed: ${msg}`);
      }
    },
    [addClipFromBuffer],
  );

  const addMidiNote = useCallback((trackId: string, note: Omit<MidiNote, 'id'>) => {
    const id = crypto.randomUUID();
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, midiNotes: [...t.midiNotes, { ...note, id }] } : t,
      ),
    );
  }, []);

  const removeMidiNote = useCallback((trackId: string, noteId: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, midiNotes: t.midiNotes.filter((n) => n.id !== noteId) } : t,
      ),
    );
  }, []);

  const updateMidiNote = useCallback(
    (trackId: string, noteId: string, patch: Partial<Omit<MidiNote, 'id'>>) => {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                midiNotes: t.midiNotes.map((n) =>
                  n.id === noteId ? { ...n, ...patch, id: noteId } : n,
                ),
              }
            : t,
        ),
      );
    },
    [],
  );

  const exportProjectJson = useCallback(() => {
    try {
      const json = serializeProject(tracksRef.current, tempoRef.current, beatsPerBar);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daw-project-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Project JSON downloaded.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Export project failed: ${msg}`);
    }
  }, [beatsPerBar]);

  const importProjectJson = useCallback(
    async (json: string) => {
      const data = parseProjectJSON(json);
      if (!data) {
        setStatus('Invalid or unsupported project file.');
        return;
      }
      stopTransport();
      const ctx = ensureAudioCtx(audioCtxRef);
      if (ctx) disposeTrackNodes(ctx);
      await ctx.resume();
      try {
        const next = await hydrateProject(data, ctx);
        setTracks(next);
        setSelectedTrackId(next[0]?.id ?? null);
        setTempo(data.tempo);
        setBeatsPerBar(Math.min(12, Math.max(1, data.beatsPerBar || 4)));
        setCurrentTime(0);
        setStatus(`Loaded project (${next.length} tracks).`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`Import failed: ${msg}`);
      }
    },
    [disposeTrackNodes, stopTransport],
  );

  const exportMixWav = useCallback(async () => {
    const list = tracksRef.current;
    const end = getTimelineEndSec(list, tempoRef.current);
    if (end <= 0.05) {
      setStatus('Nothing to export.');
      return;
    }
    setStatus('Exporting…');
    try {
      const sr = audioCtxRef.current?.sampleRate ?? 48000;
      const rendered = await offlineRenderMix(list, end + 0.1, sr, tempoRef.current);
      const wav = encodeWavFromAudioBuffer(rendered);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mix-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Mix downloaded.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(`Export failed: ${msg}`);
    }
  }, []);

  useEffect(
    () => () => {
      stopTransport();
      teardownMicGraph();
      const ctx = audioCtxRef.current;
      if (ctx) {
        disposeTrackNodes(ctx);
        ctx.close().catch(() => {});
      }
    },
    [disposeTrackNodes, stopTransport, teardownMicGraph],
  );

  const value = useMemo<DawContextValue>(
    () => ({
      tracks,
      selectedTrackId,
      setSelectedTrackId,
      currentTime,
      isPlaying,
      isRecording,
      loopEnabled,
      setLoopEnabled,
      loopStartSec,
      loopEndSec,
      setLoopRegionSec,
      metronomeOn,
      setMetronomeOn,
      tempo,
      setTempo,
      beatsPerBar,
      meterPeaks,
      busMixer,
      setBusVolume,
      toggleBusMute,
      masterVolume,
      setMasterVolume,
      masterMuted,
      setMasterMuted,
      status,
      addTrackWithKind,
      removeTrack,
      renameTrack,
      setTrackInputSource,
      setTrackVolume,
      setTrackPan,
      setTrackEq,
      setTrackEffect,
      setTrackSpace,
      setTrackOutputBus,
      setTrackSendReverb,
      applyMicChainPreset,
      toggleMute,
      toggleSolo,
      toggleExclusiveSoloSelection,
      toggleRecordArm,
      seek,
      rewindToStart,
      play,
      stopTransport,
      startRecord,
      stopRecord,
      deleteClip,
      addClipFromBuffer,
      addLibraryClip,
      addRemoteLibraryClip,
      importAudioFile,
      exportMixWav,
      exportProjectJson,
      importProjectJson,
      addMidiNote,
      removeMidiNote,
      updateMidiNote,
      setBeatsPerBar,
      recordingTrackId,
      recordingLivePeaks,
      recordingPunchInTime,
      moveClip,
      trimClipEdge,
      setClipGain,
    }),
    [
      tracks,
      selectedTrackId,
      currentTime,
      isPlaying,
      isRecording,
      recordingTrackId,
      recordingLivePeaks,
      recordingPunchInTime,
      loopEnabled,
      loopStartSec,
      loopEndSec,
      setLoopRegionSec,
      metronomeOn,
      tempo,
      beatsPerBar,
      meterPeaks,
      busMixer,
      masterVolume,
      masterMuted,
      status,
      addTrackWithKind,
      removeTrack,
      renameTrack,
      setTrackInputSource,
      setTrackVolume,
      setTrackPan,
      setTrackEq,
      setTrackEffect,
      setTrackSpace,
      setTrackOutputBus,
      setTrackSendReverb,
      applyMicChainPreset,
      setBusVolume,
      toggleBusMute,
      toggleMute,
      toggleSolo,
      toggleExclusiveSoloSelection,
      toggleRecordArm,
      seek,
      rewindToStart,
      play,
      stopTransport,
      startRecord,
      stopRecord,
      deleteClip,
      moveClip,
      trimClipEdge,
      setClipGain,
      addClipFromBuffer,
      addLibraryClip,
      addRemoteLibraryClip,
      importAudioFile,
      exportMixWav,
      exportProjectJson,
      importProjectJson,
      addMidiNote,
      removeMidiNote,
      updateMidiNote,
      setBeatsPerBar,
      setMasterVolume,
      setMasterMuted,
    ],
  );

  return <DawContext.Provider value={value}>{children}</DawContext.Provider>;
}

/** Hook to access DawProvider state */
export function useDaw() {
  const v = useContext(DawContext);
  if (!v) throw new Error('useDaw must be used inside DawProvider');
  return v;
}
