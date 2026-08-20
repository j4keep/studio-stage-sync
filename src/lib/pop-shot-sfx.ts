/**
 * Procedural Pop Shot sound effects (WebAudio, no audio files) — ball bounce,
 * rim clank, net swish, crowd cheer swell, streak fanfare, and the buzzer.
 */

const KEY = "yaj.games.popshot.sfx.muted";

class PopShotSfx {
  private ctx: AudioContext | null = null;
  private crowdOsc: OscillatorNode | null = null;
  private crowdGain: GainNode | null = null;
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
    if (muted) this.stopCrowd();
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

  /** Ball leaving the hand — a short rubbery squeak. */
  release() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.crack(ctx.currentTime, 0.04, 900, 3, 0.15, 0.05);
  }

  /** Clean swish — no rim contact. */
  swish() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.22);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** Ball clanks off the rim (miss). */
  rimClank() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
    this.crack(t, 0.03, 2600, 4, 0.12, 0.08);
  }

  /** Ball bouncing off the backboard. */
  backboard() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.thud(ctx.currentTime, 0.08, 500, 0.25, 0.12);
  }

  /** Ball bouncing on the floor after a miss. */
  floorBounce() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.thud(ctx.currentTime, 0.06, 220, 0.18, 0.1);
  }

  /** Streak-milestone fanfare — hitting the hot-streak threshold. */
  onFire() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const notes = [392, 523.25, 659.25];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  /** Buzzer at the end of a round. */
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
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
    gain.gain.setValueAtTime(0.22, t + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  /** Final-buzzer win fanfare. */
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

  /** Continuous low crowd murmur, loudness driven by makeStreak intensity. */
  startCrowd() {
    if (this.muted || this.crowdOsc) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const src = ctx.createBufferSource();
    const buf = this.noiseBuffer(ctx, 2);
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(lp).connect(gain).connect(ctx.destination);
    src.start();
    this.crowdOsc = src as unknown as OscillatorNode;
    this.crowdGain = gain;
    gain.gain.setTargetAtTime(0.02, ctx.currentTime, 0.5);
  }

  /** intensity 0..1 */
  updateCrowd(intensity: number) {
    if (!this.crowdGain || !this.ctx) return;
    this.crowdGain.gain.setTargetAtTime(0.02 + Math.min(1, Math.max(0, intensity)) * 0.05, this.ctx.currentTime, 0.2);
  }

  stopCrowd() {
    if (!this.crowdOsc || !this.ctx || !this.crowdGain) return;
    const gain = this.crowdGain;
    const src = this.crowdOsc;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.2);
    window.setTimeout(() => {
      try {
        (src as any).stop();
      } catch {
        /* already stopped */
      }
    }, 500);
    this.crowdOsc = null;
    this.crowdGain = null;
  }
}

export const popShotSfx = new PopShotSfx();
