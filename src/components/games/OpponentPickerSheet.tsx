import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Person = { user_id: string; display_name: string | null; avatar_url: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (person: Person) => void;
  title?: string;
};

const TABS = ["Circle", "Following", "Followers", "Search"] as const;
type Tab = (typeof TABS)[number];

/** Opponent picker for multiplayer game invites. */
export default function OpponentPickerSheet({ open, onClose, onPick, title = "Choose an opponent" }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Following");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const db = supabase as any;

    const run = async () => {
      setLoading(true);
      let ids: string[] = [];

      if (tab === "Following") {
        const { data } = await db.from("follows").select("following_id").eq("follower_id", user.id).limit(50);
        ids = (data || []).map((r: any) => r.following_id);
      } else if (tab === "Followers") {
        const { data } = await db.from("follows").select("follower_id").eq("following_id", user.id).limit(50);
        ids = (data || []).map((r: any) => r.follower_id);
      } else if (tab === "Circle") {
        const { data: mine } = await db.from("savings_circle_members").select("circle_id").eq("user_id", user.id);
        const circleIds = (mine || []).map((r: any) => r.circle_id);
        if (circleIds.length) {
          const { data } = await db.from("savings_circle_members").select("user_id").in("circle_id", circleIds).limit(80);
          ids = Array.from(new Set((data || []).map((r: any) => r.user_id))).filter((id) => id !== user.id) as string[];
        }
      }

      if (tab === "Search") {
        const needle = query.trim();
        if (needle.length < 2) {
          if (!cancelled) {
            setPeople([]);
            setLoading(false);
          }
          return;
        }
        const { data } = await db
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .ilike("display_name", `%${needle}%`)
          .neq("user_id", user.id)
          .limit(25);
        if (!cancelled) setPeople((data as Person[]) || []);
        setLoading(false);
        return;
      }

      if (!ids.length) {
        if (!cancelled) {
          setPeople([]);
          setLoading(false);
        }
        return;
      }
      const { data } = await db
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids)
        .limit(50);
      if (!cancelled) {
        setPeople((data as Person[]) || []);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, tab, query, user?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-background p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
          <span className="shrink-0 rounded-full bg-muted px-3.5 py-1.5 text-xs font-bold text-muted-foreground/70">
            Random · Coming Soon
          </span>
        </div>

        {tab === "Search" && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YAJ by name…"
              className="h-10 w-full rounded-full border border-border bg-muted/60 pl-9 pr-3 text-sm outline-none focus:border-primary/40"
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : people.length ? (
          <ul className="space-y-1 pb-6">
            {people.map((p) => (
              <li key={p.user_id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                        {(p.display_name || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-sm font-bold">{p.display_name || "YAJ user"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {tab === "Search" ? "Type at least 2 letters to search." : `No one found in ${tab} yet.`}
          </p>
        )}
      </div>
    </div>
  );
}
