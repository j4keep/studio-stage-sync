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
  audioBufferFromMonoFloat,
  configureCompressor,
  configureEq,
  configureSpace,
  createLibrarySound,
  encodeWavFromAudioBuffer,
  faderToGain,
  getTimelineEndSec,
  mergeFloatChunks,
  midiNoteToFreq,
  offlineRenderMix,
  trackAudible,
  type LibrarySoundId,
} from './audio';
import { MIC_CHAIN_PRESETS, type MicChainPresetId } from './micPresets';
import { hydrateProject, parseProjectJSON, serializeProject } from './projectIO';
import { REMOTE_LIBRARY_FLAT } from './remoteLibrary';
import {
  newTrack,
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
  revDry: GainNode;
  conv: ConvolverNode;
  revWet: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
};

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
  metronomeOn: boolean;
  setMetronomeOn: (v: boolean) => void;
  tempo: number;
  setTempo: (bpm: number) => void;
  beatsPerBar: number;
  /** Normalized 0–1 peaks for mixer meters */
  meterPeaks: Record<string, number>;
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
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [meterPeaks, setMeterPeaks] = useState<Record<string, number>>({});
  const [status, setStatus] = useState('');

  const loopEnabledRef = useRef(loopEnabled);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const trackNodesRef = useRef(new Map<string, TrackNodes>());
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

  useEffect(() => {
    if (tracks.length && !selectedTrackId) {
      setSelectedTrackId(tracks[0].id);
    }
  }, [tracks, selectedTrackId]);

  const disposeTrackNodes = useCallback((ctx: AudioContext) => {
    for (const n of trackNodesRef.current.values()) {
      try {
        n.fader.disconnect();
        n.low.disconnect();
        n.mid.disconnect();
        n.high.disconnect();
        n.comp.disconnect();
        n.revDry.disconnect();
        n.conv.disconnect();
        n.revWet.disconnect();
        n.pan.disconnect();
        n.analyser.disconnect();
      } catch {
        /* ignore */
      }
    }
    trackNodesRef.current.clear();
    masterRef.current = null;
  }, []);

  const ensureMaster = useCallback((ctx: AudioContext) => {
    if (!masterRef.current) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      masterRef.current = g;
    }
    return masterRef.current;
  }, []);

  const ensureTrackNodes = useCallback(
    (ctx: AudioContext, trackId: string) => {
      const master = ensureMaster(ctx);
      let t = trackNodesRef.current.get(trackId);
      if (!t) {
        const fader = ctx.createGain();
        const low = ctx.createBiquadFilter();
        const mid = ctx.createBiquadFilter();
        const high = ctx.createBiquadFilter();
        const comp = ctx.createDynamicsCompressor();
        const revDry = ctx.createGain();
        const conv = ctx.createConvolver();
        const revWet = ctx.createGain();
        const pan = ctx.createStereoPanner();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.62;
        fader.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(comp);
        comp.connect(revDry);
        revDry.connect(pan);
        comp.connect(conv);
        conv.connect(revWet);
        revWet.connect(pan);
        pan.connect(analyser);
        analyser.connect(master);
        t = { fader, low, mid, high, comp, revDry, conv, revWet, pan, analyser };
        trackNodesRef.current.set(trackId, t);
      }
      return t;
    },
    [ensureMaster],
  );

  const syncTrackNodeParams = useCallback(
    (ctx: AudioContext, track: Track, soloAny: boolean) => {
      const nodes = ensureTrackNodes(ctx, track.id);
      const audible = trackAudible(track, soloAny);
      nodes.fader.gain.value = audible ? faderToGain(track.volume) : 0;
      nodes.pan.pan.value = track.pan;
      configureEq(nodes.low, nodes.mid, nodes.high, track.eqPreset, ctx);
      configureCompressor(nodes.comp, track.effectPreset);
      configureSpace(nodes.conv, nodes.revDry, nodes.revWet, track.spacePreset, ctx);
    },
    [ensureTrackNodes],
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
          const clipEnd = clip.startTime + clip.buffer.duration;
          if (clipEnd <= p0) continue;
          const playFrom = Math.max(p0, clip.startTime);
          const offset = playFrom - clip.startTime;
          const duration = clipEnd - playFrom;
          const when = t0 + (playFrom - p0);
          const src = ctx.createBufferSource();
          src.buffer = clip.buffer;
          src.connect(nodes.fader);
          src.start(when, offset, duration);
          activeSourcesRef.current.push(src);
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
          env.connect(nodes.fader);
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

  const tickPlayhead = useCallback(() => {
    const ctx = audioCtxRef.current;
    const sess = playSessionRef.current;
    if (!ctx || !sess) return;
    const t = sess.p0 + (ctx.currentTime - sess.t0);
    const end = getTimelineEndSec(tracksRef.current, tempoRef.current);
    if (end > 0.02 && t >= end) {
      if (loopEnabledRef.current) {
        stopPlaybackSources();
        const t0 = ctx.currentTime;
        const p0 = 0;
        playSessionRef.current = { t0, p0 };
        schedulePlayback(ctx, t0, p0);
        setCurrentTime(0);
        setStatus('Loop…');
        rafRef.current = requestAnimationFrame(tickPlayhead);
        return;
      }
      for (const s of activeSourcesRef.current) {
        try {
          s.stop();
          s.disconnect();
        } catch {
          /* ignore */
        }
      }
      activeSourcesRef.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      playSessionRef.current = null;
      setIsPlaying(false);
      setCurrentTime(end);
      setStatus('End of timeline.');
      return;
    }
    setCurrentTime(t);
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [schedulePlayback, stopPlaybackSources]);

  const stopTransport = useCallback(() => {
    if (metroIntervalRef.current) {
      clearInterval(metroIntervalRef.current);
      metroIntervalRef.current = 0;
    }
    const ctx = audioCtxRef.current;
    const sess = playSessionRef.current;
    if (ctx && sess) {
      const t = sess.p0 + (ctx.currentTime - sess.t0);
      setCurrentTime(Math.max(0, t));
    }
    playSessionRef.current = null;
    stopPlaybackSources();
    stopPlayheadRaf();
    setIsPlaying(false);
  }, [stopPlaybackSources, stopPlayheadRaf]);

  const play = useCallback(async () => {
    const ctx = ensureAudioCtx(audioCtxRef);
    if (ctx.state === 'suspended') await ctx.resume();
    stopTransport();

    const t0 = ctx.currentTime;
    const p0 = currentTimeRef.current;
    playSessionRef.current = { t0, p0 };
    schedulePlayback(ctx, t0, p0);

    setIsPlaying(true);
    setStatus((s) => (s.startsWith('Recording') ? 'Recording + playback…' : ''));
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [schedulePlayback, stopTransport, tickPlayhead]);

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
      setMeterPeaks(out);
      id = requestAnimationFrame(sample);
    };
    id = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(id);
  }, []);

  const seek = useCallback(
    (t: number) => {
      if (isPlaying) stopTransport();
      setCurrentTime(Math.max(0, t));
    },
    [isPlaying, stopTransport],
  );

  const rewindToStart = useCallback(() => {
    seek(0);
  }, [seek]);

  const micStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Float32Array[]>([]);
  const recordProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const recordSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordMuteRef = useRef<GainNode | null>(null);
  const recordStartTimeRef = useRef(0);
  const recordingActiveRef = useRef(false);

  const teardownMicGraph = useCallback(() => {
    recordingActiveRef.current = false;
    try {
      recordProcessorRef.current?.disconnect();
      recordSourceRef.current?.disconnect();
      recordMuteRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    recordProcessorRef.current = null;
    recordSourceRef.current = null;
    recordMuteRef.current = null;
    micStreamRef.current?.getTracks().forEach((x) => x.stop());
    micStreamRef.current = null;
    recordChunksRef.current = [];
  }, []);

  const startRecord = useCallback(async () => {
    if (isRecording) return;
    const armed = tracksRef.current.find((x) => x.recordArm);
    const targetId = armed?.id ?? selectedTrackId ?? tracksRef.current[0]?.id;
    if (!targetId) {
      setStatus('No track to record. Arm a track (R) or select one.');
      return;
    }
    if (isPlaying) stopTransport();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = ensureAudioCtx(audioCtxRef);
      if (ctx.state === 'suspended') await ctx.resume();

      ensureMaster(ctx);
      recordStartTimeRef.current = currentTimeRef.current;
      recordChunksRef.current = [];

      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;

      proc.onaudioprocess = (e) => {
        if (!recordingActiveRef.current) return;
        const ch0 = e.inputBuffer.getChannelData(0);
        recordChunksRef.current.push(new Float32Array(ch0));
      };

      src.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);

      micStreamRef.current = stream;
      recordSourceRef.current = src;
      recordProcessorRef.current = proc;
      recordMuteRef.current = mute;
      recordingActiveRef.current = true;

      setIsRecording(true);
      setStatus(
        isPlaying
          ? 'Recording… (other tracks playing — overdub)'
          : 'Recording… Press Play to hear other tracks while you record.',
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
    recordingActiveRef.current = false;
    teardownMicGraph();
    setIsRecording(false);

    if (!ctx || !targetId) {
      setStatus('Recording stopped.');
      return;
    }

    const merged = mergeFloatChunks(recordChunksRef.current);
    if (merged.length < 64) {
      setStatus('Take too short — nothing saved.');
      return;
    }

    const buf = audioBufferFromMonoFloat(ctx, merged, ctx.sampleRate);
    const clip: Clip = {
      id: crypto.randomUUID(),
      startTime: startSec,
      buffer: buf,
    };

    setTracks((prev) =>
      prev.map((tr) => (tr.id === targetId ? { ...tr, clips: [...tr.clips, clip] } : tr)),
    );
    const nm = tracksRef.current.find((t) => t.id === targetId)?.name ?? 'track';
    setStatus(`Saved clip (${buf.duration.toFixed(2)}s) on ${nm}.`);
  }, [isRecording, selectedTrackId, teardownMicGraph]);

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
        nodes.revDry.disconnect();
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

  const addClipFromBuffer = useCallback(
    (trackId: string, buffer: AudioBuffer, startTime?: number, sourceMeta?: ClipSourceMeta) => {
      const at = startTime ?? currentTimeRef.current;
      const clip: Clip = {
        id: crypto.randomUUID(),
        startTime: Math.max(0, at),
        buffer,
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
        const buf = await ctx.decodeAudioData(ab.slice(0));
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
        const buf = await ctx.decodeAudioData(ab.slice(0));
        addClipFromBuffer(trackId, buf, currentTimeRef.current);
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
      metronomeOn,
      setMetronomeOn,
      tempo,
      setTempo,
      beatsPerBar,
      meterPeaks,
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
      applyMicChainPreset,
      toggleMute,
      toggleSolo,
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
    }),
    [
      tracks,
      selectedTrackId,
      currentTime,
      isPlaying,
      isRecording,
      loopEnabled,
      metronomeOn,
      tempo,
      beatsPerBar,
      meterPeaks,
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
      applyMicChainPreset,
      toggleMute,
      toggleSolo,
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
    ],
  );

  return <DawContext.Provider value={value}>{children}</DawContext.Provider>;
}

export function useDaw() {
  const v = useContext(DawContext);
  if (!v) throw new Error('useDaw must be used inside DawProvider');
  return v;
}
