/**
 * YAJ Snake Royale renderer — original hand-drawn 2.5D canvas art (no external
 * assets): angled top-down jungle tiles, trees/bushes/logs/ruins, hazard ground
 * warnings, croc-water tinting, and the blocky YAJ character composited separately
 * by SnakeRoyaleActors.tsx.
 */

import { GRID_H, GRID_W, JungleMap, TILE, Terrain, idx } from "@/lib/snake-royale/map";
import { SnakeRoyaleState } from "@/lib/snake-royale/engine";

export type Camera = { x: number; y: number; scale: number; vw: number; vh: number };

const SQUASH = 0.78;

const TERRAIN: Record<Terrain, string> = {
  path: "#c9a86a",
  grass: "#2f8f4d",
  water: "#1c5f86",
  shallow: "#2f8aa8",
  mud: "#6b5230",
  bridge: "#8a5c2f",
  ruins: "#8f8672",
  rock: "#7d7f74",
  camp: "#6f5b3f",
  road: "#7b684e",
};

export function makeCamera(st: SnakeRoyaleState, w: number, h: number, prev?: Camera): Camera {
  const worldW = Math.max(620, Math.min(880, 700 * (w / 420)));
  const scale = w / worldW;
  const vw = worldW;
  const vh = h / scale;

  const targetX = st.x - vw / 2;
  const targetY = st.y - vh / (2 * SQUASH);
  const maxX = GRID_W * TILE - vw;
  const maxY = GRID_H * TILE - vh / SQUASH;
  const cx = clamp(targetX, -TILE, Math.max(-TILE, maxX + TILE));
  const cy = clamp(targetY, -TILE, Math.max(-TILE, maxY + TILE));

  if (!prev) return { x: cx, y: cy, scale, vw, vh };
  const k = 0.16;
  return { x: prev.x + (cx - prev.x) * k, y: prev.y + (cy - prev.y) * k, scale, vw, vh };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function drawJungle(g: CanvasRenderingContext2D, st: SnakeRoyaleState, cam: Camera, w: number, h: number) {
  const s = cam.scale;
  const sx = (wx: number) => (wx - cam.x) * s;
  const sy = (wy: number) => (wy - cam.y) * s * SQUASH;

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#123a1f");
  sky.addColorStop(0.5, "#1c5a2e");
  sky.addColorStop(1, "#0f2e1a");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const tx1 = Math.min(GRID_W - 1, Math.ceil((cam.x + cam.vw) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const ty1 = Math.min(GRID_H - 1, Math.ceil((cam.y + cam.vh / SQUASH) / TILE) + 2);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let txi = tx0; txi <= tx1; txi++) {
      const t = st.map.tiles[idx(txi, ty)];
      const x = sx(txi * TILE);
      const y = sy(ty * TILE);
      const tw = TILE * s + 1;
      const th = TILE * s * SQUASH + 1;

      g.fillStyle = TERRAIN[t];
      g.fillRect(x, y, tw, th);

      if ((txi + ty) % 2 === 0) {
        g.fillStyle = "rgba(255,255,255,0.04)";
        g.fillRect(x, y, tw, th);
      }

      if (t === "water") {
        g.fillStyle = "rgba(255,255,255,0.08)";
        const wob = Math.sin(st.t * 2 + txi * 0.5 + ty * 0.4) * 2;
        g.fillRect(x, y + th / 2 + wob, tw, 2);
      }
      if (t === "bridge") {
        g.strokeStyle = "rgba(60,35,15,0.4)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y + th / 2);
        g.lineTo(x + tw, y + th / 2);
        g.stroke();
      }
      if (t === "ruins") {
        g.strokeStyle = "rgba(255,255,255,0.14)";
        g.lineWidth = 1;
        g.strokeRect(x + 2, y + 2, tw - 4, th - 4);
      }
    }
  }

  // ground warnings under incoming rocks/branches
  for (const hz of st.impacts) {
    if (hz.impacted) continue;
    const cx = sx(hz.x);
    const cy = sy(hz.y);
    const p = 1 - Math.max(0, hz.warn) / (hz.kind === "rock" ? 1.1 : 0.9);
    g.save();
    g.strokeStyle = hz.kind === "rock" ? "rgba(180,180,180,0.95)" : "rgba(150,220,120,0.95)";
    g.lineWidth = Math.max(2, 3 * s);
    g.setLineDash([6 * s, 5 * s]);
    g.beginPath();
    g.ellipse(cx, cy, hz.radius * s, hz.radius * s * SQUASH, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = hz.kind === "rock" ? "rgba(180,180,180,0.28)" : "rgba(150,220,120,0.28)";
    g.beginPath();
    g.ellipse(cx, cy, hz.radius * s * p, hz.radius * s * SQUASH * p, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    const fallH = (1 - p) * 200 * s;
    if (hz.kind === "rock") {
      g.fillStyle = "#8b8d84";
      g.beginPath();
      g.arc(cx, cy - fallH - 8 * s, 10 * s, 0, Math.PI * 2);
      g.fill();
    } else {
      g.save();
      g.translate(cx, cy - fallH - 10 * s);
      g.rotate((1 - p) * 2);
      g.strokeStyle = "#5c4326";
      g.lineWidth = 4 * s;
      g.beginPath();
      g.moveTo(-14 * s, 0);
      g.lineTo(14 * s, 0);
      g.stroke();
      g.restore();
    }
  }

  // props sorted by world Y so nearer things draw over
  type Drawable = { y: number; draw: () => void };
  const items: Drawable[] = [];

  for (const p of st.map.props) {
    if (p.x < cam.x - TILE * 2 || p.x > cam.x + cam.vw + TILE * 2) continue;
    if (p.y < cam.y - TILE * 3 || p.y > cam.y + cam.vh / SQUASH + TILE * 3) continue;
    items.push({ y: p.y, draw: () => drawProp(g, p.kind, sx(p.x), sy(p.y), p.scale * s, st.t) });
  }

  for (const star of st.starList) {
    if (star.taken) continue;
    const bob = Math.sin(st.t * 3 + star.x * 0.02) * 4 * s;
    items.push({ y: star.y, draw: () => drawStar(g, sx(star.x), sy(star.y) - 16 * s + bob, 11 * s) });
  }

  for (const hz of st.impacts) {
    if (!hz.impacted || hz.age >= 0.7) continue;
    items.push({ y: hz.y, draw: () => drawImpactSplat(g, hz.kind, sx(hz.x), sy(hz.y), 28 * s) });
  }

  items.sort((a, b) => a.y - b.y);
  items.forEach((i) => i.draw());

  // Moving wildlife gives Snake Royale its own living-jungle identity.
  for (const a of st.animals) {
    const x = sx(a.x), y = sy(a.y);
    drawAnimal(g, a.kind, x, y, 1.05 * s, Math.atan2(a.vy, a.vx), a.stunned > 0, st.t);
  }

  // Defense pickups.
  for (const p of st.pickups) {
    if (p.taken) continue;
    drawPickup(g, p.kind, sx(p.x), sy(p.y), s, st.t);
  }

  // Abandoned extraction jeep + final road beacon. The jeep disappears once the player enters it.
  if (!st.driving) drawJeep(g, sx(st.map.jeep.x), sy(st.map.jeep.y), s, false);
  else drawJeep(g, sx(st.x), sy(st.y), s, true);
  const ex = sx(st.map.exit.x), ey = sy(st.map.exit.y);
  g.save();
  g.strokeStyle = "rgba(255,225,95,.9)"; g.lineWidth = Math.max(2, 3*s);
  g.setLineDash([10*s, 8*s]); g.beginPath(); g.arc(ex, ey, 34*s, 0, Math.PI*2); g.stroke(); g.restore();

  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = "#fbbf24";
  g.shadowColor = "#fbbf24";
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

function drawImpactSplat(g: CanvasRenderingContext2D, kind: "rock" | "branch", cx: number, cy: number, size: number) {
  g.save();
  g.globalAlpha = 0.5;
  g.fillStyle = kind === "rock" ? "#8b8d84" : "#5c4326";
  g.beginPath();
  g.ellipse(cx, cy, size / 2, size / 3.4, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawProp(g: CanvasRenderingContext2D, kind: string, cx: number, cy: number, s: number, t: number) {
  const sway = Math.sin(t * 1.4 + cx * 0.01) * 0.03;
  g.save();
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(cx, cy + 4 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
  g.fill();

  if (kind === "tree") {
    g.strokeStyle = "#5c3c1e";
    g.lineWidth = 7 * s;
    g.beginPath();
    g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + 6 * s * sway * 8, cy - 30 * s, cx + 10 * s * sway * 8, cy - 56 * s);
    g.stroke();
    const topX = cx + 10 * s * sway * 8;
    const topY = cy - 56 * s;
    g.fillStyle = "#256b3a";
    g.beginPath();
    g.arc(topX, topY - 10 * s, 26 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2f8f4d";
    g.beginPath();
    g.arc(topX - 10 * s, topY - 2 * s, 18 * s, 0, Math.PI * 2);
    g.fill();
    g.arc(topX + 12 * s, topY, 16 * s, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "bush") {
    g.fillStyle = "#256b3a";
    g.beginPath();
    g.arc(cx - 10 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
    g.arc(cx + 10 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
    g.arc(cx, cy - 14 * s, 13 * s, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "log") {
    g.fillStyle = "#6b4423";
    g.fillRect(cx - 22 * s, cy - 10 * s, 44 * s, 12 * s);
    g.fillStyle = "#8a5a2b";
    g.beginPath();
    g.ellipse(cx - 22 * s, cy - 4 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "vine") {
    g.strokeStyle = "#3fae5c";
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(cx, cy - 60 * s);
    g.quadraticCurveTo(cx + 8 * s * sway * 10, cy - 30 * s, cx, cy - 6 * s);
    g.stroke();
  } else if (kind === "ruinWall") {
    g.fillStyle = "#a39a83";
    g.fillRect(cx - 20 * s, cy - 26 * s, 40 * s, 26 * s);
    g.fillStyle = "#8f8672";
    g.fillRect(cx - 20 * s, cy - 26 * s, 40 * s, 6 * s);
    g.strokeStyle = "rgba(0,0,0,0.2)";
    g.lineWidth = 1 * s;
    for (let i = -1; i <= 1; i++) g.strokeRect(cx - 20 * s + (i + 1) * 13 * s, cy - 20 * s, 12 * s, 18 * s);
  } else if (kind === "signpost") {
    g.fillStyle = "#8a5a2b";
    g.fillRect(cx - 2 * s, cy - 24 * s, 4 * s, 24 * s);
    g.fillStyle = "#f5e0b8";
    g.fillRect(cx - 16 * s, cy - 36 * s, 32 * s, 14 * s);
  } else if (kind === "rockProp") {
    g.fillStyle = "#8b8d84";
    g.beginPath();
    g.moveTo(cx - 18 * s, cy);
    g.lineTo(cx - 11 * s, cy - 18 * s);
    g.lineTo(cx + 4 * s, cy - 22 * s);
    g.lineTo(cx + 18 * s, cy - 6 * s);
    g.lineTo(cx + 12 * s, cy);
    g.closePath();
    g.fill();
  } else if (kind === "fern") {
    g.strokeStyle="#3faa57"; g.lineWidth=3*s;
    for (let i=-2;i<=2;i++){ g.beginPath(); g.moveTo(cx,cy); g.quadraticCurveTo(cx+i*7*s,cy-16*s,cx+i*12*s,cy-25*s); g.stroke(); }
  } else if (kind === "crate") {
    g.fillStyle="#8b5a2b"; g.fillRect(cx-15*s,cy-24*s,30*s,24*s);
    g.strokeStyle="#c18a4b"; g.lineWidth=2*s; g.strokeRect(cx-15*s,cy-24*s,30*s,24*s);
    g.beginPath(); g.moveTo(cx-13*s,cy-22*s); g.lineTo(cx+13*s,cy-2*s); g.moveTo(cx+13*s,cy-22*s); g.lineTo(cx-13*s,cy-2*s); g.stroke();
  } else if (kind === "tent") {
    g.fillStyle="#68764b"; g.beginPath(); g.moveTo(cx-25*s,cy); g.lineTo(cx,cy-32*s); g.lineTo(cx+25*s,cy); g.closePath(); g.fill();
    g.fillStyle="#2f3825"; g.beginPath(); g.moveTo(cx-6*s,cy); g.lineTo(cx,cy-17*s); g.lineTo(cx+6*s,cy); g.closePath(); g.fill();
  }
  g.restore();
}

function drawAnimal(g: CanvasRenderingContext2D, kind: string, cx: number, cy: number, s: number, angle: number, stunned: boolean, t: number) {
  g.save(); g.translate(cx, cy); g.rotate(angle); g.globalAlpha = stunned ? 0.55 : 1;
  const bob = Math.sin(t * 8 + cx * .01) * 2 * s; g.translate(0, bob);
  g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(0, 8*s, 18*s, 7*s, 0, 0, Math.PI*2); g.fill();
  if (kind === "boar") {
    g.fillStyle="#5c3827"; g.fillRect(-19*s,-10*s,34*s,20*s); g.fillStyle="#744733"; g.fillRect(10*s,-12*s,16*s,17*s);
    g.fillStyle="#f2dfba"; g.fillRect(22*s,2*s,7*s,3*s); g.fillRect(22*s,-5*s,7*s,3*s);
  } else if (kind === "jaguar") {
    g.fillStyle="#d9952c"; g.fillRect(-22*s,-10*s,38*s,18*s); g.fillRect(12*s,-14*s,17*s,17*s);
    g.fillStyle="#3a2418"; for (const x of [-13,-2,9]) { g.beginPath(); g.arc(x*s,-2*s,2.5*s,0,Math.PI*2); g.fill(); }
    g.strokeStyle="#d9952c"; g.lineWidth=5*s; g.beginPath(); g.moveTo(-20*s,0); g.quadraticCurveTo(-35*s,-8*s,-40*s,5*s); g.stroke();
  } else if (kind === "croc") {
    g.fillStyle="#477a3c"; g.fillRect(-27*s,-7*s,42*s,14*s); g.fillStyle="#5b944b"; g.fillRect(10*s,-9*s,23*s,18*s);
    g.fillStyle="#e7f1c2"; g.fillRect(29*s,-5*s,4*s,3*s); g.fillRect(29*s,2*s,4*s,3*s);
  } else {
    g.fillStyle="#8a5935"; g.beginPath(); g.arc(0,-4*s,12*s,0,Math.PI*2); g.fill();
    g.fillStyle="#b77b4b"; g.beginPath(); g.arc(11*s,-10*s,8*s,0,Math.PI*2); g.fill();
    g.strokeStyle="#8a5935"; g.lineWidth=4*s; g.beginPath(); g.arc(-11*s,-3*s,14*s,.3,Math.PI*1.6); g.stroke();
  }
  if (stunned) { g.fillStyle="#ffe45c"; g.font=`${16*s}px sans-serif`; g.fillText("★",-8*s,-22*s); }
  g.restore();
}

function drawPickup(g: CanvasRenderingContext2D, kind: string, cx: number, cy: number, s: number, t: number) {
  const bob=Math.sin(t*3+cx*.02)*4*s; g.save(); g.translate(cx,cy-12*s+bob);
  g.shadowColor="#ffe66d";g.shadowBlur=12*s; g.fillStyle=kind==="flare"?"#ff5b45":kind==="repellent"?"#7be0ff":"#9b6a34";
  if(kind==="stick"){g.rotate(-.45);g.fillRect(-3*s,-18*s,6*s,36*s);} else {g.fillRect(-8*s,-14*s,16*s,28*s);}
  g.shadowBlur=0; g.fillStyle="white"; g.font=`bold ${9*s}px sans-serif`; g.textAlign="center"; g.fillText(kind.toUpperCase(),0,27*s); g.restore();
}

function drawJeep(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, driving: boolean) {
  g.save();g.translate(cx,cy); if(driving) g.rotate(-.12);
  g.fillStyle="#c9a227";g.fillRect(-28*s,-18*s,56*s,30*s); g.fillStyle="#263c2d";g.fillRect(-14*s,-14*s,26*s,14*s);
  g.fillStyle="#161616"; for(const x of [-21,21]){g.beginPath();g.arc(x*s,14*s,8*s,0,Math.PI*2);g.fill();}
  g.fillStyle="#f8e27c";g.fillRect(21*s,-10*s,8*s,6*s); g.restore();
}
