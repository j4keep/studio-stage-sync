/**
 * Procedural YAJ Sugar Rush sound effects (WebAudio, no audio files) — candy pops, cascade
 * sparkle, special-candy whoosh, an invalid-swap buzz, and win/level-complete fanfares. Same
 * style as this app's other games.
 */

const KEY = "yaj.games.sugarrush.sfx.muted";

class SugarRushSfx {
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

  /** A quick soft tick when a swap is accepted (before the pops land). */
  swap() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** A soft low buzz for a swap that didn't form a match. */
  invalid() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 140;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** Candies popping — pitch rises with cascade depth so a deep chain sounds increasingly
   *  excited, matching the escalating score multiplier. */
  pop(cascadeDepth = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const base = 660 + Math.min(6, cascadeDepth) * 90;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** A special candy being created or triggered — a bright sparkly sweep. */
  special() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.28);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.34);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.2);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.06, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(hp).connect(ng).connect(ctx.destination);
    src.start(t);
  }

  /** Buzzer at the end of a versus round. */
  buzzer() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 180;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.03);
    gain.gain.setValueAtTime(0.2, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  /** Match win / level-complete fanfare. */
  win() {
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

  /** Match loss / level failed — a soft descending tone. */
  lose() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.85);
  }
}

export const sugarRushSfx = new SugarRushSfx();
