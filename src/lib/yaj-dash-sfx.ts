/**
 * Lightweight procedural sound effects for YAJ Dash.
 * Uses WebAudio only so the runner does not download audio files.
 */

const KEY = "yaj.games.dash.sfx.muted";

class YajDashSfx {
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
      const ctx = this.ensure();
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      /* optional audio */
    }
  }

  private async ready() {
    if (this.muted) return null;
    try {
      const ctx = this.ensure();
      if (ctx.state !== "running") await ctx.resume();
      return ctx;
    } catch {
      return null;
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

  private tone(ctx: AudioContext, t: number, freq: number, gainPeak: number, decay: number, type: OscillatorType = "sine") {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.04);
  }

  private noise(ctx: AudioContext, t: number, len: number, gainPeak: number, lpFreq: number) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lpFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  async start() {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    [330, 440, 660].forEach((f, i) => this.tone(ctx, t + i * 0.07, f, 0.12, 0.24, "triangle"));
  }

  async swipe() {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(ctx, t, 0.07, 0.07, 1800);
    this.tone(ctx, t, 520, 0.05, 0.07, "triangle");
  }

  async pickup(streak = 1) {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 760 + Math.min(streak, 8) * 28;
    this.tone(ctx, t, base, 0.11, 0.18, "sine");
    this.tone(ctx, t + 0.04, base * 1.32, 0.08, 0.16, "triangle");
  }

  async streak(streak: number) {
    const ctx = await this.ready();
    if (!ctx || streak < 3 || streak % 3 !== 0) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone(ctx, t + i * 0.055, f, 0.1, 0.22, "triangle"));
  }

  async hit() {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.noise(ctx, t, 0.15, 0.24, 500);
    this.tone(ctx, t, 110, 0.22, 0.22, "sine");
  }

  async gameOver() {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + 0.1;
    [330, 247, 196].forEach((f, i) => this.tone(ctx, t + i * 0.12, f, 0.11, 0.3, "triangle"));
  }
}

export const yajDashSfx = new YajDashSfx();
