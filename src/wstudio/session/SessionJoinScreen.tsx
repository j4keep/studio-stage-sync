import { useNavigate } from "react-router-dom";
import { Headphones, Mic2, Radio } from "lucide-react";
import { BookSessionPanel } from "../booking/BookSessionPanel";
import { EngineerBookingSetupPanel } from "../booking/EngineerBookingSetupPanel";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { WSTUDIO_DEMO_MODE } from "./demoConfig";
import { useSession } from "./SessionContext";

const JOIN_ARTIST = "/wstudio/session/artist";
const JOIN_ENGINEER = "/wstudio/session/engineer";

export default function SessionJoinScreen() {
  const navigate = useNavigate();
  const {
    sessionId,
    setSessionId,
    connection,
    joinAsArtist,
    joinAsEngineer,
    demoMode,
  } = useSession();

  const goArtist = () => {
    joinAsArtist();
    navigate(JOIN_ARTIST, { replace: true });
  };

  const goEngineer = () => {
    joinAsEngineer();
    navigate(JOIN_ENGINEER, { replace: true });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-8">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 ring-1 ring-violet-500/40">
            <Radio className="h-7 w-7 text-violet-300" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">W.Studio</h1>
          <p className="mt-1 text-sm text-zinc-400">Remote recording session</p>
          {demoMode ? (
            <p className="mx-auto mt-3 max-w-sm rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-[11px] leading-snug text-amber-100/90">
              <strong className="font-semibold">Demo preview</strong> — Join opens full Artist / Engineer UIs with mock
              connection, timer, and metering. Session ID is optional; an ID is generated if left blank.
            </p>
          ) : null}
        </header>

        <div className="flex flex-wrap items-center justify-center gap-2">
          Connection
          <ConnectionStatus state={connection} />
        </div>

        <div className="space-y-2">
          <label htmlFor="session-id" className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Session ID <span className="font-normal normal-case text-zinc-600">(optional in demo)</span>
          </label>
          <input
            id="session-id"
            type="text"
            autoComplete="off"
            placeholder="e.g. session-alpha-42 — or leave empty"
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
            onClick={goArtist}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800 py-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            <Mic2 className="h-5 w-5 text-violet-400" aria-hidden />
            Join as Artist
          </button>
          <button
            type="button"
            onClick={goEngineer}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800 py-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            <Headphones className="h-5 w-5 text-emerald-400" aria-hidden />
            Join as Engineer
          </button>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
          Paid timer and quotes are optional—use the panels above when you&apos;re billing studio time.
        </p>
        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
          {WSTUDIO_DEMO_MODE
            ? "WebRTC and signaling are not required for this clickable prototype."
            : "Connect your WebRTC / room service when ready."}
        </p>
      </div>
    </div>
  );
}
