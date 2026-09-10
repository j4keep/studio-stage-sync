import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOOK_NARRATION_SPEEDS,
  bookNarrationVoiceLabel,
  speakBookPage,
  stopBookNarration,
  type BookNarrationSpeedId,
  type NarrationHighlight,
} from "@/lib/books/book-narration";
import {
  unlockYajAudio,
  pauseYajAudio,
  resumeYajAudio,
  isYajAudioActive,
} from "@/lib/yaj-media";
import { YAJ_AI_UPDATED_EVENT } from "@/lib/yaj-ai-prefs";

/** preparing → reading → playing (pause/play controls). */
export type BookNarrationStatus =
  | "idle"
  | "preparing"
  | "reading"
  | "playing"
  | "paused"
  | "error";

type Args = {
  pageText: string;
  pageIndex: number;
  pageCount: number;
  /** Turn to the next page (with flip animation when available). */
  onAdvancePage: () => void;
};

export function useBookNarration({ pageText, pageIndex, pageCount, onAdvancePage }: Args) {
  const [status, setStatus] = useState<BookNarrationStatus>("idle");
  const [speed, setSpeed] = useState<BookNarrationSpeedId>("1");
  const [voiceLabel, setVoiceLabel] = useState(() => bookNarrationVoiceLabel());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<NarrationHighlight | null>(null);

  const sessionRef = useRef(false);
  const pausedWithAudioRef = useRef(false);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const readingTimerRef = useRef<number | null>(null);
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

  const clearReadingTimer = useCallback(() => {
    if (readingTimerRef.current != null) {
      window.clearTimeout(readingTimerRef.current);
      readingTimerRef.current = null;
    }
  }, []);

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
    clearReadingTimer();
    setHighlight(null);
  }, [clearReadingTimer]);

  const stop = useCallback(() => {
    sessionRef.current = false;
    cancelInFlight();
    setStatus("idle");
    setErrorMessage(null);
    setHighlight(null);
  }, [cancelInFlight]);

  const speakCurrentPage = useCallback(async () => {
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    stopBookNarration();
    pausedWithAudioRef.current = false;
    clearReadingTimer();
    setHighlight(null);

    setStatus("preparing");
    setErrorMessage(null);
    unlockYajAudio();

    const result = await speakBookPage(pageTextRef.current, {
      speed: speedRef.current,
      signal: ac.signal,
      onHighlight: (h) => {
        if (gen !== genRef.current) return;
        setHighlight(h);
      },
      onPlaybackStart: () => {
        if (gen !== genRef.current) return;
        setStatus("reading");
        clearReadingTimer();
        readingTimerRef.current = window.setTimeout(() => {
          if (gen !== genRef.current) return;
          if (!sessionRef.current) return;
          if (statusRef.current === "paused") return;
          setStatus("playing");
        }, 700);
      },
    });

    if (gen !== genRef.current) return;

    if (result === "aborted") return;

    if (result === "error") {
      sessionRef.current = false;
      setHighlight(null);
      setStatus("error");
      setErrorMessage("Couldn't start narration. Check your connection and try again.");
      return;
    }

    if (!sessionRef.current || gen !== genRef.current) return;

    setHighlight(null);

    if (pageIndexRef.current < pageCountRef.current - 1) {
      setStatus("preparing");
      onAdvanceRef.current();
    } else {
      sessionRef.current = false;
      setStatus("idle");
    }
  }, [clearReadingTimer]);

  useEffect(() => {
    if (!sessionRef.current) return;
    if (statusRef.current === "paused") {
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
    clearReadingTimer();
    if (isYajAudioActive()) {
      pauseYajAudio();
      pausedWithAudioRef.current = true;
      setStatus("paused");
      return;
    }
    cancelInFlight();
    sessionRef.current = true;
    setStatus("paused");
  }, [cancelInFlight, clearReadingTimer]);

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

  const togglePlay = useCallback(() => {
    if (status === "playing" || status === "preparing" || status === "reading") {
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
    const ids = BOOK_NARRATION_SPEEDS.map((s) => s.id);
    const i = ids.indexOf(speed);
    const next = ids[(i + 1) % ids.length] ?? "1";
    setSpeed(next);
    if (
      sessionRef.current &&
      statusRef.current !== "paused" &&
      statusRef.current !== "idle" &&
      statusRef.current !== "error"
    ) {
      void speakCurrentPage();
    }
  }, [speakCurrentPage, speed]);

  return {
    status,
    speed,
    voiceLabel,
    errorMessage,
    highlight,
    isSession:
      status === "playing" ||
      status === "preparing" ||
      status === "reading" ||
      status === "paused",
    start,
    stop,
    pause,
    resume,
    togglePlay,
    cycleSpeed,
  };
}
