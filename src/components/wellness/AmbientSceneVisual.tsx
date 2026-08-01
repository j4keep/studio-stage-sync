import { useMemo } from "react";
import {
  visualForTrack,
  type AmbientTrack,
  type AmbientVisualKind,
} from "@/lib/wellness-ambient-catalog";

type Props = {
  track: AmbientTrack;
  playing: boolean;
  /** 0–1 master volume — denser / faster motion when louder */
  volume?: number;
  className?: string;
};

/**
 * Animated circular scene for the Sleep Player artwork.
 * Motion intensity scales with play state + volume.
 */
export default function AmbientSceneVisual({
  track,
  playing,
  volume = 0.45,
  className = "",
}: Props) {
  const kind = visualForTrack(track);
  const intensity = playing ? 0.45 + volume * 0.55 : 0.15;

  return (
    <div
      className={`relative h-40 w-40 overflow-hidden rounded-full shadow-inner ring-1 ring-white/15 ${className}`}
      style={{ ["--amb-speed" as string]: `${Math.max(0.35, 1.35 - intensity)}s` }}
      data-playing={playing ? "1" : "0"}
      data-kind={kind}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${track.art}`} />
      <Scene kind={kind} playing={playing} intensity={intensity} />
      <style>{sceneCss()}</style>
    </div>
  );
}

function Scene({
  kind,
  playing,
  intensity,
}: {
  kind: AmbientVisualKind;
  playing: boolean;
  intensity: number;
}) {
  const drops = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i * 0.13) % 1.8}s`,
        dur: `${0.55 + (i % 5) * 0.18}s`,
        h: 10 + (i % 6) * 3,
        op: 0.35 + (i % 4) * 0.12,
      })),
    [],
  );

  const embers = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${20 + (i * 17) % 60}%`,
        delay: `${(i * 0.2) % 2}s`,
        dur: `${1.4 + (i % 4) * 0.35}s`,
        size: 2 + (i % 3),
      })),
    [],
  );

  const birds = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        top: `${18 + (i * 11) % 50}%`,
        delay: `${(i * 0.7) % 3}s`,
        dur: `${4 + (i % 3)}s`,
      })),
    [],
  );

  if (kind === "rain" || kind === "thunder") {
    return (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,160,220,0.25),transparent_55%)]" />
        {drops.map((d, i) => (
          <span
            key={i}
            className="amb-drop"
            style={{
              left: d.left,
              animationDelay: d.delay,
              animationDuration: playing ? d.dur : "3s",
              height: d.h,
              opacity: playing ? d.op * intensity : d.op * 0.25,
              animationPlayState: playing ? "running" : "paused",
            }}
          />
        ))}
        {kind === "thunder" ? (
          <div
            className="amb-flash"
            style={{ animationPlayState: playing ? "running" : "paused", opacity: intensity }}
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sky-950/50 to-transparent" />
      </>
    );
  }

  if (kind === "ocean") {
    return (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(56,189,248,0.35),transparent_55%)]" />
        <div className="amb-wave amb-wave-a" style={{ animationPlayState: playing ? "running" : "paused", opacity: 0.55 * intensity + 0.2 }} />
        <div className="amb-wave amb-wave-b" style={{ animationPlayState: playing ? "running" : "paused", opacity: 0.4 * intensity + 0.15 }} />
        <div className="amb-wave amb-wave-c" style={{ animationPlayState: playing ? "running" : "paused", opacity: 0.3 * intensity + 0.1 }} />
      </>
    );
  }

  if (kind === "fire") {
    return (
      <>
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_bottom,rgba(251,146,60,0.55),transparent_70%)]" />
        <div className="amb-flame" style={{ animationPlayState: playing ? "running" : "paused", opacity: intensity }} />
        {embers.map((e, i) => (
          <span
            key={i}
            className="amb-ember"
            style={{
              left: e.left,
              width: e.size,
              height: e.size,
              animationDelay: e.delay,
              animationDuration: e.dur,
              animationPlayState: playing ? "running" : "paused",
              opacity: intensity,
            }}
          />
        ))}
      </>
    );
  }

  if (kind === "birds" || kind === "forest") {
    return (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(167,243,208,0.2),transparent_50%)]" />
        {birds.map((b, i) => (
          <span
            key={i}
            className="amb-bird"
            style={{
              top: b.top,
              animationDelay: b.delay,
              animationDuration: b.dur,
              animationPlayState: playing ? "running" : "paused",
              opacity: 0.55 * intensity + 0.15,
            }}
          />
        ))}
        <div className="amb-leaf" style={{ animationPlayState: playing ? "running" : "paused" }} />
      </>
    );
  }

  if (kind === "wind") {
    return (
      <>
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="amb-gust"
            style={{
              top: `${12 + i * 12}%`,
              animationDelay: `${i * 0.25}s`,
              animationDuration: `${1.8 + (i % 3) * 0.4}s`,
              animationPlayState: playing ? "running" : "paused",
              opacity: 0.25 + intensity * 0.45,
            }}
          />
        ))}
      </>
    );
  }

  if (kind === "river") {
    return (
      <>
        <div className="amb-flow amb-flow-a" style={{ animationPlayState: playing ? "running" : "paused", opacity: intensity }} />
        <div className="amb-flow amb-flow-b" style={{ animationPlayState: playing ? "running" : "paused", opacity: intensity * 0.8 }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(34,211,238,0.25),transparent_55%)]" />
      </>
    );
  }

  if (kind === "fan" || kind === "noise") {
    return (
      <>
        <div
          className="amb-grain"
          style={{
            animationPlayState: playing ? "running" : "paused",
            opacity: 0.2 + intensity * 0.45,
          }}
        />
        <div
          className="amb-ring"
          style={{
            animationDuration: kind === "fan" ? "2.2s" : "4s",
            animationPlayState: playing ? "running" : "paused",
            opacity: intensity,
          }}
        />
      </>
    );
  }

  if (kind === "keys") {
    return (
      <>
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="amb-key"
            style={{
              left: `${10 + i * 8}%`,
              animationDelay: `${(i * 0.18) % 1.4}s`,
              animationPlayState: playing ? "running" : "paused",
              opacity: intensity,
            }}
          />
        ))}
      </>
    );
  }

  if (kind === "city") {
    return (
      <>
        <div className="amb-city" style={{ animationPlayState: playing ? "running" : "paused", opacity: intensity }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="amb-dot"
            style={{
              left: `${12 + i * 10}%`,
              bottom: `${10 + (i % 4) * 12}%`,
              animationDelay: `${i * 0.3}s`,
              animationPlayState: playing ? "running" : "paused",
            }}
          />
        ))}
      </>
    );
  }

  // pulse / default
  return (
    <>
      <div
        className="amb-pulse"
        style={{
          animationPlayState: playing ? "running" : "paused",
          opacity: 0.35 + intensity * 0.4,
        }}
      />
      <div
        className="amb-pulse amb-pulse-2"
        style={{
          animationPlayState: playing ? "running" : "paused",
          opacity: 0.25 + intensity * 0.3,
        }}
      />
    </>
  );
}

function sceneCss() {
  return `
    .amb-drop {
      position: absolute;
      top: -12%;
      width: 1.5px;
      border-radius: 999px;
      background: linear-gradient(to bottom, transparent, rgba(186,230,253,0.95));
      animation-name: amb-fall;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
    @keyframes amb-fall {
      0% { transform: translateY(0) translateX(0); }
      100% { transform: translateY(170%) translateX(-6px); }
    }
    .amb-flash {
      position: absolute; inset: 0;
      background: rgba(224,242,254,0.55);
      animation: amb-flash 4.5s ease-in-out infinite;
    }
    @keyframes amb-flash {
      0%, 88%, 100% { opacity: 0; }
      90% { opacity: 0.75; }
      92% { opacity: 0.1; }
      94% { opacity: 0.55; }
    }
    .amb-wave {
      position: absolute; left: -20%; right: -20%; height: 40%;
      border-radius: 50%;
      border: 2px solid rgba(125,211,252,0.45);
      animation: amb-wave 3.2s ease-in-out infinite;
    }
    .amb-wave-a { bottom: 8%; animation-duration: 3.2s; }
    .amb-wave-b { bottom: 0%; animation-duration: 4s; animation-delay: -1s; }
    .amb-wave-c { bottom: -10%; animation-duration: 5s; animation-delay: -2s; }
    @keyframes amb-wave {
      0%,100% { transform: translateY(0) scaleX(1); }
      50% { transform: translateY(-10px) scaleX(1.08); }
    }
    .amb-flame {
      position: absolute; left: 50%; bottom: 12%; width: 46%; height: 55%;
      transform: translateX(-50%);
      background: radial-gradient(ellipse at bottom, #fdba74 0%, #f97316 35%, transparent 70%);
      filter: blur(1px);
      animation: amb-flame 0.7s ease-in-out infinite alternate;
    }
    @keyframes amb-flame {
      from { transform: translateX(-50%) scaleY(0.92) scaleX(1.05); }
      to { transform: translateX(-50%) scaleY(1.08) scaleX(0.95); }
    }
    .amb-ember {
      position: absolute; bottom: 18%;
      border-radius: 999px;
      background: #fdba74;
      box-shadow: 0 0 6px #f97316;
      animation: amb-ember 2s ease-out infinite;
    }
    @keyframes amb-ember {
      0% { transform: translateY(0) scale(1); opacity: 0.9; }
      100% { transform: translateY(-90px) translateX(10px) scale(0.3); opacity: 0; }
    }
    .amb-bird {
      position: absolute; left: -10%;
      width: 10px; height: 4px;
      border-radius: 50%;
      background: rgba(236,253,245,0.75);
      animation: amb-bird 5s linear infinite;
    }
    @keyframes amb-bird {
      0% { transform: translateX(0) translateY(0); }
      50% { transform: translateX(90px) translateY(-8px); }
      100% { transform: translateX(170px) translateY(4px); }
    }
    .amb-leaf {
      position: absolute; left: 20%; top: 30%;
      width: 10px; height: 10px;
      border-radius: 0 70% 0 70%;
      background: rgba(167,243,208,0.55);
      animation: amb-leaf 6s ease-in-out infinite;
    }
    @keyframes amb-leaf {
      0%,100% { transform: translate(0,0) rotate(0deg); }
      50% { transform: translate(40px, 30px) rotate(40deg); }
    }
    .amb-gust {
      position: absolute; left: -30%;
      width: 55%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
      animation: amb-gust 2s linear infinite;
    }
    @keyframes amb-gust {
      from { transform: translateX(0); }
      to { transform: translateX(160%); }
    }
    .amb-flow {
      position: absolute; inset: -10%;
      background: repeating-linear-gradient(
        115deg,
        transparent 0 12px,
        rgba(165,243,252,0.12) 12px 14px
      );
      animation: amb-flow 2.4s linear infinite;
    }
    .amb-flow-b { animation-duration: 3.4s; opacity: 0.7; }
    @keyframes amb-flow {
      from { transform: translateX(0); }
      to { transform: translateX(-28px); }
    }
    .amb-grain {
      position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.35) 0.6px, transparent 0.7px);
      background-size: 4px 4px;
      animation: amb-grain 0.35s steps(2) infinite;
    }
    @keyframes amb-grain {
      from { transform: translate(0,0); }
      to { transform: translate(-2px, 2px); }
    }
    .amb-ring {
      position: absolute; left: 50%; top: 50%;
      width: 55%; height: 55%;
      margin: -27.5% 0 0 -27.5%;
      border-radius: 999px;
      border: 2px solid rgba(255,255,255,0.35);
      animation: amb-ring 2.2s ease-in-out infinite;
    }
    @keyframes amb-ring {
      0%,100% { transform: scale(0.85); opacity: 0.3; }
      50% { transform: scale(1.15); opacity: 0.8; }
    }
    .amb-key {
      position: absolute; bottom: 28%;
      width: 5px; height: 10px;
      border-radius: 2px;
      background: rgba(255,255,255,0.55);
      animation: amb-key 1.2s ease-in-out infinite;
    }
    @keyframes amb-key {
      0%,100% { transform: translateY(0); opacity: 0.35; }
      40% { transform: translateY(-8px); opacity: 0.95; }
    }
    .amb-city {
      position: absolute; inset-x: 10%; bottom: 18%; height: 40%;
      background: linear-gradient(to top, rgba(255,255,255,0.2), transparent);
      clip-path: polygon(0 100%, 8% 40%, 18% 70%, 30% 20%, 42% 55%, 55% 15%, 68% 50%, 80% 25%, 92% 60%, 100% 100%);
      animation: amb-city 3s ease-in-out infinite;
    }
    @keyframes amb-city {
      0%,100% { filter: brightness(0.9); }
      50% { filter: brightness(1.2); }
    }
    .amb-dot {
      position: absolute; width: 3px; height: 3px; border-radius: 999px;
      background: #fde68a;
      animation: amb-dot 2s ease-in-out infinite;
    }
    @keyframes amb-dot {
      0%,100% { opacity: 0.2; }
      50% { opacity: 1; }
    }
    .amb-pulse {
      position: absolute; left: 50%; top: 50%;
      width: 48%; height: 48%;
      margin: -24% 0 0 -24%;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%);
      animation: amb-pulse 2.8s ease-in-out infinite;
    }
    .amb-pulse-2 { width: 70%; height: 70%; margin: -35% 0 0 -35%; animation-delay: -1s; }
    @keyframes amb-pulse {
      0%,100% { transform: scale(0.85); opacity: 0.35; }
      50% { transform: scale(1.15); opacity: 0.85; }
    }
  `;
}
