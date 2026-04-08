import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, Radio, MonitorUp, Route, Square, Wallet } from "lucide-react";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { formatCurrency } from "../booking/bookingTypes";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { RemoteVocalMeter } from "../audio/RemoteVocalMeter";
import { VideoPanel } from "../video/VideoPanel";
import { PushControl } from "../components/PushControl";
import { useSession } from "../session/SessionContext";

export default function EngineerView() {
  const navigate = useNavigate();
  const {
    sessionId,
    connection,
    role,
    talkbackOn,
    toggleTalkback,
    screenSharing,
    toggleScreenShare,
    remoteVocalLevel,
    leaveSession,
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

  useEffect(() => {
    if (connection === "disconnected" || role === null) {
      navigate("/wstudio/session", { replace: true });
      return;
    }
    if (role === "artist") navigate("/wstudio/artist", { replace: true });
  }, [connection, role, navigate]);

  const lock = controlsLocked;

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

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div>
          <h1 className="text-lg font-bold text-white">Engineer</h1>
          <p className="text-[11px] text-zinc-500">
            Session <span className="font-mono text-zinc-400">{sessionId || "—"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionStatus state={connection} />
          <button
            type="button"
            className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-900/30"
            title="End session for everyone (stub)"
          >
            <Square className="mr-1 inline h-3 w-3" aria-hidden />
            End session
          </button>
          <Link
            to="/wstudio/session"
            onClick={leaveSession}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Leave
          </Link>
        </div>
      </header>

      {!booking ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-center text-sm text-zinc-400">
          No booking on this session ID yet. Have the artist confirm a block on the join screen first.
        </div>
      ) : (
        <>
          <SessionTimerBar
            totalBookedMinutes={totalBookedMinutes}
            remainingSeconds={remainingSeconds}
            warningLevel={warningLevel}
            phase={phase}
            timerRunning={timerRunning}
          />

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
                    <span className="text-zinc-200">{formatCurrency(booking.initialSessionValue)}</span>
                  </div>
                  <div>
                    Extensions{" "}
                    <span className="text-amber-200/90">
                      {formatCurrency(booking.extensionChargesTotal)}
                    </span>
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
                  onClick={startSessionTimer}
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
                Start rolls the paid clock for both rooms. Approve extensions to extend time and billing.
              </p>
            </div>
          </div>
        </>
      )}

      <div className="relative grid min-h-0 flex-1 gap-3 lg:grid-cols-5">
        {lock ? <SessionControlsLockOverlay /> : null}
        <div className="flex min-h-[220px] flex-col lg:col-span-3">
          <VideoPanel title="Artist" subtitle="Remote artist camera / room view" className="min-h-[240px] flex-1" />
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

          <RemoteVocalMeter level={remoteVocalLevel} />

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
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-xs text-zinc-500">
            Session controls and transport for the remote room live here—not a full DAW UI.
          </div>
        </aside>
      </div>
    </div>
  );
}
