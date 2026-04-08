import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Headphones, Mic2, Radio } from "lucide-react";
import { BookSessionPanel } from "../booking/BookSessionPanel";
import { EngineerBookingSetupPanel } from "../booking/EngineerBookingSetupPanel";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { useSession } from "./SessionContext";

export default function SessionJoinScreen() {
  const navigate = useNavigate();
  const {
    sessionId,
    setSessionId,
    connection,
    role,
    joinAsArtist,
    joinAsEngineer,
  } = useSession();
  const { booking } = useBookingTimer();

  useEffect(() => {
    if (connection !== "connected" || !role) return;
    if (role === "artist") navigate("/wstudio/artist", { replace: true });
    if (role === "engineer") navigate("/wstudio/engineer", { replace: true });
  }, [connection, role, navigate]);

  const hasConfirmedBooking = !!(booking && booking.bookedMinutes > 0);
  const canJoinEngineer = sessionId.trim().length > 0 && connection !== "connecting";
  const canJoinArtist =
    sessionId.trim().length > 0 && connection !== "connecting" && hasConfirmedBooking;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-8">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 ring-1 ring-violet-500/40">
            <Radio className="h-7 w-7 text-violet-300" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">W.Studio</h1>
          <p className="mt-1 text-sm text-zinc-400">Remote recording session</p>
        </header>

        <div className="flex flex-wrap items-center justify-center gap-2">
          Connection
          <ConnectionStatus state={connection} />
        </div>

        <div className="space-y-2">
          <label htmlFor="session-id" className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Session ID
          </label>
          <input
            id="session-id"
            type="text"
            autoComplete="off"
            placeholder="e.g. session-alpha-42"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none ring-violet-600/0 transition-shadow placeholder:text-zinc-600 focus:ring-2 focus:ring-violet-600"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <BookSessionPanel />
          <EngineerBookingSetupPanel />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!canJoinArtist}
            onClick={joinAsArtist}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800 py-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            <Mic2 className="h-5 w-5 text-violet-400" aria-hidden />
            Join as Artist
          </button>
          <button
            type="button"
            disabled={!canJoinEngineer}
            onClick={joinAsEngineer}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800 py-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            <Headphones className="h-5 w-5 text-emerald-400" aria-hidden />
            Join as Engineer
          </button>
        </div>
        {!hasConfirmedBooking && sessionId.trim() ? (
          <p className="text-center text-[11px] text-amber-200/70">
            Artists: confirm your booking above before joining. Engineers: publish rates so totals match your
            quote.
          </p>
        ) : null}

        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
          Signaling, media, and metering are UI shells here—connect your WebRTC / room service when ready.
        </p>
      </div>
    </div>
  );
}
