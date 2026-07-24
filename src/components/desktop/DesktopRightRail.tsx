import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Creator = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type JobRow = {
  id: string;
  title: string;
  location: string | null;
};

export default function DesktopRightRail() {
  const navigate = useNavigate();

  const { data: creators = [] } = useQuery<Creator[]>({
    queryKey: ["desktop-right-creators"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as Creator[]) || [];
    },
  });

  const { data: jobs = [] } = useQuery<JobRow[]>({
    queryKey: ["desktop-right-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_listings")
        .select("id, title, location")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(4);
      return (data as JobRow[]) || [];
    },
  });

  return (
    <aside className="sticky top-14 h-[calc(100dvh-3.5rem)] space-y-3 overflow-y-auto overscroll-y-contain py-3 pl-1">
      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Trending on YAJ</h2>
        </div>
        <ul className="space-y-2">
          {["Studio sessions", "Open mic nights", "Creator collabs"].map((label) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => navigate("/explore")}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">People to follow</h2>
        </div>
        <ul className="space-y-2">
          {creators.map((c) => (
            <li key={c.user_id}>
              <button
                type="button"
                onClick={() => navigate(`/artist/${c.user_id}`)}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-muted"
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold">
                      {(c.display_name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="truncate text-sm font-semibold">{c.display_name || "Creator"}</span>
              </button>
            </li>
          ))}
          {creators.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">Discover creators in Explore.</p>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Open roles</h2>
        </div>
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted"
              >
                <p className="truncate text-sm font-semibold text-foreground">{job.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {job.location || "YAJ Jobs"}
                </p>
              </button>
            </li>
          ))}
          {jobs.length === 0 && (
            <button
              type="button"
              onClick={() => navigate("/jobs")}
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              Browse jobs
            </button>
          )}
        </ul>
      </section>
    </aside>
  );
}
