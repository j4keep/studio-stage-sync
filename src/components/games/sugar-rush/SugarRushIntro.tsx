import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Music, Play, Settings, Users, Volume2, VolumeX, X } from "lucide-react";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";
import { CANDY_SPRITES, sugarRushBg } from "./SugarRushBoard";
import "./sugar-rush.css";

type Props = {
  opponentLabel: string;
  isComputer: boolean;
  subtitle?: string;
  bestScore?: number | null;
  onPlaySolo: () => void;
  onQuickMatch?: () => void;
  onPlayLevels?: () => void;
  onBack: () => void;
};

const FLOATERS = [
  { sprite: 0, top: "10%", left: "10%", size: 56, delay: 0 },
  { sprite: 2, top: "16%", left: "78%", size: 44, delay: 0.6 },
  { sprite: 4, top: "68%", left: "8%", size: 50, delay: 1.1 },
  { sprite: 3, top: "74%", left: "82%", size: 46, delay: 0.3 },
  { sprite: 5, top: "42%", left: "88%", size: 38, delay: 0.9 },
  { sprite: 1, top: "36%", left: "4%", size: 38, delay: 1.4 },
];

const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  top: `${(i * 37) % 100}%`,
  left: `${(i * 53) % 100}%`,
  delay: (i % 7) * 0.25,
}));

/** A little candy-hungry mascot that scoots across the bottom of the intro every so often,
 *  chasing a piece of candy — purely decorative and self-drawn (no external art), a nod to
 *  the "something walks on screen and looks like it's biting candy" ask. */
function SugarRushMascot() {
  const [visible, setVisible] = useState(false);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let hideTimer: number;
    const cycle = () => {
      setRunId((n) => n + 1);
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), 6500);
    };
    const first = window.setTimeout(cycle, 2200);
    const repeat = window.setInterval(cycle, 9000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(repeat);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div key={runId} className="pointer-events-none absolute bottom-[8%] z-[5] sr-mascot-walk" style={{ width: 48, height: 48 }}>
      <div className="sr-mascot-bob relative h-full w-full">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle at 32% 28%, #ffe8a3, #ff9f4a 55%, #e0631a 100%)", boxShadow: "0 6px 10px rgba(0,0,0,.35)" }}
        />
        <span className="absolute left-[20%] top-[28%] h-[18%] w-[18%] rounded-full bg-white">
          <span className="absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        </span>
        <span className="absolute right-[20%] top-[28%] h-[18%] w-[18%] rounded-full bg-white">
          <span className="absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        </span>
        <span
          className="sr-mascot-chomp absolute bottom-[16%] left-1/2 h-[24%] w-[36%] -translate-x-1/2 rounded-b-full bg-[#7a2412]"
          style={{ transformOrigin: "top center" }}
        />
      </div>
      <span className="absolute -right-3 top-[6%] text-base">🍬</span>
    </div>
  );
}

/** Sugar Rush's own full-screen intro — visually isolated from the rest of the app (no
 *  GameShell/GameIntro chrome), with floating candy, sparkles, a glowing title, and a
 *  settings sheet for music/sfx volume. Music starts on the first tap anywhere here, since
 *  mobile Safari blocks autoplay until a real user gesture unlocks the AudioContext. */
