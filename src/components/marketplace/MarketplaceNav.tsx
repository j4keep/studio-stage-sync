import { NavLink, useLocation } from "react-router-dom";
import { Compass, Plus, Inbox, Store, UserRound } from "lucide-react";

const tabs = [
  { to: "/marketplace", label: "Browse", icon: Compass, end: true },
  { to: "/marketplace/search", label: "Find", icon: Store, end: false },
  { to: "/marketplace/create", label: "List", icon: Plus, end: false, sell: true },
  { to: "/marketplace/messages", label: "Inbox", icon: Inbox, end: false },
  { to: "/marketplace/account", label: "You", icon: UserRound, end: false },
] as const;

/** Marketplace tab bar — YAJ pill rail, not OfferUp clone. */
export default function MarketplaceNav() {
  const location = useLocation();
  const hide =
    location.pathname.includes("/marketplace/create") ||
    location.pathname.includes("/marketplace/edit/");

  if (hide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 lg:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-1 rounded-[1.35rem] border border-border/70 bg-background/90 p-1.5 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          if ("sell" in tab && tab.sell) {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_hsl(var(--primary))]">
                  <Icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wide text-primary">{tab.label}</span>
              </NavLink>
            );
          }
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 min-h-[3.15rem] transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2.1} />
              <span className="text-[9px] font-bold uppercase tracking-wide">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
