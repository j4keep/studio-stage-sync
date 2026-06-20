import type { Track, Clip, TransportState, EffectInstance, MidiNote } from "./types";
import { buildEffect, type BuiltEffect } from "./Effects";
import { getPresetByName, getKitByName, type Preset, type DrumPiece, type KitVoiceSpec } from "./presetData";

type SharedInputMonitor = {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  refs: Set<string>;
};

const makeLowLatencyMicConstraints = (inputDeviceId?: string): MediaStreamConstraints => ({
  audio: {
    deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
    // Podcast-friendly defaults: let the browser clean up the mic so vocals
    // sound natural instead of phasey/robotic. Aggressive low-latency hints
    // were causing buffer underruns and the "robotic" artefact during record.
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  } as MediaTrackConstraints,
});

/**
 * Browser DAW engine. Holds the AudioContext, master bus, sends, and per-track chains.
 * Scheduling: simple "play all clips" — each play() call schedules every clip on every track
 * via AudioBufferSourceNodes. Recording captures the mic into a chunk buffer and converts to
 * an AudioBuffer on stop, then emits a clip via onRecordedClip.
 */
export class DawEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  masterAnalyser: AnalyserNode;
  reverbBus: { input: GainNode; output: GainNode; fx: BuiltEffect };
  delayBus: { input: GainNode; output: GainNode; fx: BuiltEffect };
  destStream: MediaStreamAudioDestinationNode;
  private trackChains = new Map<string, {
    input: GainNode;
    inserts: BuiltEffect[];
    panner: StereoPannerNode;
    gain: GainNode;
    monitorGain: GainNode;
    analyser: AnalyserNode;
    splitter: ChannelSplitterNode;
    analyserL: AnalyserNode;
    analyserR: AnalyserNode;
    inputAnalyser: AnalyserNode;
    /** Dry, low-gain mic monitor that bypasses inserts/sends to prevent feedback/echo. */
    directMonitor: GainNode;
    reverbSend: GainNode;
    delaySend: GainNode;
    activeSources: AudioScheduledSourceNode[];
    micSource?: MediaStreamAudioSourceNode | null;
    inputMonitorSource?: MediaStreamAudioSourceNode | null;
    inputMonitorStream?: MediaStream | null;
    inputMonitoring: boolean;
    inputMonitorAudible: boolean;
    inputMonitorDeviceKey?: string;
    inputMonitorToken: number;
    inputMonitorFailed: boolean;
    savedReverbSend?: number;
    savedDelaySend?: number;
    effectSignature: string;
  }>();
  private sharedInputMonitors = new Map<string, SharedInputMonitor>();
  private pendingInputMonitors = new Map<string, Promise<SharedInputMonitor>>();
  private startCtxTime = 0;
  private startTransportTime = 0;
  playing = false;

  // Metronome
  private metroEnabled = false;
  private metroBpm = 120;
  private metroBeatsPerBar = 4;
  private metroNextBeat = 0;
  private metroBeatIndex = 0;
  private metroTimer: number | null = null;
  private metroGain: GainNode;
  private metroAccent = true;
  // Separate click output routing
  private metroDest: MediaStreamAudioDestinationNode | null = null;
  private metroAudioEl: HTMLAudioElement | null = null;
  private metroOutputDeviceId: string | undefined = undefined;
  private metroRoutedToMaster = true;

  // Recording
  private micStream: MediaStream | null = null;
  private recProcessor: ScriptProcessorNode | null = null;
  private recSilentSink: GainNode | null = null;
  private recBuffers: Float32Array[] = [];
  private recordingTrackId: string | null = null;
  private recordStartTransport = 0;

  // Master capture for export
  private masterRecorder: MediaRecorder | null = null;
  private masterChunks: BlobPart[] = [];

  onRecordedClip?: (trackId: string, clip: Clip) => void;
  onPositionChange?: (pos: number) => void;
  onStop?: () => void;

  private rafId = 0;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    // Two-stage protection: gentle bus compressor, then hard safety limiter.
    // Keeps headroom when 10–30 tracks sum without crunching the master.
    const busComp = this.ctx.createDynamicsCompressor();
    busComp.threshold.value = -14;
    busComp.knee.value = 8;
    busComp.ratio.value = 3;
    busComp.attack.value = 0.005;
    busComp.release.value = 0.12;
    const safetyLimiter = this.ctx.createDynamicsCompressor();
    safetyLimiter.threshold.value = -3;
    safetyLimiter.knee.value = 0;
    safetyLimiter.ratio.value = 20;
    safetyLimiter.attack.value = 0.001;
    safetyLimiter.release.value = 0.08;
    this.masterGain.connect(busComp);
    busComp.connect(safetyLimiter);
    safetyLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    this.destStream = this.ctx.createMediaStreamDestination();
    this.masterAnalyser.connect(this.destStream);

    // Metronome click bus (independent level from master monitor)
    this.metroGain = this.ctx.createGain();
    this.metroGain.gain.value = 0.5;
    this.metroGain.connect(this.masterGain);

    // Reverb send bus
    const reverbInput = this.ctx.createGain();
    const reverbOutput = this.ctx.createGain();
    const reverbFx = buildEffect(this.ctx, {
      id: "bus-reverb", type: "reverb", enabled: true, params: { mix: 100, decay: 2.4 },
    } as EffectInstance);
    reverbFx.apply({ mix: 100, decay: 2.4 });
    reverbInput.connect(reverbFx.input);
    reverbFx.output.connect(reverbOutput);
    reverbOutput.connect(this.masterGain);
    this.reverbBus = { input: reverbInput, output: reverbOutput, fx: reverbFx };

    // Delay send bus
    const delayInput = this.ctx.createGain();
    const delayOutput = this.ctx.createGain();
    const delayFx = buildEffect(this.ctx, {
      id: "bus-delay", type: "delay", enabled: true, params: { time: 0.35, feedback: 40, mix: 100 },
    } as EffectInstance);
    delayFx.apply({ time: 0.35, feedback: 40, mix: 100 });
    delayInput.connect(delayFx.input);
    delayFx.output.connect(delayOutput);
    delayOutput.connect(this.masterGain);
    this.delayBus = { input: delayInput, output: delayOutput, fx: delayFx };
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  /** Ensure a per-track audio chain exists. Re-wires inserts only when the insert layout changes. */
  ensureTrackChain(track: Track) {
    let chain = this.trackChains.get(track.id);
    if (!chain) {
      const input = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      const gain = this.ctx.createGain();
      const monitorGain = this.ctx.createGain();
      monitorGain.gain.value = 1;
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      const splitter = this.ctx.createChannelSplitter(2);
      const analyserL = this.ctx.createAnalyser();
      const analyserR = this.ctx.createAnalyser();
      analyserL.fftSize = 512; analyserR.fftSize = 512;
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);
      const inputAnalyser = this.ctx.createAnalyser();
      inputAnalyser.fftSize = 512;
      const reverbSend = this.ctx.createGain();
      const delaySend = this.ctx.createGain();
      const directMonitor = this.ctx.createGain();
      directMonitor.gain.value = 0.18; // low headroom monitor; kept disconnected unless explicitly enabled
      directMonitor.connect(this.masterGain);
      chain = {
        input,
        inserts: [],
        panner,
        gain,
        monitorGain,
        analyser,
        splitter,
        analyserL,
        analyserR,
        inputAnalyser,
        directMonitor,
        reverbSend,
        delaySend,
        activeSources: [],
        inputMonitoring: false,
        inputMonitorAudible: false,
        inputMonitorToken: 0,
        inputMonitorFailed: false,
        effectSignature: "__new__",
      };
      this.trackChains.set(track.id, chain);
    }
    const signature = this.getEffectSignature(track);
    if (chain.effectSignature !== signature) {
      this.rebuildChain(track, chain);
      chain.effectSignature = signature;
    }
    this.updateTrackParams(track);
    return chain;
  }

  private getEffectSignature(track: Track) {
    return track.effects.map(fx => `${fx.id}:${fx.type}:${fx.enabled}:${fx.pluginKey ?? ""}`).join("|");
  }

  private rebuildChain(track: Track, chain: ReturnType<DawEngine["ensureTrackChain"]> extends infer T ? T : never) {
    const c = chain as NonNullable<ReturnType<typeof this.trackChains.get>>;
    // Tear down old inserts
    try { c.input.disconnect(); } catch {}
    try { c.panner.disconnect(); } catch {}
    try { c.gain.disconnect(); } catch {}
    try { c.analyser.disconnect(); } catch {}
    try { c.monitorGain.disconnect(); } catch {}
    try { c.reverbSend.disconnect(); } catch {}
    try { c.delaySend.disconnect(); } catch {}
    c.inserts.forEach((i) => i.dispose());
    c.inserts = [];

    let cursor: AudioNode = c.input;
    for (const fx of track.effects) {
      if (!fx.enabled) continue;
      const built = buildEffect(this.ctx, fx);
      built.apply(fx.params);
      cursor.connect(built.input);
      cursor = built.output;
      c.inserts.push(built);
    }
    cursor.connect(c.panner);
    c.panner.connect(c.gain);
    // Meter (pre-monitor, post-fader/pan) — always live so input meters move even when muted to speakers
    c.gain.connect(c.splitter);
    c.gain.connect(c.analyser);
    // Speaker monitor path can be muted independently (used during record)
    c.analyser.connect(c.monitorGain);
    c.monitorGain.connect(this.masterGain);
    c.gain.connect(c.reverbSend);
    c.reverbSend.connect(this.reverbBus.input);
    c.gain.connect(c.delaySend);
    c.delaySend.connect(this.delayBus.input);

    this.updateTrackParams(track);
  }

  updateTrackParams(track: Track, allTracks?: Track[]) {
    const c = this.trackChains.get(track.id);
    if (!c) return;
    const now = this.ctx.currentTime;
    const pan = Math.max(-1, Math.min(1, track.pan));
    const volume = Math.max(0, Math.min(2, track.volume));
    const reverb = Math.max(0, Math.min(1, track.reverbSend));
    const delay = Math.max(0, Math.min(1, track.delaySend));
    c.panner.pan.setTargetAtTime(pan, now, 0.01);
    // Solo-aware live gain: if any other track is soloed and this one isn't, silence it.
    const anySolo = allTracks ? allTracks.some(t => t.solo) : false;
    const silencedBySolo = anySolo && !track.solo;
    c.gain.gain.setTargetAtTime((track.mute || silencedBySolo) ? 0 : volume, now, 0.01);
    c.monitorGain.gain.setTargetAtTime(1, now, 0.01);
    c.reverbSend.gain.setTargetAtTime(reverb, now, 0.01);
    c.delaySend.gain.setTargetAtTime(delay, now, 0.01);
    // Update insert params
    track.effects.filter(e => e.enabled).forEach((fx, i) => {
      if (c.inserts[i]) c.inserts[i].apply(fx.params);
    });
  }

  removeTrack(trackId: string) {
    const c = this.trackChains.get(trackId);
    if (!c) return;
    c.activeSources.forEach(s => { try { s.stop(); } catch {} });
    c.inserts.forEach(i => i.dispose());
    this.stopInputMonitoring(trackId);
    try { c.input.disconnect(); c.panner.disconnect(); c.gain.disconnect(); c.analyser.disconnect(); c.reverbSend.disconnect(); c.delaySend.disconnect(); c.directMonitor.disconnect(); } catch {}
    this.trackChains.delete(trackId);
  }

  setMasterVolume(v: number) { this.masterGain.gain.value = Math.max(0, Math.min(2, v)); }
  /** Live-set a track's gain (used by automation playback). Bypasses the store. */
  setLiveTrackVolume(trackId: string, v: number) {
    const c = this.trackChains.get(trackId);
    if (!c) return;
    c.gain.gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), this.ctx.currentTime, 0.01);
  }
  /** Live-set a track's pan (-1..1). Bypasses the store. */
  setLiveTrackPan(trackId: string, p: number) {
    const c = this.trackChains.get(trackId);
    if (!c) return;
    c.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), this.ctx.currentTime, 0.01);
  }
  getMasterAnalyser() { return this.masterAnalyser; }
  getTrackAnalyser(trackId: string) { return this.trackChains.get(trackId)?.analyser ?? null; }
  getTrackInputAnalyser(trackId: string) { return this.trackChains.get(trackId)?.inputAnalyser ?? null; }
  getTrackStereoAnalysers(trackId: string) {
    const c = this.trackChains.get(trackId);
    return c ? { L: c.analyserL, R: c.analyserR } : null;
  }
  currentPosition() {
    if (!this.playing) return Math.max(0, this.startTransportTime);
    return Math.max(0, this.startTransportTime + (this.ctx.currentTime - this.startCtxTime));
  }

  play(transport: TransportState, tracks: Track[], clips: Clip[]) {
    this.stopAllSources();
    this.startCtxTime = this.ctx.currentTime + 0.05;
    this.startTransportTime = transport.position;
    this.playing = true;
    this.metroBpm = transport.bpm;
    this.metroBeatsPerBar = transport.timeSigNum || 4;
    this.metroEnabled = !!transport.metronome;
    this.metroBeatIndex = 0;
    this.metroNextBeat = this.startCtxTime;
    if (this.metroEnabled) this.scheduleMetronome();

    // NOTE: We DO NOT skip muted/non-solo clips here. Mute & solo are enforced
    // live via each track chain's gain node (see updateTrackParams), so the user
    // can mute/unmute or solo/unsolo during playback without restarting.
    for (const clip of clips) {
      const track = tracks.find(t => t.id === clip.trackId);
      if (!track || !clip.buffer) continue;
      const chain = this.trackChains.get(track.id);
      if (!chain) continue;

      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= transport.position) continue;

      const src = this.ctx.createBufferSource();
      src.buffer = clip.buffer;
      src.connect(chain.input);

      const playOffsetInClip = Math.max(0, transport.position - clip.startTime);
      const when = this.startCtxTime + Math.max(0, clip.startTime - transport.position);
      const offset = clip.offset + playOffsetInClip;
      const duration = clip.duration - playOffsetInClip;
      try {
        src.start(when, offset, duration);
        chain.activeSources.push(src);
        src.onended = () => {
          chain.activeSources = chain.activeSources.filter(s => s !== src);
        };
      } catch {}
    }

    // Schedule MIDI notes for instrument tracks via the simple synth engine.
    scheduleMidiClips(this, tracks, clips, transport.position, this.startCtxTime, transport.bpm);

    // Position loop. Emit every frame for smooth playhead. The transport
    // bar and arrange view memoize subcomponents so re-renders are cheap.
    const loopEnabled = !!transport.loopEnabled;
    const loopStart = transport.loopStart ?? 0;
    const loopEnd = transport.loopEnd ?? 0;
    const tick = () => {
      if (!this.playing) return;
      let pos = this.startTransportTime + (this.ctx.currentTime - this.startCtxTime);
      if (loopEnabled && loopEnd > loopStart && pos >= loopEnd) {
        // wrap by re-arming playback at loopStart
        const newTransport = { ...transport, position: loopStart };
        this.stopAllSources();
        this.startCtxTime = this.ctx.currentTime + 0.02;
        this.startTransportTime = loopStart;
        // re-schedule clips from loopStart
        for (const clip of clips) {
          const track = tracks.find(t => t.id === clip.trackId);
          if (!track || !clip.buffer) continue;
          const chain = this.trackChains.get(track.id);
          if (!chain) continue;
          const clipEnd = clip.startTime + clip.duration;
          if (clipEnd <= loopStart) continue;
          const src = this.ctx.createBufferSource();
          src.buffer = clip.buffer;
          src.connect(chain.input);
          const playOffsetInClip = Math.max(0, loopStart - clip.startTime);
          const when = this.startCtxTime + Math.max(0, clip.startTime - loopStart);
          const offset = clip.offset + playOffsetInClip;
          const duration = Math.min(clip.duration - playOffsetInClip, loopEnd - Math.max(clip.startTime, loopStart));
          try { src.start(when, offset, duration); chain.activeSources.push(src); } catch {}
        }
        pos = loopStart;
        scheduleMidiClips(this, tracks, clips, loopStart, this.startCtxTime, transport.bpm);
        void newTransport;
      }
      this.onPositionChange?.(pos);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.playing = false;
    if (this.metroTimer) { clearTimeout(this.metroTimer); this.metroTimer = null; }
    cancelAnimationFrame(this.rafId);
    this.stopAllSources();
    if (this.recordingTrackId) this.stopRecording();
    this.onStop?.();
    // Metronome should NOT free-run when transport is stopped.
    // It will resume on the next play() if metroEnabled is still true.
  }

  setMetronome(enabled: boolean, bpm?: number, beatsPerBar?: number) {
    const wasEnabled = this.metroEnabled;
    this.metroEnabled = enabled;
    if (bpm) this.metroBpm = bpm;
    if (beatsPerBar && beatsPerBar > 0) this.metroBeatsPerBar = beatsPerBar;
    // Only tick while transport is playing — no free-running click when stopped.
    if (enabled && this.playing) {
      if (!wasEnabled || !this.metroTimer) {
        this.metroNextBeat = this.ctx.currentTime + 0.05;
        this.metroBeatIndex = 0;
      }
      this.scheduleMetronome();
    } else if (this.metroTimer) {
      clearTimeout(this.metroTimer); this.metroTimer = null;
    }
  }

  private scheduleMetronome() {
    if (!this.metroEnabled) {
      if (this.metroTimer) { clearTimeout(this.metroTimer); this.metroTimer = null; }
      return;
    }
    try { if (this.ctx.state === "suspended") this.ctx.resume(); } catch {}
    const beatDur = 60 / Math.max(20, this.metroBpm);
    const bpb = Math.max(1, this.metroBeatsPerBar);
    const lookahead = this.ctx.currentTime + 0.25;
    while (this.metroNextBeat < lookahead) {
      this.playClick(this.metroNextBeat, this.metroBeatIndex % bpb === 0);
      this.metroNextBeat += beatDur;
      this.metroBeatIndex++;
    }
    this.metroTimer = window.setTimeout(() => this.scheduleMetronome(), 100);
  }

  private playClick(when: number, downbeat: boolean) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const accent = this.metroAccent && downbeat;
    osc.frequency.value = accent ? 1500 : 1000;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(env).connect(this.metroGain);
    osc.start(when); osc.stop(when + 0.06);
  }

  setMetronomeVolume(v: number) {
    const vol = Math.max(0, Math.min(1, v));
    if (this.metroGain) {
      this.metroGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.01);
    }
  }

  setMetronomeAccent(on: boolean) {
    this.metroAccent = !!on;
  }

  /** Route metronome clicks to a dedicated audio output device (or back to master if undefined). */
  async setMetronomeOutputDevice(deviceId: string | undefined) {
    this.metroOutputDeviceId = deviceId;
    const wantSeparate = !!deviceId;
    if (wantSeparate) {
      if (!this.metroDest) {
        this.metroDest = this.ctx.createMediaStreamDestination();
        this.metroAudioEl = document.createElement("audio");
        this.metroAudioEl.autoplay = true;
        this.metroAudioEl.srcObject = this.metroDest.stream;
      }
      // Disconnect from master, route only to dedicated dest
      if (this.metroRoutedToMaster) {
        try { this.metroGain.disconnect(this.masterGain); } catch {}
        this.metroRoutedToMaster = false;
      }
      try { this.metroGain.disconnect(this.metroDest); } catch {}
      this.metroGain.connect(this.metroDest);
      try {
        // setSinkId only supported in Chromium-based browsers
        const el = this.metroAudioEl as any;
        if (el && typeof el.setSinkId === "function") {
          await el.setSinkId(deviceId);
        }
        await this.metroAudioEl?.play().catch(() => {});
      } catch {}
    } else {
      // Back to master
      if (this.metroDest) {
        try { this.metroGain.disconnect(this.metroDest); } catch {}
      }
      if (!this.metroRoutedToMaster) {
        try { this.metroGain.connect(this.masterGain); } catch {}
        this.metroRoutedToMaster = true;
      }
    }
  }

  /** Schedule N bars of count-in clicks. Resolves when the last click is done. */
  async countIn(bars: number, beatsPerBar: number, bpm: number): Promise<void> {
    const totalBeats = Math.max(0, Math.floor(bars)) * Math.max(1, beatsPerBar);
    if (totalBeats <= 0) return;
    await this.resume();
    const beatDur = 60 / Math.max(20, bpm);
    const start = this.ctx.currentTime + 0.05;
    for (let i = 0; i < totalBeats; i++) {
      this.playClick(start + i * beatDur, i % beatsPerBar === 0);
    }
    const totalMs = (totalBeats * beatDur + 0.05) * 1000;
    await new Promise<void>(res => setTimeout(res, totalMs));
  }

  private stopAllSources() {
    this.trackChains.forEach((c) => {
      c.activeSources.forEach((s) => { try { s.stop(); } catch {} });
      c.activeSources = [];
    });
  }


  // Live recording level + waveform progress
  recordingLivePeaks: number[] = []; // interleaved min/max pairs, same shape model as rendered clips
  onRecordingProgress?: (peaks: number[], durationSec: number) => void;
  getRecordingTrackId() { return this.recordingTrackId; }
  getRecordingStart() { return this.recordStartTransport; }

  syncInputMonitoring(tracks: Track[]) {
    // Mic monitoring belongs to real audio-input tracks only. Instrument tracks
    // record MIDI, so they must never request the microphone.
    const inputAudioIds = new Set(tracks.filter(t => t.kind === "audio" && t.inputEnabled !== false).map(t => t.id));
    this.trackChains.forEach((_, id) => {
      if (!inputAudioIds.has(id)) this.stopInputMonitoring(id);
    });
    tracks.forEach((track) => {
      if (track.kind !== "audio" || track.inputEnabled === false) return;
      // Keep meters/live waveform ready, but never route the live mic into the
      // master mix just because a track is armed. That doubled the vocal with
      // the recorded clip on playback/export and made it sound robotic.
      void this.startInputMonitoring(track.id, track.inputDeviceId, false);
    });
  }

  async monitorInput(trackId: string, inputDeviceId?: string) {
    await this.startInputMonitoring(trackId, inputDeviceId);
  }

  unmonitorInput(trackId: string) {
    this.stopInputMonitoring(trackId);
  }

  private async startInputMonitoring(trackId: string, inputDeviceId?: string, audible = false) {
    const chain = this.trackChains.get(trackId);
    const deviceKey = inputDeviceId || "__default__";
    if (!chain) return;
    if (chain.inputMonitoring && chain.inputMonitorDeviceKey === deviceKey) {
      this.setInputMonitorAudible(trackId, audible);
      return;
    }
    if (chain.inputMonitoring) this.stopInputMonitoring(trackId);
    const token = ++chain.inputMonitorToken;
    try {
      await this.resume();
      let shared = this.sharedInputMonitors.get(deviceKey);
      if (!shared) {
        let pending = this.pendingInputMonitors.get(deviceKey);
        if (!pending) {
          pending = navigator.mediaDevices.getUserMedia(makeLowLatencyMicConstraints(inputDeviceId)).then((stream) => {
            const created = { stream, source: this.ctx.createMediaStreamSource(stream), refs: new Set<string>() };
            this.sharedInputMonitors.set(deviceKey, created);
            this.pendingInputMonitors.delete(deviceKey);
            return created;
          }).catch((err) => {
            this.pendingInputMonitors.delete(deviceKey);
            throw err;
          });
          this.pendingInputMonitors.set(deviceKey, pending);
        }
        shared = await pending;
      }
      if (chain.inputMonitorToken !== token) {
        return;
      }
      shared.source.connect(chain.inputAnalyser);
      if (audible) {
        try { shared.source.connect(chain.directMonitor); } catch {}
      }
      shared.refs.add(trackId);
      chain.inputMonitorSource = shared.source;
      chain.inputMonitorStream = shared.stream;
      chain.inputMonitoring = true;
      chain.inputMonitorAudible = audible;
      chain.inputMonitorDeviceKey = deviceKey;
      chain.inputMonitorFailed = false;
    } catch {
      if (chain.inputMonitorToken === token) chain.inputMonitorFailed = false;
    }
  }

  private setInputMonitorAudible(trackId: string, audible: boolean) {
    const chain = this.trackChains.get(trackId);
    if (!chain?.inputMonitorSource || chain.inputMonitorAudible === audible) return;
    if (audible) {
      try { chain.inputMonitorSource.connect(chain.directMonitor); } catch {}
    } else {
      try { chain.inputMonitorSource.disconnect(chain.directMonitor); } catch {}
    }
    chain.inputMonitorAudible = audible;
  }

  private stopInputMonitoring(trackId: string) {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.inputMonitorToken++;
    if (chain.inputMonitorSource) {
      try { chain.inputMonitorSource.disconnect(chain.inputAnalyser); } catch {}
      try { chain.inputMonitorSource.disconnect(chain.directMonitor); } catch {}
    }
    const deviceKey = chain.inputMonitorDeviceKey;
    if (deviceKey) {
      const shared = this.sharedInputMonitors.get(deviceKey);
      shared?.refs.delete(trackId);
      if (shared && shared.refs.size === 0) {
        try { shared.source.disconnect(); } catch {}
        shared.stream.getTracks().forEach(t => t.stop());
        this.sharedInputMonitors.delete(deviceKey);
      }
    }
    chain.inputMonitorSource = null;
    chain.inputMonitorStream = null;
    chain.inputMonitoring = false;
    chain.inputMonitorAudible = false;
    chain.inputMonitorDeviceKey = undefined;
    chain.inputMonitorFailed = false;
  }

  async startRecording(trackId: string, transportPos: number, inputDeviceId?: string) {
    if (this.recordingTrackId) this.stopRecording();
    this.recordingTrackId = trackId;
    this.recordStartTransport = transportPos;
    this.recBuffers = [];
    this.recordingLivePeaks = [];
    const chain = this.trackChains.get(trackId);
    if (chain && !chain.inputMonitoring) await this.startInputMonitoring(trackId, inputDeviceId);
    const liveStream = chain?.inputMonitorStream ?? await navigator.mediaDevices.getUserMedia(makeLowLatencyMicConstraints(inputDeviceId));

    this.micStream = liveStream;
    const src = chain?.inputMonitorSource ?? this.ctx.createMediaStreamSource(liveStream);
    if (chain) {
      chain.micSource = src;
      // Podcast/local recording should capture a clean mic signal without
      // routing the live mic back into the master bus. Monitoring the same
      // microphone through speakers/headphones while recording was doubling
      // the path and making exported vocals sound phasey/robotic.
      this.setInputMonitorAudible(trackId, false);
      if (!chain.inputMonitorSource) {
        try { src.connect(chain.inputAnalyser); } catch {}
        chain.inputMonitorSource = src;
        chain.inputMonitorStream = liveStream;
        chain.inputMonitoring = true;
        chain.inputMonitorAudible = false;
        chain.inputMonitorFailed = false;
      }
    }

    // Capture clean mic samples for the clip + drive the live waveform overlay.
    // 4096 buffer is more forgiving than 2048 — fewer underruns = no robot voice.
    const proc = this.ctx.createScriptProcessor(4096, 1, 1);
    src.connect(proc);
    // ScriptProcessor requires a destination connection to run. Use a silent
    // sink so the mic NEVER reaches the speakers (no feedback, no distortion).
    const silentSink = this.ctx.createGain();
    silentSink.gain.value = 0;
    proc.connect(silentSink);
    silentSink.connect(this.ctx.destination);
    this.recSilentSink = silentSink;

    proc.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      this.recBuffers.push(new Float32Array(ch));
      // Min/max pairs for live waveform overlay, matching computePeaks() so the
      // region does not redraw into a different-looking shape after stop.
      const samplesPerPixel = 512;
      for (let start = 0; start < ch.length; start += samplesPerPixel) {
        const end = Math.min(start + samplesPerPixel, ch.length);
        let min = 0;
        let max = 0;
        for (let i = start; i < end; i++) {
          const v = ch[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        this.recordingLivePeaks.push(min, max);
      }
      const dur = this.recBuffers.reduce((s, b) => s + b.length, 0) / this.ctx.sampleRate;
      this.onRecordingProgress?.(this.recordingLivePeaks, dur);
    };
    this.recProcessor = proc;
  }

  stopRecording() {
    if (!this.recordingTrackId) return;
    const total = this.recBuffers.reduce((s, b) => s + b.length, 0);
    if (total > 0) {
      const buf = this.ctx.createBuffer(1, total, this.ctx.sampleRate);
      const out = buf.getChannelData(0);
      let off = 0;
      for (const chunk of this.recBuffers) { out.set(chunk, off); off += chunk.length; }
      const clip: Clip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        trackId: this.recordingTrackId,
        startTime: this.recordStartTransport,
        duration: buf.duration,
        offset: 0,
        buffer: buf,
        name: "Recording",
      };
      this.onRecordedClip?.(this.recordingTrackId, clip);
    }
    // Restore the track's monitor path
    const chain = this.trackChains.get(this.recordingTrackId);
    if (chain) {
      try { if (this.recProcessor) chain.micSource?.disconnect(this.recProcessor); } catch {}
      this.setInputMonitorAudible(this.recordingTrackId, false);
      chain.micSource = null;
    }
    this.recBuffers = [];
    this.recordingLivePeaks = [];
    try { this.recProcessor?.disconnect(); } catch {}
    try { this.recSilentSink?.disconnect(); } catch {}
    this.recProcessor = null;
    this.recSilentSink = null;
    if (this.micStream && this.micStream !== chain?.inputMonitorStream) {
      this.micStream.getTracks().forEach(t => t.stop());
    }
    this.micStream = null;
    this.recordingTrackId = null;
    this.onRecordingProgress?.([], 0);
  }

  async decodeFile(file: File | Blob): Promise<AudioBuffer> {
    const ab = await file.arrayBuffer();
    return this.ctx.decodeAudioData(ab.slice(0));
  }

  /** Render the project to a WAV blob via OfflineAudioContext. */
  async exportToWav(tracks: Track[], clips: Clip[], lengthSec: number): Promise<Blob> {
    const sampleRate = 44100;
    const channels = 2;
    const oac = new OfflineAudioContext(channels, Math.ceil(lengthSec * sampleRate), sampleRate);
    const master = oac.createGain();
    master.gain.value = this.masterGain.gain.value;
    master.connect(oac.destination);
    const anySolo = tracks.some(t => t.solo);
    for (const track of tracks) {
      if (track.mute) continue;
      if (anySolo && !track.solo) continue;
      const trackGain = oac.createGain();
      trackGain.gain.value = track.volume;
      const panner = oac.createStereoPanner();
      panner.pan.value = track.pan;
      let cursor: AudioNode = panner;
      // Apply inserts
      for (const fx of [...track.effects].reverse().filter(e => e.enabled)) {
        const built = buildEffect(oac, fx);
        built.apply(fx.params);
        built.output.connect(cursor);
        cursor = built.input;
      }
      panner.connect(trackGain).connect(master);
      for (const clip of clips.filter(c => c.trackId === track.id && c.buffer)) {
        const src = oac.createBufferSource();
        src.buffer = clip.buffer!;
        src.connect(cursor);
        src.start(clip.startTime, clip.offset, clip.duration);
      }
    }
    const rendered = await oac.startRendering();
    return audioBufferToWav(rendered);
  }

  dispose() {
    this.stop();
    this.trackChains.forEach((_, id) => this.removeTrack(id));
    this.sharedInputMonitors.forEach((shared) => {
      try { shared.source.disconnect(); } catch {}
      shared.stream.getTracks().forEach(t => t.stop());
    });
    this.sharedInputMonitors.clear();
    try { this.ctx.close(); } catch {}
  }
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;
  const ab = new ArrayBuffer(bufferSize);
  const view = new DataView(ab);
  const writeString = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Voice handle for a sustained synth note. Calling stop twice is a safe no-op. */
