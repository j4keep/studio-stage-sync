/**
 * Procedural driving sound effects (WebAudio, no audio files) — an engine hum
 * that rises with speed, a boost whoosh, a crash, and a finish fanfare.
 */

const KEY = "yaj.games.driving.sfx.muted";

class DrivingSfx {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx!;
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
    if (muted) this.stopEngine();
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

  /** Starts a continuous low engine drone. Call updateEngine() each tick to vary pitch with speed. */
  startEngine() {
    if (this.muted || this.engineOsc) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 60;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(lp).connect(gain).connect(ctx.destination);
    osc.start();
    gain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.4);
    this.engineOsc = osc;
    this.engineGain = gain;
  }

  /** speedFactor 0..1 — idle to flat out. */
  updateEngine(speedFactor: number) {
    if (!this.engineOsc || !this.ctx) return;
    const f = 55 + Math.min(1, Math.max(0, speedFactor)) * 90;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.15);
  }

  stopEngine() {
    if (!this.engineOsc || !this.ctx || !this.engineGain) return;
    const gain = this.engineGain;
    const osc = this.engineOsc;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.15);
    window.setTimeout(() => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }, 400);
    this.engineOsc = null;
    this.engineGain = null;
  }

  /** A near-miss swish — dodged a car close. */
  closeCall() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(2200, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** Nitro boost pickup — a rising whoosh. */
  boost() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  /** Metal-on-metal crash. */
  crash() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.crack(t, 0.05, 1800, 1.2, 0.9, 0.16);
    this.thud(t, 0.3, 140, 1.1, 0.4);
    for (let i = 0; i < 5; i++) {
      const wt = t + Math.random() * 0.3;
      this.crack(wt, 0.03, 1000 + Math.random() * 1400, 1.4, 0.3, 0.12);
    }
  }

  /** Clean finish fanfare. */
  finish() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }
}

export const drivingSfx = new DrivingSfx();
