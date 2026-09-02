import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, MessageCircle, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import MeetAdultGate, { MeetBrandMark } from "@/components/meet/MeetAdultGate";
import {
  getMeetProfile,
  listMyInterviewInbox,
  respondToInterview,
  type MeetInterviewRequest,
  type MeetProfile,
} from "@/lib/meet";
import { getOrCreateConversation } from "@/lib/messaging";

function MeetInboxInner() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<MeetInterviewRequest[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const list = await listMyInterviewInbox(user.id);
      setRows(list);
      const ids = Array.from(
        new Set(list.flatMap((r) => [r.from_user_id, r.to_user_id]).filter((id) => id !== user.id)),
      );
      const map: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          const p = await getMeetProfile(id);
          map[id] = p?.display_name || "Member";
        }),
      );
      setNames(map);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (id: string, status: "accepted" | "declined" | "cancelled") => {
    try {
      await respondToInterview(id, status);
      toast({ title: status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Cancelled" });
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't update", description: e?.message, variant: "destructive" });
    }
  };

  const openChat = async (otherId: string) => {
    if (!user?.id) return;
    try {
      const convId = await getOrCreateConversation(user.id, otherId, { context: "dating" });
      nav("/messages", { state: { openConversationId: convId } });
    } catch (e: any) {
      toast({ title: "Couldn't open chat", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/meet")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <MeetBrandMark />
          <h1 className="text-lg font-black">Interview inbox</h1>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">No interview requests yet.</p>
        )}
        {rows.map((r) => {
          const incoming = r.to_user_id === user?.id;
          const otherId = incoming ? r.from_user_id : r.to_user_id;
          const otherName = names[otherId] || "Member";
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {incoming ? "Incoming" : "Sent"} · {r.status}
              </p>
              <button
                type="button"
                onClick={() => nav(`/meet/u/${otherId}`)}
                className="mt-1 text-left text-sm font-black text-foreground"
              >
                {otherName}
              </button>
              {r.message && <p className="mt-2 text-[13px] text-muted-foreground">{r.message}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {incoming && r.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void respond(r.id, "accepted")}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void respond(r.id, "declined")}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </>
                )}
                {!incoming && r.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void respond(r.id, "cancelled")}
                    className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold"
                  >
                    Cancel request
                  </button>
                )}
                {r.status === "accepted" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void openChat(otherId)}
                      className="inline-flex items-center gap-1 rounded-full gradient-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Message
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        nav(`/meet/stage/${incoming ? user?.id : r.to_user_id}`)
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold"
                    >
                      <Users className="h-3.5 w-3.5" /> Interview stage
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MeetInboxPage() {
  return (
    <MeetAdultGate>
      <MeetInboxInner />
    </MeetAdultGate>
  );
}
