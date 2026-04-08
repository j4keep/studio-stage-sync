import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Radio, Timer, Video as VideoIcon, Volume2 } from "lucide-react";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { LatencyIndicator } from "../audio/LatencyIndicator";
import { MicInputSelector, OutputSelector } from "../audio/DeviceSelectors";
import { VideoPanel } from "../video/VideoPanel";
import { PushControl } from "../components/PushControl";
import { useSession } from "../session/SessionContext";

export default function ArtistView() {
  const navigate = useNavigate();
  const {
    sessionId,
    connection,
    role,
    talkbackOn,
    toggleTalkback,
    muted,
    toggleMute,
    latencyMs,
    leaveSession,
  } = useSession();
  const {
    booking,
    totalBookedMinutes,
    remainingSeconds,
    warningLevel,
    phase,
    timerRunning,
    controlsLocked,
    requestExtension,
    sessionRates,
    pendingExtension,
  } = useBookingTimer();
  const [mic, setMic] = useState("default");
  const [out, setOut] = useState("default");
  const [selfVideoOn, setSelfVideoOn] = useState(true);

  useEffect(() => {
    if (connection === "disconnected" || role === null) {
      navigate("/wstudio/session", { replace: true });
      return;
    }
    if (role === "engineer") navigate("/wstudio/engineer", { replace: true });
  }, [connection, role, navigate]);

  const lock = controlsLocked;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-lg font-bold text-white">Artist</h1>
          <p className="text-[11px] text-zinc-500">
            Session <span className="font-mono text-zinc-400">{sessionId || "—"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionStatus state={connection} />
          {pendingExtension ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-950/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
              Extension pending
            </span>
          ) : null}
          <Link
            to="/wstudio/session"
            onClick={leaveSession}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Leave
          </Link>
        </div>
      </header>

      {booking ? (
        <SessionTimerBar
          totalBookedMinutes={totalBookedMinutes}
          remainingSeconds={remainingSeconds}
          warningLevel={warningLevel}
          phase={phase}
          timerRunning={timerRunning}
        />
      ) : null}

      {phase === "live" && sessionRates.extensionsEnabled && !lock ? (
        <div className="rounded-xl border border-amber-900/30 bg-zinc-900/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">
            <Timer className="h-3.5 w-3.5" aria-hidden />
            Request more time
          </div>
          <div className="flex flex-wrap gap-2">
            {([15, 30, 60] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!!pendingExtension}
                onClick={() => requestExtension(m)}
                className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40 disabled:opacity-40"
              >
                +{m} min
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="relative grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        {lock ? <SessionControlsLockOverlay /> : null}
        <div className="flex min-h-[200px] flex-col gap-2 lg:col-span-2">
          <VideoPanel title="Engineer" subtitle="Remote engineer video (WebRTC)" className="min-h-[220px] flex-1" />
          {selfVideoOn ? (
            <VideoPanel title="You (self)" subtitle="Optional local preview" mirrored className="h-32 lg:h-40" />
          ) : null}
        </div>

        <aside className="relative flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex flex-wrap gap-2">
            <PushControl
              active={talkbackOn}
              onClick={toggleTalkback}
              disabled={lock}
              title="Talkback to engineer"
            >
              <Radio className="mr-2 inline h-4 w-4" aria-hidden />
              Talkback
            </PushControl>
            <PushControl
              active={muted}
              onClick={toggleMute}
              variant="danger"
              disabled={lock}
              title="Mute your mic for the session mix"
            >
              <Mic className="mr-2 inline h-4 w-4" aria-hidden />
              Mute
            </PushControl>
          </div>
          <LatencyIndicator ms={latencyMs} />
          <MicInputSelector value={mic} onChange={setMic} disabled={connection !== "connected" || lock} />
          <OutputSelector value={out} onChange={setOut} disabled={connection !== "connected" || lock} />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={selfVideoOn}
              onChange={(e) => setSelfVideoOn(e.target.checked)}
              className="rounded border-zinc-600"
            />
            <VideoIcon className="h-3.5 w-3.5" aria-hidden />
            Show self video
          </label>
        </aside>
      </div>

      <section
        className={`rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 ${lock ? "pointer-events-none opacity-40" : ""}`}
      >
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          <Volume2 className="h-3.5 w-3.5" aria-hidden />
          Shared edit page viewer
        </div>
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950/80 text-center text-sm text-zinc-500">
          Embed your lyric sheet, DAW screen share, or notes URL here (iframe / trusted viewer).
        </div>
      </section>
    </div>
  );
}
