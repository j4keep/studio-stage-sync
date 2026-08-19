/**
 * Illustrated football players + team mascots drawn as inline SVG groups so they
 * can live inside the field's viewBox and be positioned/animated by the parent.
 */

export type PlayerPose = "idle" | "run" | "throw" | "catch" | "tackle" | "kick" | "celebrate";

export const PLAYER_KEYFRAMES = `
  @keyframes fb-legs-a { 0%,100% { transform: rotate(26deg); } 50% { transform: rotate(-26deg); } }
  @keyframes fb-legs-b { 0%,100% { transform: rotate(-26deg); } 50% { transform: rotate(26deg); } }
  @keyframes fb-arms-a { 0%,100% { transform: rotate(-34deg); } 50% { transform: rotate(30deg); } }
  @keyframes fb-arms-b { 0%,100% { transform: rotate(30deg); } 50% { transform: rotate(-34deg); } }
  @keyframes fb-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.6px); } }
  @keyframes fb-mascot { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-5px) rotate(4deg); } }
  @keyframes fb-pom { 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(22deg); } }
  .fb-leg-a { animation: fb-legs-a 300ms linear infinite; transform-origin: center top; }
  .fb-leg-b { animation: fb-legs-b 300ms linear infinite; transform-origin: center top; }
  .fb-arm-a { animation: fb-arms-a 300ms linear infinite; transform-origin: center top; }
  .fb-arm-b { animation: fb-arms-b 300ms linear infinite; transform-origin: center top; }
  .fb-bob { animation: fb-bob 300ms linear infinite; }
  .fb-mascot { animation: fb-mascot 900ms ease-in-out infinite; transform-origin: center bottom; }
  .fb-pom { animation: fb-pom 420ms ease-in-out infinite; transform-origin: center top; }
`;

const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#f1c27d", "#5c3a21"];

/** One helmeted player. (x, y) is the point on the turf where the feet stand. */
export function Player({
  x,
  y,
  scale = 1,
  color,
  accent = "#f8fafc",
  facing = 1,
  pose = "idle",
  number = 7,
  hasBall = false,
  seed = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  color: string;
  accent?: string;
  facing?: 1 | -1;
  pose?: PlayerPose;
  number?: number;
  hasBall?: boolean;
  seed?: number;
}) {
  const running = pose === "run";
  const skin = SKINS[seed % SKINS.length];
  const lean = pose === "run" ? 8 * facing : pose === "tackle" ? 26 * facing : 0;
  const drop = pose === "tackle" ? 6 : 0;

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="1.5" rx="9" ry="3" fill="rgba(0,0,0,0.4)" />
      <g transform={`scale(${facing} 1)`}>
        <g transform={`rotate(${lean}) translate(0 ${drop})`} className={running ? "fb-bob" : undefined}>
          {/* legs */}
          <g transform="translate(-2.6 -17)">
            <rect className={running ? "fb-leg-a" : undefined} x="-2" y="0" width="4" height="17" rx="2" fill="#e9edf5" />
          </g>
          <g transform="translate(2.6 -17)">
            <rect className={running ? "fb-leg-b" : undefined} x="-2" y="0" width="4" height="17" rx="2" fill="#e9edf5" />
          </g>
          {/* torso */}
          <rect x="-6.5" y="-31" width="13" height="15" rx="4.5" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
          <text x="0" y="-21.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="7" fill={accent} opacity="0.9">
            {number}
          </text>
          {/* arms */}
          {pose === "throw" ? (
            <>
              <g transform="translate(4 -29)">
                <rect x="-1.8" y="0" width="3.6" height="12" rx="1.8" fill={skin} transform="rotate(-118)" />
              </g>
              <g transform="translate(-4 -29)">
                <rect x="-1.8" y="0" width="3.6" height="12" rx="1.8" fill={skin} transform="rotate(38)" />
              </g>
            </>
          ) : pose === "catch" || pose === "celebrate" ? (
            <>
              <g transform="translate(4.5 -29)">
                <rect x="-1.8" y="0" width="3.6" height="12" rx="1.8" fill={skin} transform="rotate(-150)" />
              </g>
              <g transform="translate(-4.5 -29)">
                <rect x="-1.8" y="0" width="3.6" height="12" rx="1.8" fill={skin} transform="rotate(150)" />
              </g>
            </>
          ) : (
            <>
              <g transform="translate(5 -29)">
                <rect className={running ? "fb-arm-a" : undefined} x="-1.8" y="0" width="3.6" height="12" rx="1.8" fill={skin} />
              </g>
              <g transform="translate(-5 -29)">
                <rect className={running ? "fb-arm-b" : undefined} x="-1.8" y="0" width="3.6" height="12" rx="1.8" fill={skin} />
              </g>
            </>
          )}
          {/* helmet */}
          <g transform="translate(0 -36)">
            <circle cx="0" cy="0" r="5.6" fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
            <path d="M-5.6 0 A5.6 5.6 0 0 1 5.6 0" fill={accent} opacity="0.35" />
            <path d="M2 1.4 q4.6 0.6 4.2 -2.6" fill="none" stroke="#f8fafc" strokeWidth="1.1" strokeLinecap="round" />
            <rect x="-1" y="-7.2" width="2" height="3.4" rx="1" fill={accent} opacity="0.8" />
          </g>
          {/* ball tucked */}
          {hasBall && (
            <ellipse cx="6.5" cy="-24" rx="4.4" ry="2.8" fill="#6b4226" stroke="#1a0f08" strokeWidth="0.7" transform="rotate(-18 6.5 -24)" />
          )}
        </g>
      </g>
    </g>
  );
}