export interface SynthVoice {
  stop: (releaseSec?: number) => void;
  midi: number;
  trackId: string;
}

function makeDistCurve(amount: number): Float32Array {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Start a sustained synth voice using full preset synthesis: main osc + optional
 * detuned unison + sub osc + filter with envelope + amp ADSR + optional LFO + drive.
 * Backward compatible: if `presetOrWave` is undefined/string, builds a sensible default.
 */
export function startSynthNote(
  engine: DawEngine,
  trackId: string,
  midi: number,
  velocity = 0.8,
  presetOrWave?: Preset | OscillatorType,
): SynthVoice | null {
  const chain = (engine as any).trackChains.get(trackId);
  if (!chain) return null;
  const ctx = engine.ctx;
  const now = ctx.currentTime;

  const wavedef: any = (presetOrWave && typeof presetOrWave === "string" && presetOrWave !== "custom") ? presetOrWave : "sawtooth";
  const preset: Preset = (presetOrWave && typeof presetOrWave === "object")
    ? (presetOrWave as Preset)
    : { name: "Default", cat: "", sub: "", wave: wavedef };

  const wave = preset.wave;
  const oct = preset.octave ?? 0;
  const baseFreq = midiToFreq(midi + oct * 12);
  const vel = Math.max(0, Math.min(1, velocity));
  const masterGain = (preset.gain ?? 0.42) * vel;

  const oscs: OscillatorNode[] = [];
  const mix = ctx.createGain();
  mix.gain.value = 1;

  const pitchDrop = Math.max(0, preset.pitchDrop ?? 0);
  const pitchDropTime = Math.max(0.01, preset.pitchDropTime ?? 0.05);
  const setVoicePitch = (osc: OscillatorNode, freq: number) => {
    if (pitchDrop > 0.01) {
      osc.frequency.setValueAtTime(freq * Math.pow(2, pitchDrop / 12), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq), now + pitchDropTime);
    } else {
      osc.frequency.value = freq;
    }
  };

  const detuneCents = preset.detune ?? 0;
  const unison = Math.max(1, Math.min(7, preset.unison ?? 1));
  for (let i = 0; i < unison; i++) {
    const o = ctx.createOscillator();
    o.type = wave;
    setVoicePitch(o, baseFreq);
    if (unison > 1 && detuneCents) {
      o.detune.value = detuneCents * ((i / (unison - 1)) * 2 - 1);
    } else if (detuneCents) {
      o.detune.value = detuneCents;
    }
    const g = ctx.createGain();
    g.gain.value = 1 / Math.sqrt(unison);
    o.connect(g).connect(mix);
    oscs.push(o);
  }

  if ((preset.layerLevel ?? 0) > 0.001 && preset.layerWave) {
    const layer = ctx.createOscillator();
    layer.type = preset.layerWave;
    setVoicePitch(layer, baseFreq * Math.pow(2, (preset.layerOctave ?? 0) / 12));
    layer.detune.value = preset.layerDetune ?? 0;
    const lg = ctx.createGain();
    lg.gain.value = Math.max(0, Math.min(1, preset.layerLevel ?? 0));
    layer.connect(lg).connect(mix);
    oscs.push(layer);
  }

  let subOsc: OscillatorNode | null = null;
  if ((preset.subLevel ?? 0) > 0.001) {
    subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    setVoicePitch(subOsc, baseFreq / 2);
    const sg = ctx.createGain();
    sg.gain.value = preset.subLevel!;
    subOsc.connect(sg).connect(mix);
  }

  let lfo: OscillatorNode | null = null;
  if ((preset.lfoDepth ?? 0) > 0.01 && (preset.lfoRate ?? 0) > 0.01) {
    lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = preset.lfoRate!;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = preset.lfoDepth!;
    lfo.connect(lfoGain);
    oscs.forEach(o => lfoGain.connect(o.detune));
    if (subOsc) lfoGain.connect(subOsc.detune);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = preset.filterType ?? "lowpass";
  const fHz = preset.filterHz ?? 8000;
  filter.frequency.value = fHz;
  filter.Q.value = preset.filterQ ?? 0.7;
  let toneSource: AudioNode = mix;

  if ((preset.noiseLevel ?? 0) > 0.001) {
    const noiseLen = Math.ceil(ctx.sampleRate * Math.max(0.03, (preset.noiseDecay ?? 0.05) + 0.05));
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = preset.noiseFilterHz ?? 5000;
    nf.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime((preset.noiseLevel ?? 0) * vel, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, preset.noiseDecay ?? 0.05));
    noise.connect(nf).connect(ng).connect(mix);
    try { noise.start(now); noise.stop(now + Math.max(0.03, (preset.noiseDecay ?? 0.05) + 0.04)); } catch {}
  }

  if ((preset.highpassHz ?? 0) > 0) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = Math.max(20, preset.highpassHz!);
    hp.Q.value = 0.7;
    mix.connect(hp);
    toneSource = hp;
  }

  toneSource.connect(filter);

  const fEnv = preset.filterEnv ?? 0;
  const fDec = preset.filterDecay ?? 0.25;
  if (fEnv > 0.001) {
    const peakHz = Math.min(18000, fHz + fEnv * 6000);
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setValueAtTime(fHz, now);
    filter.frequency.linearRampToValueAtTime(peakHz, now + 0.005);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, fHz), now + 0.005 + fDec);
  }

  let postFilter: AudioNode = filter;
  if ((preset.drive ?? 0) > 0.001) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistCurve(preset.drive!) as any;
    shaper.oversample = "2x";
    const post = ctx.createGain();
    post.gain.value = 1 / (1 + preset.drive! * 0.6);
    filter.connect(shaper).connect(post);
    postFilter = post;
  }

  const a = Math.max(0.001, preset.attack ?? 0.01);
  const d = Math.max(0.001, preset.decay ?? 0.15);
  const s = Math.max(0,    Math.min(1, preset.sustain ?? 0.7));
  const env = ctx.createGain();
  env.gain.cancelScheduledValues(now);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.linearRampToValueAtTime(masterGain, now + a);
  env.gain.linearRampToValueAtTime(masterGain * s, now + a + d);
  postFilter.connect(env).connect(chain.input);

  if ((preset.clickLevel ?? 0) > 0.001) {
    const click = ctx.createOscillator();
    click.type = "triangle";
    click.frequency.value = preset.clickHz ?? 3500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime((preset.clickLevel ?? 0) * vel, now);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.004, preset.clickDecay ?? 0.01));
    click.connect(cg).connect(chain.input);
    try { click.start(now); click.stop(now + Math.max(0.008, (preset.clickDecay ?? 0.01) + 0.01)); } catch {}
  }

  try {
    oscs.forEach(o => o.start(now));
    if (subOsc) subOsc.start(now);
    if (lfo) lfo.start(now);
  } catch {}

  let stopped = false;
  const stop = (releaseSecOverride?: number) => {
    if (stopped) return;
    stopped = true;
    const t = ctx.currentTime;
    const r = Math.max(0.03, releaseSecOverride ?? (preset.release ?? 0.2));
    try {
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + r);
      oscs.forEach(o => { try { o.stop(t + r + 0.05); } catch {} });
      if (subOsc) { try { subOsc.stop(t + r + 0.05); } catch {} }
      if (lfo) { try { lfo.stop(t + r + 0.05); } catch {} }
    } catch {}
  };
  return { stop, midi, trackId };
}

