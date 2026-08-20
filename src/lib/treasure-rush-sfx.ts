/**
 * AudioManager for YAJ Treasure Rush.
 *
 * NOTE ON AUDIO SOURCES: every cue below is synthesised with WebAudio (no files),
 * which keeps the level lightweight and avoids placeholder MP3s. If we later want
 * recorded audio, these are the cues to replace with real assets:
 * footstep, coin, gem, chest, key, unlock, locked, trap, heart, warn, complete, highScore.
 */
class TreasureRushSfx {
  private ctx: AudioContext | null = null;
  private lastStep = 0;
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

  private tone(freq: number, dur: number, type: OscillatorType = "triangle", gain = 0.08, slideTo?: number, delay = 0) {
    const ctx = this.ac();
    if (!ctx) return;
    const at = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), at + dur);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  private noise(dur: number, gain = 0.06, hp = 500) {
    const ctx = this.ac();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
  }

  /** Throttled footstep so walking has weight without becoming noisy. */
  footstep() {
    const now = performance.now();
    if (now - this.lastStep < 280) return;
    this.lastStep = now;
    this.noise(0.07, 0.028, 900);
  }

  coin() {
    this.tone(1180, 0.09, "square", 0.045, 1560);
  }

  gem() {
    this.tone(880, 0.1, "triangle", 0.06, 1320);
    this.tone(1320, 0.14, "triangle", 0.05, 1760, 0.06);
  }

  chest() {
    this.noise(0.16, 0.05, 300);
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.06, undefined, i * 0.09));
  }

  goldChest() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.26, "triangle", 0.075, undefined, i * 0.08));
  }

  key() {
    this.tone(740, 0.12, "square", 0.05, 1100);
    this.tone(1480, 0.1, "square", 0.035, undefined, 0.08);
  }

  unlock() {
    this.noise(0.12, 0.05, 220);
    this.tone(220, 0.3, "sawtooth", 0.05, 440);
  }

  locked() {
    this.tone(180, 0.16, "square", 0.05, 120);
  }

  switchPress() {
    this.tone(520, 0.07, "square", 0.05, 700);
  }

  trap() {
    this.noise(0.2, 0.07, 180);
    this.tone(260, 0.22, "sawtooth", 0.06, 90);
  }

  heartLost() {
    this.tone(420, 0.34, "sine", 0.08, 150);
  }

  timerWarning() {
    this.tone(880, 0.12, "square", 0.05);
    this.tone(880, 0.12, "square", 0.05, undefined, 0.18);
  }

  power() {
    this.tone(660, 0.14, "triangle", 0.06, 1320);
  }

  complete() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.085, undefined, i * 0.12));
  }

  failed() {
    [440, 330, 262].forEach((f, i) => this.tone(f, 0.32, "sawtooth", 0.06, undefined, i * 0.14));
  }

  highScore() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.26, "square", 0.06, undefined, i * 0.1));
  }
}

export const trSfx = new TreasureRushSfx();
