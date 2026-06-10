import type { Track, Clip, TransportState, EffectInstance, MidiNote } from "./types";
import { buildEffect, type BuiltEffect } from "./Effects";

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
    reverbSend: GainNode;
    delaySend: GainNode;
    activeSources: AudioScheduledSourceNode[];
    micSource?: MediaStreamAudioSourceNode | null;
    inputMonitorSource?: MediaStreamAudioSourceNode | null;
    inputMonitorStream?: MediaStream | null;
    inputMonitoring: boolean;
    inputMonitorToken: number;
    inputMonitorFailed: boolean;
    savedReverbSend?: number;
    savedDelaySend?: number;
    effectSignature: string;
  }>();
  private startCtxTime = 0;
  private startTransportTime = 0;
  playing = false;

  // Metronome
  private metroEnabled = false;
  private metroBpm = 120;
  private metroNextBeat = 0;
  private metroBeatIndex = 0;
  private metroTimer: number | null = null;

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
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    this.destStream = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.destStream);

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
        reverbSend,
        delaySend,
        activeSources: [],
        inputMonitoring: false,
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
    const volume = Math.max(0, Math.min(1, track.volume));
    const reverb = Math.max(0, Math.min(1, track.reverbSend));
    const delay = Math.max(0, Math.min(1, track.delaySend));
    c.panner.pan.setTargetAtTime(pan, now, 0.01);
    // Solo-aware live gain: if any other track is soloed and this one isn't, silence it.
    const anySolo = allTracks ? allTracks.some(t => t.solo) : false;
    const silencedBySolo = anySolo && !track.solo;
    c.gain.gain.setTargetAtTime((track.mute || silencedBySolo) ? 0 : volume, now, 0.01);
    const inputOnlyMetering = this.recordingTrackId === track.id || c.inputMonitoring;
    c.monitorGain.gain.setTargetAtTime(inputOnlyMetering ? 0 : 1, now, 0.01);
    c.reverbSend.gain.setTargetAtTime(inputOnlyMetering ? 0 : reverb, now, 0.01);
    c.delaySend.gain.setTargetAtTime(inputOnlyMetering ? 0 : delay, now, 0.01);
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
    try { c.input.disconnect(); c.panner.disconnect(); c.gain.disconnect(); c.analyser.disconnect(); c.reverbSend.disconnect(); c.delaySend.disconnect(); } catch {}
    this.trackChains.delete(trackId);
  }

  setMasterVolume(v: number) { this.masterGain.gain.value = v; }
  getMasterAnalyser() { return this.masterAnalyser; }
  getTrackAnalyser(trackId: string) { return this.trackChains.get(trackId)?.analyser ?? null; }
  getTrackStereoAnalysers(trackId: string) {
    const c = this.trackChains.get(trackId);
    return c ? { L: c.analyserL, R: c.analyserR } : null;
  }

  play(transport: TransportState, tracks: Track[], clips: Clip[]) {
    this.stopAllSources();
    this.startCtxTime = this.ctx.currentTime + 0.05;
    this.startTransportTime = transport.position;
    this.playing = true;
    this.metroBpm = transport.bpm;
    this.metroEnabled = !!transport.metronome;
    this.metroBeatIndex = 0;
    this.metroNextBeat = this.startCtxTime;
    this.scheduleMetronome();

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
        void newTransport;
      }
      this.onPositionChange?.(pos);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.playing = false;
    this.metroEnabled = false;
    if (this.metroTimer) { clearTimeout(this.metroTimer); this.metroTimer = null; }
    cancelAnimationFrame(this.rafId);
    this.stopAllSources();
    if (this.recordingTrackId) this.stopRecording();
    this.onStop?.();
  }

  setMetronome(enabled: boolean, bpm?: number) {
    this.metroEnabled = enabled;
    if (bpm) this.metroBpm = bpm;
    if (enabled && this.playing) {
      this.metroNextBeat = this.ctx.currentTime + 0.05;
      this.metroBeatIndex = 0;
      this.scheduleMetronome();
    } else if (!enabled && this.metroTimer) {
      clearTimeout(this.metroTimer); this.metroTimer = null;
    }
  }

  private scheduleMetronome() {
    if (!this.metroEnabled || !this.playing) return;
    const beatDur = 60 / this.metroBpm;
    const lookahead = this.ctx.currentTime + 0.25;
    while (this.metroNextBeat < lookahead) {
      this.playClick(this.metroNextBeat, this.metroBeatIndex % 4 === 0);
      this.metroNextBeat += beatDur;
      this.metroBeatIndex++;
    }
    this.metroTimer = window.setTimeout(() => this.scheduleMetronome(), 100);
  }

  private playClick(when: number, accent: boolean) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.connect(env).connect(this.masterGain);
    osc.start(when); osc.stop(when + 0.06);
  }

  private stopAllSources() {
    this.trackChains.forEach((c) => {
      c.activeSources.forEach((s) => { try { s.stop(); } catch {} });
      c.activeSources = [];
    });
  }


  // Live recording level + waveform progress
  recordingLivePeaks: number[] = []; // peak per processor block
  onRecordingProgress?: (peaks: number[], durationSec: number) => void;
  getRecordingTrackId() { return this.recordingTrackId; }
  getRecordingStart() { return this.recordStartTransport; }

  syncInputMonitoring(tracks: Track[]) {
    // Always-on input metering for every audio track — independent of arm state.
    const audioIds = new Set(tracks.filter(t => t.kind === "audio").map(t => t.id));
    this.trackChains.forEach((_, id) => {
      if (!audioIds.has(id)) this.stopInputMonitoring(id);
    });
    tracks.forEach((track) => {
      if (track.kind !== "audio" || this.recordingTrackId === track.id) return;
      void this.startInputMonitoring(track.id, track.inputDeviceId);
    });
  }

  async monitorInput(trackId: string, inputDeviceId?: string) {
    await this.startInputMonitoring(trackId, inputDeviceId);
  }

  unmonitorInput(trackId: string) {
    this.stopInputMonitoring(trackId);
  }

  private async startInputMonitoring(trackId: string, inputDeviceId?: string) {
    const chain = this.trackChains.get(trackId);
    if (!chain || chain.inputMonitoring || chain.inputMonitorFailed) return;
    const token = ++chain.inputMonitorToken;
    try {
      await this.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: this.ctx.sampleRate,
        } as MediaTrackConstraints,
      });
      if (chain.inputMonitorToken !== token || this.recordingTrackId === trackId) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const src = this.ctx.createMediaStreamSource(stream);
      src.connect(chain.input);
      chain.inputMonitorSource = src;
      chain.inputMonitorStream = stream;
      chain.inputMonitoring = true;
      chain.inputMonitorFailed = false;
      chain.monitorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      chain.reverbSend.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      chain.delaySend.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    } catch {
      if (chain.inputMonitorToken === token) chain.inputMonitorFailed = true;
    }
  }

  private stopInputMonitoring(trackId: string) {
    const chain = this.trackChains.get(trackId);
    if (!chain) return;
    chain.inputMonitorToken++;
    try { chain.inputMonitorSource?.disconnect(); } catch {}
    chain.inputMonitorStream?.getTracks().forEach(t => t.stop());
    chain.inputMonitorSource = null;
    chain.inputMonitorStream = null;
    chain.inputMonitoring = false;
    chain.inputMonitorFailed = false;
  }

  async startRecording(trackId: string, transportPos: number, inputDeviceId?: string) {
    if (this.recordingTrackId) this.stopRecording();
    this.recordingTrackId = trackId;
    this.recordStartTransport = transportPos;
    this.recBuffers = [];
    this.recordingLivePeaks = [];
    const chain = this.trackChains.get(trackId);
    this.stopInputMonitoring(trackId);
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: inputDeviceId ? { exact: inputDeviceId } : undefined,
        // Record the mic stream, while asking the browser to remove DAW playback
        // from the capture so imported beats do not print into the vocal take.
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: this.ctx.sampleRate,
      } as MediaTrackConstraints,
    });

    const src = this.ctx.createMediaStreamSource(this.micStream);

    // Route mic INTO the track chain so the existing meters/effects path is live.
    // Mute the speaker monitor + sends to prevent feedback howl / robotic doubling.
    if (chain) {
      chain.micSource = src;
      chain.savedReverbSend = chain.reverbSend.gain.value;
      chain.savedDelaySend = chain.delaySend.gain.value;
      chain.monitorGain.gain.value = 0;          // no live monitoring through speakers
      chain.reverbSend.gain.value = 0;
      chain.delaySend.gain.value = 0;
      try { src.connect(chain.input); } catch {}
    }

    // Capture clean mic samples for the clip + drive the live waveform overlay
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
      // Peak for live waveform overlay
      let peak = 0;
      for (let i = 0; i < ch.length; i++) {
        const v = Math.abs(ch[i]);
        if (v > peak) peak = v;
      }
      this.recordingLivePeaks.push(peak);
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
      try { chain.micSource?.disconnect(); } catch {}
      chain.micSource = null;
      chain.monitorGain.gain.value = 1;
      if (chain.savedReverbSend != null) chain.reverbSend.gain.value = chain.savedReverbSend;
      if (chain.savedDelaySend != null) chain.delaySend.gain.value = chain.savedDelaySend;
      chain.savedReverbSend = undefined;
      chain.savedDelaySend = undefined;
    }
    this.recBuffers = [];
    this.recordingLivePeaks = [];
    try { this.recProcessor?.disconnect(); } catch {}
    try { this.recSilentSink?.disconnect(); } catch {}
    this.recProcessor = null;
    this.recSilentSink = null;
    this.micStream?.getTracks().forEach(t => t.stop());
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
    try { this.ctx.close(); } catch {}
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
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

