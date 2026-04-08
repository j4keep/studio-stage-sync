import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, Radio, Timer, Video as VideoIcon, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { DEMO_SESSION_TITLE } from "./demoConfig";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { LatencyIndicator } from "../audio/LatencyIndicator";
import { MicInputSelector, OutputSelector } from "../audio/DeviceSelectors";
import { VideoPanel } from "../video/VideoPanel";
import { PushControl } from "../components/PushControl";
import { useSession } from "./SessionContext";

const JOIN_PATH = "/wstudio/session/join";

export default function ArtistSessionScreen() {
  const navigate = useNavigate();
  const {
    sessionId,
    sessionDisplayName,
    connection,
    role,
    demoMode,
    demoClock,
    demoWarningLevel,
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
    if (!role) {
      navigate(JOIN_PATH, { replace: true });
      return;
    }
    if (role === "engineer") navigate("/wstudio/session/engineer", { replace: true });
  }, [role, navigate]);

  const lock = controlsLocked;
  const showPaidTimer = !!booking && booking.bookedMinutes > 0;
  const extensionActive =
    !lock && (showPaidTimer ? phase === "live" && sessionRates.extensionsEnabled : demoMode);

  const onRequestExtension = (m: 15 | 30 | 60) => {
    if (showPaidTimer) {
      requestExtension(m);
      return;
    }
    toast.message("Demo: extension request", { description: `+${m} min would be sent to the engineer.` });
  };

  if (!role) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-white">W.STUDIO</h1>
            {demoMode ? (
              <span className="rounded border border-violet-500/40 bg-violet-950/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                Demo
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-zinc-300">{sessionDisplayName || `Session: ${DEMO_SESSION_TITLE}`}</p>
          <p className="text-[10px] text-zinc-500">
            ID <span className="font-mono text-zinc-400">{sessionId || "—"}</span>
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
            to={JOIN_PATH}
            onClick={leaveSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to Session Join
          </Link>
        </div>
      </header>

      {showPaidTimer ? (
        <SessionTimerBar
          totalBookedMinutes={totalBookedMinutes}
          remainingSeconds={remainingSeconds}
          warningLevel={warningLevel}
          phase={phase}
          timerRunning={timerRunning}
        />
      ) : (
        <SessionTimerBar
          totalBookedMinutes={demoClock.totalMinutes}
          remainingSeconds={demoClock.remainingSeconds}
          warningLevel={demoWarningLevel}
          phase={demoClock.phase}
          timerRunning={demoClock.running}
        />
      )}

      {extensionActive ? (
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
                disabled={!!pendingExtension && showPaidTimer}
                onClick={() => onRequestExtension(m)}
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
          <VideoPanel
            title="Engineer — Bob · New York (mock)"
            subtitle="Remote engineer / room (WebRTC placeholder)"
            className="min-h-[220px] flex-1"
          />
          {selfVideoOn ? (
            <VideoPanel
              title="You — Jay · Florida (self view)"
              subtitle="Local preview"
              mirrored
              className="h-32 lg:h-40"
            />
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
          <MicInputSelector value={mic} onChange={setMic} disabled={lock} />
          <OutputSelector value={out} onChange={setOut} disabled={lock} />
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
          Session viewer — lyrics, notes, DAW share
        </div>
        <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950/80 text-center text-sm text-zinc-500">
          Embed your lyric sheet, DAW screen share, or trusted URL here (iframe).
        </div>
      </section>
    </div>
  );
}
