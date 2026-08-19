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
  /** Scheduler handle for the individual voices/claps riding on the murmur bed. */
  private babbleTimer: number | null = null;
  /** 0 = even fight, 1 = beatdown — drives how rowdy the arena sounds. */
  private excitement = 0;

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

  /** Soft-clips a signal so impacts read as flesh/leather rather than a clean click. */
  private drive(amount: number) {
    const ctx = this.ctx!;
    const ws = ctx.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    const k = 1 + amount * 22;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    ws.curve = curve;
    ws.oversample = "4x";
    return ws;
  }

  /** Sub-bass "weight" of an impact — a fast downward pitch drop, felt more than heard. */
  private bodyDrop(t: number, startFreq: number, endFreq: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + decay * 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  /**
   * Glove-on-body slap: a short mid-heavy noise burst driven through soft clipping.
   * Deliberately keeps almost nothing above ~2.5 kHz — high, ringy content is what
   * made the old hit read as tapping a plastic plate.
   */
  private slap(t: number, gainPeak: number, decay: number, tilt: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, decay + 0.04);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(620 + tilt * 380, t);
    bp.frequency.exponentialRampToValueAtTime(220 + tilt * 120, t + decay);
    bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(bp).connect(lp).connect(this.drive(0.5)).connect(gain).connect(ctx.destination);
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
    const amt = Math.min(1, Math.max(0, intensity));
    this.whoosh(t - 0.0, 0.05);
    this.slap(t + 0.005, 0.85 + amt * 0.7, 0.075 + amt * 0.04, 0.5 + Math.random() * 0.4);
    this.thud(t + 0.005, 0.13, 190 - amt * 60, 0.9 + amt * 0.8, 0.16 + amt * 0.1);
    this.bodyDrop(t + 0.004, 150 + amt * 40, 42, 0.5 + amt * 0.45, 0.19 + amt * 0.1);
  }

  /** Punch absorbed by a raised guard — duller, no crack, most of the energy soaked up. */
  blocked() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.slap(t, 0.4, 0.05, 0.15);
    this.thud(t, 0.08, 240, 0.5, 0.1);
    this.bodyDrop(t, 110, 55, 0.2, 0.1);
  }

  /** Punch sailed past a dodge, or just missed clean. */
  miss() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.whoosh(ctx.currentTime, 0.16);
  }


  // ---- Crowd ----

  /**
   * One layer of the crowd murmur bed. Kept low and wide on purpose: narrow,
   * bright noise bands are exactly what made the old bed sound like rainfall,
   * so everything here stays in the chest/vowel range with a lowpass on top.
   */
  private crowdLayer(centerFreq: number, q: number, lfoRate: number, lfoDepth: number, baseGain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 3.7);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = centerFreq;
    bp.Q.value = q;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    const gain = ctx.createGain();
    gain.gain.value = baseGain;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = lfoDepth;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    src.connect(bp).connect(lp).connect(gain).connect(this.crowdGain!);
    src.start();
    this.crowdVoices.push({ src, gain });
  }

  /**
   * A single human voice in the stands — a short "whoa/ahh" made of a buzzy
   * source shaped by two vowel formants. Dozens of these, overlapping at random,
   * are what actually make an audience read as people rather than noise.
   */
  private voice(t: number, gainPeak: number, dur: number) {
    if (!this.crowdGain || !this.ctx) return;
    const ctx = this.ctx;
    const base = 150 + Math.random() * 220;
    const osc = ctx.createOscillator();
    osc.type = Math.random() < 0.5 ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * (1 + (Math.random() * 0.5 - 0.1)), t + dur);

    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 550 + Math.random() * 300;
    f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 1050 + Math.random() * 600;
    f2.Q.value = 6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainPeak, t + dur * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(lp);
    f2.connect(lp);
    lp.connect(gain).connect(this.crowdGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** A single pair of hands clapping somewhere in the arena. */
  private clap(t: number, gainPeak: number) {
    if (!this.crowdGain || !this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.06);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100 + Math.random() * 900;
    bp.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.05 + Math.random() * 0.03);
    src.connect(bp).connect(gain).connect(this.crowdGain);
    src.start(t);
  }

  /**
   * Keeps a steady trickle of individual voices and claps going on top of the
   * murmur bed, scaled by how excited the crowd currently is.
   */
  private startBabble() {
    if (this.babbleTimer !== null) return;
    this.babbleTimer = window.setInterval(() => {
      if (this.muted || !this.ctx || !this.crowdGain) return;
      const t = this.ctx.currentTime;
      const heat = this.excitement;
      const voices = 1 + Math.round(Math.random() * (1 + heat * 3));
      for (let i = 0; i < voices; i++) {
        this.voice(t + Math.random() * 0.55, 0.012 + Math.random() * (0.02 + heat * 0.04), 0.22 + Math.random() * 0.5);
      }
      const claps = Math.round(Math.random() * (1 + heat * 5));
      for (let i = 0; i < claps; i++) {
        this.clap(t + Math.random() * 0.55, 0.02 + Math.random() * (0.02 + heat * 0.05));
      }
    }, 600);
  }

  /** Starts the continuous crowd bed (murmur + individual voices and claps). Safe to call repeatedly. */
  startCrowd() {
    if (this.muted || this.crowdGain) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    this.crowdGain.connect(ctx.destination);
    this.crowdBase = 0.7;
    this.crowdLayer(190, 0.5, 0.11, 0.02, 0.075);
    this.crowdLayer(360, 0.45, 0.08, 0.022, 0.06);
    this.crowdLayer(680, 0.4, 0.15, 0.016, 0.035);
    this.startBabble();
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, ctx.currentTime, 0.6);
  }

  /**
   * Nudges the crowd toward however lopsided the fight currently is — the arena
   * gets louder and rowdier (more voices, more clapping) the more one fighter
   * is dominating. `lead` is 0 (even fight) .. 1 (total beatdown).
   */
  setLead(lead: number) {
    const amt = Math.min(1, Math.max(0, lead));
    this.excitement = amt;
    if (this.muted || !this.crowdGain || !this.ctx) return;
    this.crowdBase = 0.7 + amt * 0.5;
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, this.ctx.currentTime, 1.1);
  }

  /** A swell above the ambient bed — call when a punch lands clean. Bigger intensity = bigger roar. */
  cheer(intensity = 0.5) {
    if (this.muted || !this.crowdGain || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const amt = Math.min(1, Math.max(0, intensity));
    const peak = this.crowdBase * (1.35 + amt * 0.7);
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(peak, t + 0.1);
    this.crowdGain.gain.setTargetAtTime(this.crowdBase, t + 0.35, 0.5 + amt * 0.6);

    const whoops = 5 + Math.round(amt * 9);
    for (let i = 0; i < whoops; i++) {
      this.voice(t + Math.random() * (0.5 + amt * 0.7), 0.03 + Math.random() * 0.05, 0.3 + Math.random() * 0.7);
    }
    const claps = 6 + Math.round(amt * 14);
    for (let i = 0; i < claps; i++) {
      this.clap(t + Math.random() * (0.7 + amt * 0.8), 0.03 + Math.random() * 0.05);
    }
  }

  /** The big one — knockout roar. */
  koRoar() {
    if (this.muted || !this.crowdGain || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(this.crowdBase * 2.4, t + 0.25);
    this.crowdGain.gain.setTargetAtTime(this.crowdBase * 1.1, t + 1.8, 1.4);
    for (let i = 0; i < 34; i++) {
      this.voice(t + Math.random() * 1.8, 0.03 + Math.random() * 0.06, 0.4 + Math.random() * 1.1);
    }
    for (let i = 0; i < 44; i++) {
      this.clap(t + Math.random() * 2.2, 0.03 + Math.random() * 0.06);
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
    if (this.babbleTimer !== null) {
      window.clearInterval(this.babbleTimer);
      this.babbleTimer = null;
    }
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
