import { Link } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { WSTUDIO_DAW_VOCAL_IN_1, WSTUDIO_DAW_VOCAL_IN_2 } from "../media/dawRouting";

/**
 * Engineer-side DAW bridge: surfaces isolated artist vocal streams and session metadata.
 * Open while in an active session (same tab session state as the live room).
 * Does not replace the main session UI — minimal status surface only.
 */
export default function StudioBridgeScreen() {
  const { sessionId, sessionDisplayName, role, connection } = useSession();
  const {
    engineerDawVocalIn1,
    engineerDawVocalIn2,
    engineerScreenShareAudioStream,
    hasRemoteAudio,
    remoteMicLevel,
  } = useStudioMedia();

  const vocalActive = !!(engineerDawVocalIn1 && engineerDawVocalIn2);
  const screenAudioActive = !!engineerScreenShareAudioStream;

  if (role !== "engineer") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-6 text-zinc-100">
        <h1 className="text-lg font-bold text-white">W.Studio DAW Bridge</h1>
        <p className="text-sm text-zinc-400">The bridge is engineer-only. Join a session as engineer, then open this page again.</p>
        <Link to="/wstudio/session/join" className="text-sm font-medium text-amber-200 underline-offset-2 hover:underline">
          Back to session join
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6 text-zinc-100">
      <header>
        <h1 className="text-lg font-bold text-white">W.Studio DAW Bridge</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Isolated artist vocal buses for virtual input / desktop routing. Keep your live session open in another tab if needed; session state is shared when using the same browser profile.
        </p>
      </header>

      {!sessionId.trim() ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
          No active session code. Join from the main flow first, then return to{" "}
          <span className="font-mono text-zinc-300">/wstudio/session/bridge</span>.
          <div className="mt-3">
            <Link to="/wstudio/session/join" className="text-sm font-medium text-amber-200 underline-offset-2 hover:underline">
              Session join
            </Link>
          </div>
        </div>
      ) : null}

      <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Session</div>
        <div className="text-sm text-zinc-200">
          <span className="text-zinc-500">Code </span>
          <span className="font-mono tabular-nums">{sessionId.toUpperCase() || "—"}</span>
        </div>
        {sessionDisplayName ? (
          <div className="text-sm text-zinc-300">{sessionDisplayName}</div>
        ) : null}
        <div className="text-sm">
          <span className="text-zinc-500">Link </span>
          <span
            className={
              connection === "connected"
                ? "font-medium text-emerald-400"
                : connection === "connecting"
                  ? "font-medium text-amber-300"
                  : "font-medium text-zinc-500"
            }
          >
            {connection === "connected" ? "Connected" : connection === "connecting" ? "Connecting" : "Disconnected"}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-zinc-500">Remote artist audio </span>
          <span className={hasRemoteAudio ? "text-emerald-400" : "text-zinc-600"}>{hasRemoteAudio ? "Present" : "None"}</span>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Virtual inputs (browser buses)</div>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>{WSTUDIO_DAW_VOCAL_IN_1}</span>
            <span className={vocalActive ? "text-emerald-400" : "text-zinc-600"}>{vocalActive ? "Active" : "Idle"}</span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>{WSTUDIO_DAW_VOCAL_IN_2}</span>
            <span className={vocalActive ? "text-emerald-400" : "text-zinc-600"}>{vocalActive ? "Active" : "Idle"}</span>
          </li>
        </ul>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          These map to parallel Web Audio paths from the artist&apos;s live mic — not mixed with your talkback send or session monitor fader. A future desktop bridge can expose them as Core Audio / WASAPI devices for Pro Tools, Logic, FL Studio, etc.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Artist vocal level (incoming)</div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-700 via-amber-500 to-red-600 transition-[width] duration-100"
            style={{ width: `${Math.round(Math.min(1, remoteMicLevel) * 100)}%` }}
          />
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Screen-share audio (separate bus)</div>
        <p className="text-sm text-zinc-400">
          Status:{" "}
          <span className={screenAudioActive ? "text-amber-200" : "text-zinc-600"}>
            {screenAudioActive ? "Track present (isolated from vocal DAW path)" : "None (capture is video-only in current build)"}
          </span>
        </p>
      </section>

      <footer className="text-[11px] text-zinc-600">
        <Link to="/wstudio/session/live" className="font-medium text-zinc-400 underline-offset-2 hover:text-zinc-300 hover:underline">
          Return to live session
        </Link>
      </footer>
    </div>
  );
}