export type MascotKind = "bear" | "eagle" | "bull" | "tiger";

/** Sideline team mascot in a costume suit, bouncing with pom-poms. */
export function Mascot({ x, y, scale = 1, kind, color, facing = 1 }: { x: number; y: number; scale?: number; kind: MascotKind; color: string; facing?: 1 | -1 }) {
  const fur = kind === "bear" ? "#6b4a32" : kind === "eagle" ? "#e8ecf3" : kind === "bull" ? "#3a3f4b" : "#e08a2a";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="1.5" rx="11" ry="3.4" fill="rgba(0,0,0,0.35)" />
      <g transform={`scale(${facing} 1)`} className="fb-mascot">
        {/* legs */}
        <rect x="-6" y="-14" width="5" height="14" rx="2.5" fill={fur} />
        <rect x="1" y="-14" width="5" height="14" rx="2.5" fill={fur} />
        {/* body */}
        <ellipse cx="0" cy="-24" rx="10.5" ry="12" fill={fur} />
        <ellipse cx="0" cy="-22" rx="6.5" ry="8" fill={color} opacity="0.9" />
        {/* arms with pom-poms */}
        <g transform="translate(-10 -30)">
          <g className="fb-pom">
            <rect x="-1.8" y="0" width="3.6" height="11" rx="1.8" fill={fur} transform="rotate(35)" />
            <circle cx="7" cy="10" r="4" fill={color} />
          </g>
        </g>
        <g transform="translate(10 -30)">
          <g className="fb-pom">
            <rect x="-1.8" y="0" width="3.6" height="11" rx="1.8" fill={fur} transform="rotate(-35)" />
            <circle cx="-7" cy="10" r="4" fill={color} />
          </g>
        </g>
        {/* head */}
        <g transform="translate(0 -42)">
          <circle cx="0" cy="0" r="9.5" fill={fur} />
          {kind === "bear" && (
            <>
              <circle cx="-7" cy="-7" r="3.4" fill={fur} />
              <circle cx="7" cy="-7" r="3.4" fill={fur} />
              <ellipse cx="0" cy="3" rx="5" ry="3.6" fill="#d9c3ad" />
              <ellipse cx="0" cy="1.6" rx="1.8" ry="1.3" fill="#221a14" />
            </>
          )}
          {kind === "eagle" && (
            <>
              <path d="M-1 2 L7 5 L-1 8 Z" fill="#f0b429" />
              <path d="M-9 -8 q9 -6 18 0 q-9 -3 -18 0 Z" fill="#f8fafc" />
            </>
          )}
          {kind === "bull" && (
            <>
              <path d="M-9 -5 q-7 -4 -6 -9 q5 2 7 6 Z" fill="#e8e2d4" />
              <path d="M9 -5 q7 -4 6 -9 q-5 2 -7 6 Z" fill="#e8e2d4" />
              <ellipse cx="0" cy="4" rx="5.4" ry="3.8" fill="#2a2f38" />
              <circle cx="-1.8" cy="4" r="1" fill="#8f96a3" />
              <circle cx="1.8" cy="4" r="1" fill="#8f96a3" />
            </>
          )}
          {kind === "tiger" && (
            <>
              <circle cx="-7" cy="-7" r="3.2" fill={fur} />
              <circle cx="7" cy="-7" r="3.2" fill={fur} />
              <path d="M-8 -2 h5 M8 -2 h-5" stroke="#3a2410" strokeWidth="1.4" strokeLinecap="round" />
              <ellipse cx="0" cy="3.4" rx="5" ry="3.4" fill="#f6e2c4" />
              <path d="M0 1.6 l-2 1.4 M0 1.6 l2 1.4" stroke="#3a2410" strokeWidth="1" strokeLinecap="round" />
            </>
          )}
          <circle cx="-3.4" cy="-2.4" r="1.5" fill="#141018" />
          <circle cx="3.4" cy="-2.4" r="1.5" fill="#141018" />
        </g>
      </g>
    </g>
  );
}
