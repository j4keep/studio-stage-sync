/**
 * Procedural billiard sound effects (WebAudio, no audio files) — a cue strike,
 * ball-on-ball clacks, soft cushion thuds, and a ball dropping into a pocket.
 * No ambient loop: real tables don't have background music, and looping music
 * over a physics game gets old fast.
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

  private noiseBurst(t: number, len: number, hpFreq: number, gainPeak: number, decay: number) {
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
    src.connect(hp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** Cue tip striking the cue ball — sharper and louder the harder the shot. */
  strike(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = 0.28 + Math.min(1, Math.max(0, intensity)) * 0.5;
    this.noiseBurst(t, 0.05, 1600, amt, 0.07);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.05);
    gain.gain.setValueAtTime(amt * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /** Two balls clacking together. */
  click(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.14 + Math.min(1, Math.max(0, intensity)) * 0.32;
    this.noiseBurst(t, 0.022, 2400, amt * 0.6, 0.032);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1450, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);
    gain.gain.setValueAtTime(amt, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Ball bouncing off a cushion — soft, low thud. */
  rail(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.06 + Math.min(1, Math.max(0, intensity)) * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.06);
    gain.gain.setValueAtTime(amt, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** Ball dropping into a pocket — a rolling thud with a little resonance. */
  pocket() {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.noiseBurst(t, 0.09, 450, 0.2, 0.12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190, t + 0.02);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);
    gain.gain.setValueAtTime(0, t + 0.02);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + 0.02);
    osc.stop(t + 0.22);
  }
}

export const poolSfx = new PoolSfx();
