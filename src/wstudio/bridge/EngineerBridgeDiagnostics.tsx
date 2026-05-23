import type { EngineerBridgeRelayStats } from "./useEngineerBridgeRelay";

/**
 * Engineer-side bridge diagnostics.
 *
 * Shows the remote-artist audio relay status:
 *   - remote artist signal meter (RMS of the WebRTC inbound audio we're relaying)
 *   - packets successfully POSTed to the local plugin bridge (127.0.0.1:47999)
 *   - last HTTP status and exact fetch error (if any)
 *
 * Visual style stays inline + zinc so it can drop into the existing engineer
 * bridge sidebar without disturbing the surrounding session layout.
 */
export function EngineerBridgeDiagnostics({ stats }: { stats: EngineerBridgeRelayStats }) {
  const {
    state,
    remoteLevel,
    packetsPosted,
    packetsFailed,
    packetsDropped,
    lastStatus,
    lastError,
    targetUrl,
    sending,
    hasRemoteAudio,
  } = stats;

  const stateColor =
    state === "CONNECTED" ? "text-emerald-400" : state === "CONNECTING" ? "text-amber-300" : "text-red-400";
  const stateDot =
    state === "CONNECTED"
      ? "bg-emerald-400 animate-pulse"
      : state === "CONNECTING"
        ? "bg-amber-300"
        : "bg-red-500";
  const meterPct = Math.max(0, Math.min(100, Math.round(remoteLevel * 100)));

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-zinc-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Engineer bridge relay
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${stateColor}`}>
          <span className={`h-2 w-2 rounded-full ${stateDot}`} aria-hidden />
          {state}
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>REMOTE ARTIST → plugin</span>
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
        <dt className="text-zinc-500">Remote audio</dt>
        <dd className={hasRemoteAudio ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {hasRemoteAudio ? "● live" : "○ waiting"}
        </dd>

        <dt className="text-zinc-500">Posting</dt>
        <dd className={sending ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {sending ? "● POSTing to plugin" : "○ idle"}
        </dd>

        <dt className="text-zinc-500">Packets</dt>
        <dd className="font-mono tabular-nums text-zinc-300">
          {packetsPosted}
          {packetsFailed ? <span className="text-red-400"> · {packetsFailed} err</span> : null}
          {packetsDropped ? <span className="text-amber-300"> · {packetsDropped} drop</span> : null}
        </dd>

        <dt className="text-zinc-500">Last status</dt>
        <dd className="font-mono text-[10px] text-zinc-400 truncate" title={lastStatus ?? "—"}>
          {lastStatus ?? "—"}
        </dd>

        <dt className="text-zinc-500">Endpoint</dt>
        <dd className="truncate font-mono text-[10px] text-zinc-400" title={targetUrl}>
          {targetUrl}
        </dd>
      </dl>

      {lastError ? (
        <p className="mt-2 break-words text-[10px] text-red-400" title={lastError}>
          ⚠ {lastError}
        </p>
      ) : null}
    </section>
  );
}
