import { useEffect, useMemo, useState } from "react";
import { Bot, Music2, Play, Settings2, Sparkles, Trophy, Volume2, VolumeX, X } from "lucide-react";
import GameQuickActions, { GameMatchup, GameRecordStats } from "@/components/games/GameQuickActions";
import { CANDY_SPRITES, sugarRushBg } from "@/components/games/sugar-rush/SugarRushBoard";
import { sugarRushSfx } from "@/lib/sugar-rush-sfx";

type Player = { name: string; avatarUrl?: string | null; isComputer?: boolean };

type Props = {
  open: boolean;
  subtitle: string;
  onStart: () => void;
  onBack: () => void;
  me: Player;
  them: Player;
  stats?: GameRecordStats | null;
  matchups?: GameMatchup[];
  onPlaySolo?: () => void;
  onQuickMatch?: () => void;
};

function Face({ p }: { p: Player }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/20 bg-black/25 px-2.5 py-2 backdrop-blur-md">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80 bg-fuchsia-950 shadow-[0_0_20px_rgba(255,90,220,.45)]">
        {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" /> : p.isComputer ? <Bot className="h-5 w-5 text-white" /> : <span className="font-black text-white">{p.name.slice(0,1).toUpperCase()}</span>}
      </div>
      <div className="min-w-0 text-left">
        <p className="truncate text-[11px] font-black text-white">{p.name}</p>
        <p className="text-[9px] font-bold uppercase tracking-[.12em] text-white/55">{p.isComputer ? "Computer" : "Player"}</p>
      </div>
    </div>
  );
}

