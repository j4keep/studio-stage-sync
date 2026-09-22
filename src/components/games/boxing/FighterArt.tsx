import type { CSSProperties } from "react";
import type { Appearance } from "@/lib/boxing";

export type FighterAnim = "idle" | "jab" | "hook" | "uppercut" | "guard-block" | "guard-dodge" | "hit" | "ko";

export const SKIN_TONES = ["#f3d3b3", "#e8c39e", "#c58c58", "#8a5a3a", "#5a3826", "#3a2418"];

export type CharacterId = "man" | "woman" | "heavy" | "lean";

type CharacterDef = {
  id: CharacterId;
  label: string;
  emoji: string;
  scale: number;
  fem?: boolean;
  hair: "short" | "ponytail" | "bald";
};

export const CHARACTERS: CharacterDef[] = [
  { id: "man", label: "Man", emoji: "🥊", scale: 1, hair: "short" },
  { id: "woman", label: "Woman", emoji: "🥊", scale: 0.94, fem: true, hair: "ponytail" },
  { id: "heavy", label: "Heavy", emoji: "🥊", scale: 1.12, hair: "bald" },
  { id: "lean", label: "Lean", emoji: "🥊", scale: 0.9, hair: "short" },
];

export function characterFor(appearance: Appearance): CharacterDef {
  const requested = String((appearance as any).character || "");
  const byId = CHARACTERS.find((c) => c.id === requested);
  if (byId) return byId;
  if (appearance.build === "heavy") return CHARACTERS[2];
  if (appearance.build === "lean") return CHARACTERS[3];
  return appearance.fem ? CHARACTERS[1] : CHARACTERS[0];
}

const APPROACH: Record<"jab" | "hook" | "uppercut", number> = {
  jab: 88,
  hook: 82,
  uppercut: 76,
};
const BASE_CLOSE = 42;
const MAX_CLOSE = 172;

type Pt = { x: number; y: number };

