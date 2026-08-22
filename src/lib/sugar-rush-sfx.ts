/**
 * Procedural YAJ Sugar Rush audio (WebAudio, no audio files) — candy pops, swap ticks, drops,
 * cascades, special-candy sparkle, shuffle whirl, an invalid-swap buzz, win/lose fanfares,
 * and a generative looping background tune. Everything routes through two buses (music, sfx)
 * so the volume sliders and mute button affect every sound instantly without re-touching each
 * individual effect.
 */

const MUTE_KEY = "yaj.games.sugarrush.audio.muted";
const MUSIC_VOL_KEY = "yaj.games.sugarrush.audio.musicVolume";
const SFX_VOL_KEY = "yaj.games.sugarrush.audio.sfxVolume";

function readNum(key: string, fallback: number): number {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

// A punchy, syncopated pop-style riff — faster tempo and a hook-y octave jump so it reads
// as "hot"/upbeat rather than a plain music-box melody. Loops indefinitely.
const MUSIC_NOTES = [523.25, 523.25, 659.25, 783.99, 659.25, 987.77, 880.0, 783.99, 659.25, 587.33, 659.25, 783.99, 1046.5, 783.99, 659.25, 587.33];
const MUSIC_STEP_SEC = 0.21;

class SugarRushSfx {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicRunning = false;

  muted = typeof localStorage !== "undefined" ? localStorage.getItem(MUTE_KEY) === "1" : false;
  musicVolume = readNum(MUSIC_VOL_KEY, 0.5);
  sfxVolume = readNum(SFX_VOL_KEY, 0.8);

  private ensure() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctor();
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.muted ? 0 : this.sfxVolume;
      this.sfxBus.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.muted ? 0 : this.musicVolume;
      this.musicBus.connect(ctx.destination);
      this.ctx = ctx;
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
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.sfxBus) this.sfxBus.gain.value = muted ? 0 : this.sfxVolume;
    if (this.musicBus) this.musicBus.gain.value = muted ? 0 : this.musicVolume;
    if (muted && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  setMusicVolume(v: number) {
    this.musicVolume = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(MUSIC_VOL_KEY, String(this.musicVolume));
    } catch {
      /* ignore */
    }
    if (this.musicBus && !this.muted) this.musicBus.gain.value = this.musicVolume;
  }

  setSfxVolume(v: number) {
    this.sfxVolume = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(SFX_VOL_KEY, String(this.sfxVolume));
    } catch {
      /* ignore */
    }
    if (this.sfxBus && !this.muted) this.sfxBus.gain.value = this.sfxVolume;
  }

  private noiseBuffer(ctx: AudioContext, len: number) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- background music -------------------------------------------------

  /** Starts the looping intro/gameplay tune. Safe to call repeatedly — a no-op if already
   *  running. Requires prime()/a user gesture to actually be audible on iOS Safari. */
  startMusic() {
    if (this.musicRunning) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    this.musicRunning = true;

    const playStep = () => {
      if (!this.musicRunning || !this.ctx || !this.musicBus) return;
      const t = this.ctx.currentTime;
      const note = MUSIC_NOTES[this.musicStep % MUSIC_NOTES.length];

      // Plucky lead: fast attack, quick decay — reads as a "pop synth" hook rather than a
      // soft music-box tone.
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = note;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.34, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + MUSIC_STEP_SEC * 0.72);
      osc.connect(lp).connect(gain).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + MUSIC_STEP_SEC);

      // A soft octave-down bass note every 4th step for a bit of body.
      if (this.musicStep % 4 === 0) {
        const bass = this.ctx.createOscillator();
        bass.type = "sine";
        bass.frequency.value = note / 4;
        const bgain = this.ctx.createGain();
        bgain.gain.setValueAtTime(0.0001, t);
        bgain.gain.linearRampToValueAtTime(0.35, t + 0.03);
        bgain.gain.exponentialRampToValueAtTime(0.0001, t + MUSIC_STEP_SEC * 3.6);
        bass.connect(bgain).connect(this.musicBus);
        bass.start(t);
        bass.stop(t + MUSIC_STEP_SEC * 3.8);
      }

      // A crisp closed-hihat tick on every step and a soft kick on the downbeat — gives the
      // loop a driving pop-song pulse instead of just a melody.
      const tick = this.ctx.createBufferSource();
      tick.buffer = this.noiseBuffer(this.ctx, 0.03);
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7000;
      const tgain = this.ctx.createGain();
      tgain.gain.setValueAtTime(this.musicStep % 2 === 0 ? 0.05 : 0.03, t);
      tgain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      tick.connect(hp).connect(tgain).connect(this.musicBus);
      tick.start(t);

      if (this.musicStep % 4 === 0) {
        const kick = this.ctx.createOscillator();
        kick.type = "sine";
        kick.frequency.setValueAtTime(150, t);
        kick.frequency.exponentialRampToValueAtTime(48, t + 0.09);
        const kgain = this.ctx.createGain();
        kgain.gain.setValueAtTime(0.4, t);
        kgain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        kick.connect(kgain).connect(this.musicBus);
        kick.start(t);
        kick.stop(t + 0.14);
      }

      this.musicStep++;
    };

    playStep();
    this.musicTimer = window.setInterval(playStep, MUSIC_STEP_SEC * 1000);
  }

  stopMusic() {
    this.musicRunning = false;
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // ---- one-shot effects ---------------------------------------------------

  private crack(bus: GainNode, t: number, len: number, centerFreq: number, q: number, gainPeak: number, decay: number) {
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
    src.connect(bp).connect(gain).connect(bus);
    src.start(t);
  }

  private thud(bus: GainNode, t: number, len: number, lpFreq: number, gainPeak: number, decay: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, len);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lpFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    src.connect(lp).connect(gain).connect(bus);
    src.start(t);
  }

  /** A bright, punchy "flip" when a swap is accepted — deliberately the loudest one-shot in
   *  the sfx set so it reads clearly over the music/other effects while actually playing. */
  swap() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.12);
    // A quick low click underneath gives the flip some physical weight.
    this.thud(this.sfxBus!, t, 0.02, 1400, 0.16, 0.05);
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
    osc.connect(gain).connect(this.sfxBus!);
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
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** Candies dropping into place after gravity — a soft descending patter. */
  drop() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    this.thud(this.sfxBus!, t, 0.05, 900, 0.08, 0.07);
  }

  /** A cascade chaining into a second (or deeper) match — a rising chime run. */
  combo(depth = 2) {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const notes = [784, 988, 1175];
    notes.slice(0, Math.min(3, depth)).forEach((f, i) => {
      const t = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  /** Speaks a combo callout ("Sweet!", "Tasty Combo!", ...) out loud using the browser's
   *  built-in speech synthesis — no audio files needed. Cancels any callout still queued so
   *  a fast chain never stacks overlapping voices. */
  speak(text: string) {
    if (this.muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.volume = Math.min(1, this.sfxVolume * 1.15);
      utter.pitch = 1.4;
      utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
    } catch {
      /* speech synthesis unavailable */
    }
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
    osc.connect(gain).connect(this.sfxBus!);
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
    src.connect(hp).connect(ng).connect(this.sfxBus!);
    src.start(t);
  }

  /** The board reshuffling because no move was left — a quick whirl. */
  shuffle() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.3);
    osc.frequency.linearRampToValueAtTime(220, t + 0.55);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.6);
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
    osc.connect(gain).connect(this.sfxBus!);
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
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  /** A candy treat picked up in the maze — quick bright pop. */
  treatPickup() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(720, t);
    osc.frequency.exponentialRampToValueAtTime(1080, t + 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** A Sugar Star — a little three-note twinkle, worth noticing over a plain treat. */
  sugarStarPickup() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    [1046.5, 1318.5, 1568].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.05;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  /** A power-up picked up — bright ascending arpeggio. */
  powerUpPickup() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    [523.25, 659.25, 880].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.04;
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  }

  /** Sugar Rush Mode kicking in — an energetic rising sweep. */
  rushStart() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.46);
  }

  /** Sugar Rush Mode ending — a soft settle. */
  rushEnd() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.36);
  }

  /** Warping through a chocolate tunnel — quick pitch-bend whoosh. */
  tunnelWarp() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.26);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  /** A subtle tension pulse when Dr. Cavity is closing in — deliberately understated so it
   *  doesn't wear thin if it triggers repeatedly. */
  cavityAlert() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 190;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /** The player getting caught — a short descending buzz, distinct from the match-3 buzzer. */
  playerHit() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /** Checkpoint reached. */
  checkpointReached() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    [659.25, 987.77].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /** Level complete fanfare. */
  levelComplete() {
    if (this.muted) return;
    const ctx = this.ensure();
    void ctx.resume().catch(() => undefined);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.55);
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
    osc.connect(gain).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + 0.85);
  }
}

export const sugarRushSfx = new SugarRushSfx();
