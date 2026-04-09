import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Mic, MonitorUp, Radio, Timer, Video as VideoIcon, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBookingTimer } from "../booking/BookingTimerContext";
import { SessionControlsLockOverlay } from "../booking/SessionControlsLockOverlay";
import { SessionTimerBar } from "../booking/SessionTimerBar";
import { formatClock } from "../booking/bookingTypes";
import { DEMO_SESSION_TITLE } from "./demoConfig";
import { ConnectionStatus } from "../connection/ConnectionStatus";
import { LatencyIndicator } from "../audio/LatencyIndicator";
import { MicInputSelector, OutputSelector } from "../audio/DeviceSelectors";
import { PushControl } from "../components/PushControl";
import { ReceivePrimaryRemoteWithPip } from "../receive/ReceiveLayoutParts";
import { ExpandableShell, FloatingSessionDock } from "./ExpandableSessionUI";
import { SessionCommIndicators } from "./SessionCommIndicators";
import { useSession } from "./SessionContext";
import { useExpandablePanels } from "./useExpandablePanels";

const JOIN_PATH = "/wstudio/session/join";

export default function ArtistSessionScreen() {
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
    muted,
    toggleMute,
    latencyMs,
    leaveSession,
    live,
    collaborationShareActive,
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
  const { expandId, toggleExpand, exitExpand } = useExpandablePanels();
  const [mic, setMic] = useState("default");
  const [out, setOut] = useState("default");
  const [selfVideoOn, setSelfVideoOn] = useState(true);

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

  const timerCompact = useMemo(() => {
    if (showPaidTimer) {
      return { remainingSeconds, totalBookedMinutes, warningLevel };
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

  const timerLabel = useMemo(() => {
    if (showPaidTimer) return `${formatClock(remainingSeconds)} · ${phase}`;
    return `${formatClock(demoClock.remainingSeconds)} · ${demoClock.phase}`;
  }, [showPaidTimer, remainingSeconds, phase, demoClock.remainingSeconds, demoClock.phase]);

  if (!role) return <Navigate to={JOIN_PATH} replace />;
  if (role === "engineer") return <Navigate to="/wstudio/session/engineer" replace />;

  return (
    <div className="flex min-h-0 min-h-screen flex-1 flex-col gap-3 bg-[#121212] p-3 text-zinc-100">
      <ExpandableShell
        id="session"
        title="Session"
        expandId={expandId}
        onToggleExpand={toggleExpand}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-white">W.STUDIO</h1>
              {demoMode ? (
                <span className="rounded border border-violet-500/40 bg-violet-950/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200">
                  Demo
                </span>
              ) : null}
              {live.recording ? (
                <span className="rounded border border-red-700/60 bg-red-950/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-200 animate-pulse">
                  Recording…
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs text-zinc-300">{sessionDisplayName || `Session: ${DEMO_SESSION_TITLE}`}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[10px] text-zinc-500">
                ID <span className="font-mono text-zinc-400">{sessionId || "—"}</span>
              </p>
              <span className="font-mono text-[10px] text-amber-200/80 tabular-nums">{timerLabel}</span>
            </div>
            <div className="mt-2">
              <SessionCommIndicators
                role="artist"
                live={live}
                latencyMs={latencyMs}
                connectionConnected={connection === "connected"}
              />
            </div>
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

        <div
          className={cn(
            "relative grid min-h-0 flex-1 gap-3",
            collaborationShareActive ? "lg:grid-cols-12" : "lg:grid-cols-3",
          )}
        >
          {lock ? <SessionControlsLockOverlay /> : null}

          <div
            className={cn(
              "flex min-h-[220px] flex-col gap-3",
              collaborationShareActive
                ? "lg:col-span-8 lg:grid min-h-[280px] lg:min-h-[50vh] lg:grid-cols-12 lg:gap-3"
                : "lg:col-span-2",
            )}
          >
            {collaborationShareActive ? (
              <>
                <ExpandableShell
                  id="share"
                  title="Engineer screen share"
                  expandId={expandId}
                  onToggleExpand={toggleExpand}
                  className="flex min-h-[240px] flex-col lg:min-h-[45vh] lg:col-span-7"
                >
                  <div className="flex min-h-[220px] flex-1 flex-col rounded-xl border border-violet-900/35 bg-zinc-950/80 p-3 lg:min-h-[40vh]">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-violet-200/80">
                      <MonitorUp className="h-3.5 w-3.5" aria-hidden />
                      Collaboration — engineer share
                    </div>
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-600/60 bg-black/40 p-4 text-center text-sm text-zinc-400">
                      Shared screen from the engineer (WebRTC placeholder). This is your main focus while they drive the
                      session.
                    </div>
                  </div>
                </ExpandableShell>
                <ExpandableShell
                  id="remote"
                  title="Video"
                  expandId={expandId}
                  onToggleExpand={toggleExpand}
                  className="flex min-h-[180px] flex-col lg:col-span-5"
                >
                  <ReceivePrimaryRemoteWithPip
                    remoteTitle="Engineer — Bob · New York"
                    remoteSubtitle="Remote engineer / room (WebRTC placeholder)"
                    pipTitle="You — Jay · Florida"
                    pipSubtitle="Self preview"
                    showPip={selfVideoOn}
                  />
                </ExpandableShell>
              </>
            ) : (
              <ExpandableShell
                id="remote"
                title="Video"
                expandId={expandId}
                onToggleExpand={toggleExpand}
                className="flex min-h-0 flex-1 flex-col"
              >
                <ReceivePrimaryRemoteWithPip
                  remoteTitle="Engineer — Bob · New York"
                  remoteSubtitle="Remote engineer / room (WebRTC placeholder)"
                  pipTitle="You — Jay · Florida"
                  pipSubtitle="Self preview"
                  showPip={selfVideoOn}
                />
              </ExpandableShell>
            )}
          </div>

          <aside
            className={cn(
              "relative flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3",
              collaborationShareActive ? "lg:col-span-4" : "lg:col-span-1",
            )}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={lock}
                onPointerDown={(e) => {
                  e.preventDefault();
                  beginTalkback();
                }}
                onPointerUp={endTalkback}
                onPointerLeave={endTalkback}
                className={cn(
                  "inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg border px-3 py-3 text-xs font-bold uppercase tracking-wide select-none touch-manipulation",
                  talkbackHeld
                    ? "border-sky-500/70 bg-sky-900/50 text-sky-100"
                    : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
                  lock && "opacity-40",
                )}
                title="Hold to talk to engineer"
              >
                <Radio className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Talk <span className="block text-[9px] font-normal normal-case text-zinc-500">(hold)</span>
                </span>
              </button>
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

        <ExpandableShell
          id="viewer"
          title="Session viewer"
          expandId={expandId}
          onToggleExpand={toggleExpand}
          className=""
        >
          <section
            className={cn(
              "rounded-xl border border-zinc-800 bg-zinc-900/30 p-4",
              lock ? "pointer-events-none opacity-40" : "",
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
              Session viewer — lyrics, notes, DAW share
            </div>
            <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950/80 text-center text-sm text-zinc-500">
              Embed your lyric sheet, DAW screen share, or trusted URL here (iframe).
            </div>
          </section>
        </ExpandableShell>
      </ExpandableShell>

      <FloatingSessionDock
        visible={expandId !== null}
        onExitExpand={exitExpand}
        timerCompact={timerCompact}
        talkbackLabel="Talkback"
        talkbackActive={talkbackHeld}
        onTalkDown={beginTalkback}
        onTalkUp={endTalkUp}
        talkDisabled={lock}
      />
    </div>
  );
}
