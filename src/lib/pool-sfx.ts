/**
 * Procedural billiard sound effects (WebAudio, no audio files) — a cue strike,
 * ball-on-ball clacks, cushion thuds, and a ball dropping into a pocket.
 * Tuned to sound like real phenolic-resin balls (a bright, ringing "crack"
 * with body) rather than a thin, hollow "ping-pong" click. No ambient loop:
 * real tables don't have background music.
 */

const KEY = "yaj.games.pool.sfx.muted";

class PoolSfx {
  private ctx: AudioContext | null = null;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx!;
  }

  /** Call from a user gesture (e.g. "Break the rack") to unlock audio on iOS/Safari. */
  async prime() {
    const ctx = this.ensure();
    try {
      await ctx.resume();
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
  }

  private noiseBurst(t: number, len: number, hpFreq: number, gainPeak: number, decay: number, lpFreq?: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = hpFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    let node: AudioNode = src.connect(hp);
    if (lpFreq) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = lpFreq;
      node = hp.connect(lp);
    }
    node.connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** A short resonant "ring" — two detuned tones with a fast decay, like struck resin. */
  private ring(t: number, freq: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    for (const detune of [1, 1.014]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * detune, t);
      osc.frequency.exponentialRampToValueAtTime(freq * detune * 0.72, t + decay);
      gain.gain.setValueAtTime(gainPeak * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + decay + 0.02);
    }
  }

  /** Cue tip striking the cue ball — a hard crack with low-mid body behind it. */
  strike(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = 0.35 + Math.min(1, Math.max(0, intensity)) * 0.55;
    this.noiseBurst(t, 0.028, 2200, amt * 1.1, 0.045);
    this.ring(t + 0.002, 2100, amt * 0.9, 0.09);
    // Low-mid body — the "thock" of a firm strike.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.07);
    gain.gain.setValueAtTime(amt * 0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Two balls clacking together — bright, ringing, with real body. */
  click(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.22 + Math.min(1, Math.max(0, intensity)) * 0.4;
    this.noiseBurst(t, 0.014, 2800, amt * 0.7, 0.02);
    this.ring(t, 2300 - Math.random() * 200, amt, 0.075 + Math.random() * 0.02);
  }

  /** Ball bouncing off a cushion — a rubbery thock, softer than a ball-ball hit. */
  rail(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.08 + Math.min(1, Math.max(0, intensity)) * 0.16;
    this.noiseBurst(t, 0.02, 900, amt * 0.5, 0.04, 2600);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.06);
    gain.gain.setValueAtTime(amt, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Ball dropping into a pocket — a couple of soft rattles into the liner, then a settling thud. */
  pocket() {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.noiseBurst(t, 0.012, 3000, 0.16, 0.02);
    this.noiseBurst(t + 0.05, 0.014, 2200, 0.12, 0.025);
    this.noiseBurst(t + 0.1, 0.02, 500, 0.2, 0.11);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.26);
    gain.gain.setValueAtTime(0, t + 0.1);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.115);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + 0.1);
    osc.stop(t + 0.32);
  }
}

export const poolSfx = new PoolSfx();
