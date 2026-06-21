// W.STUDIO Podcast — Scheduled sessions dashboard (Upcoming / Today / Past / Cancelled).
// Local-only. Reads from PodcastSessionStore.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock, Copy, Edit3, Play, Trash2, Video, X, Globe, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  PodcastSessionStore,
  type ScheduledPodcastSession,
} from "./podcastSessionStore";

type Tab = "upcoming" | "today" | "past" | "cancelled";

type Props = {
  onEdit: (s: ScheduledPodcastSession) => void;
};

const isToday = (ts: number) => {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

const fmt = (ts: number) =>
  new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function PodcastScheduleDashboard({ onEdit }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [rows, setRows] = useState<ScheduledPodcastSession[]>(() => PodcastSessionStore.list());
  const [, force] = useState(0);

  useEffect(() => {
    const refresh = () => setRows(PodcastSessionStore.list());
    const off = PodcastSessionStore.subscribe(refresh);
    const t = window.setInterval(() => { refresh(); force((x) => x + 1); }, 30_000);
    return () => { off(); window.clearInterval(t); };
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter((r) => {
      if (tab === "cancelled") return r.status === "cancelled";
      if (tab === "past") return r.status === "ended" || (r.status !== "cancelled" && r.scheduledAt + r.durationMin * 60_000 < now - 4 * 60 * 60_000);
      if (tab === "today") return r.status !== "cancelled" && isToday(r.scheduledAt);
      // upcoming
      return (r.status === "upcoming" || r.status === "live") && r.scheduledAt + r.durationMin * 60_000 > now - 4 * 60 * 60_000;
    });
  }, [rows, tab]);

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: rows.filter((r) => (r.status === "upcoming" || r.status === "live") && r.scheduledAt + r.durationMin * 60_000 > now - 4 * 60 * 60_000).length,
      today: rows.filter((r) => r.status !== "cancelled" && isToday(r.scheduledAt)).length,
      past: rows.filter((r) => r.status === "ended" || (r.status !== "cancelled" && r.scheduledAt + r.durationMin * 60_000 < now - 4 * 60 * 60_000)).length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
    };
  }, [rows]);

  const enterRoom = (s: ScheduledPodcastSession) => {
    PodcastSessionStore.markLive(s.id);
    navigate(`/tv/podcast/room/${s.id}`);
  };

  const copyInvite = async (s: ScheduledPodcastSession) => {
    const base = `${window.location.origin}/#/tv/podcast/room/${s.id}?guest=1`;
    const url = s.visibility === "password" && s.password ? `${base}&k=${encodeURIComponent(s.password)}` : base;
    try { await navigator.clipboard.writeText(url); toast({ title: "Invite link copied" }); }
    catch { toast({ title: "Copy failed", description: url }); }
  };

  const cancelOne = (s: ScheduledPodcastSession) => {
    if (!confirm(`Cancel "${s.title}"?`)) return;
    PodcastSessionStore.cancel(s.id);
    setRows(PodcastSessionStore.list());
  };

  const deleteOne = (s: ScheduledPodcastSession) => {
    if (!confirm(`Delete "${s.title}"? This removes the local record only.`)) return;
    PodcastSessionStore.remove(s.id);
    setRows(PodcastSessionStore.list());
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 px-3 pt-3">
        <DashTab label="Upcoming" count={counts.upcoming} active={tab === "upcoming"} onClick={() => setTab("upcoming")} />
        <DashTab label="Today" count={counts.today} active={tab === "today"} onClick={() => setTab("today")} />
        <DashTab label="Past" count={counts.past} active={tab === "past"} onClick={() => setTab("past")} />
        <DashTab label="Cancelled" count={counts.cancelled} active={tab === "cancelled"} onClick={() => setTab("cancelled")} />
      </div>

      <div className="p-3">
        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No {tab} sessions.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li key={s.id} className="rounded-md border border-border bg-background/60 p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate">{s.title}</h3>
                      <StatusBadge status={s.status} />
                      <VisibilityBadge v={s.visibility} />
                    </div>
                    {s.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmt(s.scheduledAt)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.durationMin} min</span>
                      <Countdown ts={s.scheduledAt} status={s.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(s.status === "upcoming" || s.status === "live") && (
                      <Button size="sm" onClick={() => enterRoom(s)} className="bg-purple-600 hover:bg-purple-500 gap-1.5">
                        {s.status === "live" ? <><Play className="w-3.5 h-3.5" />Enter live</> : <><Video className="w-3.5 h-3.5" />Open studio</>}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copyInvite(s)} className="gap-1.5"><Copy className="w-3.5 h-3.5" />Invite</Button>
                    {s.status === "upcoming" && (
                      <Button size="sm" variant="ghost" onClick={() => onEdit(s)} className="gap-1.5"><Edit3 className="w-3.5 h-3.5" />Edit</Button>
                    )}
                    {s.status === "upcoming" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelOne(s)} className="gap-1.5 text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" />Cancel</Button>
                    )}
                    {(s.status === "ended" || s.status === "cancelled") && (
                      <Button size="sm" variant="ghost" onClick={() => deleteOne(s)} className="gap-1.5 text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" />Delete</Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const DashTab = ({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-md text-xs font-medium border-b-2 transition ${
      active ? "border-purple-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    }`}
  >
    {label} <span className="ml-1 text-[10px] text-muted-foreground">{count}</span>
  </button>
);

const StatusBadge = ({ status }: { status: ScheduledPodcastSession["status"] }) => {
  const cfg: Record<string, string> = {
    upcoming: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    live: "bg-red-500/15 text-red-300 border-red-500/30",
    ended: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    cancelled: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border ${cfg[status]}`}>{status}</span>;
};

const VisibilityBadge = ({ v }: { v: ScheduledPodcastSession["visibility"] }) => {
  const map = { public: { i: Globe, t: "Public" }, invite: { i: UserPlus, t: "Invite" }, password: { i: Lock, t: "Password" } } as const;
  const it = map[v]; const Icon = it.i;
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground inline-flex items-center gap-1">
      <Icon className="w-2.5 h-2.5" />{it.t}
    </span>
  );
};

const Countdown = ({ ts, status }: { ts: number; status: ScheduledPodcastSession["status"] }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (status !== "upcoming") return null;
  const diff = ts - Date.now();
  if (diff <= 0) return <span className="text-emerald-400">Ready to start</span>;
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return <span>Starts in {mins} min</span>;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return <span>Starts in {hrs}h</span>;
  return <span>Starts in {Math.round(hrs / 24)}d</span>;
};
