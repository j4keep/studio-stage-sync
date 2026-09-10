import { useCallback, useEffect, useRef, useState } from "react";
import {
  bookNarrationVoiceLabel,
  speakBookPage,
  stopBookNarration,
} from "@/lib/books/book-narration";
import {
  unlockYajAudio,
  pauseYajAudio,
  resumeYajAudio,
  isYajAudioActive,
} from "@/lib/yaj-media";
import { loadYajAiPrefs, YAJ_AI_UPDATED_EVENT } from "@/lib/yaj-ai-prefs";
import { COACH_VOICE_SPEEDS, type CoachVoiceSpeedId } from "@/lib/wellness-move-coach";

export type BookNarrationStatus = "idle" | "loading" | "playing" | "paused" | "error";

type Args = {
  pageText: string;
  pageIndex: number;
  pageCount: number;
  /** Turn to the next page (with flip animation when available). */
  onAdvancePage: () => void;
};

export function useBookNarration({ pageText, pageIndex, pageCount, onAdvancePage }: Args) {
  const [status, setStatus] = useState<BookNarrationStatus>("idle");
  const [speed, setSpeed] = useState<CoachVoiceSpeedId>(() => loadYajAiPrefs().coachSpeed);
  const [voiceLabel, setVoiceLabel] = useState(() => bookNarrationVoiceLabel());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionRef = useRef(false);
  const pausedWithAudioRef = useRef(false);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pageIndexRef = useRef(pageIndex);
  const pageTextRef = useRef(pageText);
  const pageCountRef = useRef(pageCount);
  const onAdvanceRef = useRef(onAdvancePage);
  const speedRef = useRef(speed);
  const statusRef = useRef(status);

  pageIndexRef.current = pageIndex;
  pageTextRef.current = pageText;
  pageCountRef.current = pageCount;
  onAdvanceRef.current = onAdvancePage;
  speedRef.current = speed;
  statusRef.current = status;

  useEffect(() => {
    const sync = () => setVoiceLabel(bookNarrationVoiceLabel());
    window.addEventListener(YAJ_AI_UPDATED_EVENT, sync);
    return () => window.removeEventListener(YAJ_AI_UPDATED_EVENT, sync);
  }, []);

  const cancelInFlight = useCallback(() => {
    genRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    stopBookNarration();
    pausedWithAudioRef.current = false;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current = false;
    cancelInFlight();
    setStatus("idle");
    setErrorMessage(null);
  }, [cancelInFlight]);

  const speakCurrentPage = useCallback(async () => {
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    stopBookNarration();
    pausedWithAudioRef.current = false;

    setStatus("loading");
    setErrorMessage(null);
    unlockYajAudio();

    const result = await speakBookPage(pageTextRef.current, {
      speed: speedRef.current,
      signal: ac.signal,
    });

    if (gen !== genRef.current) return;

    if (result === "aborted") return;

    if (result === "error") {
      sessionRef.current = false;
      setStatus("error");
      setErrorMessage("Couldn't start narration. Check your connection and try again.");
      return;
    }

    if (!sessionRef.current || gen !== genRef.current) return;

    if (pageIndexRef.current < pageCountRef.current - 1) {
      setStatus("loading");
      onAdvanceRef.current();
    } else {
      sessionRef.current = false;
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    if (!sessionRef.current) return;
    if (statusRef.current === "paused") {
      // Page changed while paused — drop mid-clip so Resume reads the new page.
      cancelInFlight();
      sessionRef.current = true;
      setStatus("paused");
      return;
    }
    void speakCurrentPage();
  }, [pageIndex, speakCurrentPage, cancelInFlight]);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(() => {
    unlockYajAudio();
    sessionRef.current = true;
    void speakCurrentPage();
  }, [speakCurrentPage]);

  const pause = useCallback(() => {
    if (!sessionRef.current) return;
    if (isYajAudioActive()) {
      pauseYajAudio();
      pausedWithAudioRef.current = true;
      setStatus("paused");
      return;
    }
    cancelInFlight();
    sessionRef.current = true;
    setStatus("paused");
  }, [cancelInFlight]);

  const resume = useCallback(() => {
    unlockYajAudio();
    sessionRef.current = true;
    if (pausedWithAudioRef.current) {
      resumeYajAudio();
      pausedWithAudioRef.current = false;
      setStatus("playing");
      return;
    }
    void speakCurrentPage();
  }, [speakCurrentPage]);

  useEffect(() => {
    if (status !== "loading") return;
    const id = window.setInterval(() => {
      if (!sessionRef.current || statusRef.current === "paused") return;
      if (isYajAudioActive()) setStatus("playing");
    }, 180);
    return () => window.clearInterval(id);
  }, [status]);

  const togglePlay = useCallback(() => {
    if (status === "playing" || status === "loading") {
      pause();
      return;
    }
    if (status === "paused") {
      resume();
      return;
    }
    start();
  }, [pause, resume, start, status]);

  const cycleSpeed = useCallback(() => {
    const ids = COACH_VOICE_SPEEDS.map((s) => s.id);
    const i = ids.indexOf(speed);
    const next = ids[(i + 1) % ids.length] ?? "normal";
    setSpeed(next);
    if (sessionRef.current && statusRef.current !== "paused" && statusRef.current !== "idle") {
      void speakCurrentPage();
    }
  }, [speakCurrentPage, speed]);

  return {
    status,
    speed,
    voiceLabel,
    errorMessage,
    isSession: status === "playing" || status === "loading" || status === "paused",
    start,
    stop,
    pause,
    resume,
    togglePlay,
    cycleSpeed,
  };
}
