import type { EffectInstance } from "./types";

export interface BuiltEffect {
  input: AudioNode;
  output: AudioNode;
  apply: (params: Record<string, number>) => void;
  dispose: () => void;
}

function makeImpulse(ctx: BaseAudioContext, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(rate * Math.max(decay, 0.1), 1);
  const buf = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buf;
}

export function buildEffect(ctx: BaseAudioContext, fx: EffectInstance): BuiltEffect {
  switch (fx.type) {
    case "eq3": {
      const low = (ctx as AudioContext).createBiquadFilter();
      low.type = "lowshelf"; low.frequency.value = 250;
      const mid = (ctx as AudioContext).createBiquadFilter();
      mid.type = "peaking"; mid.frequency.value = 1000; mid.Q.value = 0.7;
      const high = (ctx as AudioContext).createBiquadFilter();
      high.type = "highshelf"; high.frequency.value = 4000;
      low.connect(mid).connect(high);
      return {
        input: low, output: high,
        apply: (p) => {
          low.gain.value = p.low ?? 0;
          mid.gain.value = p.mid ?? 0;
          high.gain.value = p.high ?? 0;
        },
        dispose: () => { low.disconnect(); mid.disconnect(); high.disconnect(); },
      };
    }
    case "compressor": {
      const c = (ctx as AudioContext).createDynamicsCompressor();
      return {
        input: c, output: c,
        apply: (p) => {
          c.threshold.value = p.threshold ?? -24;
          c.ratio.value = p.ratio ?? 4;
          c.attack.value = p.attack ?? 0.003;
          c.release.value = p.release ?? 0.25;
          c.knee.value = p.knee ?? 6;
        },
        dispose: () => c.disconnect(),
      };
    }
    case "reverb": {
      const conv = (ctx as AudioContext).createConvolver();
      const wet = (ctx as AudioContext).createGain();
      const dry = (ctx as AudioContext).createGain();
      const inGain = (ctx as AudioContext).createGain();
      const outGain = (ctx as AudioContext).createGain();
      let decay = 1.5;
      conv.buffer = makeImpulse(ctx, decay);
      inGain.connect(dry).connect(outGain);
      inGain.connect(conv).connect(wet).connect(outGain);
      return {
        input: inGain, output: outGain,
        apply: (p) => {
          const m = (p.mix ?? 30) / 100;
          dry.gain.value = 1 - m;
          wet.gain.value = m;
          const newDecay = p.decay ?? 1.5;
          if (Math.abs(newDecay - decay) > 0.05) {
            decay = newDecay;
            conv.buffer = makeImpulse(ctx, decay);
          }
        },
        dispose: () => { inGain.disconnect(); dry.disconnect(); wet.disconnect(); conv.disconnect(); outGain.disconnect(); },
      };
    }
    case "delay": {
      const d = (ctx as AudioContext).createDelay(2);
      const fb = (ctx as AudioContext).createGain();
      const wet = (ctx as AudioContext).createGain();
      const dry = (ctx as AudioContext).createGain();
      const inGain = (ctx as AudioContext).createGain();
      const outGain = (ctx as AudioContext).createGain();
      inGain.connect(dry).connect(outGain);
      inGain.connect(d);
      d.connect(fb).connect(d);
      d.connect(wet).connect(outGain);
      return {
        input: inGain, output: outGain,
        apply: (p) => {
          d.delayTime.value = p.time ?? 0.3;
          fb.gain.value = (p.feedback ?? 30) / 100;
          const m = (p.mix ?? 25) / 100;
          dry.gain.value = 1 - m * 0.5;
          wet.gain.value = m;
        },
        dispose: () => { inGain.disconnect(); d.disconnect(); fb.disconnect(); wet.disconnect(); dry.disconnect(); outGain.disconnect(); },
      };
    }
    case "distortion": {
      const ws = (ctx as AudioContext).createWaveShaper();
      const makeCurve = (amount: number) => {
        const n = 1024, curve = new Float32Array(n);
        const k = amount * 100;
        for (let i = 0; i < n; i++) {
          const x = (i * 2) / n - 1;
          curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }
        return curve;
      };
      return {
        input: ws, output: ws,
        apply: (p) => { ws.curve = makeCurve((p.drive ?? 20) / 100); ws.oversample = "4x"; },
        dispose: () => ws.disconnect(),
      };
    }
    case "chorus": {
      const inGain = (ctx as AudioContext).createGain();
      const outGain = (ctx as AudioContext).createGain();
      const d = (ctx as AudioContext).createDelay(0.05);
      const lfo = (ctx as AudioContext).createOscillator();
      const lfoGain = (ctx as AudioContext).createGain();
      lfo.frequency.value = 1.5;
      lfoGain.gain.value = 0.003;
      lfo.connect(lfoGain).connect(d.delayTime);
      try { lfo.start(); } catch {}
      d.delayTime.value = 0.02;
      const wet = (ctx as AudioContext).createGain();
      const dry = (ctx as AudioContext).createGain();
      inGain.connect(dry).connect(outGain);
      inGain.connect(d).connect(wet).connect(outGain);
      return {
        input: inGain, output: outGain,
        apply: (p) => {
          lfo.frequency.value = p.rate ?? 1.5;
          const m = (p.mix ?? 40) / 100;
          wet.gain.value = m; dry.gain.value = 1 - m * 0.5;
        },
        dispose: () => { try { lfo.stop(); } catch {}; inGain.disconnect(); d.disconnect(); wet.disconnect(); dry.disconnect(); outGain.disconnect(); },
      };
    }
    case "limiter": {
      const c = (ctx as AudioContext).createDynamicsCompressor();
      c.threshold.value = -1; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.05;
      return {
        input: c, output: c,
        apply: (p) => { c.threshold.value = p.ceiling ?? -1; },
        dispose: () => c.disconnect(),
      };
    }
    case "pitch": {
      // Simple pitch shifter via delay modulation (not true PSOLA — placeholder)
      const inGain = (ctx as AudioContext).createGain();
      const outGain = (ctx as AudioContext).createGain();
      inGain.connect(outGain);
      return {
        input: inGain, output: outGain,
        apply: (_p) => { /* placeholder */ },
        dispose: () => { inGain.disconnect(); outGain.disconnect(); },
      };
    }
    default: {
      const g = (ctx as AudioContext).createGain();
      return { input: g, output: g, apply: () => {}, dispose: () => g.disconnect() };
    }
  }
}

