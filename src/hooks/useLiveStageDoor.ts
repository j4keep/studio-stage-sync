// Circle / public live — stage join requests (Bigo-style ask-to-join).
// Lightweight Supabase realtime broadcast. Does not gate room entry — viewers
// already watch; this only gates publishing onto the motor stage.
//
// Channel: `live-stage:${sessionId}`
// Events:
//   guest -> host: { type: "request", reqId, userId, name }
//   guest -> host: { type: "cancel", reqId }
//   host  -> guest: { type: "decision", reqId, accepted, reason? }
//   host  -> all:   { type: "stage_full" } (optional nudge)

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveStageRequest = {
  reqId: string;
  userId: string;
  name: string;
  ts: number;
};

export type LiveStageRequestStatus =
  | "idle"
  | "requesting"
  | "accepted"
  | "declined"
  | "full"
  | "kicked";

type OutMsg = { type: string; [k: string]: unknown };

type Args = {
  sessionId: string | null | undefined;
  enabled: boolean;
  isHost: boolean;
  userId: string | null | undefined;
  displayName: string;
};

export function useLiveStageDoor({ sessionId, enabled, isHost, userId, displayName }: Args) {
  const [status, setStatus] = useState<LiveStageRequestStatus>(isHost ? "accepted" : "idle");
  const [pending, setPending] = useState<LiveStageRequest[]>([]);
  const [declineReason, setDeclineReason] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const queueRef = useRef<OutMsg[]>([]);
  const reqIdRef = useRef<string>(crypto.randomUUID());
  const nameRef = useRef(displayName);
  const userIdRef = useRef(userId);

  useEffect(() => {
    nameRef.current = displayName;
  }, [displayName]);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const send = useCallback((payload: OutMsg) => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) {
      queueRef.current.push(payload);
      return;
    }
    try {
      ch.send({ type: "broadcast", event: "msg", payload });
    } catch {
      queueRef.current.push(payload);
    }
  }, []);

  const flushQueue = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !subscribedRef.current) return;
    const q = queueRef.current.splice(0);
    q.forEach((p) => {
      try {
        ch.send({ type: "broadcast", event: "msg", payload: p });
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) return;

    subscribedRef.current = false;
    queueRef.current = [];
    setPending([]);
    setDeclineReason(null);
    setStatus(isHost ? "accepted" : "idle");
    reqIdRef.current = crypto.randomUUID();

    const ch = supabase.channel(`live-stage:${sessionId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    channelRef.current = ch;

    ch.on("broadcast", { event: "msg" }, (payload) => {
      const data = payload.payload as any;
      if (!data?.type) return;

      if (isHost) {
        if (data.type === "request") {
          setPending((prev) => {
            if (prev.some((x) => x.reqId === data.reqId || x.userId === data.userId)) return prev;
            return [
              ...prev,
              {
                reqId: String(data.reqId),
                userId: String(data.userId || ""),
                name: String(data.name || "Guest"),
                ts: Date.now(),
              },
            ];
          });
        }
        if (data.type === "cancel") {
          setPending((prev) => prev.filter((x) => x.reqId !== data.reqId));
        }
      } else {
        if (data.type === "decision" && data.reqId === reqIdRef.current) {
          if (data.accepted) {
            setStatus("accepted");
            setDeclineReason(null);
          } else {
            setStatus("declined");
            setDeclineReason(String(data.reason || "Host declined your request"));
          }
        }
        if (data.type === "stage_full" && data.reqId === reqIdRef.current) {
          setStatus("full");
          setDeclineReason("Stage is full — no seats available right now.");
        }
        if (data.type === "kick" && data.userId && data.userId === userIdRef.current) {
          setStatus("kicked");
          setDeclineReason(String(data.reason || "The host removed you from the stage."));
        }
      }
    });

    ch.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        subscribedRef.current = true;
        flushQueue();
      }
    });

    return () => {
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [enabled, sessionId, isHost, flushQueue]);

  const requestJoin = useCallback(() => {
    if (isHost) return;
    const uid = userIdRef.current;
    if (!uid) return;
    reqIdRef.current = crypto.randomUUID();
    setStatus("requesting");
    setDeclineReason(null);
    send({
      type: "request",
      reqId: reqIdRef.current,
      userId: uid,
      name: nameRef.current || "Guest",
    });
  }, [isHost, send]);

  const cancelRequest = useCallback(() => {
    if (isHost || status !== "requesting") return;
    send({ type: "cancel", reqId: reqIdRef.current });
    setStatus("idle");
  }, [isHost, send, status]);

  const decide = useCallback(
    (reqId: string, accepted: boolean, reason?: string) => {
      if (!isHost) return;
      send({ type: "decision", reqId, accepted, reason: reason || null });
      setPending((prev) => prev.filter((x) => x.reqId !== reqId));
    },
    [isHost, send],
  );

  const accept = useCallback((reqId: string) => decide(reqId, true), [decide]);
  const decline = useCallback(
    (reqId: string, reason?: string) => decide(reqId, false, reason || "Host declined your request"),
    [decide],
  );

  const notifyFull = useCallback(
    (reqId: string) => {
      if (!isHost) return;
      send({ type: "stage_full", reqId });
      setPending((prev) => prev.filter((x) => x.reqId !== reqId));
    },
    [isHost, send],
  );

  /** Host removes a guest from the stage — opens a seat. */
  const kick = useCallback(
    (targetUserId: string, reason?: string) => {
      if (!isHost || !targetUserId) return;
      send({
        type: "kick",
        userId: targetUserId,
        reason: reason || "The host removed you from the stage.",
      });
      setPending((prev) => prev.filter((x) => x.userId !== targetUserId));
    },
    [isHost, send],
  );

  const resetToIdle = useCallback(() => {
    if (isHost) return;
    setStatus("idle");
    setDeclineReason(null);
  }, [isHost]);

  return {
    status,
    pending,
    declineReason,
    requestJoin,
    cancelRequest,
    accept,
    decline,
    notifyFull,
    kick,
    resetToIdle,
  };
}
