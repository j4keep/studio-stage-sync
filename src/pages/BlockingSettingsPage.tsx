import { useEffect, useState } from "react";
import { ArrowLeft, Ban, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listBlockedUsers, unblockUser, type BlockedProfile } from "@/lib/blocks";
import BlockUserPickerSheet from "@/components/BlockUserPickerSheet";

/** Settings → Visibility → Blocking — Facebook-style blocked list. */
export default function BlockingSettingsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockTarget, setUnblockTarget] = useState<BlockedProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setRows(await listBlockedUsers(user.id));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load blocked list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const confirmUnblock = async () => {
    if (!user || !unblockTarget) return;
    setBusy(true);
    try {
      await unblockUser(user.id, unblockTarget.blocked_id);
      toast.success(`${unblockTarget.display_name || "User"} unblocked`);
      setUnblockTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not unblock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-4 text-foreground">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-display font-bold">Blocking</h1>
      </div>

      <h2 className="mb-1 text-base font-bold">Blocked people</h2>
      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        Once you block someone, that person can no longer see your YAJ profile or posts, message you,
        or follow you. You also won&apos;t see theirs. This applies across all YAJ pages.
      </p>

      <button
        type="button"
        onClick={() => setShowAdd(true)}
        className="mb-4 flex w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-left text-sm font-bold uppercase tracking-wide text-primary"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Plus className="h-4 w-4" />
        </span>
        Add to blocked list
      </button>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <Ban className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No blocked people yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.block_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                    {(row.display_name || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{row.display_name || "User"}</p>
              <button
                type="button"
                onClick={() => setUnblockTarget(row)}
                className="shrink-0 rounded-lg border border-border bg-muted px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(unblockTarget)} onOpenChange={(v) => !v && setUnblockTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Unblock {unblockTarget?.display_name || "User"}?</DialogTitle>
            <DialogDescription className="space-y-2 text-left text-sm">
              <span className="block">
                If you unblock them, they may be able to see your profile or contact you, depending on
                your settings.
              </span>
              <span className="block">You&apos;ll need to follow each other again if you want that connection back.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <button
              type="button"
              onClick={() => setUnblockTarget(null)}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmUnblock()}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : "Unblock"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BlockUserPickerSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onBlocked={() => {
          setShowAdd(false);
          void load();
        }}
      />
    </div>
  );
}
