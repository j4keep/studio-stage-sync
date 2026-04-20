import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, KeyRound, Headphones, Mic2, ChevronLeft, Sparkles, Radio } from "lucide-react";
import { useSession } from "./SessionContext";
import { StudioSearchSheet } from "./StudioSearchSheet";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import orbitMixer from "@/assets/wstudio-orbit-mixer.jpg";
import orbitMic from "@/assets/wstudio-orbit-mic.jpg";
import orbitHeadphones from "@/assets/wstudio-orbit-headphones.jpg";
import orbitControl from "@/assets/wstudio-orbit-control.jpg";
import orbitVocalist from "@/assets/wstudio-orbit-vocalist.jpg";
import orbitFaders from "@/assets/wstudio-orbit-faders.jpg";

const ORBIT_IMAGES = [orbitMixer, orbitMic, orbitHeadphones, orbitControl, orbitVocalist, orbitFaders];

export default function SessionJoinScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { joinAsArtist, joinAsEngineer } = useSession();
  const { user, loading: authLoading } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [joining, setJoining] = useState(false);
  const autoJoinedRef = useRef(false);

  // If arriving with a ?code= and not logged in, bounce to /auth and come back
  useEffect(() => {
    if (authLoading) return;
    const code = searchParams.get("code");
    if (!code) return;
    if (!user) {
      const returnTo = `/wstudio/session/join?code=${code}${searchParams.get("role") ? `&role=${searchParams.get("role")}` : ""}`;
      navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [authLoading, user, searchParams, navigate]);

  // Auto-join from booking link (?code=XXXXXX&role=engineer|artist)
  useEffect(() => {
    if (autoJoinedRef.current || authLoading || !user) return;
    const code = searchParams.get("code");
    if (!code || code.length < 6) return;
    autoJoinedRef.current = true;
    const role = searchParams.get("role");
    setSessionCode(code);

    (async () => {
      setJoining(true);
      const { data, error } = await (supabase as any)
        .from("studio_bookings")
        .select("id, session_code, session_status, studio_id, hours, user_id")
        .eq("session_code", code.toUpperCase())
        .single();
      setJoining(false);

      if (error || !data) {
        toast.error("Invalid session code. Please check and try again.");
        return;
      }
      if (data.session_status === "completed") {
        toast.error("This session has already ended.");
        return;
      }

      const sessionIdToUse = data.session_code || code.toUpperCase();

      if (data.hours) {
        const bookedMinutes = data.hours * 60;
        localStorage.setItem(`wstudio_booking_hours_${sessionIdToUse}`, JSON.stringify({ bookedMinutes, bookingId: data.id }));
      }

      toast.success("Joining session...");
      if (role === "engineer") {
        joinAsEngineer(sessionIdToUse);
      } else {
        joinAsArtist(sessionIdToUse);
      }
      navigate("/wstudio/session/live");
    })();
  }, [searchParams, joinAsArtist, joinAsEngineer, navigate, user, authLoading]);

  const handleJoin = (role: "artist" | "engineer") => {
    if (role === "artist") joinAsArtist();
    else joinAsEngineer();
    navigate("/wstudio/session/live");
  };

  const handleCodeJoin = async () => {
    if (sessionCode.length < 6) return;
    setJoining(true);

    const { data, error } = await (supabase as any)
      .from("studio_bookings")
      .select("id, session_code, session_status, studio_id, hours, user_id")
      .eq("session_code", sessionCode.toUpperCase())
      .single();

    setJoining(false);

    if (error || !data) {
      toast.error("Invalid session code. Please check and try again.");
      return;
    }

    if (data.session_status === "completed") {
      toast.error("This session has already ended.");
      return;
    }

    const sessionIdToUse = data.session_code || sessionCode.toUpperCase();

    if (data.hours) {
      const bookedMinutes = data.hours * 60;
      localStorage.setItem(`wstudio_booking_hours_${sessionIdToUse}`, JSON.stringify({ bookedMinutes, bookingId: data.id }));
    }

    toast.success("Joining session...");
    joinAsArtist(sessionIdToUse);
    navigate("/wstudio/session/live");
  };

  const handleBooked = (code: string) => {
    setSessionCode(code);
    toast.success(`Your session code is: ${code}. Enter it when your engineer starts the session.`);
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* Subtle radial accent using theme primary */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at top, hsl(var(--primary) / 0.18), transparent 55%)" }}
      />

      <div className="relative z-10 flex h-[100dvh] flex-col items-center px-4 pb-3">
        {/* Back Button */}
        <div className="w-full max-w-sm pt-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-foreground/90 hover:text-primary transition"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-between gap-3 w-full py-2 min-h-0">
          {/* Pro Logo Mark — matches WHEUAT branding */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{
                borderColor: "hsl(var(--primary) / 0.35)",
                backgroundColor: "hsl(var(--primary) / 0.10)",
                color: "hsl(var(--primary))",
              }}
            >
              <Sparkles className="h-3 w-3" />
              Remote Recording
            </div>

            {/* Refined logo — single-color wordmark with accent dot, like a pro brand mark */}
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shadow-lg"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "var(--glow-primary)",
                }}
              >
                <Radio className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="text-2xl font-black tracking-tight text-foreground">
                W<span className="text-primary">.</span>STUDIO
              </span>
            </div>

            <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">
              Book a vetted engineer. Drop into a live session from anywhere.
            </p>
          </div>

          {/* Orbiting studio image circles around the primary CTA */}
          <div className="relative flex h-[230px] w-[230px] items-center justify-center shrink-0">
            {/* Rotating orbit ring */}
            <div className="absolute inset-0 animate-[spin_28s_linear_infinite]" style={{ transformOrigin: "center" }}>
              {ORBIT_IMAGES.map((src, i) => {
                const angle = (i / ORBIT_IMAGES.length) * 2 * Math.PI;
                const radius = 100;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                return (
                  <div
                    key={src}
                    className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border"
                    style={{
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                      borderColor: "hsl(var(--primary) / 0.5)",
                      boxShadow: "0 4px 20px -4px hsl(var(--primary) / 0.45)",
                    }}
                  >
                    <div className="h-full w-full animate-[spin_28s_linear_infinite_reverse]">
                      <img
                        src={src}
                        alt="Studio gear"
                        loading="lazy"
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Soft glow behind CTA */}
            <div
              className="pointer-events-none absolute h-28 w-28 rounded-full blur-3xl"
              style={{ backgroundColor: "hsl(var(--primary) / 0.25)" }}
            />

            {/* Center CTA */}
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="group relative z-10 flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-full border text-center transition hover:scale-105"
              style={{
                borderColor: "hsl(var(--primary) / 0.6)",
                background: "linear-gradient(135deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.15), hsl(var(--background) / 0.9))",
                boxShadow: "0 8px 30px -6px hsl(var(--primary) / 0.6)",
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl ring-1"
                style={{
                  backgroundColor: "hsl(var(--primary) / 0.25)",
                  // @ts-ignore CSS custom prop
                  "--tw-ring-color": "hsl(var(--primary) / 0.5)",
                }}
              >
                <Search className="h-4 w-4 text-primary" />
              </div>
              <h3 className="px-2 text-[12px] font-bold leading-tight text-foreground">Find an Engineer</h3>
              <span
                className="rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: "hsl(var(--primary) / 0.25)",
                  color: "hsl(var(--primary))",
                }}
              >
                Tap to start
              </span>
            </button>
          </div>

          {/* Session Code Entry */}
          <div
            className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border p-3 backdrop-blur-md"
            style={{
              borderColor: "hsl(var(--border))",
              backgroundColor: "hsl(var(--card) / 0.7)",
            }}
          >
            <div className="flex items-center gap-2 text-primary">
              <KeyRound className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Have a Session Code?</span>
            </div>
            <InputOTP maxLength={6} value={sessionCode} onChange={setSessionCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="border-border bg-background text-foreground h-9 w-9" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <button
              onClick={handleCodeJoin}
              disabled={sessionCode.length < 6 || joining}
              className="w-full rounded-xl py-2 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--glow-primary)",
              }}
            >
              {joining ? "Joining..." : "Join Session"}
            </button>
          </div>

          {/* Role Buttons */}
          <div className="flex w-full max-w-sm flex-col gap-1.5">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Or join directly
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleJoin("engineer")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground backdrop-blur hover:bg-card transition"
              >
                <Headphones className="h-4 w-4" />
                Engineer
              </button>
              <button
                onClick={() => handleJoin("artist")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground backdrop-blur hover:bg-card transition"
              >
                <Mic2 className="h-4 w-4" />
                Artist
              </button>
            </div>
          </div>

          <StudioSearchSheet
            open={showSearch}
            onClose={() => setShowSearch(false)}
            onBooked={handleBooked}
          />
        </div>
      </div>
    </div>
  );
}