function Arm({
  shoulder,
  elbow,
  glove,
  skin,
  accent,
  width,
}: {
  shoulder: Pt;
  elbow: Pt;
  glove: Pt;
  skin: string;
  accent: string;
  width: number;
}) {
  return (
    <g>
      <path
        d={`M ${shoulder.x} ${shoulder.y} Q ${elbow.x} ${elbow.y} ${glove.x} ${glove.y}`}
        fill="none"
        stroke="#241711"
        strokeWidth={width + 5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${shoulder.x} ${shoulder.y} Q ${elbow.x} ${elbow.y} ${glove.x} ${glove.y}`}
        fill="none"
        stroke={skin}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx={glove.x} cy={glove.y} rx={13} ry={11.5} fill={accent} stroke="#241711" strokeWidth="3" />
      <ellipse cx={glove.x - 3} cy={glove.y - 3} rx="5.5" ry="4" fill="rgba(255,255,255,0.28)" />
    </g>
  );
}

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
  advance?: number;
}) {
  const def = characterFor(appearance);
  const facing = side === "left" ? 1 : -1;
  const cx = side === "left" ? 250 : 650;
  const s = def.scale;
  const skin = appearance.skin;
  const fem = def.fem ?? appearance.fem;

  const hit = anim === "hit";
  const ko = anim === "ko";
  const block = anim === "guard-block";
  const dodge = anim === "guard-dodge";
  const punching = anim === "jab" || anim === "hook" || anim === "uppercut";

  const lunge = punching ? APPROACH[anim] : block ? -2 : dodge ? -18 : 0;
  const step = Math.min(MAX_CLOSE, BASE_CLOSE + advance + lunge);
  const shift = (step - (hit ? 22 : 0)) * facing;
  const bodyRotate = (anim === "hook" ? 8 : anim === "uppercut" ? -3 : hit ? -7 : 0) * facing;
  const bob = anim === "uppercut" ? 8 : dodge ? 16 : 0;

  const bodyStyle: CSSProperties = {
    transform: ko
      ? `translate(${52 * facing}px, 62px) rotate(${92 * facing}deg)`
      : `translate(${shift}px, ${bob}px) rotate(${bodyRotate}deg)`,
    transformOrigin: `${cx}px 322px`,
    transition: punching
      ? "transform 145ms cubic-bezier(.2,.9,.25,1)"
      : ko
        ? "transform 420ms cubic-bezier(.4,0,.2,1)"
        : "transform 220ms cubic-bezier(.25,.9,.4,1)",
  };

  // Draw both fighters from one natural human pose, mirrored around their body.
  const shoulderLead: Pt = { x: 30, y: 226 };
  const shoulderRear: Pt = { x: -26, y: 228 };

  let leadElbow: Pt = { x: 48, y: 244 };
  let leadGlove: Pt = { x: 56, y: 224 };
  let rearElbow: Pt = { x: -42, y: 246 };
  let rearGlove: Pt = { x: -34, y: 222 };

  if (anim === "jab") {
    leadElbow = { x: 76, y: 218 };
    leadGlove = { x: 126, y: 204 };
    rearElbow = { x: -20, y: 220 };
    rearGlove = { x: -4, y: 201 };
  } else if (anim === "hook") {
    leadElbow = { x: 38, y: 232 };
    leadGlove = { x: 46, y: 208 };
    rearElbow = { x: 62, y: 206 };
    rearGlove = { x: 112, y: 213 };
  } else if (anim === "uppercut") {
    leadElbow = { x: 38, y: 238 };
    leadGlove = { x: 48, y: 214 };
    rearElbow = { x: 44, y: 232 };
    rearGlove = { x: 82, y: 177 };
  } else if (block) {
    leadElbow = { x: 26, y: 214 };
    leadGlove = { x: 18, y: 190 };
    rearElbow = { x: -12, y: 210 };
    rearGlove = { x: -1, y: 188 };
  } else if (dodge) {
    leadElbow = { x: 26, y: 232 };
    leadGlove = { x: 34, y: 212 };
    rearElbow = { x: -20, y: 232 };
    rearGlove = { x: -12, y: 210 };
  }

  const torsoFill = hit ? "#e68c7e" : skin;
  const outline = "#241711";

  return (
    <g style={bodyStyle}>
      <g transform={`translate(${cx} 0) scale(${facing} 1)`}>
        <ellipse cx="0" cy="382" rx={42 * s} ry="9" fill="rgba(0,0,0,0.42)" />

        {/* Back leg first for depth. */}
        <path
          d={`M -18 288 Q -30 322 -28 370 L -6 370 Q -8 326 -3 296 Z`}
          fill="#202735"
          stroke={outline}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d={`M 13 289 Q 31 322 28 370 L 6 370 Q 9 326 4 296 Z`}
          fill="#252f40"
          stroke={outline}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <ellipse cx="-20" cy="374" rx="17" ry="6.5" fill="#0b0e14" />
        <ellipse cx="20" cy="374" rx="17" ry="6.5" fill="#0b0e14" />

        {/* Rear arm is hidden slightly behind the torso. */}
        <g transform={`scale(${s} ${s})`}>
          <Arm shoulder={shoulderRear} elbow={rearElbow} glove={rearGlove} skin={skin} accent={accent} width={13} />
        </g>

        {/* Athletic human torso — shoulders, ribcage and waist instead of a box shape. */}
        <path
          d={
            fem
              ? "M -34 218 Q -22 209 0 208 Q 22 209 34 218 Q 30 246 23 274 Q 14 287 0 288 Q -14 287 -23 274 Q -30 246 -34 218 Z"
              : "M -39 218 Q -24 207 0 206 Q 24 207 39 218 Q 34 245 25 274 Q 14 289 0 290 Q -14 289 -25 274 Q -34 245 -39 218 Z"
          }
          fill={torsoFill}
          stroke={outline}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M -23 231 Q 0 221 23 231" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
        <path d="M 0 232 L 0 271" fill="none" stroke="rgba(70,35,25,.28)" strokeWidth="2" />
        <path d="M -12 246 Q -3 252 0 252 Q 3 252 12 246" fill="none" stroke="rgba(70,35,25,.18)" strokeWidth="2" />

        {/* Boxing trunks. */}
        <path d="M -28 270 L 28 270 L 24 303 L 5 303 L 0 286 L -5 303 L -24 303 Z" fill={accent} stroke={outline} strokeWidth="3" />
        <rect x="-29" y="269" width="58" height="9" rx="4" fill="#111827" opacity=".42" />

        {/* Neck and more human face. */}
        <path d="M -8 208 L -7 197 L 8 197 L 9 208 Z" fill={skin} stroke={outline} strokeWidth="2.4" />
        <ellipse cx="3" cy="177" rx="22" ry="27" fill={skin} stroke={outline} strokeWidth="3" />
        <path d="M 16 181 Q 20 184 15 187" fill="none" stroke="rgba(75,38,25,.48)" strokeWidth="2" />
        <path d="M 4 191 Q 10 194 15 190" fill="none" stroke="rgba(75,38,25,.55)" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="11" cy="173" rx="2.2" ry="2.8" fill="#1a1513" />
        <path d="M 5 166 Q 12 162 18 166" fill="none" stroke="rgba(40,25,20,.65)" strokeWidth="2" strokeLinecap="round" />

        {def.hair === "short" && (
          <path d="M -15 172 Q -8 145 16 150 Q 25 153 24 165 Q 14 156 2 157 Q -8 158 -15 172 Z" fill="#1f1713" />
        )}
        {def.hair === "ponytail" && (
          <>
            <path d="M -16 172 Q -9 145 16 149 Q 27 152 25 165 Q 14 155 1 157 Q -10 158 -16 172 Z" fill="#251810" />
            <path d="M -15 160 Q -34 169 -29 191 Q -18 180 -10 166 Z" fill="#251810" />
          </>
        )}
        {def.hair === "bald" && (
          <path d="M -10 155 Q 3 149 15 154" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
        )}

        {/* Lead arm in front so the punch clearly reaches the opponent. */}
        <g transform={`scale(${s} ${s})`}>
          <Arm shoulder={shoulderLead} elbow={leadElbow} glove={leadGlove} skin={skin} accent={accent} width={14} />
        </g>

        {block && (
          <ellipse cx="10" cy="192" rx="48" ry="54" fill="none" stroke={accent} strokeWidth="3" opacity=".38" />
        )}
      </g>
    </g>
  );
}
