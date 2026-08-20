/** Tiny WebAudio kit for the obby: jump blip, landing thud, fall, and a win fanfare. */
class ObbySfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ac() {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  async prime() {
    const ctx = this.ac();
    if (ctx && ctx.state === "suspended") await ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", gain = 0.09, slideTo?: number) {
    const ctx = this.ac();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  jump() {
    this.tone(420, 0.14, "square", 0.06, 760);
  }

  land() {
    this.tone(150, 0.1, "triangle", 0.07, 90);
  }

  fall() {
    this.tone(520, 0.5, "sawtooth", 0.07, 80);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => this.tone(f, 0.22, "triangle", 0.09), i * 110));
  }
}

export const obbySfx = new ObbySfx();
