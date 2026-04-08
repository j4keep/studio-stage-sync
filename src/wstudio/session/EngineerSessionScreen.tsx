import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Radio,
  MonitorUp,
  Route,
  Square,
  Wallet,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { formatCurrency } from "../booking/bookingTypes";
import { DEMO_SESSION_TITLE, DEMO_TIMER_MINUTES } from "./demoConfig";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { RemoteVocalMeter } from "../audio/RemoteVocalMeter";
import { VideoPanel } from "../video/VideoPanel";
import { PushControl } from "../components/PushControl";
import { useSession } from "./SessionContext";

const JOIN_PATH = "/wstudio/session/join";
const DEMO_HOURLY = 85;

export default function EngineerSessionScreen() {
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
    screenSharing,
    toggleScreenShare,
    remoteVocalLevel,
    leaveSession,
    startDemoSessionClock,
  } = useSession();
  const {
    booking,
    totalBookedMinutes,
    remainingSeconds,
    warningLevel,
    phase,
    timerRunning,
    startSessionTimer,
    sessionRates,
    sessionValueTotal,
    approveExtension,
    declineExtension,
    pendingExtension,
    extensionModalOpen,
    setExtensionModalOpen,
    controlsLocked,
    engineerContinueSession,
  } = useBookingTimer();
  const [selfVideoOn, setSelfVideoOn] = useState(true);
  const [extensionPlaceholderOpen, setExtensionPlaceholderOpen] = useState(false);

  useEffect(() => {
    if (!role) {
      navigate(JOIN_PATH, { replace: true });
      return;
    }
    if (role === "artist") navigate("/wstudio/session/artist", { replace: true });
  }, [role, navigate]);

  const lock = controlsLocked;
  const showPaidTimer = !!booking && booking.bookedMinutes > 0;
  const demoValue = (DEMO_TIMER_MINUTES / 60) * DEMO_HOURLY;

  const onStartClock = () => {
    if (showPaidTimer) startSessionTimer();
    else startDemoSessionClock();
  };

  if (!role) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <ExtensionApprovalDialog
        open={extensionModalOpen}
        onOpenChange={setExtensionModalOpen}
        pending={pendingExtension}
        rates={sessionRates}
        onApprove={approveExtension}
        onDecline={declineExtension}
      />

      <Dialog open={extensionPlaceholderOpen} onOpenChange={setExtensionPlaceholderOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-100">Extension requests</DialogTitle>
            <DialogDescription className="text-zinc-400">
              When an artist requests +15 / +30 / +60 minutes, the live approval flow opens here with billing
              at your overtime rate. Wire your signaling layer to surface real requests.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-zinc-500">
            Paid bookings use the approval modal automatically. This dialog is a layout placeholder for demo
            and documentation.
          </p>
        </DialogContent>
      </Dialog>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-white">W.STUDIO RECEIVE</h1>
            {demoMode ? (
              <span className="rounded border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200">
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
          <button
            type="button"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-900/30"
            title="End session (stub)"
          >
            <Square className="mr-1 inline h-3 w-3" aria-hidden />
            End session
          </button>
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

      {showPaidTimer ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-900/30 bg-gradient-to-br from-zinc-900 to-black/60 p-4 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Session value
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Current total</div>
                <div className="font-mono text-3xl font-semibold tabular-nums text-emerald-100">
                  {formatCurrency(sessionValueTotal)}
                </div>
              </div>
              <div className="text-right text-xs text-zinc-400">
                <div>
                  Booked block{" "}
                  <span className="text-zinc-200">{formatCurrency(booking!.initialSessionValue)}</span>
                </div>
                <div>
                  Extensions{" "}
                  <span className="text-amber-200/90">{formatCurrency(booking!.extensionChargesTotal)}</span>
                </div>
              </div>
            </div>
            {pendingExtension ? (
              <button
                type="button"
                onClick={() => setExtensionModalOpen(true)}
                className="mt-3 w-full rounded-lg border border-amber-500/40 bg-amber-950/40 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40"
              >
                Review extension (+{pendingExtension.minutes} min)
              </button>
            ) : null}
          </div>

          <div className="flex flex-col justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            {phase !== "ended" ? (
              <button
                type="button"
                disabled={!!timerRunning || phase === "ended"}
                onClick={onStartClock}
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600/50 bg-gradient-to-b from-emerald-700 to-emerald-950 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-4 w-4" aria-hidden />
                {timerRunning ? "Timer live" : "Start session timer"}
              </button>
            ) : (
              <button
                type="button"
                onClick={engineerContinueSession}
                className="rounded-xl border border-amber-600/40 bg-amber-950/50 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-900/40"
              >
                Continue (+5 min engineer grace)
              </button>
            )}
            <p className="text-center text-[10px] leading-relaxed text-zinc-500">
              Rolls the paid clock for both rooms when a booking exists.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-emerald-900/30 bg-gradient-to-br from-zinc-900 to-black/60 p-4 lg:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Session value (demo)
            </div>
            <div className="font-mono text-3xl font-semibold tabular-nums text-emerald-100">
              {formatCurrency(demoValue)}
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Example total for a {DEMO_TIMER_MIN}-minute block at {formatCurrency(DEMO_HOURLY)}/hr. Confirm a real
              booking on the join screen to drive live billing.
            </p>
            <button
              type="button"
              onClick={() => setExtensionPlaceholderOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Extension modal (placeholder)
            </button>
          </div>

          <div className="flex flex-col justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <button
              type="button"
              onClick={onStartClock}
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-600/50 bg-gradient-to-b from-emerald-700 to-emerald-950 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40"
            >
              <Play className="h-4 w-4" aria-hidden />
              Restart demo timer
            </button>
            <p className="text-center text-[10px] leading-relaxed text-zinc-500">
              Timer also starts automatically when you join in demo mode; use this to reset the preview window.
            </p>
          </div>
        </div>
      )}

      <div className="relative grid min-h-0 flex-1 gap-3 lg:grid-cols-5">
        {lock ? <SessionControlsLockOverlay /> : null}
        <div className="flex min-h-[220px] flex-col gap-2 lg:col-span-3">
          <VideoPanel
            title="Artist — Jay · Florida (mock)"
            subtitle="Remote artist camera / booth"
            className="min-h-[200px] flex-1"
          />
          {selfVideoOn ? (
            <VideoPanel
              title="You — Bob · New York (self view)"
              subtitle="Engineer cam / room preview"
              mirrored
              className="h-28 lg:h-36"
            />
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={selfVideoOn}
              onChange={(e) => setSelfVideoOn(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Show engineer self-view
          </label>
        </div>

        <aside className="relative flex flex-col gap-3 lg:col-span-2">
          <PushControl
            active={talkbackOn}
            onClick={toggleTalkback}
            disabled={lock}
            title="Talkback to artist"
          >
            <Radio className="mr-2 inline h-4 w-4" aria-hidden />
            Talkback
          </PushControl>

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Remote vocal</div>
            <RemoteVocalMeter level={remoteVocalLevel} />
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <MonitorUp className="h-3.5 w-3.5" aria-hidden />
              Screen share
            </div>
            <PushControl
              active={screenSharing}
              onClick={toggleScreenShare}
              disabled={lock}
              title="Share your screen to the artist"
            >
              {screenSharing ? "Sharing…" : "Start screen share"}
            </PushControl>
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <Route className="h-3.5 w-3.5" aria-hidden />
              Routing status
            </div>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>• Artist monitor send: ready (stub)</li>
              <li>• Record arm / takes: not armed</li>
              <li>• Buffer health: OK</li>
              <li>• Sync: 120 BPM (mock)</li>
            </ul>
          </div>
        </aside>
      </div>

      <section
        className={`rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 ${lock ? "pointer-events-none opacity-40" : ""}`}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Share view — DAW, notes, session files
        </div>
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950/80 text-center text-sm text-zinc-500">
          Drop session assets or embed a trusted share URL for the artist (stub).
        </div>
      </section>
    </div>
  );
}
