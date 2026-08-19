import { useEffect, useRef, useState } from "react";
import type { PlayKind, PlayType } from "@/lib/football";
import { Mascot, MascotKind, Player, PlayerPose } from "./PlayerArt";

type LastPlayView = { play: PlayType; kind: PlayKind; yards: number; message: string; mine: boolean } | null;

const MID_Y = 250;
const OL_Y = [175, 208, 250, 292, 322];
const DEF_Y = [190, 226, 268, 308];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const easeOut = (u: number) => 1 - Math.pow(1 - u, 2.2);

/**
 * Animated on-field players: the offense lines up at the ball, the play snaps,
 * the carrier/receiver runs, passes fly in an arc and get caught, and defenders
 * converge for the tackle. Purely presentational — it replays whatever the
 * resolved play in `lastPlay` says happened.
 */
export default function FootballAction({
  fieldLeft,
  fieldWidth,
  ballOnFromMyGoal,
  myBall,
  lastPlay,
  playNumber,
  myAccent,
  oppAccent,
  myMascot = "bear",
  oppMascot = "eagle",
}: {
  fieldLeft: number;
  fieldWidth: number;
  ballOnFromMyGoal: number;
  myBall: boolean;
  lastPlay: LastPlayView;
  playNumber: number;
  myAccent: string;
  oppAccent: string;
  myMascot?: MascotKind;
  oppMascot?: MascotKind;
}) {
  const toX = (yard: number) => fieldLeft + (clamp(yard, 0, 100) / 100) * fieldWidth;
  const ballX = toX(ballOnFromMyGoal);

  const prevX = useRef(ballX);
  const seen = useRef<string | null>(null);
  const plan = useRef<{ start: number; end: number; dir: 1 | -1; kind: PlayKind; play: PlayType; mine: boolean } | null>(null);
  const [t, setT] = useState(1);

  useEffect(() => {
    if (!lastPlay) return;
    const id = `${playNumber}-${lastPlay.kind}`;
    if (seen.current === id) return;
    seen.current = id;
    plan.current = {
      start: prevX.current,
      end: ballX,
      dir: lastPlay.mine ? 1 : -1,
      kind: lastPlay.kind,
      play: lastPlay.play,
      mine: lastPlay.mine,
    };
    const dur = lastPlay.play === "long_pass" || lastPlay.play === "punt" || lastPlay.play === "field_goal" ? 2000 : 1650;
    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const u = Math.min(1, (now - t0) / dur);
      setT(u);
      if (u < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [playNumber, lastPlay]);

  useEffect(() => {
    if (t >= 1) prevX.current = ballX;
  }, [t, ballX]);

  const p = plan.current;
  const active = t < 1 && !!p;

  // ---- Resting formation -------------------------------------------------
  let dir: 1 | -1 = myBall ? 1 : -1;
  let offColor = myBall ? myAccent : oppAccent;
  let defColor = myBall ? oppAccent : myAccent;
  let losX = ballX;
  let carrierX = ballX;
  let carrierPose: PlayerPose = "idle";
  let carrierHasBall = true;
  let ball: { x: number; y: number; visible: boolean; spin: number } = { x: ballX, y: MID_Y, visible: false, spin: 0 };
  let defenders = DEF_Y.map((y, i) => ({ x: ballX + dir * (70 + i * 6), y, pose: "idle" as PlayerPose }));
  let qbPose: PlayerPose = "idle";
  let receiver: { x: number; y: number; pose: PlayerPose; show: boolean } = { x: ballX, y: MID_Y, pose: "idle", show: false };

  // ---- Active play -------------------------------------------------------
  if (active && p) {
    dir = p.dir;
    offColor = p.mine ? myAccent : oppAccent;
    defColor = p.mine ? oppAccent : myAccent;
    losX = p.start;

    const isPass = p.play === "short_pass" || p.play === "long_pass";
    const isKick = p.play === "punt" || p.play === "field_goal";
    const target = p.kind === "interception" || p.kind === "fumble" || p.kind === "turnover_on_downs" || p.play === "punt" || p.play === "field_goal" ? p.start + dir * Math.max(40, Math.abs(p.end - p.start) * 0.4) : p.end;

    if (isKick) {
      carrierX = p.start - dir * 10;
      carrierPose = t < 0.18 ? "idle" : "kick";
      carrierHasBall = t < 0.18;
      const u = clamp((t - 0.18) / 0.7, 0, 1);
      ball = {
        x: lerp(p.start, target, u),
        y: MID_Y - Math.sin(Math.PI * u) * 130,
        visible: t > 0.18,
        spin: u * 900,
      };
      defenders = DEF_Y.map((y, i) => ({ x: lerp(p.start + dir * (70 + i * 6), target - dir * (14 + i * 10), easeOut(t)), y, pose: "run" as PlayerPose }));
    } else if (isPass) {
      // QB drops back, receiver streaks downfield, ball arcs to him
      carrierX = p.start - dir * (10 + 12 * Math.min(1, t / 0.25));
      qbPose = t > 0.22 && t < 0.42 ? "throw" : "idle";
      carrierHasBall = t < 0.32;
      carrierPose = qbPose;

      const catchU = clamp((t - 0.1) / 0.6, 0, 1);
      const recX = lerp(p.start + dir * 12, p.end + dir * 4, easeOut(catchU));
      const recPose: PlayerPose =
        p.kind === "incomplete" ? (t > 0.62 ? "catch" : "run") : t > 0.6 && t < 0.72 ? "catch" : t > 0.92 && p.kind === "touchdown" ? "celebrate" : t > 0.9 ? "tackle" : "run";
      receiver = { x: recX, y: MID_Y - 34, pose: recPose, show: true };

      const fu = clamp((t - 0.32) / 0.34, 0, 1);
      const landed = t >= 0.66;
      const catcher = p.kind === "interception" ? { x: p.end, y: MID_Y + 26 } : { x: recX, y: MID_Y - 34 };
      ball = {
        x: landed ? (p.kind === "incomplete" ? recX + dir * 14 : catcher.x) : lerp(p.start - dir * 18, catcher.x, fu),
        y: landed ? (p.kind === "incomplete" ? MID_Y + 6 : catcher.y - 12) : lerp(MID_Y - 22, catcher.y - 12, fu) - Math.sin(Math.PI * fu) * 74,
        visible: t > 0.3,
        spin: fu * 720,
      };
      defenders = DEF_Y.map((y, i) => {
        const chase = clamp((t - 0.25) / 0.7, 0, 1);
        const tx = p.kind === "incomplete" ? recX - dir * (10 + i * 12) : recX - dir * (8 + i * 14);
        return { x: lerp(p.start + dir * (70 + i * 8), tx, easeOut(chase)), y: lerp(y, MID_Y - 30 + i * 16, chase * 0.7), pose: "run" as PlayerPose };
      });
    } else {
      // Run play
      const u = easeOut(clamp(t / 0.85, 0, 1));
      carrierX = lerp(p.start, target, u);
      carrierPose = p.kind === "touchdown" && t > 0.9 ? "celebrate" : t > 0.88 ? "tackle" : "run";
      carrierHasBall = p.kind !== "fumble" || t < 0.75;
      ball = { x: carrierX + dir * 16, y: MID_Y + 4, visible: p.kind === "fumble" && t >= 0.75, spin: t * 540 };
      defenders = DEF_Y.map((y, i) => {
        const chase = clamp((t - 0.12) / 0.8, 0, 1);
        return { x: lerp(p.start + dir * (70 + i * 6), carrierX - dir * (10 + i * 13), easeOut(chase)), y: lerp(y, MID_Y - 24 + i * 16, chase * 0.75), pose: "run" as PlayerPose };
      });
    }
  }

  const facing: 1 | -1 = dir === 1 ? 1 : -1;
  const defFacing: 1 | -1 = dir === 1 ? -1 : 1;
  const carrierRunning = carrierPose === "run";

  return (
    <g>
      {/* sideline mascots */}
      <Mascot x={fieldLeft - 44} y={392} scale={0.82} kind={myMascot} color={myAccent} facing={1} />
      <Mascot x={fieldLeft + fieldWidth + 44} y={392} scale={0.82} kind={oppMascot} color={oppAccent} facing={-1} />

      {/* offensive line at the snap point */}
      {OL_Y.map((y, i) => (
        <Player key={`ol-${i}`} x={losX - dir * (16 + (i % 2) * 4)} y={y} scale={0.9} color={offColor} facing={facing} pose={active && t > 0.06 ? "run" : "idle"} number={60 + i} seed={i} />
      ))}

      {/* defenders */}
      {defenders.map((d, i) => (
        <Player key={`d-${i}`} x={d.x} y={d.y} scale={0.9} color={defColor} facing={defFacing} pose={d.pose} number={20 + i * 3} seed={i + 2} />
      ))}

      {/* receiver (pass plays) */}
      {receiver.show && (
        <Player x={receiver.x} y={receiver.y} scale={0.95} color={offColor} facing={facing} pose={receiver.pose} number={11} hasBall={receiver.pose !== "run" && !ball.visible} seed={4} />
      )}

      {/* ball carrier / quarterback */}
      <Player
        x={carrierX}
        y={MID_Y + 8}
        scale={1.02}
        color={offColor}
        facing={facing}
        pose={carrierRunning ? "run" : carrierPose}
        number={1}
        hasBall={carrierHasBall}
        seed={1}
      />

      {/* loose / airborne ball */}
      {ball.visible && (
        <g transform={`translate(${ball.x} ${ball.y}) rotate(${ball.spin})`}>
          <ellipse cx="0" cy="0" rx="7" ry="4.4" fill="#6b4226" stroke="#1a0f08" strokeWidth="1.2" />
          <line x1="-3.4" y1="0" x2="3.4" y2="0" stroke="#e8dcc8" strokeWidth="1.1" />
        </g>
      )}
    </g>
  );
}
