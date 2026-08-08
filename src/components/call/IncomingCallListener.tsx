import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseCallInvite, type MessageCallKind } from "@/lib/message-call";
import { startRing, stopRing } from "@/lib/call-ring";

type Incoming = {
  conversationId: string;
  kind: MessageCallKind;
  callerName: string;
};

/** Rings the phone (tone + vibration) and shows an accept/decline sheet on incoming chat calls. */
export default function IncomingCallListener() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const convIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      convIdsRef.current = new Set((data || []).map((p) => p.conversation_id));
    })();

    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            conversation_id: string;
            sender_id: string;
            content: string | null;
            created_at?: string;
          };
          if (row.sender_id === user.id) return;
          const invite = parseCallInvite(row.content);
          if (!invite) return;
          if (!convIdsRef.current.has(row.conversation_id)) {
            const { data } = await supabase
              .from("conversation_participants")
              .select("conversation_id")
              .eq("user_id", user.id)
              .eq("conversation_id", row.conversation_id)
              .maybeSingle();
            if (!data) return;
            convIdsRef.current.add(row.conversation_id);
          }
          if (row.created_at && Date.now() - new Date(row.created_at).getTime() > 60_000) return;

          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", row.sender_id)
            .maybeSingle();

          setIncoming({
            conversationId: row.conversation_id,
            kind: invite.kind,
            callerName: prof?.display_name || "Someone",
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Ring while the sheet is up; auto-stop after 45s or when already in a call.
  useEffect(() => {
    if (!incoming) {
      stopRing();
      return;
    }
    if (location.pathname.startsWith("/call/")) {
      setIncoming(null);
      return;
    }
    startRing("incoming");
    const t = window.setTimeout(() => setIncoming(null), 45_000);
    return () => {
      window.clearTimeout(t);
      stopRing();
    };
  }, [incoming, location.pathname]);

  if (!incoming) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[300] px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {incoming.kind === "audio" ? <Phone className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{incoming.callerName}</p>
          <p className="text-[11px] text-muted-foreground">
            Incoming {incoming.kind === "audio" ? "audio" : "video"} call…
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIncoming(null)}
          aria-label="Decline call"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            const { conversationId, kind } = incoming;
            setIncoming(null);
            stopRing();
            nav(`/call/${conversationId}?kind=${kind}&auto=1`);
          }}
          aria-label="Accept call"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white"
        >
          <Phone className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
