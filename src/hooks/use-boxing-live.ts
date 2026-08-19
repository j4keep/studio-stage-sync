import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FighterLive,
  Guard,
  LUNGE,
  MAX_ADVANCE,
  MOVE_COOLDOWN_MS,
  MoveDir,
  PUNCHES,
  Punch,
  PunchOutcome,
  GUARD_COOLDOWN_MS,
  GUARD_MS,
  ROUND_SECONDS,
  STEP,
  clamp,
  computerIntent,
  gapBetween,
  newFighter,
  resolvePunch,
  tickFighter,
} from "@/lib/boxing-live";
import type { FighterAnim } from "@/components/games/boxing/FighterArt";

export type LiveSide = "me" | "opp";
export type LivePhase = "idle" | "fighting" | "over";

type AnimState = { anim: FighterAnim; until: number };

export type BoxingLive = {
  me: FighterLive;
  opp: FighterLive;
  phase: LivePhase;
  winner: LiveSide | null;
  decision: boolean;
  secondsLeft: number;
  message: string | null;
  myAnim: FighterAnim;
  oppAnim: FighterAnim;
  impact: { side: LiveSide; nonce: number } | null;
  gap: number;
  /** 0..1 remaining cooldown per punch, for the button dials. */
  cooldowns: Record<Punch, number>;
  guardCooldown: number;
  start: () => void;
  punch: (p: Punch) => void;
  guard: (g: Guard) => void;
  move: (dir: MoveDir) => void;
};

/**
 * Drives a free-flowing, real-time boxing match. Nobody waits for a turn: every
 * punch, guard and step happens the instant the player asks for it, limited only
 * by that action's own cooldown and the fighter's stamina.
 */
