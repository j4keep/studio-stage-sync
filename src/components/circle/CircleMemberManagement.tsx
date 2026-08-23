import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Shield, UserMinus, UserX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Circle,
  CircleMember,
  approveMember,
  blockMember,
  denyMember,
  listCircleMembers,
  removeMember,
  setMemberRole,
} from "@/lib/circles";

const sb = supabase as any;

type Row = CircleMember & { display_name: string | null; avatar_url: string | null };

async function withProfiles(members: CircleMember[]): Promise<Row[]> {
  const ids = members.map((m) => m.user_id);
  if (!ids.length) return [];
  const { data } = await sb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
  const byId = new Map<string, { display_name: string | null; avatar_url: string | null }>(
    (data || []).map((p: any) => [p.user_id, p]),
  );
  return members.map((m) => ({ ...m, display_name: byId.get(m.user_id)?.display_name ?? null, avatar_url: byId.get(m.user_id)?.avatar_url ?? null }));
}

export default function CircleMemberManagement({ circle }: { circle: Circle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "members" | "blocked">("pending");
  const [pending, setPending] = useState<Row[] | null>(null);
  const [members, setMembers] = useState<Row[] | null>(null);
  const [blocked, setBlocked] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = () => {
    void listCircleMembers(circle.id, "pending").then(withProfiles).then(setPending).catch(() => setPending([]));
    void listCircleMembers(circle.id, "approved").then(withProfiles).then(setMembers).catch(() => setMembers([]));
    void listCircleMembers(circle.id, "blocked").then(withProfiles).then(setBlocked).catch(() => setBlocked([]));
  };

  useEffect(reload, [circle.id]);

  const act = async (fn: () => Promise<void>, id: string) => {
    setBusyId(id);
    try {
      await fn();
      reload();
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const rows = tab === "pending" ? pending : tab === "members" ? members : blocked;

  return (
    <div className="px-4 pb-8">
      <div className="mb-3 flex gap-2">
        {(["pending", "members", "blocked"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold capitalize transition ${
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t} {t === "pending" && pending?.length ? `(${pending.length})` : ""}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="py-8 text-center text-[12.5px] text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5">
              <button
                type="button"
                onClick={() => navigate(`/artist/${r.user_id}`)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                  {r.avatar_url && <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold">{r.display_name || "YAJ member"}</p>
                  <p className="text-[10.5px] capitalize text-muted-foreground">{tab === "pending" ? "Tap to view profile" : r.role}</p>
                </div>
              </button>

              {tab === "pending" && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(() => approveMember(r.id, user!.id), r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white active:scale-95"
                    aria-label="Approve"
                  >
                    {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(() => denyMember(r.id), r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
                    aria-label="Deny"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {tab === "members" && r.role !== "owner" && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(() => setMemberRole(r.id, r.role === "admin" ? "member" : "admin"), r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border active:scale-95"
                    aria-label="Toggle admin"
                    title={r.role === "admin" ? "Remove admin" : "Make admin"}
                  >
                    <Shield className={`h-4 w-4 ${r.role === "admin" ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => {
                      if (confirm(`Remove ${r.display_name || "this member"} from ${circle.name}? They can ask to join again later.`)) {
                        void act(() => removeMember(r.id), r.id);
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border active:scale-95"
                    aria-label="Remove from Circle"
                    title="Remove (can re-request later)"
                  >
                    <UserMinus className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => {
                      if (confirm(`Block ${r.display_name || "this member"}? They won't be able to request to join again.`)) {
                        void act(() => blockMember(r.id), r.id);
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border active:scale-95"
                    aria-label="Block"
                    title="Block (can't re-request)"
                  >
                    <UserX className="h-4 w-4 text-rose-500" />
                  </button>
                </div>
              )}

              {tab === "blocked" && (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => act(() => removeMember(r.id), r.id)}
                  className="rounded-full border border-border px-3 py-1.5 text-[11px] font-bold active:scale-95"
                >
                  Unblock
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