export const EFFECT_DEFAULTS: Record<string, Record<string, number>> = {
  eq3: { low: 0, mid: 0, high: 0 },
  compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 6 },
  reverb: { mix: 30, decay: 1.8 },
  delay: { time: 0.3, feedback: 30, mix: 25 },
  chorus: { rate: 1.5, mix: 40 },
  distortion: { drive: 20 },
  limiter: { ceiling: -1 },
  pitch: { semitones: 0 },
};

export const EFFECT_META: Record<string, { label: string; params: { id: string; label: string; min: number; max: number; step?: number; unit?: string }[] }> = {
  eq3: { label: "EQ", params: [
    { id: "low", label: "Low", min: -12, max: 12, step: 0.5, unit: "dB" },
    { id: "mid", label: "Mid", min: -12, max: 12, step: 0.5, unit: "dB" },
    { id: "high", label: "High", min: -12, max: 12, step: 0.5, unit: "dB" },
  ]},
  compressor: { label: "Compressor", params: [
    { id: "threshold", label: "Threshold", min: -60, max: 0, step: 1, unit: "dB" },
    { id: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5 },
    { id: "attack", label: "Attack", min: 0, max: 1, step: 0.001, unit: "s" },
    { id: "release", label: "Release", min: 0, max: 1, step: 0.01, unit: "s" },
  ]},
  reverb: { label: "Reverb", params: [
    { id: "mix", label: "Mix", min: 0, max: 100, step: 1, unit: "%" },
    { id: "decay", label: "Decay", min: 0.1, max: 6, step: 0.1, unit: "s" },
  ]},
  delay: { label: "Delay", params: [
    { id: "time", label: "Time", min: 0, max: 1.5, step: 0.01, unit: "s" },
    { id: "feedback", label: "Feedback", min: 0, max: 90, step: 1, unit: "%" },
    { id: "mix", label: "Mix", min: 0, max: 100, step: 1, unit: "%" },
  ]},
  chorus: { label: "Chorus", params: [
    { id: "rate", label: "Rate", min: 0.1, max: 8, step: 0.1, unit: "Hz" },
    { id: "mix", label: "Mix", min: 0, max: 100, step: 1, unit: "%" },
  ]},
  distortion: { label: "Distortion", params: [
    { id: "drive", label: "Drive", min: 0, max: 100, step: 1, unit: "%" },
  ]},
  limiter: { label: "Limiter", params: [
    { id: "ceiling", label: "Ceiling", min: -12, max: 0, step: 0.1, unit: "dB" },
  ]},
  pitch: { label: "Pitch", params: [
    { id: "semitones", label: "Semitones", min: -12, max: 12, step: 1 },
  ]},
};
