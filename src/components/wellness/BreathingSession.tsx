import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2, X } from "lucide-react";
import BreathAmbientBackdrop from "@/components/wellness/BreathAmbientBackdrop";
import {
  BREATH_ATMOSPHERES,
  BREATH_CARD_META,
  type BreathAtmosphere,
} from "@/lib/wellness-relax";
import { wellnessAmbient } from "@/lib/wellness-ambient-engine";
import {
  breathCoachLine,
  breathPhaseHint,
  breathPhaseLabel,
  canWellnessSpeak,
  speakBreathPhase,
  speakWellness,
  stopWellnessSpeak,
  warmupWellnessVoice,
} from "@/lib/wellness-voice";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  sessionId?: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdOut?: number;
  minutes: number;
  onComplete?: () => void;
  /** Called when user closes early after ≥30s — minutes to log. */
  onProgress?: (minutesDone: number) => void;
  /** YAJ speaks phase cues. Default true when browser supports it. */
  voiceGuide?: boolean;
};

type Phase = "inhale" | "hold" | "exhale" | "holdOut";
type Stage = "atmosphere" | "session";

/** Immersive breathing — Apple Fitness / Headspace inspired. */
export default function BreathingSession({
  open,
  onClose,
  title,
  sessionId,
  inhale,
  hold,
  exhale,
  holdOut = 0,
  minutes,
  onComplete,
  onProgress,
  voiceGuide = true,
}: Props) {
  const totalSec = minutes * 60;
  const meta = sessionId ? BREATH_CARD_META[sessionId] : undefined;
  const [stage, setStage] = useState<Stage>("atmosphere");
  const [atmosphere, setAtmosphere] = useState<BreathAtmosphere>(BREATH_ATMOSPHERES[0]);
  const [phase, setPhase] = useState<Phase>("inhale");
  const [phaseLeft, setPhaseLeft] = useState(inhale);
  const [secondsLeft, setSecondsLeft] = useState(totalSec);
  const [running, setRunning] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => voiceGuide && canWellnessSpeak());
  const [musicOn, setMusicOn] = useState(true);
  const [volume, setVolume] = useState(0.35);
  const [coachLine, setCoachLine] = useState("");
  const completedRef = useRef(false);
  const loggedRef = useRef(false);
  const secondsLeftRef = useRef(totalSec);
  const phaseRef = useRef<Phase>("inhale");

  const phases: Phase[] = useMemo(
    () =>
      (["inhale", "hold", "exhale", "holdOut"] as Phase[]).filter((p) => {
        if (p === "hold") return hold > 0;
        if (p === "holdOut") return holdOut > 0;
        return true;
      }),
    [hold, holdOut],
  );

  const durationFor = (p: Phase) =>
    p === "inhale" ? inhale : p === "hold" ? hold : p === "exhale" ? exhale : holdOut;

  const nextPhase = useMemo(() => {
    const idx = phases.indexOf(phase);
    return phases[(idx + 1) % phases.length];
  }, [phase, phases]);

  const recordProgress = (full: boolean) => {
    if (loggedRef.current) return;
    const done = Math.max(0, totalSec - secondsLeftRef.current);
    if (!full && done < 30) return;
    loggedRef.current = true;
    const mins = full ? minutes : Math.max(1, Math.round(done / 60));
    onProgress?.(mins);
  };

  const stopAmbient = () => {
    void wellnessAmbient.stop();
  };

  useEffect(() => {
    if (!open) return;
    warmupWellnessVoice();
    setStage("atmosphere");
    setAtmosphere(BREATH_ATMOSPHERES[sessionId === "wind-down" ? 4 : sessionId === "calm" ? 1 : 0]);
    completedRef.current = false;
    loggedRef.current = false;
    setPhase("inhale");
    phaseRef.current = "inhale";
    setPhaseLeft(inhale);
    setSecondsLeft(totalSec);
    secondsLeftRef.current = totalSec;
    setRunning(false);
    setCoachLine("");
    return () => {
      stopWellnessSpeak();
      stopAmbient();
    };
  }, [open, inhale, minutes, title, voiceGuide, totalSec, sessionId]);

  const beginSession = async (env: BreathAtmosphere) => {
    setAtmosphere(env);
    setStage("session");
    setPhase("inhale");
    phaseRef.current = "inhale";
    setPhaseLeft(inhale);
    setSecondsLeft(totalSec);
    secondsLeftRef.current = totalSec;
    setRunning(true);
    completedRef.current = false;
    loggedRef.current = false;
    const openLine = `Let's begin. ${title}. Take a slow breath in through your nose.`;
    setCoachLine(openLine);
    if (musicOn) {
      try {
        await wellnessAmbient.playTrack(env.trackId, { volume, loop: true });
      } catch {
        /* ambient optional */
      }
    }
    if (voiceOn) void speakWellness(openLine, { calm: true, rate: 0.88 });
  };

  useEffect(() => {
    if (!open || stage !== "session" || !running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        const next = s <= 1 ? 0 : s - 1;
        secondsLeftRef.current = next;
        if (s <= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            recordProgress(true);
            setCoachLine("Beautiful work. Carry this ease with you.");
            if (voiceOn) void speakWellness("Well done. Session complete.", { calm: true });
            onComplete?.();
          }
          setRunning(false);
          return 0;
        }
        return next;
      });
      setPhaseLeft((t) => {
        if (t > 1) return t - 1;
        const current = phaseRef.current;
        const idx = phases.indexOf(current);
        const next = phases[(idx + 1) % phases.length];
        phaseRef.current = next;
        setPhase(next);
        const line = breathCoachLine(next);
        setCoachLine(line);
        const dur = durationFor(next);
        if (voiceOn) void speakBreathPhase(next, line);
        return dur;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage, running, voiceOn, onComplete]);

  useEffect(() => {
    if (!open) stopWellnessSpeak();
  }, [open]);

  useEffect(() => {
    if (stage !== "session") return;
    wellnessAmbient.setMasterVolume(musicOn ? volume : 0.0001);
  }, [volume, musicOn, stage]);

  if (!open) return null;

  const label = secondsLeft === 0 ? "Complete" : breathPhaseLabel(phase);
  const hint = secondsLeft === 0 ? "Beautiful work" : coachLine || breathPhaseHint(phase);
  const scale = phase === "inhale" || phase === "hold" ? 1.18 : 0.86;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = ((totalSec - secondsLeft) / totalSec) * 100;
  const shape = meta?.visual || "square";

  const handleClose = () => {
    stopWellnessSpeak();
    stopAmbient();
    if (stage === "session") recordProgress(false);
    onClose();
  };

  if (stage === "atmosphere") {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-[#071412] text-emerald-50">
        <BreathAmbientBackdrop backdrop={atmosphere.backdrop} active />
        <div className="absolute inset-0 bg-black/45" />
        <header className="relative z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            {title}
          </p>
          <span className="w-10" />
        </header>
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10">
          <p className="font-[family-name:var(--font-relax-display,inherit)] text-center text-[11px] font-bold uppercase tracking-[0.22em] text-teal-200/80">
            Choose your environment
          </p>
          <h2 className="mt-3 text-center text-3xl font-black tracking-tight text-white">
            Set the atmosphere
          </h2>
          <p className="mt-2 max-w-xs text-center text-sm text-white/60">
            Sound starts softly. Then we breathe together.
          </p>
          <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2.5">
            {BREATH_ATMOSPHERES.map((env) => {
              const selected = atmosphere.id === env.id;
              return (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setAtmosphere(env)}
                  className={`rounded-2xl px-2 py-4 text-center transition ${
                    selected
                      ? "bg-white text-teal-950 shadow-lg shadow-teal-950/30"
                      : "bg-white/10 text-white ring-1 ring-white/10"
                  }`}
                >
                  <span className="text-2xl">{env.emoji}</span>
                  <span className="mt-1.5 block text-[11px] font-bold">{env.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => void beginSession(atmosphere)}
            className="mt-10 h-14 w-full max-w-sm rounded-full bg-teal-300 text-base font-black text-teal-950 shadow-[0_16px_40px_-18px_rgba(45,212,191,0.8)]"
          >
            Begin · {atmosphere.emoji} {atmosphere.label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col text-emerald-50">
      <BreathAmbientBackdrop backdrop={atmosphere.backdrop} active={running} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />

      <header className="relative z-10 flex items-center justify-between gap-2 px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold"
        >
          Close
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            {title}
          </p>
          <p className="text-xs font-semibold text-teal-100/80">Today’s Goal · {minutes} Minutes</p>
        </div>
        <span className="w-14" />
      </header>

      <div className="relative z-10 mx-8 mt-2 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-4 pt-2">
        <p className="mb-6 text-4xl font-black tabular-nums tracking-tight text-white/90">
          {mm}:{ss}
        </p>

        <div
          className={`relative flex items-center justify-center transition-transform duration-[1100ms] ease-in-out ${
            shape === "square" ? "h-56 w-56" : "h-60 w-60"
          }`}
          style={{ transform: `scale(${running && secondsLeft > 0 ? scale : 1})` }}
        >
          <div
            className={`absolute inset-0 ${
              shape === "square" ? "rounded-[1.75rem]" : "rounded-full"
            } bg-gradient-to-br from-white/25 via-teal-300/20 to-cyan-400/10 shadow-[0_0_80px_-16px_rgba(45,212,191,0.55)] ring-1 ring-white/20`}
          />
          {shape === "waves" ? <div className="breath-ring absolute inset-3 rounded-full border border-sky-200/30" /> : null}
          {shape === "stars" ? <div className="absolute -right-2 -top-2 text-2xl opacity-80">🌙</div> : null}
          <div
            className={`relative z-10 flex h-[70%] w-[70%] flex-col items-center justify-center ${
              shape === "square" ? "rounded-2xl" : "rounded-full"
            } bg-black/45 backdrop-blur-md`}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-100/80">
              {label}
            </p>
            {secondsLeft > 0 ? (
              <p className="mt-1 text-5xl font-black tabular-nums text-white">{Math.max(phaseLeft, 1)}</p>
            ) : (
              <p className="mt-1 text-3xl font-black text-teal-200">✓</p>
            )}
          </div>
        </div>

        <p className="mt-7 max-w-sm text-center text-base font-medium leading-relaxed text-white/85">
          {hint}
        </p>

        <div className="mx-auto mt-6 h-px w-40 bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="mt-5 flex items-center gap-2 text-sm text-white/70">
          <span>{atmosphere.emoji}</span>
          <span className="font-semibold">{atmosphere.label}</span>
        </div>

        <div className="mt-4 flex w-full max-w-sm items-center gap-3">
          <Volume2 className="h-4 w-4 text-white/60" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onInput={(e) => setVolume(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-8 w-full flex-1 accent-teal-300"
            aria-label="Volume"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {canWellnessSpeak() ? (
            <button
              type="button"
              onClick={() => {
                if (voiceOn) stopWellnessSpeak();
                setVoiceOn((v) => !v);
              }}
              className={`rounded-full px-3.5 py-2 text-xs font-bold ${
                voiceOn ? "bg-teal-300 text-teal-950" : "bg-white/10 text-white/60"
              }`}
            >
              Voice {voiceOn ? "On" : "Off"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const next = !musicOn;
              setMusicOn(next);
              if (!next) wellnessAmbient.setMasterVolume(0.0001);
              else {
                void wellnessAmbient.playTrack(atmosphere.trackId, { volume, loop: true }).catch(() => {});
              }
            }}
            className={`rounded-full px-3.5 py-2 text-xs font-bold ${
              musicOn ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
            }`}
          >
            Music {musicOn ? "On" : "Off"}
          </button>
          {secondsLeft > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (running) stopWellnessSpeak();
                setRunning((r) => !r);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold"
            >
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pause" : "Resume"}
            </button>
          ) : null}
        </div>

        {secondsLeft > 0 ? (
          <p className="mt-6 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
            Next · {breathPhaseLabel(nextPhase)}
          </p>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 rounded-full bg-teal-300 px-6 py-2.5 text-sm font-black text-teal-950"
          >
            Nice work
          </button>
        )}
      </div>

      <div className="relative z-10 px-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-teal-300/90 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      <style>{`
        .breath-ring { animation: breathRing 6s ease-in-out infinite; }
        @keyframes breathRing {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.06); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