export default function SugarRushIntro({
  opponentLabel,
  isComputer,
  subtitle,
  bestScore,
  onPlaySolo,
  onQuickMatch,
  onPlayLevels,
  onBack,
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(sugarRushSfx.muted);
  const [musicVol, setMusicVol] = useState(sugarRushSfx.musicVolume);
  const [sfxVol, setSfxVol] = useState(sugarRushSfx.sfxVolume);
  const unlockedRef = useRef(false);

  const unlockAudio = () => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    void sugarRushSfx.prime().then(() => sugarRushSfx.startMusic());
  };

  useEffect(() => {
    return () => sugarRushSfx.stopMusic();
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sugarRushSfx.setMuted(next);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(180deg, rgba(30,10,50,.04), rgba(20,8,40,.34)), url(${sugarRushBg})` }}
      onPointerDown={unlockAudio}
    >
      {/* Ambient drifting candy shapes + sparkles — purely decorative, isolated to this screen. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {FLOATERS.map((f, i) => (
          <img
            key={i}
            src={CANDY_SPRITES[f.sprite]}
            alt=""
            className="absolute sr-bob sr-drift opacity-90 drop-shadow-[0_6px_10px_rgba(0,0,0,.35)]"
            style={{ top: f.top, left: f.left, width: f.size, height: f.size, animationDelay: `${f.delay}s` }}
          />
        ))}
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-white sr-twinkle"
            style={{ top: s.top, left: s.left, animationDelay: `${s.delay}s` }}
          />
        ))}
        <SugarRushMascot />
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 pt-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button type="button" onClick={onBack} aria-label="Back" className="rounded-full bg-black/30 p-2.5 text-white active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => { unlockAudio(); setSettingsOpen(true); }}
          aria-label="Settings"
          className="rounded-full bg-black/30 p-2.5 text-white active:scale-95"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="sr-glow-title text-5xl font-black uppercase italic text-yellow-200" style={{ WebkitTextStroke: "1.5px rgba(120,40,10,.6)" }}>
          Sugar
        </p>
        <p className="sr-glow-title text-5xl font-black uppercase italic text-pink-300" style={{ WebkitTextStroke: "1.5px rgba(120,10,60,.6)" }}>
          Rush
        </p>
        <p className="mt-2 text-sm font-bold text-white/80">
          {subtitle ?? (isComputer ? "Match candy against the computer" : `Match candy against ${opponentLabel}`)}
        </p>
        {typeof bestScore === "number" && bestScore > 0 && (
          <p className="text-[11px] font-black uppercase tracking-wide text-yellow-200/90">Best score {bestScore.toLocaleString()}</p>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          onClick={() => { unlockAudio(); onPlaySolo(); }}
          className="sr-play-pulse flex h-20 w-20 items-center justify-center rounded-full text-white shadow-2xl active:scale-95"
          style={{ background: "radial-gradient(circle at 35% 30%, #ffe36a, #ff8a2e 55%, #d9450e 100%)" }}
          aria-label="Play"
        >
          <Play className="h-9 w-9 translate-x-0.5 fill-white" />
        </button>
        <p className="text-xs font-black uppercase tracking-widest text-white/90">Play</p>

        <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
          {onQuickMatch && (
            <button
              type="button"
              onClick={() => { unlockAudio(); onQuickMatch(); }}
              className="flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 py-2.5 text-xs font-black text-white active:scale-95"
            >
              <Users className="h-4 w-4" /> Challenge a Friend
            </button>
          )}
          {onPlayLevels && (
            <button
              type="button"
              onClick={() => { unlockAudio(); onPlayLevels(); }}
              className="flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/30 px-4 py-2.5 text-xs font-black text-white active:scale-95"
            >
              🍬 Level Map
            </button>
          )}
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-6" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-full max-w-xs rounded-[26px] border-4 border-white/70 p-5"
            style={{ background: "linear-gradient(165deg, #3a1f5c, #2a1447)", boxShadow: "0 18px 40px rgba(0,0,0,.55)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-black text-white">Settings</p>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleMute}
              className="mb-4 flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} Mute
              </span>
              <span className={`h-6 w-11 rounded-full p-0.5 transition ${muted ? "bg-white/20" : "bg-emerald-400"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white transition ${muted ? "translate-x-0" : "translate-x-5"}`} />
              </span>
            </button>

            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/80">
                <Music className="h-3.5 w-3.5" /> Music
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={musicVol}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMusicVol(v);
                  sugarRushSfx.setMusicVolume(v);
                }}
                className="w-full accent-pink-400"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/80">
                <Volume2 className="h-3.5 w-3.5" /> Sound Effects
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sfxVol}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSfxVol(v);
                  sugarRushSfx.setSfxVolume(v);
                  sugarRushSfx.pop(1);
                }}
                className="w-full accent-yellow-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
