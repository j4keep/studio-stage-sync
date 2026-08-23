/**
 * YAJ Sugar Rush maze renderer — original hand-drawn 2D canvas art (no external assets):
 * candy-street floors, frosting walls, gummy bridges, chocolate tunnels, lollipop gates,
 * syrup puddles, a donut-corner shop plaza, and simple original shapes for every
 * collectible/hazard/power-up. Nothing here is modeled on any existing maze game's art.
 */

import { CandyCityMap } from "@/lib/sugar-rush-map";
import { SugarRushMazeState, cartWorldPos } from "@/lib/sugar-rush-maze";
import candy0 from "@/assets/games/sugar-rush/candy-0.png.asset.json";
import candy1 from "@/assets/games/sugar-rush/candy-1.png.asset.json";
import candy2 from "@/assets/games/sugar-rush/candy-2.png.asset.json";
import candy3 from "@/assets/games/sugar-rush/candy-3.png.asset.json";
import candy4 from "@/assets/games/sugar-rush/candy-4.png.asset.json";
import candy5 from "@/assets/games/sugar-rush/candy-5.png.asset.json";

export type Camera = { x: number; y: number; scale: number };

const VIEW_CELLS_H = 9.5;

const CANDY_URLS = [candy0.url, candy1.url, candy2.url, candy3.url, candy4.url, candy5.url];
const candyImages: HTMLImageElement[] = [];
function candyImage(index: number) {
  if (typeof Image === "undefined") return null;
  if (!candyImages[index]) {
    const img = new Image();
    img.decoding = "async";
    img.src = CANDY_URLS[index % CANDY_URLS.length];
    candyImages[index] = img;
  }
  return candyImages[index];
}

function drawCandySprite(g: CanvasRenderingContext2D, index: number, cx: number, cy: number, size: number) {
  const img = candyImage(index);
  if (img?.complete && img.naturalWidth > 0) {
    g.save();
    g.shadowColor = "rgba(20, 4, 40, .38)";
    g.shadowBlur = Math.max(4, size * 0.14);
    g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    g.restore();
    return true;
  }
  return false;
}

