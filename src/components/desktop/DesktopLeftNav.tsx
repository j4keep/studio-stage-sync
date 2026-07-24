import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Bookmark, Compass, Home, PlusSquare, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/my-jobs", label: "Saved jobs", icon: Bookmark },
] as const;

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

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "/feed";
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

      <p className="mt-8 px-2 text-[11px] leading-relaxed text-muted-foreground">
        Privacy · Terms · Advertising · YAJ © {new Date().getFullYear()}
      </p>
    </aside>
  );
}
