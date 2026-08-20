/**
 * Procedural Bingo sound effects (WebAudio, no audio files) — number call blip, a mark tick,
 * a line-complete chime, the BINGO fanfare, and the buzzer.
 */

const KEY = "yaj.games.bingo.sfx.muted";

class BingoSfx {
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

  /** A number gets called out. */
  call() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** A called number matches a cell on your card — auto-marked. */
  mark() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.03);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2800;
    bp.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** A line just became one square away, or a new line opened up — a light nudge. */
  closeCall() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const notes = [660, 880];
    notes.forEach((f, i) => {
      const nt = t + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, nt);
      gain.gain.linearRampToValueAtTime(0.12, nt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, nt + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(nt);
      osc.stop(nt + 0.2);
    });
  }

  /** BINGO! claimed. */
  bingo() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  /** Someone else (the computer) called bingo first. */
  lose() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /** Round-cap buzzer — nobody got bingo in time. */
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
    gain.gain.setValueAtTime(0.2, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  /** Final-match win fanfare. */
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
}

export const bingoSfx = new BingoSfx();
