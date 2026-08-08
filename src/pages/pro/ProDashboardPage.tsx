import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Store,
  Tag,
  Wrench,
  CalendarDays,
  Radio,
  HeartPulse,
  Tv,
  Gamepad2,
  Lock,
} from "lucide-react";

type Section = {
  id: string;
  label: string;
  sub: string;
  icon: typeof Briefcase;
  route?: string;
  ready: boolean;
};

/**
 * Professional Dashboard — the single place where users manage everything they
 * publish across the Explore categories. Explore pages stay read-only.
 * (Battles are intentionally excluded — those are created in-page.)
 */
const SECTIONS: Section[] = [
  { id: "opportunities", label: "Opportunities", sub: "Post jobs & gigs, resume, applications, hiring pipeline", icon: Briefcase, route: "/pro/opportunities", ready: true },
  { id: "local-help", label: "Local Help", sub: "Your service business profile & gigs", icon: Wrench, route: "/local-help/business", ready: true },
  { id: "deals", label: "Deals", sub: "Business deals, redemptions & verification", icon: Tag, route: "/deals/business", ready: true },
  { id: "marketplace", label: "Marketplace", sub: "Your listings, offers & sales", icon: Store, route: "/marketplace/account", ready: true },
  { id: "events", label: "Events", sub: "Manage events & RSVPs", icon: CalendarDays, route: "/events", ready: true },
  { id: "radio", label: "Radio", sub: "Songs, playlists & rotation", icon: Radio, route: "/my-songs", ready: true },
  { id: "tv", label: "YAJ TV", sub: "Videos & shows you publish", icon: Tv, route: "/my-videos", ready: true },
  { id: "wellness", label: "Wellness", sub: "Coach content & programs", icon: HeartPulse, ready: false },
  { id: "games", label: "Games", sub: "Tournaments & game rooms", icon: Gamepad2, ready: false },
];

export default function ProDashboardPage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight">Professional Dashboard</h1>
            <p className="text-[11px] font-medium text-muted-foreground">Manage everything you publish</p>
          </div>
        </div>
      </header>

      <section className="space-y-2 px-3 pt-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              disabled={!s.ready}
              onClick={() => s.route && nav(s.route)}
              className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3.5 text-left transition-colors ${
                s.ready ? "hover:border-primary/40 active:scale-[0.99]" : "opacity-60"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon className="h-5 w-5 text-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold leading-tight">{s.label}</span>
                <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{s.sub}</span>
              </span>
              {s.ready ? (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                  <Lock className="h-3 w-3" /> Soon
                </span>
              )}
            </button>
          );
        })}
      </section>
    </div>
  );
}
