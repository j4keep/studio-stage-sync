import { useState, useRef, useCallback, useEffect } from "react";

export interface EffectsState {
  // EQ
  eqLow: number;    // -12 to +12 dB
  eqMid: number;
  eqHigh: number;
  // Reverb
  reverbMix: number; // 0-100
  reverbDecay: number; // 0.1-5 seconds
  // Delay
  delayTime: number;  // 0-1 seconds
  delayFeedback: number; // 0-90%
  delayMix: number;   // 0-100
  // Compression
  compThreshold: number; // -60 to 0 dB
  compRatio: number;     // 1-20
  compAttack: number;    // 0-1 seconds
  compRelease: number;   // 0-1 seconds
  // Pitch / Auto-tune
  pitchShift: number; // -12 to +12 semitones
}

export interface MixerState {
  beatVolume: number;   // 0-100
  vocalVolume: number;  // 0-100
  beatPan: number;      // -100 to 100
  vocalPan: number;     // -100 to 100
  masterVolume: number; // 0-100
}

export type StudioState = "idle" | "loaded" | "recording" | "recorded" | "playing" | "exporting";

const DEFAULT_EFFECTS: EffectsState = {
  eqLow: 0, eqMid: 0, eqHigh: 0,
  reverbMix: 20, reverbDecay: 1.5,
  delayTime: 0.3, delayFeedback: 30, delayMix: 0,
  compThreshold: -24, compRatio: 4, compAttack: 0.003, compRelease: 0.25,
  pitchShift: 0,
};

const DEFAULT_MIXER: MixerState = {
  beatVolume: 80, vocalVolume: 100, beatPan: 0, vocalPan: 0, masterVolume: 85,
};

function createImpulseResponse(ctx: AudioContext, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = rate * Math.max(decay, 0.1);
  const buf = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buf;
}

