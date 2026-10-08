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
      await this.ensure().resume();
    } catch {
      /* optional audio */
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
  move() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.knock(t, 310, 0.18, 0.08);
    this.knock(t + 0.035, 190, 0.11, 0.07);
  }

  /** Heavier double impact when a piece is jumped/captured. */
  capture() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.knock(t, 260, 0.22, 0.09);
    this.knock(t + 0.055, 130, 0.26, 0.13);
  }

  /** Bright little crown sound when a piece reaches king row. */
  king() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Subtle selection click so tapping a movable piece has audible feedback. */
  select() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.knock(ctx.currentTime, 420, 0.07, 0.045);
  }
}

export const checkersSfx = new CheckersSfx();
