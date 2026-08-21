/**
 * Procedural Battleship sound effects (WebAudio, no audio files) — a splash
 * for a miss, an explosion for a hit, and a bigger explosion + descending
 * "going under" tone when a ship sinks. Same style as this app's other games.
 */

const KEY = "yaj.games.battleship.sfx.muted";

class BattleshipSfx {
  private ctx: AudioContext | null = null;
  private bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx!;
  }

  /** Soft looping ocean bed — filtered noise, gently swelling. Quiet under everything else. */
  ambienceStart() {
    if (this.muted || this.bed) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.018 * white) / 1.018;
      data[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 650;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(lp).connect(gain).connect(ctx.destination);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    src.start();
    this.bed = { src, gain };
  }

  ambienceStop() {
    if (!this.bed) return;
    try {
      this.bed.src.stop();
    } catch {
      /* already stopped */
    }
    this.bed = null;
  }

  private rainBed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Steady rain hiss — brighter/higher-passed than the ocean bed so it reads as rain, not waves. */
  rainStart() {
    if (this.muted || this.rainBed) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1400;
    const gain = ctx.createGain();
    gain.gain.value = 0.07;
    src.connect(hp).connect(gain).connect(ctx.destination);
    src.start();
    this.rainBed = { src, gain };
  }

  rainStop() {
    if (!this.rainBed) return;
    try {
      this.rainBed.src.stop();
    } catch {
      /* already stopped */
    }
    this.rainBed = null;
  }

  /** A lightning strike — a bright crack followed by a low rolling rumble. */
  thunder() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.crack(t, 0.05, 2600, 0.9, 0.5, 0.1);
    this.thud(t + 0.05, 1.4, 90, 0.5, 1.6);
  }

  async prime() {
    try {
      await this.ensure().resume();
    } catch {
      /* ignore */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (muted) {
      this.ambienceStop();
      this.rainStop();
    }
  }

  private noiseBuffer(ctx: AudioContext, len: number) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private crack(t: number, len: number, centerFreq: number, q: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, len);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = centerFreq;
    bp.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  private thud(t: number, len: number, lpFreq: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, len);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lpFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** Shell lands in open water — a soft filtered splash, no impact. */
  miss() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** A shell connects with a hull — a sharp crack over a heavy thud. */
  hit() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.crack(t, 0.03, 1600, 1.4, 0.6, 0.09);
    this.thud(t, 0.16, 160, 0.85, 0.22);
  }

  /** A ship goes down — a bigger blast plus a descending groan as it sinks. */
  sunk() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.crack(t, 0.04, 1400, 1.2, 0.9, 0.14);
    this.thud(t, 0.3, 130, 1.1, 0.5);
    for (let i = 0; i < 6; i++) {
      const wt = t + 0.05 + Math.random() * 0.5;
      this.crack(wt, 0.03, 900 + Math.random() * 900, 1, 0.3 + Math.random() * 0.2, 0.15);
    }
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(40, t + 1.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t + 0.1);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + 0.1);
    osc.stop(t + 1.25);
  }

  /** A light click for placing a ship during setup. */
  place() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(t, 0.04, 300, 0.3, 0.06);
  }

  /** A cannon/launcher firing — a low thump with a quick rising whoosh as the shot leaves. */
  launch() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(t, 0.1, 220, 0.6, 0.14);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /** Sonar Pulse — a clean sweeping tone, distinct from the splash/impact cues. */
  sonarPulse() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /** A soft double-tick marking a turn changing hands. */
  turnChange() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(t, 0.03, 900, 0.18, 0.05);
    this.thud(t + 0.09, 0.03, 700, 0.14, 0.05);
  }

  /** Match won — a bright, brief rising fanfare, not a toy jingle. */
  victory() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    [392, 523, 659, 784].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      const at = t + i * 0.1;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.16, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    });
  }

  /** Match lost — a low descending tone, understated rather than harsh. */
  defeat() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.05);
  }
}

export const battleshipSfx = new BattleshipSfx();
