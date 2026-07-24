import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Compass, Home, MessageCircle, PlusSquare, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import yajLogo from "@/assets/yaj-logo.png";

const centerTabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
] as const;

export default function DesktopTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null));
  }, [user?.id]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "/feed";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      navigate("/explore");
      return;
    }
    navigate(`/explore?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-4 px-4">
        <button type="button" onClick={() => navigate("/")} className="shrink-0" aria-label="YAJ home">
          <img src={yajLogo} alt="YAJ" className="h-10 w-auto" />
        </button>

        <form onSubmit={onSearch} className="relative w-60 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YAJ"
            className="h-10 w-full rounded-full border border-border bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <nav className="mx-auto flex h-full flex-1 items-stretch justify-center gap-1 max-w-md">
          {centerTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                type="button"
                onClick={() => navigate(tab.path)}
                aria-label={tab.label}
                className={`relative flex flex-1 items-center justify-center rounded-lg transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-create-post"))}
            aria-label="Create"
            className="relative flex flex-1 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusSquare className="h-6 w-6" strokeWidth={2} />
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
            aria-label="Messages"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <NotificationBell />
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="h-10 w-10 overflow-hidden rounded-full bg-muted ring-2 ring-border"
            aria-label="Profile"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {(user?.email?.[0] || "?").toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