/** One-shot: start a note and release it after `durationSec`. */
export function triggerSynthNote(
  engine: DawEngine,
  trackId: string,
  midi: number,
  durationSec = 0.4,
  velocity = 0.8,
  presetOrWave?: Preset | OscillatorType,
) {
  const v = startSynthNote(engine, trackId, midi, velocity, presetOrWave);
  if (!v) return;
  setTimeout(() => v.stop(), Math.max(20, durationSec * 1000));
}

/**
 * Schedule all MIDI notes inside MIDI clips for playback. Resolves each track's
 * instrument preset by name for full synthesis on playback.
 */
export function scheduleMidiClips(engine: DawEngine, tracks: Track[], clips: Clip[], transportPos: number, ctxStartTime: number, bpm: number) {
  const secPerBeat = 60 / Math.max(1, bpm);
  for (const clip of clips) {
    if (!clip.notes || clip.notes.length === 0) continue;
    const track = tracks.find(t => t.id === clip.trackId);
    if (!track || track.kind !== "instrument") continue;
    const chain = (engine as any).trackChains.get(track.id);
    if (!chain) continue;
    const isDrum = track.instrument === "drum";
    const preset = getPresetByName(track.instrumentPreset)
      || getPresetByName("Platinum Anthem Lead")
      || { name: "fallback", cat: "", sub: "", wave: (track.synthWave as OscillatorType) || "sawtooth" } as Preset;
    const kitName = (track as any).drumKit as string | undefined;

    for (const n of clip.notes) {
      const noteStartTl = clip.startTime + n.start * secPerBeat;
      const noteDur = Math.max(0.05, n.length * secPerBeat);
      const noteEndTl = noteStartTl + noteDur;
      if (noteEndTl <= transportPos) continue;
      const effectiveStartDelay = Math.max(0, noteStartTl - transportPos);
      const effectiveDur = noteEndTl - Math.max(transportPos, noteStartTl);
      const when = ctxStartTime + effectiveStartDelay;

      if (isDrum) {
        const kind = drumKindForPitch(n.pitch);
        scheduleDrumHit(engine, chain, kind, when, n.velocity ?? 0.85, kitName);
        continue;
      }

      const delayMs = Math.max(0, (when - engine.ctx.currentTime) * 1000);
      setTimeout(() => {
        const v = startSynthNote(engine, track.id, n.pitch, n.velocity ?? 0.85, preset);
        if (v) setTimeout(() => v.stop(), effectiveDur * 1000);
      }, delayMs);
    }
  }
}

