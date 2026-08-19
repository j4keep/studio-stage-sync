/**
 * Procedural football sound effects (WebAudio, no audio files) — whistle,
 * tackle/catch thuds, a crowd swell on big plays and scores, and a foot-strike
 * for kicks. Same style as boxing-sfx.ts, kept intentionally simpler.
 */

const KEY = "yaj.games.football.sfx.muted";

class FootballSfx {
  private ctx: AudioContext | null = null;
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

  /** Ref's whistle — play start / play dead. */
  whistle() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.setValueAtTime(2600, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.setValueAtTime(0.14, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /** Tackle / catch — scaled by how big the play was (0..1). */
  impact(intensity = 0.5) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = 0.4 + Math.min(1, Math.max(0, intensity)) * 0.6;
    this.thud(t, 0.08, 160, amt, 0.14);
    this.crack(t, 0.015, 1100, 1.4, amt * 0.5, 0.05);
  }

  /** Incomplete pass / no-gain play — a soft, deflated non-event. */
  whiff() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(t, 0.05, 260, 0.18, 0.07);
  }

  /** Foot striking the ball — punt or field goal attempt. */
  kick() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(t, 0.05, 220, 0.5, 0.08);
    this.crack(t, 0.012, 2000, 1.6, 0.3, 0.04);
  }

  /** A crowd pop — bigger for turnovers and scores than routine gains. */
  crowd(intensity = 0.5) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = Math.min(1, Math.max(0, intensity));
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12 + amt * 0.3, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + amt * 1.2);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 2.2);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
    const whoops = 3 + Math.round(amt * 6);
    for (let i = 0; i < whoops; i++) {
      const wt = t + Math.random() * (0.5 + amt * 0.9);
      this.crack(wt, 0.09, 700 + Math.random() * 1400, 1.1, 0.06 + Math.random() * 0.07, 0.2 + Math.random() * 0.15);
    }
  }
}

export const footballSfx = new FootballSfx();