export const useStudioEngine = () => {
  const [state, setState] = useState<StudioState>("idle");
  const [effects, setEffects] = useState<EffectsState>(DEFAULT_EFFECTS);
  const [mixer, setMixer] = useState<MixerState>(DEFAULT_MIXER);
  const [elapsed, setElapsed] = useState(0);
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [mixedBlob, setMixedBlob] = useState<Blob | null>(null);
  const [mixedUrl, setMixedUrl] = useState<string | null>(null);

  // Refs
  const ctxRef = useRef<AudioContext | null>(null);
  const beatElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Audio nodes refs
  const beatGainRef = useRef<GainNode | null>(null);
  const vocalGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const beatPanRef = useRef<StereoPannerNode | null>(null);
  const vocalPanRef = useRef<StereoPannerNode | null>(null);
  const eqLowRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const reverbGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const delayMixRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  // Vocal recording blob (raw, before effects)
  const vocalBlobRef = useRef<Blob | null>(null);
  const vocalUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    beatElRef.current?.pause();
    if (ctxRef.current?.state !== "closed") {
      try { ctxRef.current?.close(); } catch {}
    }
    ctxRef.current = null;
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (beatUrl) URL.revokeObjectURL(beatUrl);
      if (mixedUrl) URL.revokeObjectURL(mixedUrl);
      if (vocalUrlRef.current) URL.revokeObjectURL(vocalUrlRef.current);
    };
  }, []);

  const loadBeat = useCallback((file: File) => {
    if (beatUrl) URL.revokeObjectURL(beatUrl);
    const url = URL.createObjectURL(file);
    setBeatFile(file);
    setBeatUrl(url);
    setState("loaded");
    setElapsed(0);
    setMixedBlob(null);
    if (mixedUrl) URL.revokeObjectURL(mixedUrl);
    setMixedUrl(null);
  }, [beatUrl, mixedUrl]);

  const startRecording = useCallback(async () => {
    if (!beatUrl) return;
    try {
      chunksRef.current = [];
      setElapsed(0);

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Beat source
      const el = document.createElement("audio");
      el.src = beatUrl;
      el.crossOrigin = "anonymous";
      beatElRef.current = el;
      const beatSource = ctx.createMediaElementSource(el);

      // Mic source
      const micSource = ctx.createMediaStreamSource(micStream);

      // Beat chain: source -> gain -> pan
      const beatGain = ctx.createGain();
      beatGain.gain.value = mixer.beatVolume / 100;
      beatGainRef.current = beatGain;

      const beatPan = ctx.createStereoPanner();
      beatPan.pan.value = mixer.beatPan / 100;
      beatPanRef.current = beatPan;

      beatSource.connect(beatGain).connect(beatPan);

      // Vocal chain: mic -> EQ -> compressor -> reverb/delay -> gain -> pan
      // EQ
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 320;
      eqLow.gain.value = effects.eqLow;
      eqLowRef.current = eqLow;

      const eqMid = ctx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1000;
      eqMid.Q.value = 0.5;
      eqMid.gain.value = effects.eqMid;
      eqMidRef.current = eqMid;

      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 3200;
      eqHigh.gain.value = effects.eqHigh;
      eqHighRef.current = eqHigh;

      // Compressor
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = effects.compThreshold;
      comp.ratio.value = effects.compRatio;
      comp.attack.value = effects.compAttack;
      comp.release.value = effects.compRelease;
      compressorRef.current = comp;

      // Reverb
      const reverb = ctx.createConvolver();
      reverb.buffer = createImpulseResponse(ctx, effects.reverbDecay);
      reverbRef.current = reverb;

      const reverbGain = ctx.createGain();
      reverbGain.gain.value = effects.reverbMix / 100;
      reverbGainRef.current = reverbGain;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1 - (effects.reverbMix / 200);
      dryGainRef.current = dryGain;

      // Delay
      const delayNode = ctx.createDelay(2);
      delayNode.delayTime.value = effects.delayTime;
      delayNodeRef.current = delayNode;

      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = effects.delayFeedback / 100;
      delayFeedbackRef.current = delayFeedback;

      const delayMix = ctx.createGain();
      delayMix.gain.value = effects.delayMix / 100;
      delayMixRef.current = delayMix;

      // Vocal gain + pan
      const vocalGain = ctx.createGain();
      vocalGain.gain.value = mixer.vocalVolume / 100;
      vocalGainRef.current = vocalGain;

      const vocalPan = ctx.createStereoPanner();
      vocalPan.pan.value = mixer.vocalPan / 100;
      vocalPanRef.current = vocalPan;

      // Master
      const masterGain = ctx.createGain();
      masterGain.gain.value = mixer.masterVolume / 100;
      masterGainRef.current = masterGain;

      // Wire vocal chain: mic -> eqLow -> eqMid -> eqHigh -> comp -> [dry + reverb + delay] -> vocalGain -> vocalPan
      micSource.connect(eqLow).connect(eqMid).connect(eqHigh).connect(comp);

      // Dry path
      comp.connect(dryGain);
      dryGain.connect(vocalGain);

      // Reverb path
      comp.connect(reverb);
      reverb.connect(reverbGain);
      reverbGain.connect(vocalGain);

      // Delay path
      comp.connect(delayNode);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode); // feedback loop
      delayNode.connect(delayMix);
      delayMix.connect(vocalGain);

      vocalGain.connect(vocalPan);

      // Mix to master
      beatPan.connect(masterGain);
      vocalPan.connect(masterGain);

      // Output to speakers
      masterGain.connect(ctx.destination);

      // Record the mixed output
      const dest = ctx.createMediaStreamDestination();
      masterGain.connect(dest);

      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setMixedBlob(blob);
        if (mixedUrl) URL.revokeObjectURL(mixedUrl);
        const url = URL.createObjectURL(blob);
        setMixedUrl(url);
        setState("recorded");
      };

      recorder.start(100);
      await el.play();

      el.onended = () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
      };

      timerRef.current = window.setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      setState("recording");
    } catch (err: any) {
      console.error("Recording error:", err);
      throw err;
    }
  }, [beatUrl, effects, mixer, mixedUrl]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    beatElRef.current?.pause();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const resetRecording = useCallback(() => {
    if (mixedUrl) URL.revokeObjectURL(mixedUrl);
    setMixedUrl(null);
    setMixedBlob(null);
    setElapsed(0);
    setState("loaded");
    cleanup();
  }, [mixedUrl, cleanup]);

  // Live parameter updates
  useEffect(() => { if (beatGainRef.current) beatGainRef.current.gain.value = mixer.beatVolume / 100; }, [mixer.beatVolume]);
  useEffect(() => { if (vocalGainRef.current) vocalGainRef.current.gain.value = mixer.vocalVolume / 100; }, [mixer.vocalVolume]);
  useEffect(() => { if (masterGainRef.current) masterGainRef.current.gain.value = mixer.masterVolume / 100; }, [mixer.masterVolume]);
  useEffect(() => { if (beatPanRef.current) beatPanRef.current.pan.value = mixer.beatPan / 100; }, [mixer.beatPan]);
  useEffect(() => { if (vocalPanRef.current) vocalPanRef.current.pan.value = mixer.vocalPan / 100; }, [mixer.vocalPan]);
  useEffect(() => { if (eqLowRef.current) eqLowRef.current.gain.value = effects.eqLow; }, [effects.eqLow]);
  useEffect(() => { if (eqMidRef.current) eqMidRef.current.gain.value = effects.eqMid; }, [effects.eqMid]);
  useEffect(() => { if (eqHighRef.current) eqHighRef.current.gain.value = effects.eqHigh; }, [effects.eqHigh]);
  useEffect(() => { if (compressorRef.current) { compressorRef.current.threshold.value = effects.compThreshold; compressorRef.current.ratio.value = effects.compRatio; } }, [effects.compThreshold, effects.compRatio]);
  useEffect(() => { if (delayNodeRef.current) delayNodeRef.current.delayTime.value = effects.delayTime; }, [effects.delayTime]);
  useEffect(() => { if (delayFeedbackRef.current) delayFeedbackRef.current.gain.value = effects.delayFeedback / 100; }, [effects.delayFeedback]);
  useEffect(() => { if (delayMixRef.current) delayMixRef.current.gain.value = effects.delayMix / 100; }, [effects.delayMix]);
  useEffect(() => { if (reverbGainRef.current) reverbGainRef.current.gain.value = effects.reverbMix / 100; }, [effects.reverbMix]);
  useEffect(() => { if (dryGainRef.current) dryGainRef.current.gain.value = 1 - (effects.reverbMix / 200); }, [effects.reverbMix]);

  const getExportFile = useCallback((): File | null => {
    if (!mixedBlob) return null;
    return new File([mixedBlob], `studio-mix-${Date.now()}.webm`, { type: "audio/webm" });
  }, [mixedBlob]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return {
    state, effects, setEffects, mixer, setMixer, elapsed, formatTime,
    beatFile, beatUrl, mixedBlob, mixedUrl,
    loadBeat, startRecording, stopRecording, resetRecording, getExportFile,
    DEFAULT_EFFECTS, DEFAULT_MIXER,
  };
};
