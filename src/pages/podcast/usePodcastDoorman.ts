// W.STUDIO Podcast — Waiting-room "doorman".
// Lightweight Supabase realtime channel that gates LiveKit room entry.
// Does NOT touch LiveKit, recording, editor, or export. Only decides
// whether the parent should set `enabled: true` on the LiveKit hook.
//
// Roles:
//  - host: auto-accepted; receives `pending` join requests and approves/rejects
//  - guest: emits a `request` and waits for the host's `decision`
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
  | "requesting"     // guest: waiting for host
  | "rejected"       // guest: host said no
  | "accepted"       // guest or host: cleared to join LiveKit
  | "needs-password"; // guest: room requires a password and we haven't sent one yet

type Args = {
  sessionId: string;
  isHost: boolean;
  displayName: string;
  // host-controlled security; guests get a snapshot via `policy` broadcasts
  security?: PodcastSecurity;
};

export function usePodcastDoorman({ sessionId, isHost, displayName, security }: Args) {
  const [status, setStatus] = useState<DoormanStatus>(isHost ? "accepted" : "idle");
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [policy, setPolicy] = useState<{ visibility: RoomVisibility; requiresPassword: boolean }>({
    visibility: "public",
    requiresPassword: false,
  });
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reqIdRef = useRef<string>(crypto.randomUUID());

  // host: keep latest security in a ref so handlers see fresh values
  const secRef = useRef(security);
  useEffect(() => { secRef.current = security; }, [security]);

  useEffect(() => {
    const ch = supabase.channel(`podcast-door:${sessionId}`, {
      config: { broadcast: { self: false } },
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
        }
      } else {
        if (data.type === "policy") {
          setPolicy({ visibility: data.visibility, requiresPassword: !!data.requiresPassword });
          if (data.visibility === "public" && status === "idle") {
            // auto-request as a formality so host sees the join
            // (the request itself is harmless; host auto-accepts public rooms below)
          }
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
      }
    });

    ch.subscribe((s) => {
      if (s === "SUBSCRIBED" && isHost) {
        // announce policy on join
        const sec = secRef.current;
        ch.send({
          type: "broadcast",
          event: "msg",
          payload: {
            type: "policy",
            visibility: sec?.visibility || "public",
            requiresPassword: sec?.visibility === "password",
          },
        });
      }
    });

    return () => { supabase.removeChannel(ch); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isHost]);

  // host: re-broadcast policy when it changes
  useEffect(() => {
    if (!isHost || !channelRef.current || !security) return;
    channelRef.current.send({
      type: "broadcast",
      event: "msg",
      payload: {
        type: "policy",
        visibility: security.visibility,
        requiresPassword: security.visibility === "password",
      },
    });
  }, [isHost, security?.visibility, security?.password]);

  /* ---------- guest actions ---------- */
  const requestJoin = useCallback((password?: string) => {
    if (isHost) return;
    setStatus("requesting");
    setRejectReason(null);
    channelRef.current?.send({
      type: "broadcast",
      event: "msg",
      payload: { type: "request", reqId: reqIdRef.current, name: displayName, password },
    });
  }, [isHost, displayName]);

  /* ---------- host actions ---------- */
  const decide = useCallback((reqId: string, accepted: boolean, reason?: string) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "msg",
      payload: { type: "decision", reqId, accepted, reason },
    });
    setPending((p) => p.filter((x) => x.reqId !== reqId));
  }, []);

  const accept = useCallback((reqId: string) => decide(reqId, true), [decide]);
  const reject = useCallback((reqId: string, reason?: string) => decide(reqId, false, reason), [decide]);

  // host-side auto-accept for public rooms
  useEffect(() => {
    if (!isHost) return;
    if (secRef.current?.visibility !== "public") return;
    if (pending.length === 0) return;
    pending.forEach((p) => decide(p.reqId, true));
  }, [pending, isHost, decide]);

  // host-side password validation suggestion: provide a helper for UI
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
    validatePassword,
  }), [status, pending, policy, rejectReason, requestJoin, accept, reject, validatePassword]);
}