/** GM-style drum pitch → kind. */
export function drumKindForPitch(pitch: number): DrumPiece {
  switch (pitch) {
    case 36: return "kick";
    case 37: return "rim";
    case 38: return "snare";
    case 39: return "clap";
    case 41: case 45: case 48: return "tom";
    case 42: return "hat";
    case 44: return "perc";
    case 46: return "openhat";
    case 49: return "crash";
    case 51: return "ride";
    case 56: return "cowbell";
    default: return "perc";
  }
}

function scheduleDrumHit(engine: DawEngine, chain: any, kind: DrumPiece, when: number, velocity = 0.85, kitName?: string) {
  const ctx = engine.ctx;
  const v = Math.max(0.05, Math.min(1, velocity));
  const kit = getKitByName(kitName);
  const spec: KitVoiceSpec = kit.voices[kind] || {};

  const hasPitchSweep = spec.startHz != null && spec.endHz != null;
  if (hasPitchSweep) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const dur = spec.dur ?? 0.3;
    osc.frequency.setValueAtTime(spec.startHz!, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.endHz!), when + dur * 0.7);
    env.gain.setValueAtTime(v, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env);
    let out: AudioNode = env;
    if ((spec.drive ?? 0) > 0.001) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistCurve(spec.drive!) as any;
      shaper.oversample = "2x";
      env.connect(shaper);
      out = shaper;
    }
    out.connect(chain.input);
    try { osc.start(when); osc.stop(when + dur + 0.05); chain.activeSources.push(osc); } catch {}
    return;
  }

  // Pure-tone (cowbell)
  if (spec.tone && spec.toneHz && (!spec.noiseDecay || (spec.noiseGain ?? 0) === 0)) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const dur = spec.dur ?? 0.18;
    osc.type = "square";
    osc.frequency.value = spec.toneHz;
    env.gain.setValueAtTime(v * spec.tone, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(env).connect(chain.input);
    try { osc.start(when); osc.stop(when + dur + 0.02); chain.activeSources.push(osc); } catch {}
    return;
  }

  // Noise-based voice with optional tonal body
  if (spec.noiseDecay && spec.noiseDecay > 0) {
    const decay = spec.noiseDecay;
    const gain = (spec.noiseGain ?? 0.4) * v;
    const bufLen = Math.ceil(ctx.sampleRate * (decay + 0.1));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = spec.filterType ?? "highpass";
    filter.frequency.value = spec.filterHz ?? 6000;
    filter.Q.value = spec.filterQ ?? 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, when);
    env.gain.exponentialRampToValueAtTime(0.001, when + decay);
    noise.connect(filter).connect(env).connect(chain.input);
    try { noise.start(when); noise.stop(when + decay + 0.1); chain.activeSources.push(noise); } catch {}

    if (spec.tone && spec.toneHz) {
      const osc = ctx.createOscillator();
      const tEnv = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = spec.toneHz;
      tEnv.gain.setValueAtTime(v * spec.tone, when);
      tEnv.gain.exponentialRampToValueAtTime(0.001, when + Math.min(0.15, decay));
      osc.connect(tEnv).connect(chain.input);
      try { osc.start(when); osc.stop(when + decay + 0.02); chain.activeSources.push(osc); } catch {}
    }
  }
}

/** Trigger a drum hit immediately (used by pads / step seq UI). */
export function triggerDrumHit(engine: DawEngine, trackId: string, kind: DrumPiece, kitName?: string, velocity = 0.95) {
  const chain = (engine as any).trackChains.get(trackId);
  if (!chain) return;
  scheduleDrumHit(engine, chain, kind, engine.ctx.currentTime, velocity, kitName);
}

export type { MidiNote };

