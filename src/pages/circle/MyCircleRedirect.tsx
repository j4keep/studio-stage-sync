import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Home,
  Loader2,
  LockKeyhole,
  LogOut,
  Mic2,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Users,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreatePersonalCircle, leaveCircle, listCircleDirectory, updateCircle } from "@/lib/circles";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CircleFollowingFeed from "@/components/circle/CircleFollowingFeed";

const SLIDE_MS = 3600;

type DiscoveryTab = "home" | "discover" | "memberships";

type CirclePreview = {
  id: string;
  name: string;
  cover_url: string | null;
  city: string | null;
  member_count: number;
  is_private: boolean;
  is_discoverable: boolean;
  type: string;
  owner_id: string;
  description?: string | null;
  category?: string | null;
  is_personal?: boolean;
  owner_name?: string | null;
};

type JoinedCircle = CirclePreview & {
  membership_id: string;
  role: string;
};

const slides = [
  {
    eyebrow: "MY CIRCLE",
    title: "Your people.\nYour moments.",
    body: "A place for the communities, conversations and experiences you actually care about.",
    icon: Users,
    accent: "from-violet-500 via-fuchsia-500 to-orange-400",
    cards: ["Private circles", "Creator communities", "Real connections"],
  },
  {
    eyebrow: "DISCOVER",
    title: "Find something\nworth showing up for.",
    body: "Podcasts, dinners, workshops, listening sessions, networking, nightlife and more.",
    icon: CalendarDays,
    accent: "from-orange-400 via-rose-500 to-red-600",
    cards: ["Podcast taping", "Community meetup", "Live experience"],
  },
  {
    eyebrow: "CREATE",
    title: "Build your own\ncircle.",
    body: "Bring people together, post, go live and create experiences around what matters to you.",
    icon: Mic2,
    accent: "from-cyan-400 via-blue-500 to-violet-600",
    cards: ["Host a live", "Share with members", "Grow together"],
  },
  {
    eyebrow: "PUBLIC OR PRIVATE",
    title: "Your circle.\nYour rules.",
    body: "Keep it close, open it to the community, or create an event with RSVP and ticket options.",
    icon: LockKeyhole,
    accent: "from-emerald-400 via-teal-500 to-cyan-500",
    cards: ["Invite only", "Free RSVP", "Ticketed events"],
  },
] as const;

