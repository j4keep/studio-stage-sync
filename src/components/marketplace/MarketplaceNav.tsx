import { NavLink, useLocation } from "react-router-dom";
import { Home, Search, PlusCircle, MessageCircle, UserRound } from "lucide-react";

const tabs = [
  { to: "/marketplace", label: "Home", icon: Home, end: true },
  { to: "/marketplace/search", label: "Search", icon: Search, end: false },
  { to: "/marketplace/create", label: "Sell", icon: PlusCircle, end: false },
  { to: "/marketplace/messages", label: "Messages", icon: MessageCircle, end: false },
  { to: "/marketplace/account", label: "My MP", icon: UserRound, end: false },
] as const;

/** Dedicated marketplace bottom nav — separate from main YAJ tabs. */
export default function MarketplaceNav() {
  const location = useLocation();
  const hide =
    location.pathname.includes("/marketplace/create") ||
    location.pathname.includes("/marketplace/edit/");

  if (hide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl safe-area-bottom lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch gap-0.5 px-1 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 min-h-[3rem] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={2.2} />
              <span className="text-[10px] font-semibold leading-tight">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
