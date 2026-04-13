import { Link } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { useStudioMedia } from "../media/StudioMediaContext";
import { useBridgeOutputDevice } from "./useBridgeOutputDevice";
import { useBridgeInputDevices } from "./useBridgeInputDevice";
import { BridgeSessionInfo } from "./BridgeSessionInfo";
import { BridgeAudioLink } from "./BridgeAudioLink";
import { BridgeVocalMeter } from "./BridgeVocalMeter";
import { BridgeOutputRouting } from "./BridgeOutputRouting";
import { BridgeDawReturn } from "./BridgeDawReturn";

/**
 * Engineer-side W.Studio Bridge MVP: isolated artist vocal path + DAW return + session status.
 */
export default function StudioBridgeScreen() {
  const { sessionId, sessionDisplayName, role, live } = useSession();
  const {
    engineerDawVocalIn1,
    engineerDawVocalIn2,
    engineerScreenShareAudioStream,
    engineerBridgeVocalLevel,
    engineerDawReturnLevel,
    dawReturnActive,
    dawReturnDeviceId,
    setDawReturnDeviceId,
    startDawReturn,
    stopDawReturn,
    hasRemoteAudio,
  } = useStudioMedia();

  const { devices: outputDevices, selectedDeviceId, setSelectedDeviceId, routingError, routed, refreshDevices: refreshOutputDevices } =
    useBridgeOutputDevice(engineerDawVocalIn1);

  const { devices: inputDevices, refreshDevices: refreshInputDevices } = useBridgeInputDevices();

  const vocalPathReady = !!(engineerDawVocalIn1 && engineerDawVocalIn2 && hasRemoteAudio);
  const signalDetected = engineerBridgeVocalLevel >= 0.035;

  const feedInactiveReason = !sessionId.trim()
    ? "No session"
    : !hasRemoteAudio
      ? "No remote audio track"
      : !vocalPathReady
        ? "Vocal bus not ready"
        : null;

  const feedStatusLabel = vocalPathReady
    ? signalDetected ? "ACTIVE" : "ACTIVE · quiet"
    : "INACTIVE";

  const artistLine = live.remoteArtistLabel.trim() || (hasRemoteAudio ? "Artist connected" : "Waiting for artist…");
  const sessionNameLine = sessionDisplayName.trim() || (sessionId.trim() ? `Session: ${sessionId.toUpperCase()}` : "—");

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
          Engineer-only layer: artist vocal to DAW + DAW playback return to artist. Session, video, and talkback stay in the main live room.
        </p>
      </header>

      {!sessionId.trim() && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
          Join a session as engineer first, then open{" "}
          <span className="font-mono text-amber-200/90">/wstudio/session/bridge</span> in this profile.
          <div className="mt-3">
            <Link to="/wstudio/session/join" className="font-medium text-amber-200 underline-offset-2 hover:underline">
              Go to session join
            </Link>
          </div>
        </div>
      )}

      <BridgeSessionInfo
        sessionNameLine={sessionNameLine}
        sessionId={sessionId}
        artistLine={artistLine}
        hasRemoteAudio={hasRemoteAudio}
      />

      <BridgeAudioLink
        vocalPathReady={vocalPathReady}
        hasRemoteAudio={hasRemoteAudio}
        feedStatusLabel={feedStatusLabel}
        signalDetected={signalDetected}
        feedInactiveReason={feedInactiveReason}
      />

      <BridgeVocalMeter
        level={engineerBridgeVocalLevel}
        label="Incoming vocal (bridge path)"
        description="Tapped from the isolated DAW vocal bus — not mixed with talkback send or headphone UI."
      />

      <BridgeOutputRouting
        devices={outputDevices}
        selectedDeviceId={selectedDeviceId}
        setSelectedDeviceId={setSelectedDeviceId}
        vocalPathReady={vocalPathReady}
        routed={routed}
        routingError={routingError}
        refreshDevices={refreshOutputDevices}
      />

      <BridgeDawReturn
        inputDevices={inputDevices}
        dawReturnDeviceId={dawReturnDeviceId}
        setDawReturnDeviceId={setDawReturnDeviceId}
        dawReturnActive={dawReturnActive}
        dawReturnLevel={engineerDawReturnLevel}
        startDawReturn={startDawReturn}
        stopDawReturn={stopDawReturn}
        refreshInputDevices={refreshInputDevices}
        sessionActive={!!sessionId.trim()}
      />

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
