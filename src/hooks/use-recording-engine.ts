import { useState, useRef, useCallback, useEffect } from "react";

export interface WaveformData {
  peaks: number[];
}

export interface RecordingEngineState {
  isRecording: boolean;
  isPlaying: boolean;
  recordTime: number;
  playbackTime: number;
  playbackDuration: number;
  liveWaveform: number[];
}

export interface PlaybackTakeInput {
  id: string;
  audioUrl: string;
  volume: number;
  pan: number;
  trimStart: number;
  trimEnd: number;
}

export interface PlaybackEffectsInput {
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compressionAmount: number;
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  outputGain: number;
}

export interface PlaybackRequest {
  beatUrl: string | null;
  startAt?: number;
  beatVolume: number;
  beatPan: number;
  loop?: boolean;
  masterVolume: number;
  takes: PlaybackTakeInput[];
  effects: PlaybackEffectsInput;
}

interface ManagedPlaybackTrack {
  id: string;
  audio: HTMLAudioElement;
  trimEndTime: number;
  trimStartTime: number;
  isBeat: boolean;
}

interface ManagedPlaybackTrackNodes {
  gain: GainNode;
  pan: StereoPannerNode;
}

interface ManagedPlaybackEffectsNodes {
  eqLow: BiquadFilterNode | null;
  eqMid: BiquadFilterNode | null;
  eqHigh: BiquadFilterNode | null;
  vocalOutput: GainNode | null;
  dryGain: GainNode | null;
  reverbGain: GainNode | null;
  delayNode: DelayNode | null;
  delayFeedback: GainNode | null;
  delayMixGain: GainNode | null;
  compressor: DynamicsCompressorNode | null;
}

function createImpulseResponse(ctx: AudioContext, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * Math.max(decay, 0.15)));
  const buffer = ctx.createBuffer(2, length, rate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  return buffer;
}

function resolveAudioDuration(audio: HTMLAudioElement): Promise<number> {
  return new Promise((resolve) => {
    const finish = (duration: number) => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("error", onError);
      resolve(Number.isFinite(duration) ? duration : 0);
    };

    const onError = () => finish(0);

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        finish(audio.duration);
        return;
      }

      const onTimeUpdate = () => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        try {
          audio.currentTime = 0;
        } catch {}
        finish(duration);
      };

      audio.addEventListener("timeupdate", onTimeUpdate, { once: true });
      try {
        audio.currentTime = 1e10;
      } catch {
        finish(0);
      }
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    audio.addEventListener("error", onError, { once: true });

    if (audio.readyState >= 1) {
      onLoadedMetadata();
    } else {
      audio.load();
    }
  });
}