export function useBoxingLive({
  gameId,
  mode,
  enabled,
  onFinish,
}: {
  gameId: string | undefined;
  mode: "solo" | "multiplayer";
  enabled: boolean;
  onFinish?: (winner: LiveSide | null, myHealth: number, oppHealth: number) => void;
}): BoxingLive {
  const meRef = useRef<FighterLive>(newFighter());
  const oppRef = useRef<FighterLive>(newFighter());
  const phaseRef = useRef<LivePhase>("idle");
  const startedAtRef = useRef<number>(0);
  const punchCdRef = useRef<Record<Punch, number>>({ jab: 0, hook: 0, uppercut: 0 });
  const guardCdRef = useRef(0);
  const moveCdRef = useRef(0);
  const oppPunchCdRef = useRef(0);
  const myAnimRef = useRef<AnimState>({ anim: "idle", until: 0 });
  const oppAnimRef = useRef<AnimState>({ anim: "idle", until: 0 });
  const channelRef = useRef<any>(null);
  const finishedRef = useRef(false);
  const nonceRef = useRef(0);

  const [snapshot, setSnapshot] = useState(0);
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [winner, setWinner] = useState<LiveSide | null>(null);
  const [decision, setDecision] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [impact, setImpact] = useState<{ side: LiveSide; nonce: number } | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const bump = () => setSnapshot((n) => n + 1);

  const setAnim = (side: LiveSide, anim: FighterAnim, ms: number) => {
    const ref = side === "me" ? myAnimRef : oppAnimRef;
    ref.current = { anim, until: Date.now() + ms };
  };

  const finish = useCallback((w: LiveSide | null, byDecision: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    phaseRef.current = "over";
    setPhase("over");
    setWinner(w);
    setDecision(byDecision);
    if (w) setAnim(w === "me" ? "opp" : "me", "ko", 60_000);
    finishRef.current?.(w, meRef.current.health, oppRef.current.health);
    bump();
  }, []);

  const send = (payload: any) => {
    if (mode !== "multiplayer") return;
    channelRef.current?.send({ type: "broadcast", event: "bx", payload });
  };

  /* ---------------- realtime wiring ---------------- */
  useEffect(() => {
    if (!gameId || mode !== "multiplayer") return;
    const channel = (supabase as any).channel(`boxing-live-${gameId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel.on("broadcast", { event: "bx" }, ({ payload }: any) => {
      const now = Date.now();
      if (!payload) return;
      if (payload.t === "p") {
        // The opponent threw a punch and already resolved it against my guard.
        const o: PunchOutcome = payload.outcome;
        setAnim("opp", o.punch, PUNCHES[o.punch].cooldownMs * 0.6);
        if (o.hit) {
          meRef.current = { ...meRef.current, health: clamp(meRef.current.health - o.damage, 0, 100) };
          setAnim("me", "hit", 420);
          nonceRef.current += 1;
          setImpact({ side: "me", nonce: nonceRef.current });
        }
        setMessage(o.message);
        bump();
        if (meRef.current.health <= 0) {
          send({ t: "ko", loser: "sender" });
          finish("opp", false);
        }
      } else if (payload.t === "g") {
        oppRef.current = { ...oppRef.current, guard: payload.guard, guardUntil: now + GUARD_MS[payload.guard as Guard] };
        setAnim("opp", payload.guard === "block" ? "guard-block" : "guard-dodge", GUARD_MS[payload.guard as Guard]);
        bump();
      } else if (payload.t === "s") {
        oppRef.current = {
          ...oppRef.current,
          health: payload.health,
          stamina: payload.stamina,
          advance: payload.advance,
        };
        // Mirror the opponent's live pose so their fighter visibly moves on this phone.
        if (payload.anim && oppAnimRef.current.anim !== "ko") {
          if (payload.anim === "idle") {
            if (oppAnimRef.current.until <= now) oppAnimRef.current = { anim: "idle", until: 0 };
          } else if (oppAnimRef.current.until <= now) {
            setAnim("opp", payload.anim as FighterAnim, 260);
          }
        }
        bump();
      } else if (payload.t === "hi") {
        // A late joiner asked for a full picture of my fighter.
        send({ t: "s", health: meRef.current.health, stamina: meRef.current.stamina, advance: meRef.current.advance, anim: myAnimRef.current.anim });
      } else if (payload.t === "ko") {
        // Sender says they were knocked out.
        finish("me", false);
      }
    });

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        send({ t: "hi" });
        send({ t: "s", health: meRef.current.health, stamina: meRef.current.stamina, advance: meRef.current.advance, anim: myAnimRef.current.anim });
      }
    });

    return () => {
      channelRef.current = null;
      (supabase as any).removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode]);

  /* ---------------- simulation loop ---------------- */
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let lastSync = 0;
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;

      meRef.current = tickFighter(meRef.current, dt, now);
      if (mode === "solo") oppRef.current = tickFighter(oppRef.current, dt, now);

      if (myAnimRef.current.until && myAnimRef.current.until <= now && myAnimRef.current.anim !== "ko") myAnimRef.current = { anim: "idle", until: 0 };
      if (oppAnimRef.current.until && oppAnimRef.current.until <= now && oppAnimRef.current.anim !== "ko") oppAnimRef.current = { anim: "idle", until: 0 };

      if (phaseRef.current === "fighting") {
        // Solo: the computer fights on its own clock, no turns involved.
        if (mode === "solo" && now >= oppPunchCdRef.current) {
          const intent = computerIntent(oppRef.current, meRef.current, now);
          if (intent.kind === "punch") {
            const stats = PUNCHES[intent.punch];
            if (oppRef.current.stamina >= stats.cost) {
              oppRef.current = { ...oppRef.current, stamina: clamp(oppRef.current.stamina - stats.cost, 0, 100), guard: null, guardUntil: 0 };
              const outcome = resolvePunch(intent.punch, oppRef.current, meRef.current, now);
              setAnim("opp", intent.punch, stats.cooldownMs * 0.6);
              oppPunchCdRef.current = now + stats.cooldownMs + 120 + Math.random() * 320;
              window.setTimeout(() => {
                if (finishedRef.current) return;
                if (outcome.hit) {
                  meRef.current = { ...meRef.current, health: clamp(meRef.current.health - outcome.damage, 0, 100) };
                  setAnim("me", "hit", 400);
                  nonceRef.current += 1;
                  setImpact({ side: "me", nonce: nonceRef.current });
                }
                setMessage(outcome.message);
                bump();
                if (meRef.current.health <= 0) finish("opp", false);
              }, stats.windupMs);
            } else {
              oppPunchCdRef.current = now + 400;
            }
          } else if (intent.kind === "guard") {
            oppRef.current = { ...oppRef.current, guard: intent.guard, guardUntil: now + GUARD_MS[intent.guard] };
            setAnim("opp", intent.guard === "block" ? "guard-block" : "guard-dodge", GUARD_MS[intent.guard]);
            oppPunchCdRef.current = now + 320 + Math.random() * 380;
          } else if (intent.kind === "move") {
            const delta = intent.dir === "in" ? STEP : -STEP;
            oppRef.current = { ...oppRef.current, advance: clamp(oppRef.current.advance + delta, 0, MAX_ADVANCE) };
            oppPunchCdRef.current = now + 220;
          } else {
            oppPunchCdRef.current = now + 260;
          }
        }

        // Match clock → decision.
        const left = ROUND_SECONDS - Math.floor((now - startedAtRef.current) / 1000);
        if (left <= 0) {
          const mine = meRef.current.health;
          const theirs = oppRef.current.health;
          finish(mine === theirs ? null : mine > theirs ? "me" : "opp", true);
        }

        if (mode === "multiplayer" && now - lastSync > 1200) {
          lastSync = now;
          send({ t: "s", health: meRef.current.health, stamina: meRef.current.stamina, advance: meRef.current.advance });
        }
      }

      bump();
    }, 80);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, finish]);

  /* ---------------- player actions ---------------- */
  const start = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    startedAtRef.current = Date.now();
    phaseRef.current = "fighting";
    setPhase("fighting");
    oppPunchCdRef.current = Date.now() + 900;
    bump();
  }, []);

  const punch = useCallback(
    (p: Punch) => {
      const now = Date.now();
      if (phaseRef.current !== "fighting" || finishedRef.current) return;
      if (now < punchCdRef.current[p]) return;
      const stats = PUNCHES[p];
      if (meRef.current.stamina < stats.cost) {
        setMessage("Out of gas — guard up to recover.");
        return;
      }
      punchCdRef.current = { ...punchCdRef.current, [p]: now + stats.cooldownMs };
      meRef.current = { ...meRef.current, stamina: clamp(meRef.current.stamina - stats.cost, 0, 100), guard: null, guardUntil: 0 };
      const outcome = resolvePunch(p, meRef.current, oppRef.current, now);
      setAnim("me", p, stats.cooldownMs * 0.6);
      bump();

      window.setTimeout(() => {
        if (finishedRef.current) return;
        if (outcome.hit) {
          oppRef.current = { ...oppRef.current, health: clamp(oppRef.current.health - outcome.damage, 0, 100) };
          setAnim("opp", "hit", 400);
          nonceRef.current += 1;
          setImpact({ side: "opp", nonce: nonceRef.current });
        }
        setMessage(outcome.message);
        send({ t: "p", outcome });
        bump();
        if (oppRef.current.health <= 0) finish("me", false);
      }, stats.windupMs);
    },
    [finish],
  );

  const guard = useCallback((g: Guard) => {
    const now = Date.now();
    if (phaseRef.current !== "fighting" || finishedRef.current) return;
    if (now < guardCdRef.current) return;
    guardCdRef.current = now + GUARD_COOLDOWN_MS;
    meRef.current = { ...meRef.current, guard: g, guardUntil: now + GUARD_MS[g] };
    setAnim("me", g === "block" ? "guard-block" : "guard-dodge", GUARD_MS[g]);
    send({ t: "g", guard: g });
    bump();
  }, []);

  const move = useCallback((dir: MoveDir) => {
    const now = Date.now();
    if (phaseRef.current !== "fighting" || finishedRef.current) return;
    if (now < moveCdRef.current) return;
    moveCdRef.current = now + MOVE_COOLDOWN_MS;
    const delta = dir === "in" ? STEP : -STEP;
    meRef.current = { ...meRef.current, advance: clamp(meRef.current.advance + delta, 0, MAX_ADVANCE) };
    send({ t: "s", health: meRef.current.health, stamina: meRef.current.stamina, advance: meRef.current.advance });
    bump();
  }, []);

  const now = Date.now();
  const cooldowns = useMemo(() => {
    const out = {} as Record<Punch, number>;
    (Object.keys(PUNCHES) as Punch[]).forEach((p) => {
      const remaining = punchCdRef.current[p] - now;
      out[p] = remaining > 0 ? clamp(remaining / PUNCHES[p].cooldownMs, 0, 1) : 0;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  const secondsLeft =
    phaseRef.current === "fighting" ? Math.max(0, ROUND_SECONDS - Math.floor((now - startedAtRef.current) / 1000)) : ROUND_SECONDS;

  return {
    me: meRef.current,
    opp: oppRef.current,
    phase,
    winner,
    decision,
    secondsLeft,
    message,
    myAnim: myAnimRef.current.anim,
    oppAnim: oppAnimRef.current.anim,
    impact,
    gap: gapBetween(meRef.current, oppRef.current),
    cooldowns,
    guardCooldown: guardCdRef.current > now ? clamp((guardCdRef.current - now) / GUARD_COOLDOWN_MS, 0, 1) : 0,
    start,
    punch,
    guard,
    move,
  };
}

export { LUNGE, MAX_ADVANCE };
