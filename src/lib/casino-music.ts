/**
 * Lightweight WebAudio lounge/casino background loop for the games.
 * No audio files — a soft jazzy chord bed generated on the fly so it can
 * loop forever, start on a user gesture, and be muted at any time.
 */

const KEY = "yaj.games.music.muted";

type Voice = { osc: OscillatorNode; gain: GainNode };

class CasinoMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private voices: Voice[] = [];
  private playing = false;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  private chords = [
    [220, 261.63, 329.63], // Am
    [174.61, 220, 261.63], // F
    [196, 246.94, 293.66], // G
    [164.81, 207.65, 246.94], // Em
  ];

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

  private tick() {
    const ctx = this.ensure();
    const chord = this.chords[this.step % this.chords.length];
    this.step += 1;
    const t = ctx.currentTime;

    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16 / (i + 1), t + 0.6);
      gain.gain.linearRampToValueAtTime(0, t + 3.2);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(t);
      osc.stop(t + 3.3);
      const v = { osc, gain };
      this.voices.push(v);
      osc.onended = () => {
        this.voices = this.voices.filter((x) => x !== v);
      };
    });
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
    this.applyVolume();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 3000);
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    const target = this.muted || !this.playing ? 0 : 0.5;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.4);
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
