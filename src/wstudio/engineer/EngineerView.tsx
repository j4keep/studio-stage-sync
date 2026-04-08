import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Radio, MonitorUp, Route, Square } from "lucide-react";
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

  useEffect(() => {
    if (connection === "disconnected" || role === null) {
      navigate("/wstudio/session", { replace: true });
      return;
    }
    if (role === "artist") navigate("/wstudio/artist", { replace: true });
  }, [connection, role, navigate]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
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

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-5">
        <div className="flex min-h-[220px] flex-col lg:col-span-3">
          <VideoPanel title="Artist" subtitle="Remote artist camera / room view" className="min-h-[240px] flex-1" />
        </div>

        <aside className="flex flex-col gap-3 lg:col-span-2">
          <PushControl active={talkbackOn} onClick={toggleTalkback} title="Talkback to artist">
            <Radio className="mr-2 inline h-4 w-4" aria-hidden />
            Talkback
          </PushControl>

          <RemoteVocalMeter level={remoteVocalLevel} />

          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              <MonitorUp className="h-3.5 w-3.5" aria-hidden />
              Screen share
            </div>
            <PushControl active={screenSharing} onClick={toggleScreenShare} title="Share your screen to the artist">
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