export default function SugarRushIntro({ open, subtitle, onStart, onBack, me, them, stats, matchups, onPlaySolo, onQuickMatch }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(sugarRushSfx.muted);
  const [musicVolume, setMusicVolume] = useState(sugarRushSfx.musicVolume);
  const [sfxVolume, setSfxVolume] = useState(sugarRushSfx.sfxVolume);

  const floaters = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i,
    sprite: CANDY_SPRITES[i % CANDY_SPRITES.length],
    left: `${(i * 37) % 94 + 1}%`,
    delay: `${-(i * 0.73)}s`,
    duration: `${7.5 + (i % 5) * 1.1}s`,
    size: `${28 + (i % 4) * 9}px`,
    drift: `${(i % 2 ? 1 : -1) * (12 + (i % 3) * 8)}px`,
  })), []);

  useEffect(() => {
    if (!open) {
      sugarRushSfx.stopMusic();
      return;
    }
    // Desktop often permits this immediately; iOS will begin on the first touch below.
    void sugarRushSfx.startMusic();
    return () => sugarRushSfx.stopMusic();
  }, [open]);

  if (!open) return null;

  const unlockAudio = () => {
    void sugarRushSfx.prime().then(() => sugarRushSfx.startMusic());
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sugarRushSfx.setMuted(next);
    if (!next) void sugarRushSfx.startMusic();
  };

  return (
    <>

      <style>{`
@keyframes sugarFloatIntro{0%{transform:translate3d(0,112vh,0) rotate(-8deg) scale(.82);opacity:0}10%{opacity:.9}50%{transform:translate3d(var(--sugar-drift,18px),45vh,0) rotate(10deg) scale(1.05)}90%{opacity:.88}100%{transform:translate3d(calc(var(--sugar-drift,18px)*-.6),-18vh,0) rotate(-8deg) scale(.88);opacity:0}}
@keyframes sugarIntroBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes sugarIntroSpark{0%,100%{transform:scale(.8) rotate(-10deg);opacity:.55}50%{transform:scale(1.22) rotate(12deg);opacity:1}}
@keyframes sugarIntroSky{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes sugarIntroGlow{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(18px,-24px,0) scale(1.16)}}
@keyframes sugarIntroPlay{0%,100%{box-shadow:0 12px 35px rgba(224,55,190,.48),inset 0 2px 0 rgba(255,255,255,.55)}50%{box-shadow:0 14px 48px rgba(255,91,210,.76),0 0 0 7px rgba(255,255,255,.08),inset 0 2px 0 rgba(255,255,255,.62)}}
.sugar-intro{isolation:isolate}.sugar-intro-sky{z-index:0;background:linear-gradient(125deg,rgba(255,136,226,.18),rgba(89,211,255,.12),rgba(255,213,91,.14));background-size:220% 220%;animation:sugarIntroSky 12s ease-in-out infinite;mix-blend-mode:screen}.sugar-intro-glow{position:absolute;z-index:0;width:44vw;height:44vw;max-width:310px;max-height:310px;border-radius:999px;filter:blur(45px);opacity:.28;animation:sugarIntroGlow 7s ease-in-out infinite}.sugar-intro-glow-a{left:-10%;top:18%;background:#ff6fcf}.sugar-intro-glow-b{right:-10%;bottom:12%;background:#58d7ff;animation-delay:-3s}.sugar-intro-candy{bottom:-18vh;animation-name:sugarFloatIntro;animation-timing-function:linear;animation-iteration-count:infinite}.sugar-intro-logo{animation:sugarIntroBreath 3.2s ease-in-out infinite}.sugar-intro-title{background:linear-gradient(180deg,#fff7d2 0%,#ffd06c 38%,#ff76cf 70%,#b44cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 5px 0 rgba(94,25,111,.6)) drop-shadow(0 12px 20px rgba(71,5,89,.35));letter-spacing:-.055em}.sugar-intro-spark{animation:sugarIntroSpark 1.8s ease-in-out infinite}.sugar-intro-spark-right{animation-delay:-.9s}.sugar-intro-play{animation:sugarIntroPlay 2.1s ease-in-out infinite}.sugar-volume{accent-color:#ff72d2}
`}</style>
    <div
      className="sugar-intro fixed inset-0 z-[70] overflow-hidden text-white"
      onPointerDown={unlockAudio}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(39,7,65,.08), rgba(45,4,74,.28)), url(${sugarRushBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="sugar-intro-sky absolute inset-0" />
      <div className="sugar-intro-glow sugar-intro-glow-a" />
      <div className="sugar-intro-glow sugar-intro-glow-b" />
      {floaters.map((f) => (
        <img
          key={f.id}
          src={f.sprite}
          alt=""
          className="sugar-intro-candy pointer-events-none absolute z-[1] object-contain drop-shadow-[0_8px_12px_rgba(70,0,70,.35)]"
          style={{ left: f.left, width: f.size, height: f.size, animationDelay: f.delay, animationDuration: f.duration, ["--sugar-drift" as any]: f.drift }}
          draggable={false}
        />
      ))}

      <div className="relative z-10 flex h-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="rounded-full border border-white/30 bg-white/15 p-2.5 backdrop-blur-md active:scale-95" aria-label="Leave Sugar Rush"><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="rounded-full border border-white/30 bg-white/15 p-2.5 backdrop-blur-md active:scale-95" aria-label={muted ? "Turn sound on" : "Mute"}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
            <button onClick={() => setSettingsOpen((v) => !v)} className="rounded-full border border-white/30 bg-white/15 p-2.5 backdrop-blur-md active:scale-95" aria-label="Audio settings"><Settings2 className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center pb-2 pt-2 text-center">
          <div className="sugar-intro-logo relative mb-2">
            <Sparkles className="sugar-intro-spark sugar-intro-spark-left absolute -left-7 top-3 h-7 w-7 text-yellow-200" />
            <p className="text-[13px] font-black uppercase tracking-[.32em] text-white/80">YAJ</p>
            <h1 className="sugar-intro-title text-5xl font-black leading-none sm:text-6xl">Sugar Rush</h1>
            <Sparkles className="sugar-intro-spark sugar-intro-spark-right absolute -right-7 bottom-1 h-7 w-7 text-yellow-200" />
          </div>
          <p className="max-w-xs text-[12px] font-bold text-white/85 drop-shadow">{subtitle}</p>

          <div className="mt-5 grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Face p={me} />
            <div className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black uppercase tracking-[.18em] backdrop-blur">vs</div>
            <Face p={them} />
          </div>

          <button
            type="button"
            onClick={() => { unlockAudio(); sugarRushSfx.special(); onStart(); }}
            className="sugar-intro-play mt-6 flex w-full max-w-xs items-center justify-center gap-3 rounded-full border-2 border-white/80 bg-gradient-to-b from-pink-400 via-fuchsia-500 to-purple-700 px-7 py-4 text-white shadow-[0_12px_35px_rgba(224,55,190,.55),inset_0_2px_0_rgba(255,255,255,.55)] active:scale-95"
          >
            <Play className="h-6 w-6" fill="currentColor" />
            <span className="text-xl font-black">Play</span>
          </button>

          <div className="mt-3 flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-bold text-white/75 backdrop-blur">
            <Trophy className="h-3.5 w-3.5 text-yellow-300" /> {stats?.wins ?? 0} wins
            <span className="text-white/30">•</span>
            <Music2 className="h-3.5 w-3.5 text-pink-200" /> Music stays on while you play
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <GameQuickActions stats={stats} matchups={matchups} onPlaySolo={onPlaySolo} onQuickMatch={onQuickMatch} accent="#ff78d8" />
        </div>
      </div>

      {settingsOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
          <div className="w-full max-w-xs rounded-[28px] border border-white/30 bg-[#2b1641]/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xl font-black">Sugar Rush Audio</p><p className="text-[11px] text-white/60">Set it once — we remember it.</p></div><button onClick={() => setSettingsOpen(false)} className="rounded-full bg-white/10 p-2"><X className="h-4 w-4" /></button></div>
            <label className="block text-sm font-black">Music <span className="float-right text-white/60">{Math.round(musicVolume * 100)}%</span></label>
            <input aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(e) => { const v = Number(e.target.value); setMusicVolume(v); sugarRushSfx.setMusicVolume(v); if (v > 0) void sugarRushSfx.startMusic(); }} className="sugar-volume mt-2 w-full" />
            <label className="mt-5 block text-sm font-black">Sound effects <span className="float-right text-white/60">{Math.round(sfxVolume * 100)}%</span></label>
            <input aria-label="Sound effects volume" type="range" min="0" max="1" step="0.05" value={sfxVolume} onChange={(e) => { const v = Number(e.target.value); setSfxVolume(v); sugarRushSfx.setSfxVolume(v); sugarRushSfx.swap(); }} className="sugar-volume mt-2 w-full" />
            <button onClick={toggleMute} className="mt-5 w-full rounded-full bg-white/12 px-4 py-3 text-sm font-black">{muted ? "Turn all sound on" : "Mute all sound"}</button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
