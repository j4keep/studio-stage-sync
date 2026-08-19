import type { CSSProperties } from "react";
import type { Appearance } from "@/lib/boxing";

export type FighterAnim = "idle" | "jab" | "hook" | "uppercut" | "guard-block" | "guard-dodge" | "hit" | "ko";

export const SKIN_TONES = ["#f3d3b3", "#e8c39e", "#c58c58", "#8a5a3a", "#5a3826", "#3a2418"];

export type CharacterId = "man" | "woman" | "heavy" | "lean" | "robot" | "bear";

type CharacterDef = {
  id: CharacterId;
  label: string;
  emoji: string;
  /** Body width multiplier. */
  scale: number;
  head: "human" | "robot" | "animal";
  hair: "short" | "ponytail" | "bald" | "none";
  /** Overrides the chosen skin tone (robots/animals aren't skin-toned). */
  bodyColor?: string;
  fem?: boolean;
};

export const CHARACTERS: CharacterDef[] = [
  { id: "man", label: "Man", emoji: "🥊", scale: 1, head: "human", hair: "short" },
  { id: "woman", label: "Woman", emoji: "🥊", scale: 0.94, head: "human", hair: "ponytail", fem: true },
  { id: "heavy", label: "Heavy", emoji: "🐻", scale: 1.3, head: "human", hair: "bald" },
  { id: "lean", label: "Lean", emoji: "⚡", scale: 0.82, head: "human", hair: "short" },
  { id: "robot", label: "Robot", emoji: "🤖", scale: 1.08, head: "robot", hair: "none", bodyColor: "#b8c4d4" },
  { id: "bear", label: "Bear", emoji: "🐻", scale: 1.22, head: "animal", hair: "none", bodyColor: "#8b5a2b" },
];

export function characterFor(appearance: Appearance): CharacterDef {
  const byId = CHARACTERS.find((c) => c.id === (appearance as any).character);
  if (byId) return byId;
  // Legacy appearances only carried build + fem.
  if (appearance.build === "heavy") return CHARACTERS[2];
  if (appearance.build === "lean") return CHARACTERS[3];
  return appearance.fem ? CHARACTERS[1] : CHARACTERS[0];
}

/** How far a fighter travels toward the middle of the ring to land a punch. */
const APPROACH: Record<string, number> = { jab: 96, hook: 108, uppercut: 88 };

/**
 * A fully illustrated boxer — head, torso, trunks, two-segment arms, gloves, boots —
 * that steps in toward the opponent to punch and steps back out to guard.
 */
