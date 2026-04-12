import { Link } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { WSTUDIO_DAW_VOCAL_IN_1, WSTUDIO_DAW_VOCAL_IN_2 } from "../media/dawRouting";
import { useBridgeOutputDevice } from "./useBridgeOutputDevice";

/**
 * Engineer-side W.Studio Bridge MVP: isolated artist vocal path + session/participant status.
 * Separate from the main live session UI (see /wstudio/session/live).
 */
export default function StudioBridgeScreen() {
  const { sessionId, sessionDisplayName, role, live } = useSession();
  const {
    engineerDawVocalIn1,
    engineerDawVocalIn2,
    engineerScreenShareAudioStream,
    engineerBridgeVocalLevel,
    hasRemoteAudio,
  } = useStudioMedia();

  const { devices, selectedDeviceId, setSelectedDeviceId, routingError, routed, refreshDevices } =
    useBridgeOutputDevice(engineerDawVocalIn1);

  const vocalPathReady = !!(engineerDawVocalIn1 && engineerDawVocalIn2 && hasRemoteAudio);
  const signalDetected = engineerBridgeVocalLevel >= 0.035;

  /** Bridge status derives from actual audio path, not session-level handshake */
  const feedInactiveReason = !sessionId.trim()
    ? "No session"
    : !hasRemoteAudio
      ? "No remote audio track"
      : !vocalPathReady
        ? "Vocal bus not ready"
        : null;

  const feedStatusLabel =
    vocalPathReady
      ? signalDetected
        ? "ACTIVE"
        : "ACTIVE · quiet"
      : "INACTIVE";

  const artistLine =
    live.remoteArtistLabel.trim() ||
    (hasRemoteAudio ? "Artist connected" : "Waiting for artist…");

  const sessionNameLine =
    sessionDisplayName.trim() ||
    (sessionId.trim() ? `Session: ${sessionId.toUpperCase()}` : "—");

  if (role !== "engineer") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-6 text-zinc-100">
        <h1 className="text-lg font-bold text-white">W.Studio Bridge</h1>
        <p className="text-sm text-zinc-400">
          This window is for the engineer only. Join as engineer from the main flow, then open the bridge again.
        </p>
        <Link to="/wstudio/session/join" className="text-sm font-medium text-amber-200 underline-offset-2 hover:underline">
          Session join
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6 text-zinc-100">
      <header className="border-b border-zinc-800 pb-4">
        <h1 className="text-lg font-bold text-white">W.Studio Bridge</h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Engineer-only layer for the artist&apos;s live vocal (dedicated Web Audio path). Session, video, and talkback stay in the main live room — this page does not replace them.
        </p>
      </header>

      {!sessionId.trim() ? (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
          Join a session as engineer first, then open{" "}
          <span className="font-mono text-amber-200/90">/wstudio/session/bridge</span> in this profile.
          <div className="mt-3">
            <Link to="/wstudio/session/join" className="font-medium text-amber-200 underline-offset-2 hover:underline">
              Go to session join
            </Link>
          </div>
        </div>
      ) : null}

      {/* Session + participant */}
      <section className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Session</div>
          <div className="mt-1 text-base font-semibold text-zinc-100">{sessionNameLine}</div>
          <div className="mt-0.5 font-mono text-xs text-zinc-500 tabular-nums">{sessionId.toUpperCase() || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Artist</div>
          <div className="mt-1 text-base font-semibold text-zinc-100">{artistLine}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {hasRemoteAudio ? (
              <span className="text-emerald-400/90">Audio connected</span>
            ) : (
              <span className="text-zinc-600">No audio yet</span>
            )}
          </div>
        </div>
      </section>

      {/* Link + feed state */}
      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Audio link</div>
          <div
            className={
              vocalPathReady
                ? "text-sm font-semibold text-emerald-400"
                : hasRemoteAudio
                  ? "text-sm font-semibold text-amber-300"
                  : "text-sm font-semibold text-zinc-500"
            }
          >
            {vocalPathReady ? "Connected" : hasRemoteAudio ? "Connecting" : "Disconnected"}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Artist vocal feed</div>
          <div className="flex items-center gap-2">
            <span
              className={
                feedStatusLabel.startsWith("ACTIVE")
                  ? signalDetected
                    ? "inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400"
                    : "inline-flex h-2 w-2 rounded-full bg-emerald-600/80"
                  : "inline-flex h-2 w-2 rounded-full bg-zinc-600"
              }
              aria-hidden
            />
            <span
              className={
                feedStatusLabel.startsWith("ACTIVE") ? "text-sm font-bold text-emerald-400" : "text-sm font-bold text-zinc-500"
              }
            >
              {feedStatusLabel}
            </span>
          </div>
        </div>
        {feedInactiveReason ? (
          <p className="text-xs text-zinc-500">{feedInactiveReason}</p>
        ) : null}
      </section>

      {/* Dedicated bridge-path meter (not the main session monitor strip) */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Incoming vocal (bridge path)</div>
            <p className="mt-0.5 text-[11px] text-zinc-500">Tapped from the isolated DAW vocal bus — not mixed with talkback send or headphone UI.</p>
          </div>
          <span className="font-mono text-xs text-zinc-400 tabular-nums">{Math.round(engineerBridgeVocalLevel * 100)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-800 via-amber-500 to-red-500 transition-[width] duration-75"
            style={{ width: `${Math.round(Math.min(1, engineerBridgeVocalLevel) * 100)}%` }}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Output routing</div>
          <button
            type="button"
            onClick={() => refreshDevices()}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Device selector */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-zinc-400">Bridge output device</span>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={!vocalPathReady}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
          >
            <option value="default">Default output</option>
            {devices
              .filter((d) => d.deviceId !== "default")
              .map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
          </select>
        </label>

        {/* Routing status */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              routed && vocalPathReady
                ? "inline-flex h-2 w-2 rounded-full bg-emerald-400"
                : "inline-flex h-2 w-2 rounded-full bg-zinc-600"
            }
            aria-hidden
          />
          <span className={routed && vocalPathReady ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
            {routed && vocalPathReady
              ? `Routing to: ${devices.find((d) => d.deviceId === selectedDeviceId)?.label ?? selectedDeviceId}`
              : "Not routing"}
          </span>
        </div>

        {routingError && (
          <p className="text-xs text-red-400/90">{routingError}</p>
        )}

        <p className="text-[11px] leading-relaxed text-zinc-600">
          Select a virtual cable (BlackHole, VB-Cable, Loopback) to route the artist vocal into your DAW. Set your DAW input to the same device.
        </p>
      </section>

      {!!engineerScreenShareAudioStream && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Screen audio bus</span>
          <p className="mt-2 text-amber-200/80">Separate capture track present (not routed into vocal DAW path).</p>
        </section>
      )}

      <footer className="border-t border-zinc-800 pt-4 text-[11px] text-zinc-600">
        <Link to="/wstudio/session/live" className="font-medium text-zinc-400 underline-offset-2 hover:text-zinc-300 hover:underline">
          Back to live session
        </Link>
      </footer>
    </div>
  );
}
