/**
 * Procedural Checkers sound effects — lightweight WebAudio so no media files
 * are downloaded just to make the board feel responsive.
 */

const KEY = "yaj.games.checkers.sfx.muted";

class CheckersSfx {
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
      /* ignore storage failures */
    }
  }

  private knock(t: number, freq: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq * 0.45), t + decay);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.03);
  }

  /** Wooden checker sliding/tapping into its next square. */
  async move() {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.knock(t, 310, 0.22, 0.085);
    this.knock(t + 0.038, 185, 0.14, 0.075);
  }

  /** Heavier double impact when a piece is jumped/captured. */
  async capture() {
    const ctx = await this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.knock(t, 285, 0.26, 0.09);
    this.knock(t + 0.06, 125, 0.32, 0.15);
  }

  /** Bright little crown sound when a piece reaches king row. */
  async king() {
    const ctx = await this.ready();
    if (!ctx) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  /** Subtle selection click so tapping a movable piece has audible feedback. */
  async select() {
    const ctx = await this.ready();
    if (!ctx) return;
    this.knock(ctx.currentTime, 460, 0.11, 0.055);
  }
}

export const checkersSfx = new CheckersSfx();
