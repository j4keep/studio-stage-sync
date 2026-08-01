import { useEffect, useMemo, useState } from "react";
import {
  Pause,
  Play,
  Repeat,
  Timer,
  Volume2,
  X,
  Sparkles,
} from "lucide-react";
import AmbientSceneVisual from "@/components/wellness/AmbientSceneVisual";
import {
  AMBIENT_MIX_LAYERS,
  getAmbientTrack,
  type AmbientTrack,
} from "@/lib/wellness-ambient-catalog";
import { wellnessAmbient } from "@/lib/wellness-ambient-engine";
import { synthesizeYajVoice, playYajAudio, stopYajAudio, unlockYajAudio } from "@/lib/yaj-media";
import { getYajAiVoice } from "@/lib/yaj-ai-prefs";
import { toast } from "sonner";

const TIMER_OPTS = [15, 30, 45, 60];

type Props = {
  track: AmbientTrack;
  onClose: () => void;
  onPlayingChange?: (playing: boolean) => void;
};

/**
 * Calm / Spotify-style full-screen ambient player with mix + fade timer + optional YAJ voice.
 */
export default function AmbientSoundPlayer({ track, onClose, onPlayingChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => wellnessAmbient.getMasterVolume() || 0.45);
  const [loop, setLoop] = useState(true);
  const [timerMin, setTimerMin] = useState(30);
  const [timerOn, setTimerOn] = useState(false);
  const [mixOpen, setMixOpen] = useState(false);
  const [mix, setMix] = useState<Record<string, number>>({ [track.id]: 1 });
  const [voiceOn, setVoiceOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const mixIds = useMemo(() => {
    const base = new Set<string>([track.id, ...(track.mixWith || [])]);
    AMBIENT_MIX_LAYERS.forEach((l) => {
      if (getAmbientTrack(l.id)) base.add(l.id);
    });
    return [...base];
  }, [track]);

  useEffect(() => {
    setMix({ [track.id]: 1 });
    void start(track.id);
    return () => {
      stopYajAudio();
      void wellnessAmbient.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const applyVolume = (v: number) => {
    const next = Math.max(0, Math.min(1, v));
    setVolume(next);
    unlockYajAudio();
    wellnessAmbient.setMasterVolume(next);
  };

  const start = async (id: string) => {
    setBusy(true);
    try {
      unlockYajAudio();
      await wellnessAmbient.playTrack(id, { volume, loop });
      // Re-apply in case iOS created the graph after play
      wellnessAmbient.setMasterVolume(volume);
      setPlaying(true);
      setMix({ [id]: 1 });
      if (timerOn) armTimer();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t start sound");
      setPlaying(false);
    } finally {
      setBusy(false);
    }
  };

  const togglePlay = async () => {
    if (playing) {
      await wellnessAmbient.fadeOutStop(800);
      setPlaying(false);
      return;
    }
    await applyMix(mix);
  };

  const applyMix = async (next: Record<string, number>) => {
    setBusy(true);
    try {
      unlockYajAudio();
      wellnessAmbient.setMasterVolume(volume);
      wellnessAmbient.setLoop(loop);
      const hasLayers = Object.values(next).some((g) => g > 0.01);
      if (!hasLayers) {
        await start(track.id);
        return;
      }
      if (!wellnessAmbient.isPlaying()) {
        await wellnessAmbient.playTrack(track.id, { volume, loop });
      }
      await wellnessAmbient.setMix(next);
      wellnessAmbient.setMasterVolume(volume);
      setPlaying(true);
      if (timerOn) armTimer();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t update mix");
    } finally {
      setBusy(false);
    }
  };

  const armTimer = () => {
    setTimerOn(true);
    wellnessAmbient.setTimerMinutes(timerMin, () => {
      setPlaying(false);
      setTimerOn(false);
      toast.message("Sleep timer finished — sweet dreams");
    });
  };

  const speakGuide = async () => {
    setVoiceOn(true);
    try {
      unlockYajAudio();
      const line =
        "Close your eyes. Take a slow breath in… and let it go. Soften your shoulders. I’m here with you — rest easy.";
      const src = await synthesizeYajVoice(line, getYajAiVoice());
      playYajAudio(src, () => setVoiceOn(false));
    } catch {
      setVoiceOn(false);
      toast.error("Voice guide unavailable right now");
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black text-white">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${track.art}`} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            void wellnessAmbient.fadeOutStop(600);
            onClose();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          aria-label="Close player"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
          YAJ Sleep Player
        </p>
        <button
          type="button"
          onClick={() => setMixOpen((v) => !v)}
          className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-bold"
        >
          Mix
        </button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-4">
        <div className="mb-8 flex h-56 w-56 items-center justify-center rounded-[2rem] bg-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/20 backdrop-blur-md">
          <AmbientSceneVisual track={track} playing={playing} volume={volume} />
        </div>
        <h1 className="text-center text-3xl font-black tracking-tight">{track.title}</h1>
        <p className="mt-2 text-center text-sm text-white/70">
          {track.durationLabel} · {track.blurb}
        </p>

        <div className="mt-8 flex w-full max-w-sm items-center gap-3">
          <Volume2 className="h-4 w-4 shrink-0 text-white/70" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onInput={(e) => applyVolume(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => applyVolume(Number(e.target.value))}
            className="h-8 w-full flex-1 cursor-pointer appearance-none bg-transparent accent-white [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/25 [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            aria-label="Volume"
          />
          <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-white/70">
            {Math.round(volume * 100)}
          </span>
        </div>

        <div className="mt-8 flex items-center gap-5">
          <button
            type="button"
            onClick={() => {
              const next = !loop;
              setLoop(next);
              wellnessAmbient.setLoop(next);
            }}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              loop ? "bg-white text-black" : "bg-white/15 text-white"
            }`}
            aria-label="Loop"
          >
            <Repeat className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void togglePlay()}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black shadow-lg disabled:opacity-60"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-8 w-8 fill-current" /> : <Play className="ml-1 h-8 w-8 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => void speakGuide()}
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              voiceOn ? "bg-sky-400 text-slate-950" : "bg-white/15 text-white"
            }`}
            aria-label="YAJ voice guide"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-white/80">
            <Timer className="h-3.5 w-3.5" />
            Fade out timer
          </div>
          <div className="flex flex-wrap gap-2">
            {TIMER_OPTS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setTimerMin(m);
                  setTimerOn(true);
                  wellnessAmbient.setTimerMinutes(m, () => {
                    setPlaying(false);
                    setTimerOn(false);
                    toast.message("Sleep timer finished — sweet dreams");
                  });
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  timerOn && timerMin === m ? "bg-white text-black" : "bg-white/10"
                }`}
              >
                {m} min
              </button>
            ))}
            {timerOn ? (
              <button
                type="button"
                onClick={() => {
                  setTimerOn(false);
                  wellnessAmbient.clearTimer();
                }}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {mixOpen ? (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold text-white/80">Custom mix</p>
            {mixIds.map((id) => {
              const t = getAmbientTrack(id);
              if (!t) return null;
              const g = mix[id] ?? 0;
              return (
                <label key={id} className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 truncate font-semibold">{t.title}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={g}
                    onInput={(e) => {
                      const next = { ...mix, [id]: Number((e.target as HTMLInputElement).value) };
                      setMix(next);
                      void applyMix(next);
                    }}
                    onChange={(e) => {
                      const next = { ...mix, [id]: Number(e.target.value) };
                      setMix(next);
                      void applyMix(next);
                    }}
                    className="h-7 flex-1 accent-white"
                  />
                  <span className="w-8 text-right text-white/60">{Math.round(g * 100)}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
