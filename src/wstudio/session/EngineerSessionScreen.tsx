import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Sparkles, Square, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { formatClock, formatCurrency } from "../booking/bookingTypes";
import {
  ReceiveEffectsPanel,
  ReceiveMonitoringPanel,
  ReceiveRightColumnWrap,
  ReceiveRoutingPanel,
  ReceiveSessionStrip,
  ReceiveSyncPanel,
  ReceiveTalkRow,
  ReceiveTopChrome,
  ReceiveVideoStack,
  ReceiveVocalInputPanel,
  ReceiveWaveformFooter,
} from "../receive/ReceiveLayoutParts";
import { DEMO_SESSION_TITLE, DEMO_TIMER_MINUTES } from "./demoConfig";
import { ConnectionStatus } from "../connection/ConnectionStatus";
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
    muted,
    toggleMute,
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
  const [extensionPlaceholderOpen, setExtensionPlaceholderOpen] = useState(false);
  const [vocalChannel, setVocalChannel] = useState<1 | 2 | 3>(1);
  const [armRecord, setArmRecord] = useState(false);
  const [transportRecording, setTransportRecording] = useState(false);

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

  const sessionTitle = sessionDisplayName || `Session: ${DEMO_SESSION_TITLE}`;

  const timerLine = useMemo(() => {
    if (showPaidTimer) {
      return `${formatClock(remainingSeconds)} · ${phase}`;
    }
    return `${formatClock(demoClock.remainingSeconds)} · ${demoClock.phase}`;
  }, [showPaidTimer, remainingSeconds, phase, demoClock.remainingSeconds, demoClock.phase]);

  const monitorVocal = Math.min(100, Math.max(0, remoteVocalLevel * 100));
  const monitorTalk = talkbackOn ? 68 : 35;

  if (!role) return null;

  return (
    <div className="flex min-h-0 min-h-screen flex-1 flex-col bg-[#121212] text-zinc-100">
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
              When an artist requests more time, approvals and billing appear here. Paid bookings use the live
              approval modal.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <ReceiveTopChrome demoMode={demoMode} joinPath={JOIN_PATH} onLeave={leaveSession} />

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Link
            to={JOIN_PATH}
            onClick={leaveSession}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Back to Session Join
          </Link>
          <span className="text-zinc-700">|</span>
          <ConnectionStatus state={connection} />
          <span className="font-mono text-[10px] text-zinc-600">{sessionId || "—"}</span>
        </div>

        <ReceiveSessionStrip
          sessionTitle={sessionTitle}
          connectionLabel={connection === "connected" ? "connected" : connection}
          timerLabel={timerLine}
          onShareClick={() => {
            toggleScreenShare();
            toast.message(screenSharing ? "Share off (demo)" : "Share on (demo)");
          }}
          onVolumeClick={() => toast.message("Monitor mix (demo)")}
          onToolsClick={() => toast.message("Tools / routing (demo)")}
          onSettingsClick={() => toast.message("Session settings (demo)")}
        />

        {showPaidTimer ? (
          <SessionTimerBar
            totalBookedMinutes={totalBookedMinutes}
            remainingSeconds={remainingSeconds}
            warningLevel={warningLevel}
            phase={phase}
            timerRunning={timerRunning}
            compact
          />
        ) : (
          <SessionTimerBar
            totalBookedMinutes={demoClock.totalMinutes}
            remainingSeconds={demoClock.remainingSeconds}
            warningLevel={demoWarningLevel}
            phase={demoClock.phase}
            timerRunning={demoClock.running}
            compact
          />
        )}

        {/* Billing strip — matches your flow; sits under reference-style session row */}
        {showPaidTimer ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-900/35 bg-[#1a1a1a] px-3 py-2 text-[10px] text-zinc-400">
            <Wallet className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-mono text-emerald-200">{formatCurrency(sessionValueTotal)}</span>
            {pendingExtension ? (
              <button
                type="button"
                onClick={() => setExtensionModalOpen(true)}
                className="ml-auto rounded border border-amber-600/50 px-2 py-1 text-[9px] font-semibold uppercase text-amber-200"
              >
                Extension +{pendingExtension.minutes}m
              </button>
            ) : null}
            {phase !== "ended" ? (
              <button
                type="button"
                disabled={!!timerRunning}
                onClick={onStartClock}
                className="inline-flex items-center gap-1 rounded border border-emerald-700/50 px-2 py-1 text-[9px] font-semibold text-emerald-200 disabled:opacity-40"
              >
                <Play className="h-3 w-3" />
                Start paid timer
              </button>
            ) : (
              <button
                type="button"
                onClick={engineerContinueSession}
                className="rounded border border-amber-600/50 px-2 py-1 text-[9px] text-amber-200"
              >
                Grace continue
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-[#1a1a1a] px-3 py-2 text-[10px] text-zinc-500">
            <span>
              Demo value <span className="font-mono text-zinc-300">{formatCurrency(demoValue)}</span>
            </span>
            <button type="button" onClick={onStartClock} className="text-emerald-400/90 underline-offset-2 hover:underline">
              Reset demo timer
            </button>
            <button
              type="button"
              onClick={() => setExtensionPlaceholderOpen(true)}
              className="inline-flex items-center gap-1 text-amber-200/80"
            >
              <Sparkles className="h-3 w-3" />
              Extension UI (placeholder)
            </button>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {lock ? <SessionControlsLockOverlay /> : null}

          <div className="grid h-full min-h-[420px] grid-cols-1 gap-2 lg:grid-cols-12 lg:gap-3">
            {/* Left: video stack + talk row — reference layout */}
            <div className="flex flex-col gap-2 lg:col-span-3">
              <ReceiveVideoStack artistTitle="Jay — Florida" engineerTitle="Bob — New York" />
              <ReceiveTalkRow
                muted={muted}
                talkbackOn={talkbackOn}
                onMute={toggleMute}
                onTalk={toggleTalkback}
                onSettings={() => toast.message("Channel / device settings (demo)")}
                disabled={lock}
              />
            </div>

            {/* Center: sync + vocal */}
            <div className="flex flex-col gap-2 lg:col-span-5">
              <ReceiveSyncPanel
                disabled={lock}
                onPlay={() => toast.message("Play (demo)")}
                onStop={() => {
                  setTransportRecording(false);
                  toast.message("Stop (demo)");
                }}
                onRecord={() => setTransportRecording((v) => !v)}
              />
              <ReceiveVocalInputPanel
                level={remoteVocalLevel}
                channel={vocalChannel}
                onChannel={setVocalChannel}
                armed={armRecord}
                onArm={() => setArmRecord((a) => !a)}
                disabled={lock}
              />
              <div className="rounded-lg border border-zinc-800 bg-[#1a1a1a] p-2">
                <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">Screen share</div>
                <PushControl
                  active={screenSharing}
                  onClick={toggleScreenShare}
                  disabled={lock}
                  title="Share screen to artist"
                >
                  {screenSharing ? "Sharing…" : "Start screen share"}
                </PushControl>
              </div>
              <ReceiveRoutingPanel />
            </div>

            {/* Right: monitoring + effects */}
            <ReceiveRightColumnWrap>
              <ReceiveMonitoringPanel vocalLevel={monitorVocal} talkbackLevel={monitorTalk} />
              <ReceiveEffectsPanel />
            </ReceiveRightColumnWrap>
          </div>
        </div>

        <ReceiveWaveformFooter vocalLevel={remoteVocalLevel} recording={transportRecording} disabled={lock} />

        <div className="flex justify-end px-1">
          <button
            type="button"
            className="rounded-md border border-rose-900/50 bg-rose-950/30 px-2 py-1 text-[9px] font-medium text-rose-200"
            title="Stub"
          >
            <Square className="mr-1 inline h-3 w-3" aria-hidden />
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
