/**
 * Upbeat WebAudio techno/house loop for the games — kick, hats, bassline and a
 * bright pluck arpeggio, generated on the fly (no audio files) so it can loop
 * forever, start on a user gesture, and be muted at any time.
 */

const KEY = "yaj.games.music.muted";

type Voice = { osc: OscillatorNode; gain: GainNode };

const BPM = 124;
const STEP = 60 / BPM / 2; // eighth notes
const STEPS_PER_BAR = 8;

class CasinoMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private voices: Voice[] = [];
  private playing = false;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  /** Bass root per bar (A minor groove). */
  private roots = [110, 110, 87.31, 98];
  /** Pluck arp offsets in semitones from the bar root. */
  private arp = [12, 19, 24, 19, 15, 19, 24, 28];

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx!;
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  private hat(t: number, open: boolean) {
    const ctx = this.ctx!;
    const len = open ? 0.16 : 0.05;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7200;
    const gain = ctx.createGain();
    gain.gain.value = open ? 0.16 : 0.11;
    src.connect(hp).connect(gain).connect(this.master!);
    src.start(t);
  }

  private bass(t: number, freq: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + STEP);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.26, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
    osc.connect(lp).connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + STEP);
  }

  private pluck(t: number, freq: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private scheduleStep(i: number, t: number) {
    const bar = Math.floor(i / STEPS_PER_BAR) % this.roots.length;
    const s = i % STEPS_PER_BAR;
    const root = this.roots[bar];

    if (s % 2 === 0) this.kick(t);
    this.hat(t + STEP / 2, s === 6);
    if (s !== 0) this.bass(t, s % 4 === 3 ? root * 1.5 : root);
    const semi = this.arp[s];
    this.pluck(t + STEP / 2, root * Math.pow(2, semi / 12));
  }

  private tick() {
    const ctx = this.ensure();
    // Schedule a little ahead so the groove stays tight.
    while (this.nextTime < ctx.currentTime + 0.35) {
      this.scheduleStep(this.step, Math.max(this.nextTime, ctx.currentTime + 0.02));
      this.step += 1;
      this.nextTime += STEP;
    }
  }

  async start() {
    if (this.playing) return;
    const ctx = this.ensure();
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
    this.playing = true;
    this.nextTime = ctx.currentTime + 0.08;
    this.applyVolume();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 120);
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    const target = this.muted || !this.playing ? 0 : 0.85;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.3);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    this.applyVolume();
  }

  stop() {
    this.playing = false;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.applyVolume();
    this.voices.forEach((v) => {
      try {
        v.osc.stop();
      } catch {
        /* ignore */
      }
    });
    this.voices = [];
    const ctx = this.ctx;
    if (ctx) {
      window.setTimeout(() => {
        if (!this.playing) void ctx.suspend().catch(() => undefined);
      }, 500);
    }
  }

  /** Short win fanfare — a rising gold arpeggio. */
  fanfare() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;
      osc.type = "triangle";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  /** Tile click/place sound. */
  clack() {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }
}

export const casinoMusic = new CasinoMusic();
