import type { ArtistMicBridgeStats } from "./useArtistMicBridge";

/**
 * Artist-side bridge diagnostics panel.
 *
 * Artist mic travels to the engineer via the existing W.STUDIO WebRTC
 * session — this panel only reflects the local mic signal and reports
 * "sending to session". The engineer side handles the local-loopback POST
 * to the JUCE AU plugin (see `EngineerBridgeDiagnostics`).
 */
export function ArtistBridgePanel({
  stats,
  remoteEngineerConnected,
}: {
  stats: ArtistMicBridgeStats;
  remoteEngineerConnected: boolean;
}) {
  const { connection, level, sending, enabled } = stats;

  const stateColor =
    connection === "CONNECTED"
      ? "text-emerald-400"
      : connection === "CONNECTING"
        ? "text-amber-300"
        : "text-red-400";
  const stateDot =
    connection === "CONNECTED"
      ? "bg-emerald-400 animate-pulse"
      : connection === "CONNECTING"
        ? "bg-amber-300"
        : "bg-red-500";

  const meterPct = Math.max(0, Math.min(100, Math.round(level * 100)));

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-zinc-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Artist mic → session
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${stateColor}`}>
          <span className={`h-2 w-2 rounded-full ${stateDot}`} aria-hidden />
          {connection}
        </div>
      </div>

      {/* Local mic meter */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>LOCAL MIC</span>
          <span className="font-mono tabular-nums text-zinc-300">{meterPct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-700 via-amber-400 to-red-500 transition-[width] duration-75"
            style={{ width: `${meterPct}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <dt className="text-zinc-500">Mic</dt>
        <dd className={enabled ? "text-zinc-300" : "text-zinc-500"}>
          {enabled ? "live" : "muted / off"}
        </dd>

        <dt className="text-zinc-500">Sending</dt>
        <dd className={sending ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {sending ? "● sending to session" : "○ idle"}
        </dd>

        <dt className="text-zinc-500">Engineer</dt>
        <dd className={remoteEngineerConnected ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {remoteEngineerConnected ? "● connected" : "○ waiting"}
        </dd>

        <dt className="text-zinc-500">Transport</dt>
        <dd className="font-mono text-[10px] text-zinc-400">WebRTC session</dd>
      </dl>

      <p className="mt-2 text-[10px] leading-snug text-zinc-500">
        Your mic is delivered to the engineer through the session. The engineer's
        bridge handles the local plugin route to the DAW.
      </p>
    </section>
  );
}
