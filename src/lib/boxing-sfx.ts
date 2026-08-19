/**
 * Procedural boxing sound effects (WebAudio, no audio files) + a spoken ring
 * announcer (browser SpeechSynthesis, no voice files). No music, by design —
 * just punches, crowd, and a voice calling the fight.
 */

const KEY = "yaj.games.boxing.sfx.muted";

class BoxingSfx {
  private ctx: AudioContext | null = null;
  private crowdGain: GainNode | null = null;
  private crowdVoices: { src: AudioBufferSourceNode; gain: GainNode }[] = [];
  private crowdBase = 0;
  muted = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false;

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx!;
  }

  /** Call from a user gesture to unlock WebAudio + speech synthesis on iOS/Safari. */
  async prime() {
    const ctx = this.ensure();
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        /* ignore */
      }
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (muted) {
      this.stopCrowd();
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private noiseBuffer(ctx: AudioContext, len: number) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Short bright-mid transient — the "smack" of glove on skin. */
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

  /** Low-mid body underneath the crack — the sense of weight behind the punch. */
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

  /** Quick air whoosh — a punch that didn't land on anything (thrown, missed, or dodged). */
  private whoosh(t: number, gainPeak: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(1800, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** Punch thrown — a light swish, regardless of outcome. */
  punchThrow() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.whoosh(ctx.currentTime, 0.1);
  }

  /** Clean punch connects — scaled by how hard it landed (0..1). */
  punchLand(intensity = 0.6) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const amt = 0.5 + Math.min(1, Math.max(0, intensity)) * 0.6;
    this.crack(t, 0.02, 1300 + Math.random() * 300, 1.8, amt * 0.9, 0.055);
    this.thud(t, 0.09, 150 - intensity * 40, amt * 1.1, 0.14 + intensity * 0.08);
  }

  /** Punch absorbed by a raised guard — duller, no crack, most of the energy soaked up. */
  blocked() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(t, 0.07, 320, 0.45, 0.09);
  }

  /** Punch sailed past a dodge, or just missed clean. */
  miss() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.whoosh(ctx.currentTime, 0.16);
  }

  // ---- Crowd ----

  private crowdLayer(centerFreq: number, q: number, lfoRate: number, lfoDepth: number, baseGain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    const buf = this.noiseBuffer(ctx, 2.5);
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = centerFreq;
    bp.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = baseGain;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lfoDepth;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    src.connect(bp).connect(gain).connect(this.crowdGain!);
    src.start();
    this.crowdVoices.push({ src, gain });
  }

  /** Starts the low continuous crowd murmur bed. Safe to call repeatedly (no-ops if already running). */
  startCrowd() {
    if (this.muted || this.crowdGain) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    this.crowdGain.connect(ctx.destination);
    this.crowdBase = 0.09;
    this.crowdLayer(420, 0.7, 0.13, 0.018, 0.09);
    this.crowdLayer(900, 0.6, 0.09, 0.02, 0.065);
    this.crowdLayer(1600, 0.5, 0.17, 0.014, 0.04);
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, ctx.currentTime, 0.6);
  }

  /**
   * Nudges the ambient bed toward however lopsided the fight currently is — the
   * crowd gets audibly louder/rowdier the more one fighter is dominating.
   * `lead` is 0 (even fight) .. 1 (total beatdown).
   */
  setLead(lead: number) {
    if (this.muted || !this.crowdGain || !this.ctx) return;
    const amt = Math.min(1, Math.max(0, lead));
    this.crowdBase = 0.09 + amt * 0.09;
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, this.ctx.currentTime, 1.1);
  }

  /** A swell above the ambient bed — call when a punch lands clean. Bigger intensity = bigger roar. */
  cheer(intensity = 0.5) {
    if (this.muted || !this.crowdGain || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const amt = Math.min(1, Math.max(0, intensity));
    const peak = this.crowdBase + 0.2 + amt * 0.4;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(peak, t + 0.1);
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, t + 0.3, 0.5 + amt * 0.6);

    const whoops = 3 + Math.round(amt * 5);
    for (let i = 0; i < whoops; i++) {
      const wt = t + Math.random() * (0.5 + amt * 0.6);
      this.crack(wt, 0.09, 700 + Math.random() * 1400, 1.1, 0.09 + Math.random() * 0.08, 0.22 + Math.random() * 0.15);
    }
  }

  /** The big one — knockout roar. */
  koRoar() {
    if (this.muted || !this.crowdGain || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(this.crowdBase + 0.6, t + 0.25);
    this.crowdGain.gain.setTargetAtTime(this.crowdBase + 0.1, t + 1.6, 1.4);
    for (let i = 0; i < 14; i++) {
      const wt = t + Math.random() * 1.4;
      this.crack(wt, 0.12, 500 + Math.random() * 1800, 1, 0.1 + Math.random() * 0.09, 0.25 + Math.random() * 0.2);
    }
  }

  /** A struck bell/gong tone — used for the pre-fight countdown and the opening bell. */
  private bell(t: number, freq: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const overtone = ctx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2.01, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(gainPeak * 0.35, t);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.6);
    osc.connect(gain).connect(ctx.destination);
    overtone.connect(overtoneGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.05);
    overtone.start(t);
    overtone.stop(t + decay * 0.6 + 0.05);
  }

  /** One tick of the pre-fight countdown — pitch rises as it approaches zero, building tension. */
  countdownBeat(secondsLeft: number) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const freq = 300 + Math.max(0, 5 - secondsLeft) * 70;
    this.bell(t, freq, 0.24, 0.5);
  }

  /** The opening bell — a bigger bell + a brass-ish stab chord, right as the fight begins. */
  fightBell() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.bell(t, 660, 0.34, 0.9);
    this.bell(t + 0.08, 880, 0.26, 0.7);
    [440, 554.37, 659.25].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  /** Fades out and stops the crowd bed — call when a match ends or the page unmounts. */
  stopCrowd() {
    if (!this.crowdGain || !this.ctx) {
      this.crowdVoices = [];
      return;
    }
    const gain = this.crowdGain;
    const voices = this.crowdVoices;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0, t, 0.15);
    window.setTimeout(() => {
      voices.forEach((v) => {
        try {
          v.src.stop();
        } catch {
          /* already stopped */
        }
      });
    }, 500);
    this.crowdGain = null;
    this.crowdVoices = [];
  }

  // ---- Announcer ----

  /**
   * Speaks a line via the browser's built-in voice. Cancels any line still in
   * progress first. This is generic OS/browser text-to-speech — it can be tuned
   * (voice pick, pitch, pacing) but will never sound like a trained human
   * announcer; that needs a real speech-generation service, not this API.
   */
  announce(text: string) {
    if (this.muted || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.12;
      u.pitch = 0.65;
      u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter((v) => /^en/i.test(v.lang));
      const preferred =
        englishVoices.find((v) => /male|daniel|fred|alex|arthur|oliver|david|george|guy/i.test(v.name)) ??
        englishVoices.find((v) => !/female|samantha|victoria|karen|moira|tessa|zira|susan/i.test(v.name)) ??
        englishVoices[0] ??
        voices[0];
      if (preferred) u.voice = preferred;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore — announcer is a nice-to-have, never block the match on it */
    }
  }
}

export const boxingSfx = new BoxingSfx();