export default function MyCircleRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [circles, setCircles] = useState<CirclePreview[]>([]);
  const [memberships, setMemberships] = useState<JoinedCircle[]>([]);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [tab, setTab] = useState<DiscoveryTab>("home");
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [circleSearch, setCircleSearch] = useState("");

  const hasCompletedIntro = Boolean(user?.user_metadata?.circle_onboarding_complete);

  useEffect(() => {
    if (loading || !user?.id) return;
    let active = true;
    void getOrCreatePersonalCircle(user.id, user.user_metadata?.display_name)
      .then((circle) => {
        if (!active) return;
        setCircleId(circle.id);
        // A personal Circle may be private, but it must still be discoverable so people
        // can find it again after leaving and request to rejoin. Privacy controls access
        // to the content; it should not erase the Circle card from discovery.
        if (circle.is_personal && !circle.is_discoverable) {
          void updateCircle(circle.id, { isDiscoverable: true }).catch(() => {});
        }
        if (hasCompletedIntro) setShowDiscovery(true);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [hasCompletedIntro, loading, user?.id, user?.user_metadata?.display_name]);

  const loadDiscovery = useCallback(async () => {
    if (!showDiscovery || !user?.id) return;

    const [directory, { data: membershipRows }] = await Promise.all([
      listCircleDirectory(),
      (supabase as any)
        .from("circle_members")
        .select("id,circle_id,role,status")
        .eq("user_id", user.id)
        .eq("status", "approved"),
    ]);

    setCircles(directory as CirclePreview[]);

    const approved = (membershipRows || []) as Array<{ id: string; circle_id: string; role: string; status: string }>;
    const joinedIds = approved
      .filter((m) => m.circle_id !== circleId && m.role !== "owner")
      .map((m) => m.circle_id);

    if (!joinedIds.length) {
      setMemberships([]);
      return;
    }

    const { data: joinedRows } = await (supabase as any)
      .from("circles")
      .select("id,name,cover_url,city,member_count,is_private,is_discoverable,is_personal,type,owner_id,description,category")
      .in("id", joinedIds);

    const membershipByCircle = new Map(approved.map((m) => [m.circle_id, m]));
    setMemberships(
      ((joinedRows || []) as CirclePreview[]).map((circle) => {
        const membership = membershipByCircle.get(circle.id)!;
        return {
          ...circle,
          membership_id: membership.id,
          role: membership.role,
        };
      }),
    );
  }, [circleId, showDiscovery, user?.id]);

  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  useEffect(() => {
    if (loading || hasCompletedIntro || error || showDiscovery) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [error, hasCompletedIntro, loading, showDiscovery]);

  const visibleCircles = useMemo(() => {
    const needle = circleSearch.trim().toLowerCase();
    if (!needle) return circles;
    return circles.filter((circle) => {
      const haystack = [
        circle.name,
        circle.owner_name,
        circle.city,
        circle.category,
        circle.type,
        circle.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [circleSearch, circles]);

  const current = slides[slide];
  const Icon = current.icon;
  const progress = useMemo(() => ((slide + 1) / slides.length) * 100, [slide]);

  const enterCircle = async (remember: boolean) => {
    if (!circleId || finishing) return;
    setFinishing(true);
    if (remember) {
      const { error: updateError } = await supabase.auth.updateUser({ data: { circle_onboarding_complete: true } });
      if (updateError) console.warn("Unable to save My Circle onboarding state", updateError);
    }
    setFinishing(false);
    setShowDiscovery(true);
  };

  const handleLeave = async (circle: JoinedCircle) => {
    if (!user?.id || leavingId) return;
    if (!window.confirm(`Leave ${circle.name}? You will still be able to find this Circle and join or request access again later.`)) return;
    setLeavingId(circle.id);
    try {
      await leaveCircle(circle.id, user.id);
      setMemberships((prev) => prev.filter((item) => item.id !== circle.id));
      toast({ title: "Left Circle", description: "The Circle is still available in Discover if you want to rejoin later." });
    } catch (e: any) {
      toast({ title: "Could not leave Circle", description: e?.message, variant: "destructive" });
    } finally {
      setLeavingId(null);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-center text-foreground">
        <div className="w-full max-w-sm rounded-[30px] border border-border bg-card p-7 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[22px] font-black tracking-tight">My Circle is taking a moment</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">We couldn't open your Circle right now. Try again and we'll reconnect you.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 text-[14px] font-black text-background active:scale-[0.98]">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading || (hasCompletedIntro && !showDiscovery)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><Users className="h-6 w-6" /></div>
          <p className="mt-4 text-[15px] font-black">Opening My Circle</p>
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (showDiscovery) {
    return (
      <main className="min-h-[100dvh] bg-background pb-28 text-foreground transition-colors">
        <section className="px-4 pt-[max(env(safe-area-inset-top),1.25rem)] lg:px-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Community</p>
              <h1 className="mt-1 text-[42px] font-black leading-[0.9] tracking-[-0.055em]">My Circle</h1>
            </div>
            {circleId && (
              <button type="button" onClick={() => navigate(`/circle/c/${circleId}`)} className="rounded-full bg-foreground px-4 py-2.5 text-[12px] font-black text-background">
                Open my Circle
              </button>
            )}
          </div>
          <p className="mt-3 max-w-sm text-[13px] font-medium leading-relaxed text-muted-foreground">
            Follow what is happening across the Circles you joined, or discover new communities.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-[22px] border border-border bg-card p-1.5">
            {([
              ["home", "Home", Home],
              ["discover", "Discover", Compass],
              ["memberships", "Memberships", UsersRound],
            ] as const).map(([id, label, TabIcon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-[17px] text-[11px] font-black transition ${
                  tab === id ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <TabIcon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {tab === "home" && user?.id && (
          <section className="mt-4">
            <div className="px-4 lg:px-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Latest from your Circles</p>
              <h2 className="mt-1 text-[28px] font-black tracking-[-0.04em]">Home</h2>
            </div>
            <CircleFollowingFeed userId={user.id} ownCircleId={circleId} />
          </section>
        )}

        {tab === "discover" && (
          <section className="mt-7 px-4 lg:px-6">
            <div className="relative mb-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={circleSearch}
                onChange={(event) => setCircleSearch(event.target.value)}
                placeholder="Search Circles, people, topics or places"
                className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
            {visibleCircles.map((circle) => (
              <button
                key={circle.id}
                type="button"
                onClick={() => navigate(`/circle/c/${circle.id}`)}
                className="group relative block aspect-[16/11] w-full overflow-hidden rounded-[30px] border border-border bg-card text-left shadow-sm"
              >
                {circle.cover_url ? (
                  <img src={circle.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-active:scale-[1.01]" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/85" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h2 className="text-[29px] font-black leading-[0.95] tracking-[-0.045em]">{circle.name}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-white/70">
                    <span>{circle.member_count || 0} members</span>
                    {circle.owner_name ? <span>{circle.owner_name}</span> : null}
                    {circle.city ? <span>{circle.city}</span> : null}
                    {circle.is_private ? <span className="flex items-center gap-1"><LockKeyhole className="h-3 w-3" /> Private · Request to join</span> : <span>Open · Join anytime</span>}
                  </div>
                </div>
              </button>
            ))}
            {!visibleCircles.length && (
              <div className="rounded-[28px] border border-border bg-card px-6 py-14 text-center lg:col-span-2">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-black">{circleSearch.trim() ? "No Circle matched that search" : "Circles are getting started"}</h2>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {circleSearch.trim()
                    ? "Try a Circle name, member name, topic, category or city."
                    : "Public and private personal Circles will appear here so people can join or request access."}
                </p>
              </div>
            )}
            </div>
          </section>
        )}

        {tab === "memberships" && (
          <section className="mt-7 space-y-3 px-4 lg:px-6">
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Your memberships</p>
              <h2 className="mt-1 text-[28px] font-black tracking-[-0.04em]">Circles you joined</h2>
              <p className="mt-2 text-[12px] text-muted-foreground">Manage membership here. Leaving never hides a discoverable Circle from you.</p>
            </div>

            {memberships.map((circle) => (
              <div key={circle.id} className="flex items-center gap-3 rounded-[24px] border border-border bg-card p-3 shadow-sm">
                <button type="button" onClick={() => navigate(`/circle/c/${circle.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-muted">
                    {circle.cover_url ? <img src={circle.cover_url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black">{circle.name}</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      {circle.is_private ? "Private Circle" : "Open Circle"} · {circle.member_count || 0} members
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={leavingId === circle.id}
                  onClick={() => void handleLeave(circle)}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-black text-muted-foreground active:scale-95 disabled:opacity-50"
                >
                  {leavingId === circle.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  Leave
                </button>
              </div>
            ))}

            {!memberships.length && (
              <div className="rounded-[28px] border border-border bg-card px-6 py-14 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-black">No joined Circles yet</h2>
                <p className="mt-2 text-[13px] text-muted-foreground">Open Discover to find communities. Public Circles join immediately; private Circles let you request access.</p>
                <button type="button" onClick={() => setTab("discover")} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-[12px] font-black text-background">Discover Circles</button>
              </div>
            )}
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className={`absolute inset-0 bg-gradient-to-br ${current.accent} opacity-35 transition-all duration-700 dark:opacity-90`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.20),transparent_34%),linear-gradient(to_bottom,transparent,hsl(var(--background)/0.92))]" />

      <div className="pointer-events-none absolute inset-x-0 top-[15dvh] flex justify-center">
        <div className="relative h-[34dvh] w-[82vw] max-w-md">
          <div className="absolute left-[4%] top-[7%] h-44 w-32 -rotate-6 animate-pulse rounded-[30px] border border-border bg-card/55 shadow-2xl backdrop-blur-md" />
          <div className="absolute right-[4%] top-[12%] h-48 w-36 rotate-6 animate-pulse rounded-[30px] border border-border bg-card/55 shadow-2xl backdrop-blur-md [animation-delay:700ms]" />
          <div className="absolute left-1/2 top-0 flex h-56 w-40 -translate-x-1/2 flex-col items-center justify-center rounded-[34px] border border-border bg-card/70 shadow-2xl backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background shadow-xl"><Icon className="h-9 w-9" /></div>
            <span className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">YAJ Circle</span>
          </div>
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
            {current.cards.map((item) => (
              <span key={item} className="whitespace-nowrap rounded-full border border-border bg-card/80 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">{item}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <div className="flex gap-1.5">
            {slides.map((item, index) => (
              <button key={item.eyebrow} type="button" onClick={() => setSlide(index)} aria-label={`Intro ${index + 1}`} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/20">
                <span className={`block h-full rounded-full bg-foreground transition-all duration-500 ${index <= slide ? "w-full" : "w-0"}`} />
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-[11px] font-black tracking-[0.22em] text-foreground/80">{current.eyebrow}</span>
            <span className="text-[11px] font-bold text-muted-foreground">{slide + 1}/{slides.length}</span>
          </div>
        </div>

        <div className="mt-auto pb-5">
          <div className="mb-4 flex items-center gap-2 text-foreground/85"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-black uppercase tracking-[0.18em]">Together we show up</span></div>
          <h1 className="whitespace-pre-line text-[clamp(44px,13vw,68px)] font-black leading-[0.88] tracking-[-0.065em]">{current.title}</h1>
          <p className="mt-5 max-w-md text-[15px] font-semibold leading-relaxed text-muted-foreground">{current.body}</p>

          <div className="mt-7 flex items-center gap-3 rounded-[24px] border border-border bg-card/75 p-3 backdrop-blur-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background">{slide === 3 ? <Ticket className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div>
            <div className="min-w-0 flex-1"><p className="text-[12px] font-black">Made for more than parties</p><p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">Private · Podcast · Community · Events · Live</p></div>
          </div>

          <button type="button" disabled={!circleId || finishing} onClick={() => void enterCircle(true)} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-black text-background shadow-2xl transition active:scale-[0.985] disabled:opacity-55">
            {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enter My Circle <ArrowRight className="h-4 w-4" /></>}
          </button>
          <button type="button" disabled={!circleId || finishing} onClick={() => void enterCircle(false)} className="mt-3 h-11 w-full text-[13px] font-bold text-muted-foreground disabled:opacity-50">Maybe later</button>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">Intro progress {Math.round(progress)} percent</div>
    </main>
  );
}
