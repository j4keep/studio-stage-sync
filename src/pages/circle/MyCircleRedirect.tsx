import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Loader2,
  LockKeyhole,
  Mic2,
  RefreshCw,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreatePersonalCircle } from "@/lib/circles";
import { supabase } from "@/integrations/supabase/client";

const SLIDE_MS = 3600;

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

/**
 * Resolve the signed-in user's personal Circle. New My Circle users get one short,
 * bold intro first; completion is stored on the auth account so it follows them
 * across devices. The Circle itself is prepared in the background while they watch.
 */
export default function MyCircleRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [circleId, setCircleId] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const hasCompletedIntro = Boolean(user?.user_metadata?.circle_onboarding_complete);

  useEffect(() => {
    if (loading || !user?.id) return;

    let active = true;
    void getOrCreatePersonalCircle(user.id, user.user_metadata?.display_name)
      .then((circle) => {
        if (!active) return;
        setCircleId(circle.id);
        if (hasCompletedIntro) navigate(`/circle/c/${circle.id}`, { replace: true });
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [hasCompletedIntro, loading, navigate, user?.id, user?.user_metadata?.display_name]);

  useEffect(() => {
    if (loading || hasCompletedIntro || error) return;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [error, hasCompletedIntro, loading]);

  const current = slides[slide];
  const Icon = current.icon;
  const progress = useMemo(() => ((slide + 1) / slides.length) * 100, [slide]);

  const enterCircle = async (remember: boolean) => {
    if (!circleId || finishing) return;
    setFinishing(true);

    if (remember) {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { circle_onboarding_complete: true },
      });
      if (updateError) {
        // Don't trap the user because metadata could not save. They can still enter.
        console.warn("Unable to save My Circle onboarding state", updateError);
      }
    }

    navigate(`/circle/c/${circleId}`, { replace: true });
  };

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black px-5 text-center text-white">
        <div className="w-full max-w-sm rounded-[30px] border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Users className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[22px] font-black tracking-tight">My Circle is taking a moment</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">
            We couldn't open your Circle right now. Try again and we'll reconnect you.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-[14px] font-black text-black active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading || hasCompletedIntro) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Users className="h-6 w-6" />
          </div>
          <p className="mt-4 text-[15px] font-black">Opening My Circle</p>
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-white/70" />
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <div className={`absolute inset-0 bg-gradient-to-br ${current.accent} opacity-90 transition-all duration-700`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(to_bottom,rgba(0,0,0,0.04),rgba(0,0,0,0.78))]" />

      {/* Motion-story stage. These shapes intentionally move like a short visual reel
          while keeping the component self-contained until dedicated YAJ video assets land. */}
      <div className="pointer-events-none absolute inset-x-0 top-[15dvh] flex justify-center">
        <div className="relative h-[34dvh] w-[82vw] max-w-md">
          <div className="absolute left-[4%] top-[7%] h-44 w-32 -rotate-6 animate-pulse rounded-[30px] border border-white/20 bg-black/25 shadow-2xl backdrop-blur-md" />
          <div className="absolute right-[4%] top-[12%] h-48 w-36 rotate-6 animate-pulse rounded-[30px] border border-white/20 bg-black/25 shadow-2xl backdrop-blur-md [animation-delay:700ms]" />
          <div className="absolute left-1/2 top-0 flex h-56 w-40 -translate-x-1/2 flex-col items-center justify-center rounded-[34px] border border-white/25 bg-black/30 shadow-2xl backdrop-blur-xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black shadow-xl">
              <Icon className="h-9 w-9" />
            </div>
            <span className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/75">YAJ Circle</span>
          </div>
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-2">
            {current.cards.map((item) => (
              <span key={item} className="whitespace-nowrap rounded-full border border-white/20 bg-black/30 px-3 py-2 text-[10px] font-bold backdrop-blur-xl">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <div className="flex gap-1.5">
            {slides.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                onClick={() => setSlide(index)}
                aria-label={`Intro ${index + 1}`}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
              >
                <span className={`block h-full rounded-full bg-white transition-all duration-500 ${index <= slide ? "w-full" : "w-0"}`} />
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-[11px] font-black tracking-[0.22em] text-white/80">{current.eyebrow}</span>
            <span className="text-[11px] font-bold text-white/60">{slide + 1}/{slides.length}</span>
          </div>
        </div>

        <div className="mt-auto pb-5">
          <div className="mb-4 flex items-center gap-2 text-white/85">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-black uppercase tracking-[0.18em]">Together we show up</span>
          </div>
          <h1 className="whitespace-pre-line text-[clamp(44px,13vw,68px)] font-black leading-[0.88] tracking-[-0.065em]">
            {current.title}
          </h1>
          <p className="mt-5 max-w-md text-[15px] font-semibold leading-relaxed text-white/78">{current.body}</p>

          <div className="mt-7 flex items-center gap-3 rounded-[24px] border border-white/15 bg-black/25 p-3 backdrop-blur-xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black">
              {slide === 3 ? <Ticket className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black">Made for more than parties</p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-white/55">Private · Podcast · Community · Events · Live</p>
            </div>
          </div>

          <button
            type="button"
            disabled={!circleId || finishing}
            onClick={() => void enterCircle(true)}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-black text-black shadow-2xl transition active:scale-[0.985] disabled:opacity-55"
          >
            {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Enter My Circle <ArrowRight className="h-4 w-4" /></>}
          </button>
          <button
            type="button"
            disabled={!circleId || finishing}
            onClick={() => void enterCircle(false)}
            className="mt-3 h-11 w-full text-[13px] font-bold text-white/75 disabled:opacity-50"
          >
            Maybe later
          </button>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">Intro progress {Math.round(progress)} percent</div>
    </main>
  );
}
