import {
  getAmbientTrack,
  resolveAmbientUrl,
  type ProceduralRecipe,
} from "@/lib/wellness-ambient-catalog";

type LayerState = {
  id: string;
  gain: number;
  audio?: HTMLAudioElement;
  sourceNode?: MediaElementAudioSourceNode;
  gainNode: GainNode;
  proceduralNodes?: AudioNode[];
  bufferSource?: AudioBufferSourceNode;
};

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

function fillBrown(data: Float32Array) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = Math.max(-1, Math.min(1, last * 3.5));
  }
}

function fillRain(data: Float32Array, sampleRate: number) {
  fillPink(data);
  for (let i = 0; i < data.length; i++) data[i] *= 0.22;
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

function fillOcean(data: Float32Array) {
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.015 * white) / 1.015;
    data[i] = last * 4.2;
  }
}

/**
 * Shared Web Audio graph so volume works on iOS (HTMLAudioElement.volume is ignored there).
 */
export class WellnessAmbientEngine {
  private layers = new Map<string, LayerState>();
  private masterVolume = 0.45;
  private loop = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private primaryId: string | null = null;
  private listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  private async ensureGraph() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return { ctx: this.ctx, master: this.masterGain! };
  }

  getPrimaryId() {
    return this.primaryId;
  }

  isPlaying() {
    return this.layers.size > 0;
  }

  getLoop() {
    return this.loop;
  }

  getMasterVolume() {
    return this.masterVolume;
  }

  getLayerGains(): Record<string, number> {
    const out: Record<string, number> = {};
    this.layers.forEach((l, id) => {
      out[id] = l.gain;
    });
    return out;
  }

  async playTrack(trackId: string, opts?: { volume?: number; loop?: boolean }) {
    const track = getAmbientTrack(trackId);
    if (!track) throw new Error("Unknown ambient track");
    await this.stop(false);
    if (opts?.volume != null) this.masterVolume = opts.volume;
    if (opts?.loop != null) this.loop = opts.loop;
    this.primaryId = track.id;
    await this.ensureGraph();
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    await this.addLayer(track.id, 1);
    this.emit();
  }

  async setMix(gains: Record<string, number>) {
    await this.ensureGraph();
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;

    const nextIds = Object.entries(gains)
      .filter(([, g]) => g > 0.01)
      .map(([id]) => id);

    for (const id of [...this.layers.keys()]) {
      if (!nextIds.includes(id)) this.removeLayer(id);
    }

    for (const [id, gain] of Object.entries(gains)) {
      if (gain <= 0.01) continue;
      if (this.layers.has(id)) this.setLayerGain(id, gain);
      else await this.addLayer(id, gain);
    }

    if (!this.primaryId && nextIds[0]) this.primaryId = nextIds[0];
    this.emit();
  }

  private async addLayer(trackId: string, gain: number) {
    const track = getAmbientTrack(trackId);
    if (!track) return;
    const { ctx, master } = await this.ensureGraph();
    const layerGain = Math.max(0, Math.min(1, gain));
    const gainNode = ctx.createGain();
    gainNode.gain.value = layerGain;
    gainNode.connect(master);

    const source = track.source;

    if (source.kind === "procedural") {
      const nodes = this.connectProcedural(ctx, source.recipe, gainNode);
      this.layers.set(trackId, {
        id: trackId,
        gain: layerGain,
        gainNode,
        proceduralNodes: nodes.nodes,
        bufferSource: nodes.bufferSource,
      });
      return;
    }

    const url = resolveAmbientUrl(source);
    if (!url) return;

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.loop = this.loop;
    audio.preload = "auto";
    audio.src = url;
    // Keep element volume at 1 — real level is Web Audio GainNode (iOS-safe).
    audio.volume = 1;

    let sourceNode: MediaElementAudioSourceNode | undefined;
    try {
      sourceNode = ctx.createMediaElementSource(audio);
      sourceNode.connect(gainNode);
    } catch {
      // Fallback if element was already connected somehow
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * layerGain));
    }

    this.layers.set(trackId, {
      id: trackId,
      gain: layerGain,
      audio,
      sourceNode,
      gainNode,
    });

    try {
      await audio.play();
    } catch {
      this.removeLayer(trackId);
      throw new Error("Tap again to start sound (browser blocked autoplay)");
    }
  }

  private connectProcedural(
    ctx: AudioContext,
    recipe: ProceduralRecipe,
    dest: AudioNode,
  ): { nodes: AudioNode[]; bufferSource: AudioBufferSourceNode } {
    const bufferSize = Math.floor(3 * ctx.sampleRate);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    if (recipe === "white") fillWhite(data);
    else if (recipe === "brown") fillBrown(data);
    else if (recipe === "rain") fillRain(data, ctx.sampleRate);
    else if (recipe === "ocean") fillOcean(data);
    else fillPink(data);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const nodes: AudioNode[] = [source];

    if (recipe === "fan") {
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
      noiseGain.connect(dest);
      hum.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(dest);
      hum.start();
      nodes.push(band, noiseGain, hum, humFilter, humGain);
    } else if (recipe === "white") {
      const g = ctx.createGain();
      g.gain.value = 0.28;
      source.connect(g);
      g.connect(dest);
      nodes.push(g);
    } else if (recipe === "brown") {
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.value = 0.55;
      source.connect(low);
      low.connect(g);
      g.connect(dest);
      nodes.push(low, g);
    } else if (recipe === "ocean") {
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 340;
      const amp = ctx.createGain();
      amp.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(amp.gain);
      source.connect(low);
      low.connect(amp);
      amp.connect(dest);
      lfo.start();
      nodes.push(low, amp, lfo, lfoGain);
    } else {
      const g = ctx.createGain();
      g.gain.value = recipe === "rain" ? 0.7 : 0.4;
      source.connect(g);
      g.connect(dest);
      nodes.push(g);
    }

    source.start();
    return { nodes, bufferSource: source };
  }

  private removeLayer(id: string) {
    const layer = this.layers.get(id);
    if (!layer) return;
    try {
      layer.bufferSource?.stop();
    } catch {
      /* ignore */
    }
    for (const n of layer.proceduralNodes || []) {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    try {
      layer.sourceNode?.disconnect();
      layer.gainNode.disconnect();
    } catch {
      /* ignore */
    }
    if (layer.audio) {
      layer.audio.pause();
      layer.audio.removeAttribute("src");
      layer.audio.load();
    }
    this.layers.delete(id);
  }

  setLayerGain(id: string, gain: number) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.gain = Math.max(0, Math.min(1, gain));
    layer.gainNode.gain.value = layer.gain;
    // Fallback path when MediaElementSource unavailable
    if (layer.audio && !layer.sourceNode) {
      layer.audio.volume = Math.max(0, Math.min(1, this.masterVolume * layer.gain));
    }
    this.emit();
  }

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      const now = this.ctx?.currentTime ?? 0;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterVolume, now);
    }
    // Fallback for layers without Web Audio routing
    this.layers.forEach((layer) => {
      if (layer.audio && !layer.sourceNode) {
        layer.audio.volume = Math.max(0, Math.min(1, this.masterVolume * layer.gain));
      }
    });
    this.emit();
  }

  setLoop(loop: boolean) {
    this.loop = loop;
    this.layers.forEach((layer) => {
      if (layer.audio) layer.audio.loop = loop;
    });
    this.emit();
  }

  setTimerMinutes(mins: number, onDone?: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (mins <= 0) return;
    this.timer = setTimeout(() => {
      void this.fadeOutStop().then(() => onDone?.());
    }, mins * 60_000);
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async fadeOutStop(ms = 2800) {
    const startVol = this.masterVolume;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(startVol, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + ms / 1000);
      await new Promise((r) => setTimeout(r, ms + 40));
    } else {
      const steps = 16;
      for (let i = 1; i <= steps; i++) {
        this.setMasterVolume(startVol * (1 - i / steps));
        await new Promise((r) => setTimeout(r, ms / steps));
      }
    }
    await this.stop();
    this.masterVolume = startVol;
    if (this.masterGain) this.masterGain.gain.value = startVol;
  }

  async stop(_fade = true) {
    this.clearTimer();
    for (const id of [...this.layers.keys()]) this.removeLayer(id);
    this.primaryId = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
    this.masterGain = null;
    this.emit();
  }
}

export const wellnessAmbient = new WellnessAmbientEngine();

/** @deprecated use wellnessAmbient — kept for older imports */
export const sleepAmbience = {
  play: (id: string, volume?: number) => wellnessAmbient.playTrack(id, { volume }),
  stop: () => wellnessAmbient.stop(),
  fadeOutStop: (ms?: number) => wellnessAmbient.fadeOutStop(ms),
  setVolume: (v: number) => wellnessAmbient.setMasterVolume(v),
  setTimerMinutes: (mins: number, onDone?: () => void) =>
    wellnessAmbient.setTimerMinutes(mins, onDone),
  isPlaying: (id?: string) =>
    id ? wellnessAmbient.getPrimaryId() === id : wellnessAmbient.isPlaying(),
};
