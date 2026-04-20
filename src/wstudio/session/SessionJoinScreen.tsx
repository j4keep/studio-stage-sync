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
    <div className="relative min-h-[100dvh] overflow-hidden bg-black text-zinc-100">
      {/* Subtle radial accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_55%)]" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center px-4 pb-10">
        {/* Back Button */}
        <div className="w-full max-w-sm pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-white/90 hover:text-amber-300 transition"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">Back</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full">
          {/* Logo / Hero */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              <Sparkles className="h-3 w-3" />
              Remote Recording
            </div>
            <span className="mt-1 text-3xl font-black tracking-tight text-white drop-shadow">
              W.<span className="text-amber-300">STUDIO</span>
            </span>
            <p className="max-w-xs text-[12px] leading-relaxed text-zinc-300/80">
              Book a vetted engineer. Drop into a live studio session from anywhere.
            </p>
          </div>

          {/* Orbiting studio image circles around the primary CTA */}
          <div className="relative my-2 flex h-[300px] w-[300px] items-center justify-center sm:h-[340px] sm:w-[340px]">
            {/* Rotating orbit ring */}
            <div
              className="absolute inset-0 animate-[spin_28s_linear_infinite]"
              style={{ transformOrigin: "center" }}
            >
              {ORBIT_IMAGES.map((src, i) => {
                const angle = (i / ORBIT_IMAGES.length) * 2 * Math.PI;
                const radius = 130; // px from center
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                return (
                  <div
                    key={src}
                    className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-amber-400/40 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.45)] sm:h-[72px] sm:w-[72px]"
                    style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  >
                    {/* Counter-rotate so images stay upright */}
                    <div className="h-full w-full animate-[spin_28s_linear_infinite_reverse]">
                      <img
                        src={src}
                        alt="Studio gear"
                        loading="lazy"
                        width={72}
                        height={72}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Soft glow behind CTA */}
            <div className="pointer-events-none absolute h-40 w-40 rounded-full bg-amber-500/20 blur-3xl" />

            {/* Center CTA */}
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="group relative z-10 flex h-36 w-36 flex-col items-center justify-center gap-1 rounded-full border border-amber-500/50 bg-gradient-to-br from-amber-600/40 via-amber-700/30 to-zinc-900/90 text-center shadow-[0_8px_30px_-6px_rgba(245,158,11,0.6)] transition hover:scale-105 hover:border-amber-400/80 sm:h-40 sm:w-40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-400/50">
                <Search className="h-5 w-5 text-amber-200" />
              </div>
              <h3 className="px-2 text-[13px] font-bold leading-tight text-white">Find an Engineer</h3>
              <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-100">
                Tap to start
              </span>
            </button>
          </div>

          {/* Session Code Entry */}
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-5 backdrop-blur-md">
            <div className="flex items-center gap-2 text-amber-300">
              <KeyRound className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Have a Session Code?</span>
            </div>
            <p className="text-center text-[11px] text-zinc-400">
              Enter your 6-digit code from your engineer or a featured artist invite.
            </p>
            <InputOTP maxLength={6} value={sessionCode} onChange={setSessionCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} className="border-zinc-700 bg-zinc-950 text-white" />
                <InputOTPSlot index={1} className="border-zinc-700 bg-zinc-950 text-white" />
                <InputOTPSlot index={2} className="border-zinc-700 bg-zinc-950 text-white" />
                <InputOTPSlot index={3} className="border-zinc-700 bg-zinc-950 text-white" />
                <InputOTPSlot index={4} className="border-zinc-700 bg-zinc-950 text-white" />
                <InputOTPSlot index={5} className="border-zinc-700 bg-zinc-950 text-white" />
              </InputOTPGroup>
            </InputOTP>
            <button
              onClick={handleCodeJoin}
              disabled={sessionCode.length < 6 || joining}
              className="w-full rounded-xl border border-amber-600/40 bg-gradient-to-b from-amber-700/90 to-amber-950 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-950/40 transition hover:from-amber-600 hover:to-amber-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {joining ? "Joining..." : "Join Session"}
            </button>
          </div>

          {/* Role Buttons */}
          <div className="flex w-full max-w-sm flex-col gap-2">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Or join directly
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleJoin("engineer")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-zinc-200 backdrop-blur hover:bg-zinc-800/80"
              >
                <Headphones className="h-4 w-4" />
                Engineer
              </button>
              <button
                onClick={() => handleJoin("artist")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700/70 bg-zinc-900/70 px-4 py-3 text-sm font-semibold text-zinc-200 backdrop-blur hover:bg-zinc-800/80"
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
