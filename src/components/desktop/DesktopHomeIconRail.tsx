import { useLocation, useNavigate } from "react-router-dom";
import { Compass, Home, PlusSquare } from "lucide-react";
import YajAiGeneratorIcon from "@/components/YajAiGeneratorIcon";

const tabs = [
  { path: "/", label: "Home", kind: "lucide" as const, icon: Home },
  { path: "/explore", label: "Explore", kind: "lucide" as const, icon: Compass },
  { path: "/ask-yaj", label: "YAJ AI", kind: "ai" as const },
] as const;

/** Vertical menu strip on the right of desktop shell pages. */
export default function DesktopHomeIconRail() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname === "/feed";
    if (path === "/explore") {
      return (
        location.pathname === "/explore" ||
        location.pathname.startsWith("/local-help") ||
        location.pathname.startsWith("/marketplace") ||
        location.pathname.startsWith("/wellness") ||
        location.pathname === "/radio"
      );
    }
    if (path === "/ask-yaj") {
      return location.pathname === "/ask-yaj" || location.pathname.startsWith("/ask-yaj/");
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="sticky top-14 flex h-[calc(100dvh-3.5rem)] w-14 flex-col items-center gap-1 border-l border-border bg-card/80 py-3">
      {tabs.map((tab) => {
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
            {tab.kind === "ai" ? (
              <YajAiGeneratorIcon className="h-6 w-6" active={active} />
            ) : (
              <tab.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            )}
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
