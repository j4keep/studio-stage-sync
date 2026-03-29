import { useState, useRef, useCallback, useEffect } from "react";

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
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  outputGain: number;
}

export interface PlaybackRequest {
  beatUrl: string | null;
  beatVolume: number;
  beatPan: number;
  masterVolume: number;
  takes: PlaybackTakeInput[];
  effects: PlaybackEffectsInput;
}

interface ManagedPlaybackTrack {
  audio: HTMLAudioElement;
  trimEndTime: number;
  trimStartTime: number;
  isBeat: boolean;
  gainNode?: GainNode;
  panNode?: StereoPannerNode;
}

function createImpulseResponse(ctx: AudioContext, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * Math.max(decay, 0.15)));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function resolveAudioDuration(audio: HTMLAudioElement): Promise<number> {
  return new Promise((resolve) => {
    const finish = (d: number) => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("error", onErr);
      resolve(Number.isFinite(d) ? d : 0);
    };
    const onErr = () => finish(0);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) { finish(audio.duration); return; }
      const onTime = () => {
        audio.removeEventListener("timeupdate", onTime);
        const d = Number.isFinite(audio.duration) ? audio.duration : 0;
        try { audio.currentTime = 0; } catch {}
        finish(d);
      };
      audio.addEventListener("timeupdate", onTime, { once: true });
      try { audio.currentTime = 1e10; } catch { finish(0); }
    };
    audio.addEventListener("loadedmetadata", onMeta, { once: true });
    audio.addEventListener("error", onErr, { once: true });
    if (audio.readyState >= 1) onMeta(); else audio.load();
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
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef<number>(0);
  const playbackTracksRef = useRef<ManagedPlaybackTrack[]>([]);
  const playbackStartedAtRef = useRef<number>(0);
  const masterGainRef = useRef<GainNode | null>(null);

  const closeAudioContext = useCallback(() => {
    if (audioCtxRef.current?.state !== "closed") {
      try { audioCtxRef.current?.close(); } catch {}
    }
    audioCtxRef.current = null;
  }, []);

  const stopPlaybackGraph = useCallback((resetTime = true) => {
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = null;
    playbackTracksRef.current.forEach(({ audio, trimStartTime }) => {
      audio.pause();
      try { audio.currentTime = resetTime ? trimStartTime : audio.currentTime; } catch {}
      audio.src = "";
    });
    playbackTracksRef.current = [];
    masterGainRef.current = null;
    setIsPlaying(false);
    if (resetTime) setPlaybackTime(0);
    closeAudioContext();
  }, [closeAudioContext]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    stopPlaybackGraph();
    closeAudioContext();
  }, [closeAudioContext, stopPlaybackGraph]);

  useEffect(() => () => cleanup(), []);

  // ── Recording ──
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

      // Play beat through speakers during recording
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
          if (beatAudioRef.current) { beatAudioRef.current.pause(); beatAudioRef.current = null; }
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

        const animateWaveform = () => {
          const a = analyserRef.current;
          if (!a) return;
          const data = new Uint8Array(a.fftSize);
          a.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / data.length);
          waveformPeaksRef.current.push(Math.min(rms * 3, 1));
          setLiveWaveform([...waveformPeaksRef.current.slice(-60)]);
          if (mediaRecorderRef.current?.state === "recording") {
            waveformRafRef.current = requestAnimationFrame(animateWaveform);
          }
        };
        waveformRafRef.current = requestAnimationFrame(animateWaveform);
      });
    } catch { return null; }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (beatAudioRef.current) { beatAudioRef.current.pause(); beatAudioRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
  }, []);

  // ── Playback with Web Audio API routing ──
  const playAudio = useCallback(async ({
    beatUrl, beatVolume, beatPan, masterVolume, takes, effects,
  }: PlaybackRequest) => {
    stopPlaybackGraph();

    const playableTakes = takes.filter(t => t.audioUrl);
    if (!beatUrl && playableTakes.length === 0) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume / 100;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const playbackTracks: ManagedPlaybackTrack[] = [];

    // ── Build vocal effects chain ──
    if (playableTakes.length > 0) {
      const vocalBus = ctx.createGain();

      // EQ
      const eqLow = ctx.createBiquadFilter();
      eqLow.type = "lowshelf"; eqLow.frequency.value = 320; eqLow.gain.value = effects.eqLow;
      const eqMid = ctx.createBiquadFilter();
      eqMid.type = "peaking"; eqMid.frequency.value = 1200; eqMid.Q.value = 0.8; eqMid.gain.value = effects.eqMid;
      const eqHigh = ctx.createBiquadFilter();
      eqHigh.type = "highshelf"; eqHigh.frequency.value = 4200; eqHigh.gain.value = effects.eqHigh;

      const vocalOutput = ctx.createGain();
      vocalOutput.gain.value = effects.outputGain / 100;
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1;

      vocalBus.connect(eqLow).connect(eqMid).connect(eqHigh);
      eqHigh.connect(dryGain);
      dryGain.connect(vocalOutput);

      if (effects.reverbMix > 0) {
        const convolver = ctx.createConvolver();
        convolver.buffer = createImpulseResponse(ctx, effects.reverbDecay);
        const reverbGain = ctx.createGain();
        reverbGain.gain.value = effects.reverbMix / 100;
        dryGain.gain.value = Math.max(0.2, 1 - effects.reverbMix / 130);
        eqHigh.connect(convolver);
        convolver.connect(reverbGain);
        reverbGain.connect(vocalOutput);
      }

      if (effects.delayMix > 0) {
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
      }

      vocalOutput.connect(masterGain);

      // Create per-take audio elements routed through Web Audio
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

          source.connect(gain).connect(pan).connect(vocalBus);

          return { audio, trimStartTime, trimEndTime, gainNode: gain, panNode: pan };
        })
      );

      takeDurations.forEach((track) => {
        try { track.audio.currentTime = track.trimStartTime; } catch {}
        playbackTracks.push({ ...track, isBeat: false });
      });
    }

    // ── Beat track ──
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
      playbackTracks.push({
        audio: beatAudio, trimStartTime: 0, trimEndTime: beatDuration,
        isBeat: true, gainNode: beatGainNode, panNode: beatPanNode,
      });
    }

    playbackTracksRef.current = playbackTracks;

    const maxDuration = playbackTracks.reduce((longest, track) => {
      return Math.max(longest, Math.max(0, track.trimEndTime - track.trimStartTime));
    }, 0);

    setPlaybackDuration(Math.round(maxDuration));
    setPlaybackTime(0);
    setIsPlaying(true);

    await ctx.resume();
    await Promise.all(playbackTracks.map(async ({ audio }) => {
      try { await audio.play(); } catch {}
    }));

    playbackStartedAtRef.current = ctx.currentTime;

    playbackTimerRef.current = setInterval(() => {
      const elapsed = Math.max(0, ctx.currentTime - playbackStartedAtRef.current);
      setPlaybackTime(Math.min(elapsed, maxDuration));

      playbackTracksRef.current.forEach((track) => {
        if (!track.isBeat && !track.audio.paused && track.audio.currentTime >= track.trimEndTime - 0.03) {
          track.audio.pause();
        }
      });

      const anyPlaying = playbackTracksRef.current.some((track) => {
        if (track.isBeat) return !track.audio.paused && !track.audio.ended;
        return !track.audio.paused && track.audio.currentTime < track.trimEndTime - 0.03;
      });

      if (!anyPlaying || elapsed >= maxDuration + 0.05) {
        stopPlaybackGraph(false);
        setPlaybackTime(maxDuration);
      }
    }, 80);
  }, [stopPlaybackGraph]);

  const stopPlayback = useCallback(() => stopPlaybackGraph(), [stopPlaybackGraph]);

  const pausePlayback = useCallback(() => {
    playbackTracksRef.current.forEach(({ audio }) => audio.pause());
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    setIsPlaying(false);
  }, []);

  // Live parameter updates during playback
  const updateMasterVolume = useCallback((v: number) => {
    if (masterGainRef.current) masterGainRef.current.gain.value = v / 100;
  }, []);

  const updateTrackVolume = useCallback((trackIndex: number, v: number) => {
    const track = playbackTracksRef.current[trackIndex];
    if (track?.gainNode) track.gainNode.gain.value = v / 100;
  }, []);

  const updateTrackPan = useCallback((trackIndex: number, v: number) => {
    const track = playbackTracksRef.current[trackIndex];
    if (track?.panNode) track.panNode.pan.value = v / 100;
  }, []);

  return {
    isRecording, isPlaying, recordTime, playbackTime, playbackDuration, liveWaveform,
    startRecording, stopRecording, playAudio, stopPlayback, pausePlayback,
    updateMasterVolume, updateTrackVolume, updateTrackPan,
  };
};
