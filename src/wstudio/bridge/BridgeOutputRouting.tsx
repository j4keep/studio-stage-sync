import type { AudioOutputDevice } from "./useBridgeOutputDevice";
import { WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED } from "./useBridgeOutputDevice";

export function BridgeOutputRouting({
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  vocalPathReady,
  routed,
  routingError,
  refreshDevices,
}: {
  devices: AudioOutputDevice[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  vocalPathReady: boolean;
  routed: boolean;
  routingError: string | null;
  refreshDevices: () => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Output routing · bridge out</div>
        <button type="button" onClick={refreshDevices} className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
          ↻ Refresh
        </button>
      </div>

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

      <div className="flex items-center gap-2 text-xs">
        <span
          className={routed && vocalPathReady ? "inline-flex h-2 w-2 rounded-full bg-emerald-400" : "inline-flex h-2 w-2 rounded-full bg-zinc-600"}
          aria-hidden
        />
        <span className={routed && vocalPathReady ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {routed && vocalPathReady
            ? `Routing to: ${devices.find((d) => d.deviceId === selectedDeviceId)?.label ?? selectedDeviceId}`
            : "Not routing"}
        </span>
      </div>

      {routingError && <p className="text-xs text-red-400/90">{routingError}</p>}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Primary path: <span className="text-zinc-500">W.STUDIO Desktop Bridge</span> receives the session and drives{" "}
        <span className="text-zinc-500">W.STUDIO Artist Input</span> (virtual device) so Logic can use it like a normal mic input. Route
        bridge audio here to the same output the bridge listens on (often BlackHole) until the desktop app wires this automatically.
        {WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED ? (
          <span> Experimental AU WebSocket option is enabled in this build.</span>
        ) : null}
      </p>
    </section>
  );
}
