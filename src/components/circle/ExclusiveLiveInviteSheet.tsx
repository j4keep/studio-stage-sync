import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { listCircleMembers, type CircleMember } from "@/lib/circles";
import {
  setExclusiveLiveInvites,
  sessionInviteToken,
  type CircleLiveSession,
} from "@/lib/circle-live";
import { liveWatchUrl } from "@/lib/dual-camera";
import { sendDirectMessage } from "@/lib/messaging";

const sb = supabase as any;

type MemberRow = CircleMember & { display_name: string | null; avatar_url: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  circleId: string;
  circleName: string;
  hostUserId: string;
  session: CircleLiveSession;
  onInvited?: (session: CircleLiveSession) => void;
};

/**
 * Pick Circle members to unlock an Exclusive invite-only live, and send each
 * a YAJ message with the personal watch link.
 */
export default function ExclusiveLiveInviteSheet({
  open,
  onClose,
  circleId,
  circleName,
  hostUserId,
  session,
  onInvited,
}: Props) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(session.invited_user_ids || []));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(session.invited_user_ids || []));
    void listCircleMembers(circleId, "approved")
      .then(async (rows) => {
        const others = rows.filter((m) => m.user_id !== hostUserId);
        const ids = others.map((m) => m.user_id);
        if (!ids.length) {
          setMembers([]);
          return;
        }
        const { data } = await sb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
        const byId = new Map<string, { display_name: string | null; avatar_url: string | null }>(
          (data || []).map((p: any) => [p.user_id, p]),
        );
        setMembers(
          others.map((m) => ({
            ...m,
            display_name: byId.get(m.user_id)?.display_name ?? null,
            avatar_url: byId.get(m.user_id)?.avatar_url ?? null,
          })),
        );
      })
      .catch(() => setMembers([]));
  }, [open, circleId, hostUserId, session.id, session.invited_user_ids]);

  const inviteUrl = useMemo(() => {
    const token = sessionInviteToken(session);
    return liveWatchUrl({
      circleId,
      exclusive: true,
      inviteToken: token,
    });
  }, [circleId, session]);

  if (!open) return null;

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const sendInvites = async () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast({ title: "Select at least one member", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const updated = await setExclusiveLiveInvites(session.id, ids);
      const message = `You're invited to my Exclusive live in ${circleName} on YAJ. Tap to watch: ${inviteUrl}`;
      let sent = 0;
      for (const userId of ids) {
        try {
          await sendDirectMessage(hostUserId, userId, message, { context: "circle" });
          sent += 1;
        } catch {
          /* continue other members */
        }
      }
      onInvited?.(updated);
      toast({
        title: sent ? `Invites sent in Messages (${sent})` : "Members unlocked",
        description: sent
          ? "They’ll get the Exclusive live link in their YAJ inbox."
          : "Selected members can watch. Messaging may need a refresh.",
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Couldn't send invites", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Invite to Exclusive live</h2>
            <p className="text-[11px] text-muted-foreground">
              Check Circle members, then send the link in YAJ Messages
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {members === null ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">Loading members…</p>
          ) : members.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-muted-foreground">No other Circle members to invite yet.</p>
          ) : (
            members.map((m) => {
              const on = selected.has(m.user_id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.user_id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                    on ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{m.display_name || "YAJ member"}</p>
                    <p className="text-[10px] capitalize text-muted-foreground">{m.role.replace("_", " ")}</p>
                  </div>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {on ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void sendInvites()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {busy ? "Sending…" : `Message invite · ${selected.size} selected`}
          </button>
          <p className="text-center text-[10px] text-muted-foreground">
            Selected people can watch this Exclusive live · link also lands in their Messages
          </p>
        </div>
      </div>
    </div>
  );
}
