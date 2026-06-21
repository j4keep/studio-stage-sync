// W.STUDIO Podcast — Waiting-room "doorman".
// Lightweight Supabase realtime channel that gates LiveKit room entry.
// Does NOT touch LiveKit, recording, editor, or export.
//
// Channel:  `podcast-door:${sessionId}`
// Events:
//   guest -> host:  { type: "request", reqId, name, password? }
//   host  -> guest: { type: "decision", reqId, accepted: boolean, reason?: string }
//   host  -> all:   { type: "policy", visibility, requiresPassword }

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RoomVisibility, PodcastSecurity } from "./PodcastInviteSheet";

export type PendingRequest = {
  reqId: string;
  name: string;
  password?: string;
  ts: number;
};

export type DoormanStatus =
  | "idle"
  | "requesting"
  | "rejected"
  | "accepted"
  | "needs-password"
  | "ended";

type Args = {
  sessionId: string;
  isHost: boolean;
  displayName: string;
  security?: PodcastSecurity;
};

type OutMsg = { type: string; [k: string]: any };

export function usePodcastDoorman({ sessionId, isHost, displayName, security }: Args) {
  const [status, setStatus] = useState<DoormanStatus>(isHost ? "accepted" : "idle");
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [policy, setPolicy] = useState<{ visibility: RoomVisibility; requiresPassword: boolean }>({
    visibility: "public",
    requiresPassword: false,
  });
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [forceMuteTick, setForceMuteTick] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const queueRef = useRef<OutMsg[]>([]);
  const reqIdRef = useRef<string>(crypto.randomUUID());

  const secRef = useRef(security);
  useEffect(() => { secRef.current = security; }, [security]);

  const send = useCallback((payload: OutMsg) => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) {
      queueRef.current.push(payload);
      return;
    }
    try {
      ch.send({ type: "broadcast", event: "msg", payload });
    } catch {
      // re-queue and retry shortly
      queueRef.current.push(payload);
    }
  }, []);

  const flushQueue = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) return;
    const q = queueRef.current.splice(0);
    q.forEach((p) => {
      try { ch.send({ type: "broadcast", event: "msg", payload: p }); } catch {}
    });
  }, []);

  useEffect(() => {
    subscribedRef.current = false;
    const ch = supabase.channel(`podcast-door:${sessionId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    channelRef.current = ch;

    ch.on("broadcast", { event: "msg" }, (payload) => {
      const data = payload.payload as any;
      if (!data?.type) return;

      if (isHost) {
        if (data.type === "request") {
          setPending((p) => {
            if (p.some((x) => x.reqId === data.reqId)) return p;
            return [...p, { reqId: data.reqId, name: data.name || "Guest", password: data.password, ts: Date.now() }];
          });
          // Acknowledge with current policy so guests in a stale state can recover.
          const sec = secRef.current;
          send({
            type: "policy",
            visibility: sec?.visibility || "public",
            requiresPassword: sec?.visibility === "password",
          });
        }
      } else {
        if (data.type === "policy") {
          setPolicy({ visibility: data.visibility, requiresPassword: !!data.requiresPassword });
        }
        if (data.type === "decision" && data.reqId === reqIdRef.current) {
          if (data.accepted) {
            setStatus("accepted");
            setRejectReason(null);
          } else {
            setStatus("rejected");
            setRejectReason(data.reason || "Host declined your request");
          }
        }
        if (data.type === "ended") {
          setStatus("ended");
          setRejectReason(data.reason || "Host ended the session");
        }
      }
    });

    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        subscribedRef.current = true;
        if (isHost) {
          const sec = secRef.current;
          send({
            type: "policy",
            visibility: sec?.visibility || "public",
            requiresPassword: sec?.visibility === "password",
          });
        }
        flushQueue();
      } else if (s === "CLOSED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
        subscribedRef.current = false;
      }
    });

    // Periodic flush in case network hiccups stranded messages.
    const flushTimer = window.setInterval(flushQueue, 1500);

    return () => {
      window.clearInterval(flushTimer);
      subscribedRef.current = false;
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isHost]);

  // host: re-broadcast policy when it changes
  useEffect(() => {
    if (!isHost || !security) return;
    send({
      type: "policy",
      visibility: security.visibility,
      requiresPassword: security.visibility === "password",
    });
  }, [isHost, security?.visibility, security?.password, send]);

  /* ---------- guest actions ---------- */
  const requestJoin = useCallback((password?: string) => {
    if (isHost) return;
    setStatus("requesting");
    setRejectReason(null);
    send({ type: "request", reqId: reqIdRef.current, name: displayName, password });
  }, [isHost, displayName, send]);

  /* ---------- host actions ---------- */
  const decide = useCallback((reqId: string, accepted: boolean, reason?: string) => {
    send({ type: "decision", reqId, accepted, reason });
    setPending((p) => p.filter((x) => x.reqId !== reqId));
  }, [send]);

  const accept = useCallback((reqId: string) => decide(reqId, true), [decide]);
  const reject = useCallback((reqId: string, reason?: string) => decide(reqId, false, reason), [decide]);

  const endSession = useCallback((reason?: string) => {
    if (!isHost) return;
    send({ type: "ended", reason: reason || "Host ended the session" });
  }, [isHost, send]);

  // host-side auto-accept for public rooms
  useEffect(() => {
    if (!isHost) return;
    if (secRef.current?.visibility !== "public") return;
    if (pending.length === 0) return;
    pending.forEach((p) => decide(p.reqId, true));
  }, [pending, isHost, decide]);

  const validatePassword = useCallback((submitted?: string) => {
    const sec = secRef.current;
    if (!sec || sec.visibility !== "password") return true;
    return (submitted || "") === sec.password;
  }, []);

  return useMemo(() => ({
    status,
    pending,
    policy,
    rejectReason,
    requestJoin,
    accept,
    reject,
    endSession,
    validatePassword,
  }), [status, pending, policy, rejectReason, requestJoin, accept, reject, endSession, validatePassword]);
}
