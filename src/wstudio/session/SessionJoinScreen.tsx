import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, KeyRound, Headphones, Mic2 } from "lucide-react";
import { useSession } from "./SessionContext";
import { StudioSearchSheet } from "./StudioSearchSheet";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SessionJoinScreen() {
  const navigate = useNavigate();
  const { joinAsArtist, joinAsEngineer } = useSession();
  const [showSearch, setShowSearch] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [joining, setJoining] = useState(false);

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
      .select("id, session_code, session_status, studio_id, hours")
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

    toast.success("Joining session...");
    joinAsArtist();
    navigate("/wstudio/session/live");
  };

  const handleBooked = (code: string) => {
    setSessionCode(code);
    toast.success(`Your session code is: ${code}. Enter it when your engineer starts the session.`);
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 px-4 text-zinc-100">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl font-black tracking-tight text-white">
          W.<span className="text-white">STUDIO</span>
        </span>
        <span className="text-xs font-light tracking-widest text-zinc-500">REMOTE SESSIONS</span>
      </div>

      {/* Session Code Entry */}
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center gap-2 text-amber-300">
          <KeyRound className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Enter Session Code</span>
        </div>
        <p className="text-center text-[11px] text-zinc-500">
          Got a code from your engineer? Enter it below to join.
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

      {/* Find a Studio */}
      <button
        onClick={() => setShowSearch(true)}
        className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-amber-800/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Search className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Find a Studio</h3>
          <p className="text-[11px] text-zinc-500">Browse remote studios & book a session</p>
        </div>
      </button>

      {/* Role Buttons */}
      <div className="flex w-full max-w-sm flex-col gap-2">
        <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Or join directly
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleJoin("engineer")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            <Headphones className="h-4 w-4" />
            Engineer
          </button>
          <button
            onClick={() => handleJoin("artist")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
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
  );
}
