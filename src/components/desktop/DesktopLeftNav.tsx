import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Compass, Home, PlusSquare, TrendingUp, User, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/jobs", label: "Opportunities", icon: Briefcase },
  { path: "/profile", label: "Profile", icon: User },
] as const;

type Creator = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function DesktopLeftNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("You");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { display_name?: string | null; avatar_url?: string | null } | null;
        setDisplayName(row?.display_name || user.email?.split("@")[0] || "You");
        setAvatarUrl(row?.avatar_url ?? null);
      });
  }, [user?.id]);

  const { data: creators = [] } = useQuery<Creator[]>({
    queryKey: ["desktop-left-creators"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as Creator[]) || [];
    },
  });

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/jobs") return location.pathname === "/jobs" || (location.pathname.startsWith("/jobs/") && !location.pathname.includes("/interview"));
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-y-contain py-3 pr-2">
      <button
        type="button"
        onClick={() => navigate("/profile")}
        className="mb-2 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted"
      >
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
              {displayName[0]?.toUpperCase() || "?"}
            </span>
          )}
        </div>
        <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
      </button>

      <nav className="space-y-0.5">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.path);
          return (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold transition-colors ${
                active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
              {link.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-create-post"))}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted"
        >
          <PlusSquare className="h-5 w-5 shrink-0" />
          Create
        </button>
      </nav>

      {/* Widgets under Create — fills the profile column; frees center for Reels + Posts */}
      <div className="mt-4 space-y-3">
        <section className="rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Trending on YAJ</h2>
          </div>
          <ul className="space-y-1">
            {["Studio sessions", "Open mic nights", "Creator collabs"].map((label) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => navigate("/")}
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
      </div>

      <p className="mt-8 px-2 text-[11px] leading-relaxed text-muted-foreground">
        Privacy · Terms · Advertising · YAJ © {new Date().getFullYear()}
      </p>
    </aside>
  );
}
