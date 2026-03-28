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

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveformRafRef.current) cancelAnimationFrame(waveformRafRef.current);
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current?.state !== "closed") {
      try { audioCtxRef.current?.close(); } catch {}
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

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
  }, []);

  const playAudio = useCallback((audioUrl: string, beatUrl: string | null, beatVolume: number, vocalVolume: number) => {
    // Stop any existing playback
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }
    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current = null;
    }
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);

    const hasVocal = audioUrl && audioUrl.length > 0;
    const hasBeat = beatUrl && beatUrl.length > 0;

    // Primary track for time tracking
    let primaryAudio: HTMLAudioElement | null = null;

    if (hasVocal) {
      const audio = new Audio(audioUrl);
      audio.volume = vocalVolume / 100;
      playbackAudioRef.current = audio;
      primaryAudio = audio;

      // Seek-to-end workaround for WebM duration
      audio.addEventListener("loadedmetadata", () => {
        if (!isFinite(audio.duration) || audio.duration === Infinity) {
          audio.currentTime = 1e10;
          audio.addEventListener("timeupdate", function seekBack() {
            audio.removeEventListener("timeupdate", seekBack);
            audio.currentTime = 0;
            setPlaybackDuration(Math.round(audio.duration));
            audio.play();
            // Start beat in sync
            if (beatAudioRef.current) beatAudioRef.current.play().catch(() => {});
          });
        } else {
          setPlaybackDuration(Math.round(audio.duration));
          audio.play();
          // Start beat in sync
          if (beatAudioRef.current) beatAudioRef.current.play().catch(() => {});
        }
      });

      audio.load();

      audio.onended = () => {
        setIsPlaying(false);
        if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
        if (beatAudioRef.current) {
          beatAudioRef.current.pause();
          beatAudioRef.current = null;
        }
      };
    }

    if (hasBeat) {
      const beat = new Audio(beatUrl);
      beat.volume = beatVolume / 100;
      beatAudioRef.current = beat;

      // If no vocal, beat is the primary audio
      if (!hasVocal) {
        primaryAudio = beat;

        beat.addEventListener("loadedmetadata", () => {
          if (!isFinite(beat.duration) || beat.duration === Infinity) {
            beat.currentTime = 1e10;
            beat.addEventListener("timeupdate", function seekBack() {
              beat.removeEventListener("timeupdate", seekBack);
              beat.currentTime = 0;
              setPlaybackDuration(Math.round(beat.duration));
              beat.play();
            });
          } else {
            setPlaybackDuration(Math.round(beat.duration));
            beat.play();
          }
        });

        beat.load();

        beat.onended = () => {
          setIsPlaying(false);
          if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
        };
      }
    }

    setIsPlaying(true);
    setPlaybackTime(0);

    const trackingAudio = primaryAudio;
    playbackTimerRef.current = setInterval(() => {
      if (trackingAudio) {
        setPlaybackTime(Math.round(trackingAudio.currentTime));
      }
    }, 250);
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }
    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current = null;
    }
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    setIsPlaying(false);
    setPlaybackTime(0);
  }, []);

  const pausePlayback = useCallback(() => {
    playbackAudioRef.current?.pause();
    beatAudioRef.current?.pause();
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    setIsPlaying(false);
  }, []);

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
  };
};
