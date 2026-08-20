/**
 * YAJ Tower Escape renderer — original hand-drawn 2.5D canvas art (no external
 * assets, nothing borrowed): angled block platforms with side faces, neon
 * hazards, scaffolding, and the blocky YAJ Adventure character.
 */

import {
  PLAYER_H,
  PLAYER_W,
  TowerState,
  hazardActive,
  hazardBox,
  platformBox,
  platformSolid,
} from "@/lib/tower-escape/engine";
import { Platform, SectionTheme } from "@/lib/tower-escape/level";

export type Camera = { x: number; y: number; scale: number; vw: number; vh: number };

const THEME: Record<SectionTheme, { sky: [string, string]; wall: string; deck: string; face: string; accent: string; glow: string }> = {
  lobby: { sky: ["#241a44", "#120c26"], wall: "#2b2050", deck: "#c9a24a", face: "#8a6c2c", accent: "#f0d78c", glow: "#ffcf6b" },
  industrial: { sky: ["#1c2a3d", "#0d1522"], wall: "#233246", deck: "#9fb4c9", face: "#5d7387", accent: "#67e8f9", glow: "#22d3ee" },
  neon: { sky: ["#2a1046", "#120524"], wall: "#331253", deck: "#b98cf5", face: "#6c3fa8", accent: "#e879f9", glow: "#a855f7" },
  glass: { sky: ["#0d2a33", "#06171d"], wall: "#123640", deck: "#8fdfe4", face: "#3d8d96", accent: "#7de0a6", glow: "#5eead4" },
  shaft: { sky: ["#1b1b26", "#0b0b12"], wall: "#232333", deck: "#b6b9c9", face: "#6a6d80", accent: "#f59e0b", glow: "#fbbf24" },
  construction: { sky: ["#3a2412", "#180d06"], wall: "#3d2a16", deck: "#e0a13c", face: "#96682a", accent: "#fbbf24", glow: "#fb923c" },
  sky: { sky: ["#1b3d6b", "#0a1830"], wall: "#20456f", deck: "#cfe6ff", face: "#6f93bd", accent: "#7dd3fc", glow: "#38bdf8" },
};


export function themeAt(st: TowerState, y: number) {
  const s = st.level.sections.find((sec) => y >= sec.from && y < sec.to) ?? st.level.sections[0];
  return { section: s, palette: THEME[s.theme] };
}

export function makeCamera(st: TowerState, w: number, h: number, prev?: Camera): Camera {
  const worldH = Math.max(560, Math.min(760, h / (w / 420)));
  const scale = h / worldH;
  const vw = w / scale;
  const vh = worldH;
  const targetY = st.y - vh * 0.36;
  const targetX = Math.max(0, Math.min(st.level.width - vw, st.x + PLAYER_W / 2 - vw / 2));
  if (!prev) return { x: targetX, y: Math.max(-40, targetY), scale, vw, vh };
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  return {
    x: lerp(prev.x, targetX, 0.16),
    y: Math.max(-40, lerp(prev.y, targetY, 0.14)),
    scale,
    vw,
    vh,
  };
}

