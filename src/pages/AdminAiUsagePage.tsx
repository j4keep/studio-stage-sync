import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Row = { feature: string; user_id: string; created_at: string };

const LABELS: Record<string, string> = {
  "ask-yaj": "YAJ Buddy chat",
  "yaj-voice": "YAJ voice (speech)",
  "yaj-transcribe": "Voice to text",
  "yaj-image": "YAJ image generation",
  "generate-cover-image": "Cover / book art",
  "generate-battle-emoji": "Battle emoji art",
  "generate-music": "AI music",
  "yaj-food-scan": "Food scan",
  "yaj-jobs-ai": "Jobs AI helper",
};

const AdminAiUsagePage = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    (supabase as any)
      .from("ai_usage_events")
      .select("feature,user_id,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data }: { data: Row[] | null }) => setRows(data ?? []));
  }, [isAdmin, days]);

  const stats = useMemo(() => {
    const dayAgo = Date.now() - 86400000;
    const m = new Map<string, { total: number; today: number; users: Set<string> }>();
    rows.forEach((r) => {
      const s = m.get(r.feature) ?? { total: 0, today: 0, users: new Set<string>() };
      s.total++; s.users.add(r.user_id);
      if (new Date(r.created_at).getTime() >= dayAgo) s.today++;
      m.set(r.feature, s);
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  if (isAdmin === null) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <div className="p-6 text-muted-foreground">Admins only.</div>;

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-display font-bold text-foreground mb-1">AI usage</h1>
      <p className="text-sm text-muted-foreground mb-4">
        How often each AI feature was called by signed-in users. Backend hosting and media bandwidth are billed separately and aren't counted here.
      </p>
      <div className="flex gap-2 mb-4">
        {[1, 7, 30].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border border-border ${days === d ? "bg-foreground text-background" : "bg-card text-foreground"}`}>
            {d === 1 ? "24h" : `${d} days`}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-bold text-muted-foreground border-b border-border">
          <span className="col-span-1">Feature</span><span>Calls</span><span>Last 24h</span><span>Users</span>
        </div>
        {stats.length === 0 && <div className="px-4 py-6 text-sm text-muted-foreground">No AI calls in this period.</div>}
        {stats.map(([f, s]) => (
          <div key={f} className="grid grid-cols-4 gap-2 px-4 py-3 text-sm text-foreground border-b border-border last:border-0">
            <span>{LABELS[f] ?? f}</span><span>{s.total}</span><span>{s.today}</span><span>{s.users.size}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Total calls: {rows.length}</p>
    </div>
  );
};

export default AdminAiUsagePage;
