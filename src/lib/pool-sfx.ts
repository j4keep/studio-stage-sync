/**
 * Procedural billiard sound effects (WebAudio, no audio files) — a cue strike,
 * ball-on-ball clacks, cushion thuds, and a ball dropping into a pocket.
 *
 * A real ball impact is dominated by a very short, loud, broadband noise
 * transient (a "crack") with almost no tonal ringing — pure sine/triangle
 * oscillators read as a synthetic "ping" (the ping-pong problem). So the
 * character here comes from tightly bandpass-filtered noise bursts, not
 * musical tones; any oscillator is just quiet low-end body underneath it.
 * No ambient loop: real tables don't have background music.
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

  private noiseBuffer(ctx: AudioContext, len: number) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** The core "crack" — noise punched through a resonant bandpass, very short decay. */
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

  /** Soft, low-passed noise body — the felt-muffled "thud" underneath a crack. */
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

  /** Cue tip striking the cue ball — a hard, loud crack with body behind it. */
  strike(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = 0.4 + Math.min(1, Math.max(0, intensity)) * 0.6;
    this.crack(t, 0.02, 2600, 1.8, amt * 1.3, 0.02);
    this.crack(t, 0.016, 4200, 2.2, amt * 0.7, 0.012);
    this.thud(t, 0.05, 320, amt * 0.45, 0.05);
  }

  /** Two balls clacking together — sharp and percussive, no musical ring. */
  click(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.28 + Math.min(1, Math.max(0, intensity)) * 0.45;
    const wobble = 1 + (Math.random() - 0.5) * 0.15;
    this.crack(t, 0.016, 2900 * wobble, 2, amt * 1.2, 0.016);
    this.crack(t, 0.012, 4600 * wobble, 2.4, amt * 0.55, 0.009);
    this.thud(t, 0.03, 260, amt * 0.22, 0.03);
  }

  /** Ball bouncing off a cushion — a rubbery, low-pitched thock, softer than a ball-ball hit. */
  rail(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.1 + Math.min(1, Math.max(0, intensity)) * 0.18;
    this.crack(t, 0.02, 1400, 1.4, amt * 0.5, 0.03);
    this.thud(t, 0.06, 260, amt, 0.07);
  }

  /** Ball dropping into a pocket — a couple of soft rattles into the liner, then a settling thud. */
  pocket() {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.crack(t, 0.014, 2400, 1.6, 0.22, 0.018);
    this.thud(t + 0.045, 0.02, 500, 0.16, 0.03);
    this.thud(t + 0.1, 0.09, 220, 0.32, 0.16);
  }
}

export const poolSfx = new PoolSfx();
