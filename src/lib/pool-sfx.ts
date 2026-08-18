/**
 * Procedural billiard sound effects (WebAudio, no audio files).
 *
 * Modeled on how a real ball impact actually sounds, as five distinct layers:
 *  - the strike/click: a sharp, bright, very short high-frequency pop
 *  - the body/thud: a low-mid knock underneath it that gives the impact mass
 *  - the table echo: a soft, muffled reverb tail (slate + felt swallow sharp echoes)
 *  - the roll: a continuous low rumble with a faint high whir while balls are moving
 *  - the pocket drop: a deep thud followed by a soft rattle against the liner
 *
 * No ambient music loop — real tables don't have one, and it gets old fast.
 */

const KEY = "yaj.games.pool.sfx.muted";

class PoolSfx {
  private ctx: AudioContext | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private rollSrc: AudioBufferSourceNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (!this.reverb) this.buildReverb(this.ctx!);
    return this.ctx!;
  }

  /** A short, muffled "room" impulse — felt and slate swallow sharp reflections fast. */
  private buildReverb(ctx: AudioContext) {
    const duration = 0.34;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * 0.28; // one-pole lowpass over the noise itself: darkens the tail
        const env = Math.pow(1 - i / len, 2.6);
        data[i] = lp * env;
      }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = buf;
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.32;
    this.reverb.connect(this.reverbGain).connect(ctx.destination);
  }

  /** Sends a node to both the dry output and the shared muffled-room reverb bus. */
  private toBus(node: AudioNode) {
    node.connect(this.ctx!.destination);
    if (this.reverb) node.connect(this.reverb);
  }

  /** Call from a user gesture (e.g. "Break the rack") to unlock audio on iOS/Safari. */
  async prime() {
    const ctx = this.ensure();
    try {
      await ctx.resume();
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
    if (muted) this.stopRoll();
  }

  private noiseBuffer(ctx: AudioContext, len: number) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** The bright, short "click" transient. */
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
    src.connect(bp).connect(gain);
    this.toBus(gain);
    src.start(t);
  }

  /** The low-mid "thud" body underneath a click — the sense of mass. */
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
    src.connect(lp).connect(gain);
    this.toBus(gain);
    src.start(t);
  }

  /** Cue tip striking the cue ball — sharp click + heavy body. */
  strike(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = 0.45 + Math.min(1, Math.max(0, intensity)) * 0.65;
    this.crack(t, 0.011, 2900, 2.4, amt * 0.85, 0.013);
    this.thud(t, 0.075, 190, amt * 1.05, 0.09);
  }

  /** Two balls clacking together — the core "sharp pop over a dark knock" sound. */
  click(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.32 + Math.min(1, Math.max(0, intensity)) * 0.55;
    const wobble = 1 + (Math.random() - 0.5) * 0.12;
    this.crack(t, 0.009, 3100 * wobble, 2.6, amt * 0.8, 0.011);
    this.thud(t, 0.05, 210, amt * 0.9, 0.06);
  }

  /** Ball bouncing off a cushion — duller and softer, the rubber absorbs most of the energy. */
  rail(intensity = 1) {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const amt = 0.1 + Math.min(1, Math.max(0, intensity)) * 0.16;
    this.crack(t, 0.014, 1100, 1.1, amt * 0.3, 0.025);
    this.thud(t, 0.06, 190, amt * 0.9, 0.075);
  }

  /** Ball dropping into a pocket — a deep thud, then a soft rattle against the liner. */
  pocket() {
    if (this.muted) return;
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.thud(t, 0.1, 160, 0.4, 0.13);
    this.crack(t + 0.05, 0.01, 2200, 1.6, 0.14, 0.016);
    this.crack(t + 0.09, 0.012, 1700, 1.4, 0.1, 0.02);
    this.thud(t + 0.09, 0.03, 260, 0.14, 0.05);
  }

  /** Starts the continuous rolling rumble — call once when a shot begins. */
  startRoll() {
    if (this.muted || this.rollSrc) return;
    const ctx = this.ensure();
    const buf = this.noiseBuffer(ctx, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain);
    this.toBus(gain);
    src.start();
    this.rollSrc = src;
    this.rollGain = gain;
    this.rollFilter = filter;
  }

  /** Updates roll volume/brightness from the balls' current aggregate motion (0..1). */
  updateRoll(motion: number) {
    if (this.muted || !this.rollGain || !this.rollFilter || !this.ctx) return;
    const m = Math.min(1, Math.max(0, motion));
    const t = this.ctx.currentTime;
    this.rollGain.gain.setTargetAtTime(m * 0.16, t, 0.05);
    this.rollFilter.frequency.setTargetAtTime(190 + m * 260, t, 0.08);
  }

  /** Fades out and stops the rolling rumble — call once a shot has fully settled. */
  stopRoll() {
    if (!this.rollSrc || !this.ctx || !this.rollGain) return;
    const src = this.rollSrc;
    const gain = this.rollGain;
    const t = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, t, 0.06);
    window.setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }, 350);
    this.rollSrc = null;
    this.rollGain = null;
    this.rollFilter = null;
  }
}

export const poolSfx = new PoolSfx();