/** Trigger a one-shot synth note immediately on a track's input. */
export function triggerSynthNote(engine: DawEngine, trackId: string, midi: number, durationSec = 0.4, velocity = 0.8) {
  const chain = (engine as any).trackChains.get(trackId);
  if (!chain) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = midiToFreq(midi);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(velocity * 0.6, now + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
  osc.connect(env).connect(chain.input);
  osc.start(now);
  osc.stop(now + durationSec + 0.05);
}

/** Trigger a drum hit (simple noise/click sound). */
export function triggerDrumHit(engine: DawEngine, trackId: string, kind: "kick" | "snare" | "hat") {
  const chain = (engine as any).trackChains.get(trackId);
  if (!chain) return;
  const ctx = engine.ctx;
  const now = ctx.currentTime;
  if (kind === "kick") {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    env.gain.setValueAtTime(1, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(env).connect(chain.input);
    osc.start(now); osc.stop(now + 0.3);
  } else {
    const bufferSize = ctx.sampleRate * 0.2;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = kind === "snare" ? "bandpass" : "highpass";
    filter.frequency.value = kind === "snare" ? 1500 : 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(kind === "snare" ? 0.6 : 0.3, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + (kind === "snare" ? 0.18 : 0.05));
    noise.connect(filter).connect(env).connect(chain.input);
    noise.start(now); noise.stop(now + 0.25);
  }
}

export type { MidiNote };
