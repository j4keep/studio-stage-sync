import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Compass, Home, PlusSquare } from "lucide-react";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
] as const;

/** Vertical menu strip on the right of desktop Home (replaces top center icons). */
export default function DesktopHomeIconRail() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "/feed";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="sticky top-14 flex h-[calc(100dvh-3.5rem)] w-14 flex-col items-center gap-1 border-l border-border bg-card/80 py-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            title={tab.label}
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
              active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-create-post"))}
        aria-label="Create"
        title="Create"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PlusSquare className="h-5 w-5" />
      </button>
    </aside>
  );
}