export default function FighterArt({
  side,
  appearance,
  accent,
  anim,
  advance = 0,
}: {
  side: "left" | "right";
  appearance: Appearance;
  accent: string;
  anim: FighterAnim;
  /** How far this fighter has walked toward the middle of the ring (ring units). */
  advance?: number;
}) {
  const def = characterFor(appearance);
  const facing = side === "left" ? 1 : -1;
  const cx = side === "left" ? 250 : 650;
  const s = def.scale;
  const skin = def.bodyColor ?? appearance.skin;
  const fem = def.fem ?? appearance.fem;

  const hit = anim === "hit";
  const ko = anim === "ko";
  const guarding = anim === "guard-block" || anim === "guard-dodge";
  const ducking = anim === "guard-dodge";
  const punching = anim === "jab" || anim === "hook" || anim === "uppercut";

  const lunge = punching ? APPROACH[anim] : guarding ? -10 : 0;
  const step = advance + lunge;
  const twist = anim === "hook" ? 12 : anim === "uppercut" ? 4 : 0;
  const bob = anim === "uppercut" ? -8 : ducking ? 16 : 0;
  const knockback = hit ? 26 : 0;


  const bodyStyle: CSSProperties = {
    transform: ko
      ? `translate(${facing * 40}px, 52px) rotate(${facing * 92}deg)`
      : `translate(${(step - knockback) * facing}px, ${bob}px) rotate(${(twist - (hit ? 9 : 0)) * facing}deg)`,
    transformOrigin: `${cx}px 320px`,
    transition: ko
      ? "transform 420ms cubic-bezier(.4,0,.2,1)"
      : punching
        ? "transform 190ms cubic-bezier(.3,.9,.35,1.05)"
        : "transform 300ms cubic-bezier(.25,.9,.4,1)",
  };

  const leadArmStyle: CSSProperties = {
    transform:
      anim === "jab"
        ? `translate(${44 * facing}px, -8px) rotate(${-8 * facing}deg)`
        : guarding
          ? `translate(${8 * facing}px, -6px) rotate(${-18 * facing}deg)`
          : `rotate(${-10 * facing}deg)`,
    transformOrigin: `${cx + 14 * facing}px 218px`,
    transition: "transform 150ms cubic-bezier(.25,.9,.4,1.1)",
  };
  const rearArmStyle: CSSProperties = {
    transform:
      anim === "hook"
        ? `translate(${20 * facing}px, -2px) rotate(${62 * facing}deg)`
        : anim === "uppercut"
          ? `translate(${14 * facing}px, -30px) rotate(${22 * facing}deg)`
          : guarding
            ? `translate(${3 * facing}px, -3px) rotate(${-9 * facing}deg)`
            : `rotate(${7 * facing}deg)`,
    transformOrigin: `${cx - 12 * facing}px 222px`,
    transition: "transform 150ms cubic-bezier(.25,.9,.4,1.1)",
  };

  const torsoTopW = 30 * s;
  const torsoBotW = 20 * s;
  const gloveR = 13 * s;
  const ink = "#12070a";
  const inkW = 2.2 * s;
  const metal = def.head === "robot";

  return (
    <g style={bodyStyle}>
      <g className={ko ? undefined : "bx-footwork"} style={{ transformBox: "fill-box" } as CSSProperties}>
        <ellipse cx={cx} cy="382" rx={36 * s} ry="8" fill="rgba(0,0,0,0.4)" />

        {/* Legs + boots */}
        <path
          d={`M ${cx - 9} 278 L ${cx - 32 * s} 294 L ${cx - 26 * s} 376 L ${cx - 10} 376 L ${cx - 11} 296 Z`}
          fill={metal ? "#5c6a7c" : "#161b26"}
          stroke={ink}
          strokeWidth={inkW}
          strokeLinejoin="round"
        />
        <path
          d={`M ${cx + 7} 278 L ${cx + 32 * s} 296 L ${cx + 25 * s} 376 L ${cx + 9} 376 L ${cx + 5} 296 Z`}
          fill={metal ? "#6d7b8e" : "#1c2431"}
          stroke={ink}
          strokeWidth={inkW}
          strokeLinejoin="round"
        />
        <ellipse cx={cx - 24 * s} cy="377" rx={11 * s} ry="5.5" fill="#0b0e14" stroke={ink} strokeWidth={inkW * 0.8} />
        <ellipse cx={cx + 22 * s} cy="377" rx={11 * s} ry="5.5" fill="#0b0e14" stroke={ink} strokeWidth={inkW * 0.8} />

        {/* Rear arm behind the torso */}
        <g style={rearArmStyle}>
          <path
            d={`M ${cx - 12 * facing} 222 L ${cx - 28 * facing} 246 L ${cx - 22 * facing} 250 L ${cx - 7 * facing} 226 Z`}
            fill={skin}
            stroke={ink}
            strokeWidth={inkW}
            strokeLinejoin="round"
          />
          <ellipse cx={cx - 28 * facing} cy="250" rx={gloveR} ry={gloveR * 0.9} fill={accent} stroke={ink} strokeWidth={inkW} />
          <ellipse cx={cx - 28 * facing} cy="250" rx={gloveR} ry={gloveR * 0.9} fill="url(#bx-glove-sheen)" />
        </g>

        {/* Torso */}
        <path
          d={`M ${cx - torsoTopW} 222 Q ${cx} 208 ${cx + torsoTopW} 222 L ${cx + torsoBotW} 278 Q ${cx} 288 ${cx - torsoBotW} 278 Z`}
          fill={hit ? "#ff6b6b" : skin}
          stroke={ink}
          strokeWidth={inkW}
          strokeLinejoin="round"
          style={{ transition: "fill 100ms" }}
        />
        {fem && (
          <path
            d={`M ${cx - 15 * s} 240 q ${7 * s} ${9 * s} ${14 * s} 0 q ${7 * s} ${9 * s} ${14 * s} 0`}
            fill="none"
            stroke="rgba(0,0,0,0.22)"
            strokeWidth={1.8 * s}
          />
        )}
        <path d={`M ${cx - 3} 236 L ${cx - 3} 270 M ${cx + 3} 236 L ${cx + 3} 270`} stroke="rgba(0,0,0,0.22)" strokeWidth="1.6" />
        <path d={`M ${cx - torsoTopW + 4} 226 Q ${cx} 216 ${cx + torsoTopW - 4} 226`} stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none" />
        {metal && (
          <>
            <circle cx={cx} cy={252} r={5} fill={accent} stroke={ink} strokeWidth="1.4" />
            <path d={`M ${cx - 16 * s} 262 h ${32 * s}`} stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" />
          </>
        )}
        {def.head === "animal" && (
          <path d={`M ${cx - 12 * s} 248 q ${12 * s} ${16 * s} ${24 * s} 0 q ${-12 * s} ${8 * s} ${-24 * s} 0`} fill="rgba(255,255,255,0.14)" />
        )}

        {/* Trunks */}
        <path
          d={`M ${cx - torsoBotW - 2} 270 L ${cx + torsoBotW + 2} 270 L ${cx + torsoBotW - 4} 294 L ${cx - torsoBotW + 4} 294 Z`}
          fill={accent}
          stroke={ink}
          strokeWidth={inkW}
          strokeLinejoin="round"
        />
        <path
          d={`M ${cx - torsoBotW - 2} 270 L ${cx + torsoBotW + 2} 270 L ${cx + torsoBotW - 1} 277 L ${cx - torsoBotW + 1} 277 Z`}
          fill="#0b0e14"
          opacity="0.32"
        />

        {/* Neck + head */}
        <rect x={cx - 6} y="203" width="12" height="15" rx="3" fill={skin} stroke={ink} strokeWidth={inkW * 0.8} />
        {def.head === "robot" ? (
          <>
            <rect x={cx - 16} y="174" width="32" height="30" rx="7" fill="#c9d4e2" stroke={ink} strokeWidth={inkW} />
            <rect x={cx - 11 + 2 * facing} y="184" width="20" height="8" rx="4" fill={accent} />
            <line x1={cx} y1="174" x2={cx} y2="162" stroke="#8b98a8" strokeWidth="3" />
            <circle cx={cx} cy="159" r="4" fill={accent} />
          </>
        ) : def.head === "animal" ? (
          <>
            <circle cx={cx - 12} cy="176" r="7" fill={skin} stroke={ink} strokeWidth={inkW * 0.8} />
            <circle cx={cx + 12} cy="176" r="7" fill={skin} stroke={ink} strokeWidth={inkW * 0.8} />
            <ellipse cx={cx + 2 * facing} cy="192" rx="18" ry="18" fill={skin} stroke={ink} strokeWidth={inkW} />
            <ellipse cx={cx + 13 * facing} cy="196" rx="9" ry="7" fill="#e5cdb3" stroke={ink} strokeWidth={inkW * 0.7} />
            <circle cx={cx + 17 * facing} cy="195" r="2.6" fill="#160d0a" />
            <circle cx={cx + 8 * facing} cy="187" r="2" fill="#160d0a" />
          </>
        ) : (
          <>
            <ellipse cx={cx + 3 * facing} cy="191" rx="17" ry="19" fill={skin} stroke={ink} strokeWidth={inkW} />
            {def.hair === "ponytail" && (
              <>
                <path
                  d={`M ${cx - 14} 185 Q ${cx + 2 * facing} 167 ${cx + 18} 183 Q ${cx + 10} 177 ${cx} 177 Q ${cx - 12} 177 ${cx - 14} 185 Z`}
                  fill="#241408"
                  stroke={ink}
                  strokeWidth={inkW * 0.7}
                />
                <path
                  d={`M ${cx - 15 * facing} 195 Q ${cx - 24 * facing} 214 ${cx - 18 * facing} 234 L ${cx - 12 * facing} 232 Q ${cx - 17 * facing} 214 ${cx - 12 * facing} 197 Z`}
                  fill="#241408"
                  stroke={ink}
                  strokeWidth={inkW * 0.7}
                />
              </>
            )}
            {def.hair === "short" && (
              <path
                d={`M ${cx - 14} 186 Q ${cx + 2 * facing} 171 ${cx + 17} 184 Q ${cx + 9} 179 ${cx} 179 Q ${cx - 11} 179 ${cx - 14} 186 Z`}
                fill="#1c130c"
                stroke={ink}
                strokeWidth={inkW * 0.7}
              />
            )}
            {def.hair === "bald" && <path d={`M ${cx - 12} 182 Q ${cx + 2 * facing} 174 ${cx + 14} 182`} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />}
            <circle cx={cx + 9 * facing} cy="190" r="2" fill="#161616" />
            <path d={`M ${cx + 5 * facing} 200 q ${5 * facing} 3 ${9 * facing} 0`} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" />
          </>
        )}

        {/* Lead arm in front */}
        <g style={leadArmStyle}>
          <path
            d={`M ${cx + 14 * facing} 222 L ${cx + 28 * facing} 242 L ${cx + 22 * facing} 246 L ${cx + 9 * facing} 226 Z`}
            fill={skin}
            stroke={ink}
            strokeWidth={inkW}
            strokeLinejoin="round"
          />
          <ellipse cx={cx + 28 * facing} cy="244" rx={gloveR + 1} ry={gloveR} fill={accent} stroke={ink} strokeWidth={inkW} />
          <ellipse cx={cx + 28 * facing} cy="244" rx={gloveR + 1} ry={gloveR} fill="url(#bx-glove-sheen)" />
        </g>

        {guarding && (
          <circle
            cx={cx + 16 * facing}
            cy="216"
            r="46"
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            opacity="0.55"
            style={{ filter: `drop-shadow(0 0 8px ${accent})` }}
          />
        )}
      </g>
    </g>
  );
}
