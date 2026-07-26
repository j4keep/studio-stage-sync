import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { blockUser } from "@/lib/blocks";
import BlockConfirmDialog from "@/components/BlockConfirmDialog";

type Profile = { user_id: string; display_name: string | null; avatar_url: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onBlocked?: () => void;
};

/** Search + confirm to add someone to the blocked list. */
export default function BlockUserPickerSheet({ open, onClose, onBlocked }: Props) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [pending, setPending] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      setPending(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .ilike("display_name", `%${term}%`)
          .neq("user_id", user.id)
          .limit(20);
        setResults(data || []);
      })();
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, user]);

  if (!open) return null;

  const confirm = async () => {
    if (!user || !pending) return;
    setBusy(true);
    try {
      await blockUser(user.id, pending.user_id);
      toast.success(`${pending.display_name || "User"} blocked on all YAJ pages`);
      setPending(null);
      onBlocked?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not block");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
        <div
          className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl border border-border bg-background md:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold">Add to blocked list</h3>
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="border-b border-border px-4 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name…"
                className="h-10 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {results.map((p) => (
              <button
                key={p.user_id}
                type="button"
                onClick={() => setPending(p)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold">
                      {(p.display_name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold">{p.display_name || "User"}</span>
              </button>
            ))}
            {q.trim().length >= 2 && results.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No users found</p>
            )}
          </div>
        </div>
      </div>

      <BlockConfirmDialog
        open={Boolean(pending)}
        name={pending?.display_name || "User"}
        loading={busy}
        onClose={() => setPending(null)}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