export function drawTower(g: CanvasRenderingContext2D, st: TowerState, cam: Camera, w: number, h: number) {
  g.save();
  g.clearRect(0, 0, w, h);

  const { palette, section } = themeAt(st, st.y);

  // ── Sky / shaft background with parallax ──────────────────────────────────
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(1, palette.sky[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const toScreenX = (x: number) => (x - cam.x) * cam.scale;
  const toScreenY = (y: number) => h - (y - cam.y) * cam.scale;

  // Distant tower silhouettes (parallax 0.35)
  g.globalAlpha = 0.4;
  g.fillStyle = palette.wall;
  for (let i = 0; i < 7; i++) {
    const bx = ((i * 173) % 760) - 40;
    const bw = 90 + ((i * 37) % 60);
    const bh = 320 + ((i * 91) % 260);
    const yy = h - ((-cam.y * 0.35 + 0) % 400) - bh * 0.2;
    g.fillRect(toScreenX(bx) * 0.6 + i * 22, yy, bw * cam.scale, bh * cam.scale);
  }
  g.globalAlpha = 1;

  // Inner shaft walls
  const leftWall = toScreenX(0);
  const rightWall = toScreenX(st.level.width);
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(0, 0, Math.max(0, leftWall), h);
  g.fillRect(Math.min(w, rightWall), 0, w, h);
  g.strokeStyle = palette.accent;
  g.globalAlpha = 0.35;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(leftWall, 0);
  g.lineTo(leftWall, h);
  g.moveTo(rightWall, 0);
  g.lineTo(rightWall, h);
  g.stroke();
  g.globalAlpha = 1;

  // Structural grid + windows
  g.globalAlpha = 0.16;
  g.strokeStyle = palette.deck;
  g.lineWidth = 1;
  const gridStep = 110;
  const startY = Math.floor(cam.y / gridStep) * gridStep;
  for (let y = startY; y < cam.y + cam.vh + gridStep; y += gridStep) {
    const sy = toScreenY(y);
    g.beginPath();
    g.moveTo(leftWall, sy);
    g.lineTo(rightWall, sy);
    g.stroke();
  }
  g.globalAlpha = 0.1;
  for (let y = startY; y < cam.y + cam.vh + gridStep; y += gridStep) {
    for (let i = 0; i < 5; i++) {
      const wx = 60 + i * 140;
      g.fillStyle = palette.glow;
      g.fillRect(toScreenX(wx), toScreenY(y + 70), 44 * cam.scale, 40 * cam.scale);
    }
  }
  g.globalAlpha = 1;

  // Floor / section banners
  for (const sec of st.level.sections) {
    const sy = toScreenY(sec.from);
    if (sy < -60 || sy > h + 60) continue;
    const p = THEME[sec.theme];
    g.globalAlpha = 0.6;
    g.fillStyle = p.accent;
    g.fillRect(leftWall, sy - 2, rightWall - leftWall, 3);
    g.globalAlpha = 0.85;
    g.font = `700 ${Math.round(11 * Math.max(1, cam.scale))}px ui-sans-serif, system-ui`;
    g.fillStyle = p.accent;
    g.fillText(sec.name.toUpperCase(), leftWall + 8, sy - 8);
    g.globalAlpha = 1;
  }

  // ── Climb zones (scaffold ladders) ────────────────────────────────────────
  for (const c of st.level.climbs) {
    const x = toScreenX(c.x);
    const yTop = toScreenY(c.y + c.h);
    const yBot = toScreenY(c.y);
    if (yBot < -80 || yTop > h + 80) continue;
    const cw = c.w * cam.scale;
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(x, yTop, cw, yBot - yTop);
    g.strokeStyle = palette.deck;
    g.lineWidth = Math.max(2, 3 * cam.scale);
    g.beginPath();
    g.moveTo(x + cw * 0.15, yTop);
    g.lineTo(x + cw * 0.15, yBot);
    g.moveTo(x + cw * 0.85, yTop);
    g.lineTo(x + cw * 0.85, yBot);
    g.stroke();
    const rungs = Math.floor(c.h / 26);
    for (let i = 0; i <= rungs; i++) {
      const ry = toScreenY(c.y + i * 26);
      g.beginPath();
      g.moveTo(x + cw * 0.15, ry);
      g.lineTo(x + cw * 0.85, ry);
      g.stroke();
    }
  }

  // ── Platforms ─────────────────────────────────────────────────────────────
  for (const p of st.level.platforms) {
    const box = platformBox(p, st.t);
    const sy = toScreenY(box.y + box.h);
    if (sy < -120 || sy > h + 160) continue;
    const solidNow = platformSolid(p, st.t, st);
    const collapsing = Boolean(st.collapsing[p.id]);
    drawPlatform(g, p, box, toScreenX, toScreenY, cam, solidNow, collapsing, palette);
  }

  // ── Hazards ───────────────────────────────────────────────────────────────
  for (const hz of st.level.hazards) {
    const box = hazardBox(hz, st.t);
    const sy = toScreenY(box.y + box.h);
    if (sy < -160 || sy > h + 200) continue;
    const active = hazardActive(hz, st.t);
    const x = toScreenX(box.x);
    const y = toScreenY(box.y + box.h);
    const bw = box.w * cam.scale;
    const bh = box.h * cam.scale;
    if (hz.kind === "laser") {
      g.globalAlpha = active ? 1 : 0.22;
      g.fillStyle = active ? "#ff3d6e" : "#7f2440";
      g.shadowColor = "#ff3d6e";
      g.shadowBlur = active ? 18 : 0;
      g.fillRect(x, y, bw, Math.max(2, bh));
      g.shadowBlur = 0;
      g.fillStyle = "#5c6478";
      g.fillRect(x - 10 * cam.scale, y - 8 * cam.scale, 12 * cam.scale, bh + 20 * cam.scale);
      g.fillRect(x + bw - 2 * cam.scale, y - 8 * cam.scale, 12 * cam.scale, bh + 20 * cam.scale);
      g.globalAlpha = 1;
    } else if (hz.kind === "spikes") {
      g.fillStyle = "#cbd5e1";
      const teeth = Math.max(3, Math.floor(box.w / 18));
      for (let i = 0; i < teeth; i++) {
        const tx = x + (i * bw) / teeth;
        g.beginPath();
        g.moveTo(tx, y + bh);
        g.lineTo(tx + bw / teeth / 2, y - 6 * cam.scale);
        g.lineTo(tx + bw / teeth, y + bh);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "#475569";
      g.fillRect(x, y + bh - 3 * cam.scale, bw, 5 * cam.scale);
    } else if (hz.kind === "bar") {
      g.strokeStyle = "#f97316";
      g.lineWidth = Math.max(3, 7 * cam.scale);
      g.shadowColor = "#f97316";
      g.shadowBlur = 12;
      g.beginPath();
      g.moveTo(toScreenX(hz.x), toScreenY(hz.y));
      g.lineTo(x + bw / 2, y + bh / 2);
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = "#fdba74";
      g.beginPath();
      g.arc(x + bw / 2, y + bh / 2, 12 * cam.scale, 0, Math.PI * 2);
      g.fill();
    } else {
      // moving block / falling crate
      g.fillStyle = hz.kind === "crate" ? "#8b5a2b" : "#4b5563";
      g.fillRect(x, y, bw, bh);
      g.strokeStyle = hz.kind === "crate" ? "#f0b429" : "#ef4444";
      g.lineWidth = Math.max(2, 3 * cam.scale);
      g.strokeRect(x, y, bw, bh);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + bw, y + bh);
      g.moveTo(x + bw, y);
      g.lineTo(x, y + bh);
      g.stroke();
    }
  }

  // ── Stars ─────────────────────────────────────────────────────────────────
  for (const s of st.level.stars) {
    if (st.taken[s.id]) continue;
    const sy = toScreenY(s.y);
    if (sy < -40 || sy > h + 40) continue;
    const bob = Math.sin(st.t * 3 + s.x) * 3 * cam.scale;
    drawStar(g, toScreenX(s.x), sy + bob, 11 * cam.scale, s.bonus ? "#a855f7" : "#fbbf24");
  }

  // ── Power-ups ─────────────────────────────────────────────────────────────
  for (const u of st.level.powerups) {
    if (st.taken[u.id]) continue;
    const sy = toScreenY(u.y);
    if (sy < -40 || sy > h + 40) continue;
    const x = toScreenX(u.x);
    const r = 14 * cam.scale;
    const color = u.kind === "shield" ? "#38bdf8" : u.kind === "double" ? "#7de0a6" : "#fb7185";
    g.fillStyle = "rgba(0,0,0,0.4)";
    g.beginPath();
    g.arc(x, sy, r + 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(x, sy, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "#0b0713";
    g.font = `900 ${Math.round(13 * cam.scale)}px ui-sans-serif, system-ui`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(u.kind === "shield" ? "S" : u.kind === "double" ? "2x" : "»", x, sy + 1);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }

  // ── Checkpoints ───────────────────────────────────────────────────────────
  for (const c of st.level.checkpoints) {
    const sy = toScreenY(c.y);
    if (sy < -80 || sy > h + 80) continue;
    const x = toScreenX(c.x);
    const reached = c.index <= st.checkpoint;
    const poleH = 52 * cam.scale;
    g.strokeStyle = "#cbd5e1";
    g.lineWidth = Math.max(2, 3 * cam.scale);
    g.beginPath();
    g.moveTo(x, sy);
    g.lineTo(x, sy - poleH);
    g.stroke();
    const wave = reached ? Math.sin(st.t * 5) * 3 * cam.scale : 0;
    g.fillStyle = reached ? "#7de0a6" : "rgba(203,213,225,0.35)";
    g.beginPath();
    g.moveTo(x, sy - poleH);
    g.lineTo(x + 30 * cam.scale + wave, sy - poleH + 9 * cam.scale);
    g.lineTo(x, sy - poleH + 20 * cam.scale);
    g.closePath();
    g.fill();
    g.fillStyle = reached ? "#7de0a6" : "rgba(226,232,240,0.55)";
    g.font = `900 ${Math.round(10 * cam.scale)}px ui-sans-serif, system-ui`;
    g.fillText(`CP${c.index}`, x + 5 * cam.scale, sy - 4 * cam.scale);
  }

  // ── Rooftop finish ────────────────────────────────────────────────────────
  const f = st.level.finish;
  const fy = toScreenY(f.y + f.h);
  if (fy > -200 && fy < h + 200) {
    const x = toScreenX(f.x);
    const bw = f.w * cam.scale;
    const bh = f.h * cam.scale;
    const grad = g.createLinearGradient(x, fy, x, fy + bh);
    grad.addColorStop(0, "rgba(125,224,166,0.55)");
    grad.addColorStop(1, "rgba(125,224,166,0)");
    g.fillStyle = grad;
    g.fillRect(x, fy, bw, bh);
    g.fillStyle = "#7de0a6";
    g.font = `900 ${Math.round(15 * cam.scale)}px ui-sans-serif, system-ui`;
    g.textAlign = "center";
    g.fillText("ROOFTOP", x + bw / 2, fy - 8 * cam.scale);
    g.textAlign = "left";
  }

  // ── Player ────────────────────────────────────────────────────────────────
  drawPlayer(g, st, toScreenX(st.x), toScreenY(st.y + PLAYER_H), cam);

  g.restore();
}

function drawPlatform(
  g: CanvasRenderingContext2D,
  p: Platform,
  box: { x: number; y: number; w: number; h: number },
  sx: (x: number) => number,
  sy: (y: number) => number,
  cam: Camera,
  solidNow: boolean,
  collapsing: boolean,
  palette: (typeof THEME)[SectionTheme],
) {
  const x = sx(box.x);
  const y = sy(box.y + box.h);
  const bw = box.w * cam.scale;
  const bh = Math.max(4, box.h * cam.scale);
  const depth = 10 * cam.scale;

  let deck = palette.deck;
  let face = palette.face;
  if (p.kind === "mover" || p.kind === "elevator") {
    deck = "#8fb8e8";
    face = "#3f5f8f";
  } else if (p.kind === "blink") {
    deck = solidNow ? "#e879f9" : "rgba(232,121,249,0.18)";
    face = solidNow ? "#7e22ce" : "rgba(126,34,206,0.18)";
  } else if (p.kind === "fall") {
    deck = collapsing ? "#fca5a5" : "#8fdfe4";
    face = collapsing ? "#b91c1c" : "#3d8d96";
  } else if (p.kind === "conveyor") {
    deck = "#fbbf24";
    face = "#92400e";
  } else if (p.kind === "bounce") {
    deck = "#7de0a6";
    face = "#166534";
  }

  if (!solidNow && p.kind === "fall") return;

  const shake = collapsing ? Math.sin(cam.scale * 1 + Date.now() / 24) * 2 : 0;

  // 2.5D side face
  g.fillStyle = face;
  g.beginPath();
  g.moveTo(x + shake, y + bh);
  g.lineTo(x + bw + shake, y + bh);
  g.lineTo(x + bw - depth + shake, y + bh + depth);
  g.lineTo(x - depth + shake, y + bh + depth);
  g.closePath();
  g.fill();

  // deck
  g.fillStyle = deck;
  g.fillRect(x + shake, y, bw, bh);
  g.fillStyle = "rgba(255,255,255,0.28)";
  g.fillRect(x + shake, y, bw, Math.max(1.5, bh * 0.22));

  if (p.kind === "conveyor") {
    g.fillStyle = "rgba(0,0,0,0.35)";
    const dir = p.dir ?? 1;
    const off = ((Date.now() / 12) * dir) % 22;
    for (let i = -1; i < box.w / 22 + 1; i++) {
      g.fillRect(x + shake + (i * 22 + off) * cam.scale, y + bh * 0.4, 8 * cam.scale, bh * 0.3);
    }
  }
  if (p.kind === "bounce") {
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = Math.max(1.5, 2 * cam.scale);
    g.beginPath();
    g.moveTo(x + shake + 4, y - 4 * cam.scale);
    g.lineTo(x + shake + bw / 2, y - 12 * cam.scale);
    g.lineTo(x + shake + bw - 4, y - 4 * cam.scale);
    g.stroke();
  }
  if (p.kind === "mover" || p.kind === "elevator") {
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x + shake + bw / 2, y);
    g.lineTo(x + shake + bw / 2, y - 26 * cam.scale);
    g.stroke();
  }
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.restore();
}

/** The blocky YAJ Adventure character, side-on, with limb animation. */
function drawPlayer(g: CanvasRenderingContext2D, st: TowerState, x: number, yTop: number, cam: Camera) {
  const s = cam.scale;
  const w = PLAYER_W * s;
  const hh = PLAYER_H * s;
  const cx = x + w / 2;
  const flicker = st.invuln > 0 && Math.floor(st.t * 14) % 2 === 0;

  g.save();
  g.globalAlpha = flicker ? 0.45 : 1;

  // shadow
  g.globalAlpha *= 0.35;
  g.fillStyle = "#000";
  g.beginPath();
  g.ellipse(cx, yTop + hh + 4 * s, w * 0.5, 4 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = flicker ? 0.45 : 1;

  const anim = st.anim;
  const cycle = st.t * 11;
  const legSwing = anim === "run" ? Math.sin(cycle) * 8 * s : anim === "climb" ? Math.sin(st.t * 7) * 6 * s : 0;
  const armSwing = anim === "run" ? -Math.sin(cycle) * 8 * s : anim === "climb" ? Math.sin(st.t * 7 + Math.PI) * 8 * s : 0;
  const crouch = anim === "land" ? 4 * s : 0;
  const face = st.facing;

  const bodyY = yTop + 14 * s + crouch;
  const bodyH = hh * 0.42;

  // legs
  g.fillStyle = "#2b2b45";
  const legH = hh * 0.3;
  const legW = w * 0.3;
  const legY = bodyY + bodyH;
  g.fillRect(cx - legW - 1 * s + legSwing * 0.4, legY, legW, legH - crouch);
  g.fillRect(cx + 1 * s - legSwing * 0.4, legY, legW, legH - crouch);
  // shoes
  g.fillStyle = "#12121f";
  g.fillRect(cx - legW - 1 * s + legSwing * 0.4, legY + legH - crouch - 3 * s, legW + 2 * s, 4 * s);
  g.fillRect(cx + 1 * s - legSwing * 0.4, legY + legH - crouch - 3 * s, legW + 2 * s, 4 * s);

  // torso (YAJ jersey)
  const torsoGrad = g.createLinearGradient(cx - w / 2, bodyY, cx + w / 2, bodyY + bodyH);
  torsoGrad.addColorStop(0, "#8b5cf6");
  torsoGrad.addColorStop(1, "#6d28d9");
  g.fillStyle = torsoGrad;
  g.fillRect(cx - w * 0.42, bodyY, w * 0.84, bodyH);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = `900 ${Math.round(9 * s)}px ui-sans-serif, system-ui`;
  g.textAlign = "center";
  g.fillText("YAJ", cx, bodyY + bodyH * 0.62);
  g.textAlign = "left";

  // arms
  g.fillStyle = "#f5c9a4";
  const armW = w * 0.22;
  const armH = bodyH * 0.78;
  const armY = bodyY + 2 * s + (anim === "climb" || anim === "hang" ? -8 * s : 0);
  g.fillRect(cx - w * 0.42 - armW + 1 * s, armY + armSwing * 0.4, armW, armH);
  g.fillRect(cx + w * 0.42 - 1 * s, armY - armSwing * 0.4, armW, armH);

  // head
  const headSize = w * 0.62;
  const headY = bodyY - headSize - 1 * s;
  g.fillStyle = "#f5c9a4";
  g.fillRect(cx - headSize / 2, headY, headSize, headSize);
  // hair / cap
  g.fillStyle = "#1f2937";
  g.fillRect(cx - headSize / 2, headY, headSize, headSize * 0.28);
  g.fillRect(cx - headSize / 2 + (face > 0 ? headSize * 0.5 : -headSize * 0.25), headY + headSize * 0.2, headSize * 0.75, headSize * 0.12);
  // eye — always faces the direction of travel
  g.fillStyle = "#111827";
  const eyeX = cx + face * headSize * 0.16;
  g.fillRect(eyeX - 1.6 * s, headY + headSize * 0.45, 3.2 * s, 3.6 * s);
  // mouth
  g.fillStyle = "rgba(17,24,39,0.7)";
  g.fillRect(cx + face * headSize * 0.08, headY + headSize * 0.68, 5 * s, 1.6 * s);

  g.restore();

  // shield bubble
  if (st.powers.shield > 0) {
    g.save();
    g.strokeStyle = "rgba(56,189,248,0.9)";
    g.lineWidth = Math.max(1.5, 2 * s);
    g.shadowColor = "#38bdf8";
    g.shadowBlur = 14;
    g.beginPath();
    g.ellipse(cx, yTop + hh * 0.5, w * 0.95, hh * 0.68, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  // speed streaks
  if (st.powers.speed > 0 && Math.abs(st.vx) > 60) {
    g.save();
    g.strokeStyle = "rgba(251,113,133,0.7)";
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = yTop + hh * (0.3 + i * 0.2);
      g.beginPath();
      g.moveTo(cx - st.facing * (w * 0.7 + i * 6 * s), yy);
      g.lineTo(cx - st.facing * (w * 1.5 + i * 10 * s), yy);
      g.stroke();
    }
    g.restore();
  }
}
