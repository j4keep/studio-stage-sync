import type { SleepSoundId } from "@/lib/wellness";

/**
 * Procedural sleep ambience via Web Audio — no hosted media required.
 * Soft filters keep each profile distinct but calm.
 */
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

  async play(id: SleepSoundId, volume = 0.35) {
    await this.stop(false);
    const ctx = new AudioContext();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    this.master = master;
    this.playing = id;

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (id === "white") {
        data[i] = white;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    if (id === "rain") {
      filter.type = "lowpass";
      filter.frequency.value = 900;
      lfo.frequency.value = 0.15;
      lfoGain.gain.value = 120;
    } else if (id === "ocean") {
      filter.type = "lowpass";
      filter.frequency.value = 480;
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 220;
    } else if (id === "fan") {
      filter.type = "bandpass";
      filter.frequency.value = 220;
      filter.Q.value = 0.7;
      lfo.frequency.value = 0.03;
      lfoGain.gain.value = 40;
    } else if (id === "white") {
      filter.type = "highpass";
      filter.frequency.value = 200;
      lfo.frequency.value = 0.01;
      lfoGain.gain.value = 10;
    } else {
      filter.type = "bandpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.5;
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = 160;
    }

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    source.connect(filter);
    filter.connect(master);
    source.start();
    lfo.start();
    this.nodes = [source, filter, lfo, lfoGain];
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  /** Minutes until auto-stop. 0 = clear timer. */
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