export const useRecordingEngine = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveformRafRef = useRef<number | null>(null);
  const waveformPeaksRef = useRef<number[]>([]);
  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);
  const playbackTracksRef = useRef<ManagedPlaybackTrack[]>([]);
  const playbackStartedAtRef = useRef<number>(0);
  const masterGainRef = useRef<GainNode | null>(null);
  const beatNodesRef = useRef<ManagedPlaybackTrackNodes | null>(null);
  const trackNodesRef = useRef<Record<string, ManagedPlaybackTrackNodes>>({});
  const playbackEffectsNodesRef = useRef<ManagedPlaybackEffectsNodes>({
    eqLow: null,
    eqMid: null,
    eqHigh: null,
    vocalOutput: null,
    dryGain: null,
    reverbGain: null,
    delayNode: null,
    delayFeedback: null,
    delayMixGain: null,
    compressor: null,
  });

  const closeAudioContext = useCallback(() => {
    if (audioCtxRef.current?.state !== "closed") {
      try {
        audioCtxRef.current?.close();
      } catch {}
    }
    audioCtxRef.current = null;
  }, []);

  const stopPlaybackGraph = useCallback((resetTime = true) => {
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = null;

    playbackTracksRef.current.forEach(({ audio, trimStartTime }) => {
      audio.pause();
      try {
        audio.currentTime = resetTime ? trimStartTime : audio.currentTime;
      } catch {}
      audio.src = "";
    });
    playbackTracksRef.current = [];
    trackNodesRef.current = {};
    beatNodesRef.current = null;
    masterGainRef.current = null;
    playbackEffectsNodesRef.current = {
      eqLow: null,
      eqMid: null,
      eqHigh: null,
      vocalOutput: null,
      dryGain: null,
      reverbGain: null,
      delayNode: null,
      delayFeedback: null,
      delayMixGain: null,
      compressor: null,
    };

    setIsPlaying(false);
    if (resetTime) {
      setPlaybackTime(0);
    }

    closeAudioContext();
  }, [closeAudioContext]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    stopPlaybackGraph();
    closeAudioContext();
    analyserRef.current = null;
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, [closeAudioContext, stopPlaybackGraph]);

  useEffect(() => () => cleanup(), []);

  const updateWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    
    // Calculate RMS amplitude
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const normalized = Math.min(rms * 3, 1); // amplify for visibility
    
    waveformPeaksRef.current.push(normalized);
    
    // Show last 60 peaks for live display
    const peaks = waveformPeaksRef.current.slice(-60);
    setLiveWaveform(peaks);
    
    if (isRecording) {
      waveformRafRef.current = requestAnimationFrame(updateWaveform);
    }
  }, [isRecording]);

  const startRecording = useCallback(async (
    beatUrl: string | null,
    beatVolume: number
  ): Promise<{ blob: Blob; duration: number; waveform: number[] } | null> => {
    try {
      stopPlaybackGraph();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Play beat
      if (beatUrl) {
        const beatEl = new Audio(beatUrl);
        beatEl.volume = beatVolume / 100;
        beatEl.crossOrigin = "anonymous";
        beatAudioRef.current = beatEl;
        try { await beatEl.play(); } catch {}
      }

      chunksRef.current = [];
      waveformPeaksRef.current = [];
      setLiveWaveform([]);
      setRecordTime(0);
      recordStartRef.current = Date.now();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      return new Promise((resolve) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const duration = Math.round((Date.now() - recordStartRef.current) / 1000);
          const waveform = [...waveformPeaksRef.current];
          
          stream.getTracks().forEach(t => t.stop());
          if (beatAudioRef.current) {
            beatAudioRef.current.pause();
            beatAudioRef.current = null;
          }
          if (timerRef.current) clearInterval(timerRef.current);
          if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
          closeAudioContext();
          
          setIsRecording(false);
          resolve({ blob, duration, waveform });
        };

        recorder.start(100);
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setRecordTime(Math.round((Date.now() - recordStartRef.current) / 1000));
        }, 250);

        // Start waveform animation
        const animateWaveform = () => {
          const a = analyserRef.current;
          if (!a) return;
          const data = new Uint8Array(a.fftSize);
          a.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const normalized = Math.min(rms * 3, 1);
          waveformPeaksRef.current.push(normalized);
          setLiveWaveform([...waveformPeaksRef.current.slice(-60)]);
          
          if (mediaRecorderRef.current?.state === "recording") {
            waveformRafRef.current = requestAnimationFrame(animateWaveform);
          }
        };
        waveformRafRef.current = requestAnimationFrame(animateWaveform);
      });
    } catch {
      return null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
  }, [closeAudioContext, stopPlaybackGraph]);

  const playAudio = useCallback(async ({
    beatUrl,
    startAt = 0,
    beatVolume,
    beatPan,
    loop = false,
    masterVolume,
    takes,
    effects,
  }: PlaybackRequest) => {
    stopPlaybackGraph();

    const playableTakes = takes.filter((take) => take.audioUrl);
    const hasBeat = Boolean(beatUrl);
    if (!hasBeat && playableTakes.length === 0) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume / 100;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const playbackTracks: ManagedPlaybackTrack[] = [];
    trackNodesRef.current = {};
    beatNodesRef.current = null;

    if (playableTakes.length > 0) {
      const vocalInput = ctx.createGain();
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = "lowshelf";
      eqLow.frequency.value = 320;
      eqLow.gain.value = effects.eqLow;

      const eqMid = ctx.createBiquadFilter();
      eqMid.type = "peaking";
      eqMid.frequency.value = 1200;
      eqMid.Q.value = 0.8;
      eqMid.gain.value = effects.eqMid;

      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = "highshelf";
      eqHigh.frequency.value = 4200;
      eqHigh.gain.value = effects.eqHigh;

      const vocalOutput = ctx.createGain();
      vocalOutput.gain.value = effects.outputGain / 100;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;

      vocalInput.connect(eqLow).connect(eqMid).connect(eqHigh);
      eqHigh.connect(dryGain);
      dryGain.connect(vocalOutput);

      const compressor = ctx.createDynamicsCompressor();
      const compressionMix = Math.max(0, Math.min(100, effects.compressionAmount));
      compressor.threshold.value = -36 + compressionMix * 0.24;
      compressor.knee.value = 20;
      compressor.ratio.value = 1 + compressionMix * 0.08;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.18;

      vocalOutput.connect(compressor);
      compressor.connect(masterGain);

      playbackEffectsNodesRef.current = {
        eqLow,
        eqMid,
        eqHigh,
        vocalOutput,
        dryGain,
        reverbGain: effects.reverbMix > 0 ? null : null,
        delayNode: effects.delayMix > 0 ? null : null,
        delayFeedback: effects.delayMix > 0 ? null : null,
        delayMixGain: effects.delayMix > 0 ? null : null,
        compressor,
      };

      const takeDurations = await Promise.all(
        playableTakes.map(async (take) => {
          const audio = new Audio(take.audioUrl);
          audio.crossOrigin = "anonymous";
          audio.preload = "auto";

          const duration = await resolveAudioDuration(audio);
          const trimStartTime = duration * (take.trimStart / 100);
          const trimEndTime = duration * (take.trimEnd / 100);

          const source = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          gain.gain.value = take.volume / 100;
          const pan = ctx.createStereoPanner();
          pan.pan.value = take.pan / 100;

          source.connect(gain).connect(pan).connect(vocalInput);

          trackNodesRef.current[take.id] = { gain, pan };

          return { id: take.id, audio, trimStartTime, trimEndTime };
        })
      );

      takeDurations.forEach((track) => {
        try {
          track.audio.currentTime = Math.min(track.trimEndTime, track.trimStartTime + startAt);
        } catch {}
        playbackTracks.push({ ...track, isBeat: false });
      });

      const reverbGain = ctx.createGain();
      reverbGain.gain.value = effects.reverbMix / 100;
      playbackEffectsNodesRef.current.reverbGain = reverbGain;
      dryGain.gain.value = Math.max(0.2, 1 - effects.reverbMix / 130);

      const convolver = ctx.createConvolver();
      convolver.buffer = createImpulseResponse(ctx, effects.reverbDecay);
      eqHigh.connect(convolver);
      convolver.connect(reverbGain);
      reverbGain.connect(vocalOutput);

      const delayNode = ctx.createDelay(2);
      delayNode.delayTime.value = effects.delayTime;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = effects.delayFeedback / 100;
      const delayMixGain = ctx.createGain();
      delayMixGain.gain.value = effects.delayMix / 100;
      eqHigh.connect(delayNode);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(delayMixGain);
      delayMixGain.connect(vocalOutput);

      playbackEffectsNodesRef.current.delayNode = delayNode;
      playbackEffectsNodesRef.current.delayFeedback = delayFeedback;
      playbackEffectsNodesRef.current.delayMixGain = delayMixGain;
    }

    if (beatUrl) {
      const beatAudio = new Audio(beatUrl);
      beatAudio.crossOrigin = "anonymous";
      beatAudio.preload = "auto";
      const beatDuration = await resolveAudioDuration(beatAudio);

      const beatSource = ctx.createMediaElementSource(beatAudio);
      const beatGainNode = ctx.createGain();
      beatGainNode.gain.value = beatVolume / 100;
      const beatPanNode = ctx.createStereoPanner();
      beatPanNode.pan.value = beatPan / 100;

      beatSource.connect(beatGainNode).connect(beatPanNode).connect(masterGain);
      beatNodesRef.current = { gain: beatGainNode, pan: beatPanNode };
      try {
        beatAudio.currentTime = Math.min(beatDuration, startAt);
      } catch {}
      playbackTracks.push({ id: "beat", audio: beatAudio, trimStartTime: 0, trimEndTime: beatDuration, isBeat: true });
    }

    playbackTracksRef.current = playbackTracks;

    const maxDuration = playbackTracks.reduce((longest, track) => {
      const duration = Math.max(0, track.trimEndTime - track.trimStartTime);
      return Math.max(longest, duration);
    }, 0);

    setPlaybackDuration(Math.round(maxDuration));
    setPlaybackTime(Math.min(startAt, maxDuration));
    setIsPlaying(true);

    await ctx.resume();
    await Promise.all(
      playbackTracks.map(async ({ audio }) => {
        try {
          await audio.play();
        } catch {}
      })
    );

    playbackStartedAtRef.current = ctx.currentTime - Math.min(startAt, maxDuration);

    playbackTimerRef.current = setInterval(() => {
      const elapsed = Math.max(0, ctx.currentTime - playbackStartedAtRef.current);
      setPlaybackTime(Math.min(elapsed, maxDuration));

      playbackTracksRef.current.forEach((track) => {
        if (!track.isBeat && !track.audio.paused && track.audio.currentTime >= track.trimEndTime - 0.03) {
          track.audio.pause();
        }
      });

      const anyTrackStillPlaying = playbackTracksRef.current.some((track) => {
        if (track.isBeat) {
          return !track.audio.paused && !track.audio.ended;
        }

        return !track.audio.paused && track.audio.currentTime < track.trimEndTime - 0.03;
      });

        if (loop && maxDuration > 0 && (!anyTrackStillPlaying || elapsed >= maxDuration + 0.05)) {
        playbackTracksRef.current.forEach((track) => {
          track.audio.pause();
          try {
            track.audio.currentTime = track.isBeat ? 0 : track.trimStartTime;
          } catch {}
        });

        playbackStartedAtRef.current = ctx.currentTime;
        setPlaybackTime(0);

        playbackTracksRef.current.forEach(({ audio }) => {
          void audio.play().catch(() => {});
        });
        return;
      }

      if (!anyTrackStillPlaying || elapsed >= maxDuration + 0.05) {
        stopPlaybackGraph(false);
        setPlaybackTime(maxDuration);
      }
    }, 100);
  }, [stopPlaybackGraph]);

  const stopPlayback = useCallback(() => {
    stopPlaybackGraph();
  }, [stopPlaybackGraph]);

  const pausePlayback = useCallback(() => {
    playbackTracksRef.current.forEach(({ audio }) => audio.pause());
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    setIsPlaying(false);
  }, []);

  const seekPlayback = useCallback((nextTime: number) => {
    const ctx = audioCtxRef.current;
    const boundedTime = Math.max(0, Math.min(nextTime, playbackDuration || nextTime));

    playbackTracksRef.current.forEach((track) => {
      try {
        track.audio.currentTime = track.isBeat
          ? boundedTime
          : Math.min(track.trimEndTime, track.trimStartTime + boundedTime);
      } catch {}
    });

    if (ctx) {
      playbackStartedAtRef.current = ctx.currentTime - boundedTime;
    }

    setPlaybackTime(boundedTime);
  }, [playbackDuration]);

  const updatePlaybackMix = useCallback((params: {
    masterVolume?: number;
    beatVolume?: number;
    beatPan?: number;
    takes?: PlaybackTakeInput[];
    effects?: PlaybackEffectsInput;
  }) => {
    if (typeof params.masterVolume === "number" && masterGainRef.current) {
      masterGainRef.current.gain.value = params.masterVolume / 100;
    }

    if (typeof params.beatVolume === "number" && beatNodesRef.current) {
      beatNodesRef.current.gain.gain.value = params.beatVolume / 100;
    }

    if (typeof params.beatPan === "number" && beatNodesRef.current) {
      beatNodesRef.current.pan.pan.value = params.beatPan / 100;
    }

    if (params.takes) {
      params.takes.forEach((take) => {
        const nodes = trackNodesRef.current[take.id];
        if (!nodes) return;
        nodes.gain.gain.value = take.volume / 100;
        nodes.pan.pan.value = take.pan / 100;
      });
    }

    if (params.effects) {
      const nodes = playbackEffectsNodesRef.current;
      if (nodes.eqLow) nodes.eqLow.gain.value = params.effects.eqLow;
      if (nodes.eqMid) nodes.eqMid.gain.value = params.effects.eqMid;
      if (nodes.eqHigh) nodes.eqHigh.gain.value = params.effects.eqHigh;
      if (nodes.vocalOutput) nodes.vocalOutput.gain.value = params.effects.outputGain / 100;
      if (nodes.reverbGain) nodes.reverbGain.gain.value = params.effects.reverbMix / 100;
      if (nodes.delayNode) nodes.delayNode.delayTime.value = params.effects.delayTime;
      if (nodes.delayFeedback) nodes.delayFeedback.gain.value = params.effects.delayFeedback / 100;
      if (nodes.delayMixGain) nodes.delayMixGain.gain.value = params.effects.delayMix / 100;
      if (nodes.compressor) {
        const compressionMix = Math.max(0, Math.min(100, params.effects.compressionAmount));
        nodes.compressor.threshold.value = -36 + compressionMix * 0.24;
        nodes.compressor.ratio.value = 1 + compressionMix * 0.08;
      }
    }
  }, [playbackEffectsNodesRef]);

  return {
    isRecording,
    isPlaying,
    recordTime,
    playbackTime,
    playbackDuration,
    liveWaveform,
    startRecording,
    stopRecording,
    playAudio,
    stopPlayback,
    pausePlayback,
    seekPlayback,
    updatePlaybackMix,
  };
};
