import { useMemo } from "react";
import type { BreathAtmosphere } from "@/lib/wellness-relax";

type Props = {
  backdrop: BreathAtmosphere["backdrop"];
  active?: boolean;
};

/** Slow, non-distracting full-screen ambience behind breathing. */
export default function BreathAmbientBackdrop({ backdrop, active = true }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 47) % 100}%`,
        top: `${(i * 29) % 100}%`,
        size: 1 + (i % 3),
        delay: `${(i % 12) * 0.35}s`,
        dur: `${3.5 + (i % 5) * 0.7}s`,
      })),
    [],
  );

  const drops = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: `${(i * 41) % 100}%`,
        delay: `${(i * 0.19) % 2}s`,
        dur: `${1.4 + (i % 4) * 0.35}s`,
        h: 14 + (i % 5) * 4,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-active={active ? "1" : "0"}>
      {backdrop === "rain" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a24] via-[#0d2430] to-[#071018]" />
          {drops.map((d, i) => (
            <span
              key={i}
              className="bab-drop"
              style={{
                left: d.left,
                height: d.h,
                animationDelay: d.delay,
                animationDuration: d.dur,
                animationPlayState: active ? "running" : "paused",
              }}
            />
          ))}
        </>
      )}

      {backdrop === "ocean" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#06263f] via-[#0a3d5c] to-[#031826]" />
          <div className="bab-wave bab-wave-a" />
          <div className="bab-wave bab-wave-b" />
          <div className="bab-wave bab-wave-c" />
        </>
      )}

      {backdrop === "fireplace" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#2a140c] via-[#1a0e0a] to-[#0a0605]" />
          <div className="bab-glow-fire" />
          <div className="bab-ember" style={{ left: "42%" }} />
          <div className="bab-ember" style={{ left: "50%", animationDelay: "0.6s" }} />
          <div className="bab-ember" style={{ left: "58%", animationDelay: "1.1s" }} />
        </>
      )}

      {backdrop === "forest" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c2418] via-[#123524] to-[#07140e]" />
          <div className="bab-leaf" style={{ left: "12%", top: "18%" }} />
          <div className="bab-leaf" style={{ left: "78%", top: "28%", animationDelay: "1.2s" }} />
          <div className="bab-leaf" style={{ left: "55%", top: "12%", animationDelay: "2s" }} />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
        </>
      )}

      {backdrop === "stars" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#120c28] via-[#1a1340] to-[#07050f]" />
          <div className="bab-moon" />
          {stars.map((s, i) => (
            <span
              key={i}
              className="bab-star"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                animationDelay: s.delay,
                animationDuration: s.dur,
              }}
            />
          ))}
        </>
      )}

      {backdrop === "clouds" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#1c2a3a] via-[#243548] to-[#101820]" />
          <div className="bab-cloud bab-cloud-a" />
          <div className="bab-cloud bab-cloud-b" />
          <div className="bab-cloud bab-cloud-c" />
        </>
      )}

      {backdrop === "aurora" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#071820] via-[#0a2430] to-[#040c12]" />
          <div className="bab-aurora" />
        </>
      )}

      {backdrop === "sunrise" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#3a2a28] via-[#6b4a3a] to-[#1a1418]" />
          <div className="bab-sun" />
        </>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,0.06),transparent_55%)]" />
      <style>{css}</style>
    </div>
  );
}

const css = `
  .bab-drop {
    position: absolute; top: -20px; width: 1.5px;
    background: linear-gradient(to bottom, transparent, rgba(186,230,253,0.55));
    border-radius: 999px; opacity: 0.45;
    animation: babRain linear infinite;
  }
  @keyframes babRain {
    0% { transform: translateY(0); opacity: 0; }
    15% { opacity: 0.5; }
    100% { transform: translateY(110vh); opacity: 0; }
  }
  .bab-wave {
    position: absolute; left: -20%; right: -20%; height: 42%;
    border-radius: 50%; opacity: 0.22;
    animation: babWave 14s ease-in-out infinite;
  }
  .bab-wave-a { bottom: -8%; background: #38bdf8; animation-duration: 16s; }
  .bab-wave-b { bottom: -14%; background: #0ea5e9; opacity: 0.16; animation-duration: 20s; animation-delay: -4s; }
  .bab-wave-c { bottom: -20%; background: #67e8f9; opacity: 0.12; animation-duration: 24s; animation-delay: -8s; }
  @keyframes babWave {
    0%, 100% { transform: translateX(0) translateY(0); }
    50% { transform: translateX(4%) translateY(-3%); }
  }
  .bab-glow-fire {
    position: absolute; left: 50%; bottom: 8%; width: 55%; height: 35%;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at center, rgba(251,146,60,0.35), transparent 70%);
    animation: babPulse 3.5s ease-in-out infinite;
  }
  .bab-ember {
    position: absolute; bottom: 18%; width: 4px; height: 4px; border-radius: 999px;
    background: #fdba74; opacity: 0.7;
    animation: babRise 3.8s ease-in infinite;
  }
  @keyframes babRise {
    0% { transform: translateY(0) scale(1); opacity: 0.7; }
    100% { transform: translateY(-45vh) scale(0.3); opacity: 0; }
  }
  .bab-leaf {
    position: absolute; width: 18px; height: 10px; border-radius: 0 70% 0 70%;
    background: rgba(74,222,128,0.35);
    animation: babDrift 11s ease-in-out infinite;
  }
  @keyframes babDrift {
    0%, 100% { transform: translate(0,0) rotate(0deg); }
    50% { transform: translate(18px, 14px) rotate(18deg); }
  }
  .bab-moon {
    position: absolute; top: 12%; right: 16%; width: 56px; height: 56px; border-radius: 999px;
    background: radial-gradient(circle at 35% 35%, #f5f3ff, #c4b5fd 60%, #7c3aed 120%);
    box-shadow: 0 0 40px rgba(196,181,253,0.35);
    opacity: 0.85;
  }
  .bab-star {
    position: absolute; border-radius: 999px; background: white;
    animation: babTwinkle ease-in-out infinite;
  }
  @keyframes babTwinkle {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.9; }
  }
  .bab-cloud {
    position: absolute; height: 70px; border-radius: 999px;
    background: rgba(226,232,240,0.08); filter: blur(2px);
    animation: babCloud 28s linear infinite;
  }
  .bab-cloud-a { top: 18%; width: 180px; left: -20%; }
  .bab-cloud-b { top: 36%; width: 240px; left: -30%; animation-duration: 36s; opacity: 0.7; }
  .bab-cloud-c { top: 52%; width: 160px; left: -15%; animation-duration: 42s; opacity: 0.5; }
  @keyframes babCloud {
    0% { transform: translateX(0); }
    100% { transform: translateX(140vw); }
  }
  .bab-aurora {
    position: absolute; inset: -20% -10% 30%;
    background:
      radial-gradient(ellipse at 30% 40%, rgba(52,211,153,0.28), transparent 50%),
      radial-gradient(ellipse at 70% 30%, rgba(56,189,248,0.22), transparent 45%),
      radial-gradient(ellipse at 50% 60%, rgba(167,139,250,0.18), transparent 50%);
    animation: babAurora 18s ease-in-out infinite;
  }
  @keyframes babAurora {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.85; }
    50% { transform: translateY(4%) scale(1.05); opacity: 1; }
  }
  .bab-sun {
    position: absolute; left: 50%; bottom: 22%; width: 120px; height: 120px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: radial-gradient(circle, rgba(253,186,116,0.7), rgba(251,113,133,0.15) 55%, transparent 70%);
    animation: babPulse 8s ease-in-out infinite;
  }
  @keyframes babPulse {
    0%, 100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
    50% { opacity: 1; transform: translateX(-50%) scale(1.06); }
  }
`;