export function makeCamera(target: { x: number; y: number }, map: CandyCityMap, w: number, h: number, prev?: Camera): Camera {
  const vh = VIEW_CELLS_H * map.cellSize;
  const scale = h / vh;
  const vw = w / scale;
  const mapW = map.cols * map.cellSize;
  const mapH = map.rows * map.cellSize;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const tx = mapW <= vw ? mapW / 2 : clamp(target.x, vw / 2, mapW - vw / 2);
  const ty = mapH <= vh ? mapH / 2 : clamp(target.y, vh / 2, mapH - vh / 2);
  if (!prev) return { x: tx, y: ty, scale };
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
  return { x: lerp(prev.x, tx, 0.15), y: lerp(prev.y, ty, 0.15), scale };
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, r2: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

export function drawCandyCity(g: CanvasRenderingContext2D, st: SugarRushMazeState, cam: Camera, w: number, h: number) {
  const map = st.map;
  const CELL = map.cellSize;
  g.save();
  g.clearRect(0, 0, w, h);

  const bg = g.createLinearGradient(0, 0, 0, h);
  if (st.rushActive) {
    bg.addColorStop(0, "#3a0f52");
    bg.addColorStop(1, "#1c0630");
  } else {
    bg.addColorStop(0, "#4a2271");
    bg.addColorStop(1, "#25113f");
  }
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  const toScreenX = (x: number) => (x - cam.x) * cam.scale + w / 2;
  const toScreenY = (y: number) => (y - cam.y) * cam.scale + h / 2;

  const vw = w / cam.scale;
  const vh = h / cam.scale;
  const c0 = Math.max(0, Math.floor((cam.x - vw / 2) / CELL) - 1);
  const c1 = Math.min(map.cols - 1, Math.ceil((cam.x + vw / 2) / CELL) + 1);
  const r0 = Math.max(0, Math.floor((cam.y - vh / 2) / CELL) - 1);
  const r1 = Math.min(map.rows - 1, Math.ceil((cam.y + vh / 2) / CELL) + 1);

  const inPlaza = (c: number, r: number) => map.shopPlaza.some((p) => p.c === c && p.r === r);

  // ── Floors ─────────────────────────────────────────────────────────────────
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = toScreenX(c * CELL);
      const y = toScreenY(r * CELL);
      const s = CELL * cam.scale;
      const checker = (c + r) % 2 === 0;
      g.fillStyle = inPlaza(c, r) ? "#9a6ccc" : checker ? "#5b347e" : "#4d2b70";
      g.fillRect(x, y, s + 1, s + 1);
    }
  }

  // Syrup puddles
  for (const h2 of map.hazards) {
    if (h2.kind !== "syrup") continue;
    for (const cell of h2.cells) {
      const cx = toScreenX(cell.c * CELL + CELL / 2);
      const cy = toScreenY(cell.r * CELL + CELL / 2);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, (CELL / 2) * cam.scale);
      grad.addColorStop(0, "rgba(255,150,40,.55)");
      grad.addColorStop(1, "rgba(255,150,40,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, (CELL / 2) * cam.scale, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Sour patch tint
  for (const h2 of map.hazards) {
    if (h2.kind !== "sourPatch") continue;
    for (const cell of h2.cells) {
      const cx = toScreenX(cell.c * CELL + CELL / 2);
      const cy = toScreenY(cell.r * CELL + CELL / 2);
      g.fillStyle = "rgba(150,255,90,.28)";
      g.beginPath();
      g.arc(cx, cy, (CELL / 2.4) * cam.scale, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ── Walls ("frosting") ────────────────────────────────────────────────────
  g.fillStyle = "#ffe6f4";
  g.strokeStyle = "#ff9fd3";
  const wallT = Math.max(3, CELL * 0.11 * cam.scale);
  const drawWallSeg = (x1: number, y1: number, x2: number, y2: number) => {
    g.beginPath();
    g.lineCap = "round";
    g.lineWidth = wallT;
    g.strokeStyle = "#ffb6dd";
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.lineWidth = wallT * 0.5;
    g.strokeStyle = "#fff6fb";
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = map.cells[r * map.cols + c];
      const x = toScreenX(c * CELL);
      const y = toScreenY(r * CELL);
      const s = CELL * cam.scale;
      if (!cell.open.n) drawWallSeg(x, y, x + s, y);
      if (!cell.open.w) drawWallSeg(x, y, x, y + s);
      if (r === map.rows - 1 && !cell.open.s) drawWallSeg(x, y + s, x + s, y + s);
      if (c === map.cols - 1 && !cell.open.e) drawWallSeg(x + s, y, x + s, y + s);
    }
  }

  // Chocolate block gates (toggling)
  for (const hz of map.hazards) {
    if (hz.kind !== "chocolateBlock") continue;
    const open = st.chocolateBlockOpen[hz.id];
    const midX = toScreenX(((hz.a.c + hz.b.c) / 2 + 0.5) * CELL);
    const midY = toScreenY(((hz.a.r + hz.b.r) / 2 + 0.5) * CELL);
    if (!open) {
      g.fillStyle = "#5a3420";
      g.strokeStyle = "#8a5a34";
      g.lineWidth = Math.max(2, CELL * 0.08 * cam.scale);
      const barLen = CELL * 0.7 * cam.scale;
      const vertical = hz.a.c === hz.b.c;
      g.beginPath();
      if (vertical) {
        g.moveTo(midX - barLen / 2, midY);
        g.lineTo(midX + barLen / 2, midY);
      } else {
        g.moveTo(midX, midY - barLen / 2);
        g.lineTo(midX, midY + barLen / 2);
      }
      g.lineWidth = Math.max(4, CELL * 0.22 * cam.scale);
      g.strokeStyle = "#6b3d22";
      g.stroke();
      g.lineWidth = Math.max(2, CELL * 0.1 * cam.scale);
      g.strokeStyle = "#a9713f";
      g.stroke();
    }
  }

  // Tunnels
  for (const tp of map.tunnels) {
    for (const end of [tp.a, tp.b]) {
      const cx = toScreenX(end.c * CELL + CELL / 2);
      const cy = toScreenY(end.r * CELL + CELL / 2);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, (CELL / 2.2) * cam.scale);
      grad.addColorStop(0, "#3d2210");
      grad.addColorStop(0.7, "#6b3d1f");
      grad.addColorStop(1, "rgba(107,61,31,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, (CELL / 2.2) * cam.scale, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Shop plaza landmark
  if (map.shopPlaza.length) {
    const cx = toScreenX(map.shopPlaza[Math.floor(map.shopPlaza.length / 2)].c * CELL + CELL / 2);
    const cy = toScreenY(map.shopPlaza[Math.floor(map.shopPlaza.length / 2)].r * CELL + CELL / 2);
    g.fillStyle = "#ffd166";
    g.font = `${Math.max(10, 22 * cam.scale)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.fillText("Candy Shop", cx, cy - CELL * 0.7 * cam.scale);
  }

  // Exit gate
  {
    const cx = toScreenX(map.exit.c * CELL + CELL / 2);
    const cy = toScreenY(map.exit.r * CELL + CELL / 2);
    const s = (CELL / 2) * cam.scale;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = st.exitUnlocked ? "#7CFFB2" : "#5a5a72";
    g.strokeStyle = st.exitUnlocked ? "#c9ffe0" : "#8888a0";
    g.lineWidth = Math.max(2, 3 * cam.scale);
    if (st.exitUnlocked) {
      g.shadowColor = "#7CFFB2";
      g.shadowBlur = 18 * cam.scale;
    }
    g.beginPath();
    g.roundRect(-s * 0.7, -s * 0.9, s * 1.4, s * 1.8, 6 * cam.scale);
    g.fill();
    g.stroke();
    g.restore();
  }

  // Moving candy cart
  {
    const pos = cartWorldPos(st);
    const cx = toScreenX(pos.x);
    const cy = toScreenY(pos.y);
    const s = CELL * 0.36 * cam.scale;
    g.fillStyle = "#ff6b6b";
    g.beginPath();
    g.roundRect(cx - s, cy - s * 0.6, s * 2, s * 1.2, s * 0.3);
    g.fill();
    g.fillStyle = "#3a2160";
    g.beginPath();
    g.arc(cx - s * 0.55, cy + s * 0.55, s * 0.3, 0, Math.PI * 2);
    g.arc(cx + s * 0.55, cy + s * 0.55, s * 0.3, 0, Math.PI * 2);
    g.fill();
  }

  // ── Collectibles / power-ups ─────────────────────────────────────────────
  const bob = Math.sin(st.t * 4) * 2 * cam.scale;
  for (const item of map.collectibles) {
    if (st.taken[item.id]) continue;
    const cx = toScreenX(item.c * CELL + CELL / 2);
    const cy = toScreenY(item.r * CELL + CELL / 2) + bob;
    if (cx < -20 || cx > w + 20 || cy < -20 || cy > h + 20) continue;
    const rr = CELL * 0.16 * cam.scale;
    const candySize = CELL * 0.46 * cam.scale;
    if (item.kind === "gummy") {
      if (!drawCandySprite(g, 0, cx, cy, candySize)) {
        g.fillStyle = "#ff6fa3"; g.beginPath(); g.ellipse(cx, cy, rr, rr * 1.15, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (item.kind === "candyDrop") {
      if (!drawCandySprite(g, 2, cx, cy, candySize)) {
        g.fillStyle = "#5fd0ff"; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      }
    } else if (item.kind === "sugarStar") {
      g.save();
      g.shadowColor = "#ffe066";
      g.shadowBlur = 10 * cam.scale;
      g.fillStyle = "#ffe066";
      star(g, cx, cy, rr * 1.35, rr * 0.58);
      g.fill();
      g.restore();
    } else if (item.kind === "donutToken") {
      if (!drawCandySprite(g, 4, cx, cy, candySize * 1.03)) {
        g.strokeStyle = "#ffb0c8"; g.lineWidth = rr * 0.65; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
      }
    } else if (item.kind === "frostingGem") {
      if (!drawCandySprite(g, 5, cx, cy, candySize * 0.92)) {
        g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillStyle = "#8ef4ff"; g.fillRect(-rr, -rr, rr * 2, rr * 2); g.restore();
      }
    }
  }

  for (const pu of map.powerups) {
    if (st.taken[pu.id]) continue;
    const cx = toScreenX(pu.c * CELL + CELL / 2);
    const cy = toScreenY(pu.r * CELL + CELL / 2) + bob * 1.3;
    if (cx < -20 || cx > w + 20 || cy < -20 || cy > h + 20) continue;
    const rr = CELL * 0.22 * cam.scale;
    const colors: Record<string, string> = { speed: "#ffb347", shield: "#7cc6ff", magnet: "#ff77e0", freeze: "#9fe8ff" };
    g.fillStyle = colors[pu.kind] ?? "#fff";
    g.strokeStyle = "rgba(255,255,255,.85)";
    g.lineWidth = Math.max(1.5, 2 * cam.scale);
    g.beginPath();
    g.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.4);
    g.fill();
    g.stroke();
  }

  // ── Sugar Rush Mode screen glow ───────────────────────────────────────────
  if (st.rushActive) {
    g.save();
    g.globalCompositeOperation = "screen";
    const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    glow.addColorStop(0, "rgba(255, 210, 90, .22)");
    glow.addColorStop(1, "rgba(255, 210, 90, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  g.restore();
}

/** Screen-space player/Cavity positions for the 3D overlay Canvas to read each frame. */
export function toScreenPos(worldX: number, worldY: number, cam: Camera, w: number, h: number) {
  return { x: (worldX - cam.x) * cam.scale + w / 2, y: (worldY - cam.y) * cam.scale + h / 2 };
}
