import { useCallback, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Play, Sparkles, Square, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { ExtensionApprovalDialog } from "../booking/ExtensionApprovalDialog";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { formatClock, formatCurrency } from "../booking/bookingTypes";
import {
  ReceiveEffectsPanel,
  ReceiveMonitoringPanel,
  ReceivePrimaryRemoteWithPip,
  ReceiveRightColumnWrap,
  ReceiveRoutingPanel,
  ReceiveSessionStrip,
  ReceiveSyncPanel,
  ReceiveTalkRow,
  ReceiveTopChrome,
  ReceiveVocalInputPanel,
  ReceiveWaveformFooter,
} from "../receive/ReceiveLayoutParts";
import { VideoPanel } from "../video/VideoPanel";
import { useStudioMedia } from "../media/StudioMediaContext";
import { DEMO_SESSION_TITLE, DEMO_TIMER_MINUTES } from "./demoConfig";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { PushControl } from "../components/PushControl";
import { ExpandableShell, FloatingSessionDock } from "./ExpandableSessionUI";
import { SessionCommIndicators } from "./SessionCommIndicators";
import { useSession } from "./SessionContext";
import { useExpandablePanels } from "./useExpandablePanels";

const JOIN_PATH = "/wstudio/session/join";
const DEMO_HOURLY = 85;

export default function EngineerSessionScreen() {
  const {
    sessionId,
    sessionDisplayName,
    connection,
    role,
    demoMode,
    demoClock,
    demoWarningLevel,
    talkbackHeld,
    beginTalkback,
    endTalkback,
    screenSharing,
    toggleScreenShare,
    muted,
    toggleMute,
    leaveSession,
    startDemoSessionClock,
    latencyMs,
    live,
    setSessionRecording,
    setSessionPlaying,
    setSessionRecordArmed,
    collaborationShareActive,
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
  const { expandId, toggleExpand, exitExpand } = useExpandablePanels();
  const {
    localStream,
    remoteStream,
    remoteStreamForPlayback,
    localScreenPreview,
    mediaError,
    remoteMicLevel,
    localTalkbackTxLevel,
  } = useStudioMedia();
  const [extensionPlaceholderOpen, setExtensionPlaceholderOpen] = useState(false);
  const [vocalChannel, setVocalChannel] = useState<1 | 2 | 3>(1);

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

  const timerCompact = useMemo(() => {
    if (showPaidTimer) {
      return {
        remainingSeconds,
        totalBookedMinutes,
        warningLevel,
      };
    }
    return {
      remainingSeconds: demoClock.remainingSeconds,
      totalBookedMinutes: demoClock.totalMinutes,
      warningLevel: demoWarningLevel,
    };
  }, [
    showPaidTimer,
    remainingSeconds,
    totalBookedMinutes,
    warningLevel,
    demoClock.remainingSeconds,
    demoClock.totalMinutes,
    demoWarningLevel,
  ]);

  const monitorVocalSignal = Math.min(100, Math.max(0, remoteMicLevel * 100));
  const monitorTalkSignal = Math.min(
    100,
    Math.max(0, Math.max(localTalkbackTxLevel, remoteMicLevel) * 100),
  );

  const handleTransportRecord = useCallback(() => {
    if (live.recording) {
      setSessionRecording(false);
      return;
    }
    if (!live.recordArmed) return;
    setSessionRecording(true);
    if (!live.playing) setSessionPlaying(true);
  }, [live.recording, live.recordArmed, live.playing, setSessionRecording, setSessionPlaying]);

  const handleTransportStop = useCallback(() => {
    if (live.recording) setSessionRecording(false);
    setSessionPlaying(false);
  }, [live.recording, setSessionRecording, setSessionPlaying]);

  if (!role) return <Navigate to={JOIN_PATH} replace />;
  if (role === "artist") return <Navigate to="/wstudio/session/artist" replace />;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#121212] text-zinc-100">
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

      <ExpandableShell
        id="session"
        title="Session layout"
        expandId={expandId}
        onToggleExpand={toggleExpand}
        className="flex min-h-0 flex-1 flex-col gap-2 p-2"
      >
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
          connection={connection}
          timerLabel={timerLine}
          onShareClick={() => {
            toggleScreenShare();
            toast.message(screenSharing ? "Share off (demo)" : "Share on (demo)");
          }}
          onVolumeClick={() => toast.message("Monitor mix (demo)")}
          onToolsClick={() => toast.message("Tools / routing (demo)")}
          onSettingsClick={() => toast.message("Session settings (demo)")}
        />

        <div className="flex flex-wrap items-center gap-2 px-1">
          <SessionCommIndicators
            role="engineer"
            live={live}
            latencyMs={latencyMs}
            connectionConnected={connection === "connected"}
          />
          {mediaError ? (
            <span className="rounded border border-rose-800/60 bg-rose-950/50 px-2 py-0.5 text-[9px] text-rose-200">
              Media: {mediaError}
            </span>
          ) : null}
        </div>

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
            {/* Left: remote + talk — artist large, self PiP */}
            <div className="flex flex-col gap-2 lg:col-span-3">
              <ExpandableShell
                id="remote"
                title="Remote video"
                expandId={expandId}
                onToggleExpand={toggleExpand}
                className="min-h-0 flex-1 flex-col gap-2"
              >
                <ReceivePrimaryRemoteWithPip
                  remoteTitle="Jay — Florida"
                  remoteSubtitle="Artist (remote)"
                  pipTitle="Bob — New York"
                  pipSubtitle="You (engineer)"
                  remoteStream={remoteStreamForPlayback}
                  remoteVolume={live.headphoneLevelEngineer}
                  pipStream={localStream}
                />
                <ReceiveTalkRow
                  muted={muted}
                  talkbackActive={talkbackHeld}
                  onMute={toggleMute}
                  onTalkDown={beginTalkback}
                  onTalkUp={endTalkback}
                  onSettings={() => toast.message("Channel / device settings (demo)")}
                  disabled={lock}
                />
              </ExpandableShell>
            </div>

            {/* Center: sync + vocal + share (share grows when active) */}
            <div className="flex min-h-0 flex-col gap-2 lg:col-span-5">
              <ExpandableShell
                id="share"
                title="Screen share"
                expandId={expandId}
                onToggleExpand={toggleExpand}
                className={cn(
                  "flex flex-col gap-2",
                  collaborationShareActive && "min-h-[260px] flex-1 lg:min-h-[52vh]",
                )}
              >
                <div className="rounded-lg border border-zinc-800 bg-[#1a1a1a] p-2">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-zinc-500">Screen share</div>
                  <PushControl
                    active={screenSharing}
                    onClick={toggleScreenShare}
                    disabled={lock}
                    title="Share screen to artist"
                  >
                    {screenSharing ? "Sharing…" : "Start screen share"}
                  </PushControl>
                  <div
                    className={cn(
                      "mt-2 min-h-[120px] flex-1 overflow-hidden rounded-md border border-dashed border-zinc-700/80 bg-zinc-950/80",
                      collaborationShareActive && "min-h-[240px] lg:min-h-[46vh]",
                    )}
                  >
                    {collaborationShareActive && localScreenPreview ? (
                      <VideoPanel
                        title="Shared screen"
                        subtitle="Preview — sent to artist"
                        stream={localScreenPreview}
                        videoMuted
                        className="min-h-[120px] flex-1 rounded-none border-0 lg:min-h-[44vh]"
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex h-full min-h-[120px] items-center justify-center p-2 text-center text-[10px] text-zinc-500",
                          collaborationShareActive && "text-zinc-400",
                        )}
                      >
                        {collaborationShareActive
                          ? "Starting screen capture…"
                          : "When sharing, this becomes the main collaboration view for the artist."}
                      </div>
                    )}
                  </div>
                </div>
              </ExpandableShell>

              <ExpandableShell
                id="viewer"
                title="Session viewer / sync"
                expandId={expandId}
                onToggleExpand={toggleExpand}
                className="flex flex-col gap-2"
              >
                <ReceiveSyncPanel
                  disabled={lock}
                  recording={live.recording}
                  recordArmed={live.recordArmed}
                  onPlay={() => toast.message("Play (demo)")}
                  onStop={handleTransportStop}
                  onRecord={handleTransportRecord}
                />
                <ReceiveVocalInputPanel
                  level={remoteMicLevel}
                  channel={vocalChannel}
                  onChannel={setVocalChannel}
                  armed={live.recordArmed}
                  onArm={() => setSessionRecordArmed(!live.recordArmed)}
                  disabled={lock}
                />
              </ExpandableShell>

              <ReceiveRoutingPanel />
            </div>

            {/* Right: monitoring + effects */}
            <ReceiveRightColumnWrap>
              <ReceiveMonitoringPanel
                vocalKnobDisplay={Math.min(100, Math.max(0, live.vocalLevel * 100))}
                talkbackKnobDisplay={Math.min(100, Math.max(0, live.talkbackLevel * 100))}
              />
              <ReceiveEffectsPanel />
            </ReceiveRightColumnWrap>
          </div>
        </div>

        <ExpandableShell
          id="waveform"
          title="Waveform / recording"
          expandId={expandId}
          onToggleExpand={toggleExpand}
          className=""
        >
          <ReceiveWaveformFooter
            vocalLevel={remoteMicLevel}
            recording={live.recording}
            disabled={lock}
            recordArmed={live.recordArmed}
            takeCaptured={live.takeCapturedThisSession}
            playing={live.playing}
          />
        </ExpandableShell>

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
      </ExpandableShell>

      <FloatingSessionDock
        visible={expandId !== null}
        onExitExpand={exitExpand}
        timerCompact={timerCompact}
        talkbackLabel="Talk"
        talkbackActive={talkbackHeld}
        onTalkDown={beginTalkback}
        onTalkUp={endTalkback}
        talkDisabled={lock}
      />
    </div>
  );
}
