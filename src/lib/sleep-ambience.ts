import type { SleepSoundId } from "@/lib/wellness";

/**
 * Distinct procedural sleep ambience (Web Audio).
 * Each profile uses a different synthesis recipe so rain ≠ ocean ≠ fan ≠ white ≠ nature.
 */

function fillWhite(data: Float32Array) {
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

function fillPink(data: Float32Array) {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
}

/** Sparse raindrop impulses on a quieter bed — reads as rain, not hiss. */
function fillRain(data: Float32Array, sampleRate: number) {
  fillPink(data);
  for (let i = 0; i < data.length; i++) data[i] *= 0.22;
  // Random droplet clicks
  let nextDrop = 0;
  while (nextDrop < data.length) {
    const gap = Math.floor((0.012 + Math.random() * 0.045) * sampleRate);
    nextDrop += gap;
    if (nextDrop >= data.length) break;
    const amp = 0.35 + Math.random() * 0.55;
    const len = Math.floor((0.004 + Math.random() * 0.012) * sampleRate);
    for (let j = 0; j < len && nextDrop + j < data.length; j++) {
      const env = 1 - j / len;
      data[nextDrop + j] += (Math.random() * 2 - 1) * amp * env * env;
    }
  }
}

/** Slow swell brown bed for ocean waves. */
function fillOcean(data: Float32Array) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.015 * white) / 1.015;
    data[i] = last * 4.2;
  }
}

export class SleepAmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private playing: SleepSoundId | null = null;

  isPlaying(id?: SleepSoundId) {
    if (!id) return !!this.playing;
    return this.playing === id;
  }

  async play(id: SleepSoundId, volume = 0.4) {
    await this.stop(false);
    const ctx = new AudioContext();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    this.master = master;
    this.playing = id;

    const bufferSize = Math.floor(3 * ctx.sampleRate);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    if (id === "rain") fillRain(data, ctx.sampleRate);
    else if (id === "ocean") fillOcean(data);
    else if (id === "white") fillWhite(data);
    else if (id === "fan") fillPink(data);
    else fillPink(data); // nature bed

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const nodes: AudioNode[] = [source];

    if (id === "rain") {
      // Bright droplets + soft bed
      const hip = ctx.createBiquadFilter();
      hip.type = "highpass";
      hip.frequency.value = 900;
      hip.Q.value = 0.7;
      const peak = ctx.createBiquadFilter();
      peak.type = "peaking";
      peak.frequency.value = 2800;
      peak.Q.value = 0.8;
      peak.gain.value = 6;
      const wet = ctx.createGain();
      wet.gain.value = 0.85;
      source.connect(hip);
      hip.connect(peak);
      peak.connect(wet);
      wet.connect(master);
      nodes.push(hip, peak, wet);
    } else if (id === "ocean") {
      // Deep rumble + slow wave amplitude
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 340;
      low.Q.value = 0.5;
      const amp = ctx.createGain();
      amp.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07; // ~14s wave cycle
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(amp.gain);
      source.connect(low);
      low.connect(amp);
      amp.connect(master);
      lfo.start();
      nodes.push(low, amp, lfo, lfoGain);
    } else if (id === "fan") {
      // Steady motor hum + narrow band noise
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 180;
      band.Q.value = 1.4;
      const hum = ctx.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.value = 95;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.035;
      const humFilter = ctx.createBiquadFilter();
      humFilter.type = "lowpass";
      humFilter.frequency.value = 280;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.45;
      source.connect(band);
      band.connect(noiseGain);
      noiseGain.connect(master);
      hum.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(master);
      hum.start();
      nodes.push(band, noiseGain, hum, humFilter, humGain);
    } else if (id === "white") {
      // True broadband hiss — flat, no slow LFO (that made it sound like “rain”)
      const hip = ctx.createBiquadFilter();
      hip.type = "highpass";
      hip.frequency.value = 80;
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf";
      shelf.frequency.value = 4000;
      shelf.gain.value = 2;
      const g = ctx.createGain();
      g.gain.value = 0.28;
      source.connect(hip);
      hip.connect(shelf);
      shelf.connect(g);
      g.connect(master);
      nodes.push(hip, shelf, g);
    } else {
      // Nature: breeze + occasional soft bird-like chirps
      const breeze = ctx.createBiquadFilter();
      breeze.type = "bandpass";
      breeze.frequency.value = 650;
      breeze.Q.value = 0.55;
      const breezeGain = ctx.createGain();
      breezeGain.gain.value = 0.35;
      const windLfo = ctx.createOscillator();
      windLfo.frequency.value = 0.11;
      const windDepth = ctx.createGain();
      windDepth.gain.value = 180;
      windLfo.connect(windDepth);
      windDepth.connect(breeze.frequency);
      source.connect(breeze);
      breeze.connect(breezeGain);
      breezeGain.connect(master);
      windLfo.start();
      nodes.push(breeze, breezeGain, windLfo, windDepth);

      // Soft chirps every few seconds
      const chirpTimer = window.setInterval(() => {
        if (!this.ctx || this.playing !== "nature") return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1800 + Math.random() * 1400;
        f.Q.value = 6;
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400 + Math.random() * 900, t);
        osc.frequency.linearRampToValueAtTime(2200 + Math.random() * 800, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.connect(f);
        f.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.2);
      }, 2200 + Math.random() * 1800);
      // Store timer id on a dummy gain so stop() can clear it
      (master as GainNode & { __chirp?: number }).__chirp = chirpTimer;
    }

    source.start();
    this.nodes = nodes;
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  setTimerMinutes(mins: number, onDone?: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (mins <= 0) return;
    this.timer = setTimeout(() => {
      void this.fadeOutStop().then(() => onDone?.());
    }, mins * 60_000);
  }

  async fadeOutStop(ms = 2500) {
    if (!this.ctx || !this.master) {
      await this.stop();
      return;
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.0001, now + ms / 1000);
    await new Promise((r) => setTimeout(r, ms + 50));
    await this.stop();
  }

  async stop(_fade = true) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const chirp = this.master && (this.master as GainNode & { __chirp?: number }).__chirp;
    if (chirp) clearInterval(chirp);

    for (const n of this.nodes) {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.nodes = [];
    this.master = null;
    this.playing = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }
}

export const sleepAmbience = new SleepAmbienceEngine();
