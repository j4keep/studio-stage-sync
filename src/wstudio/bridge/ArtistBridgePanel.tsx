import { useState } from "react";
import type { ArtistMicBridgeStats } from "./useArtistMicBridge";

/**
 * Artist-side bridge diagnostics panel.
 * Renders connection state, outgoing mic level, packet counters and the
 * target engineer bridge endpoint so the artist can verify that their
 * microphone is actively routing across the network to the engineer.
 *
 * Visual style stays inline + zinc to drop into the existing monitoring
 * sidebar without disturbing the surrounding session layout.
 */
export function ArtistBridgePanel({
  stats,
  remoteEngineerConnected,
}: {
  stats: ArtistMicBridgeStats;
  remoteEngineerConnected: boolean;
}) {
  const { connection, level, packetsSent, packetsFailed, packetsDropped, sending, bridgeHost, slot, enabled, lastError } =
    stats;

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
  // Artist mic sender is plain HTTP POST to the engineer plugin bridge.
  const endpointLabel = `http://${bridgeHost}/artist-audio?slot=${slot}`;

  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const runTestPost = async () => {
    setTesting(true);
    setTestResult("POSTing...");
    const url = endpointLabel;
    try {
      const t0 = performance.now();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: [0.1, 0.1, 0.1, 0.1] }),
        mode: "cors",
        cache: "no-store",
      });
      const ms = Math.round(performance.now() - t0);
      let text = "";
      try { text = await res.text(); } catch {}
      setTestResult(`HTTP ${res.status} ${res.statusText} (${ms}ms)\n${text || "<empty body>"}`);
    } catch (err: any) {
      setTestResult(`ERROR: ${err?.name ?? "Error"}: ${err?.message ?? String(err)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-zinc-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Artist bridge · slot {slot}
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${stateColor}`}>
          <span className={`h-2 w-2 rounded-full ${stateDot}`} aria-hidden />
          {connection}
        </div>
      </div>

      {/* Outgoing vocal meter */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>LOCAL MIC → engineer</span>
          <span className="font-mono tabular-nums text-zinc-300">{meterPct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-700 via-amber-400 to-red-500 transition-[width] duration-75"
            style={{ width: `${meterPct}%` }}
          />
        </div>
      </div>

      {/* Diagnostic grid */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <dt className="text-zinc-500">Bridge</dt>
        <dd className={connection === "CONNECTED" ? "text-emerald-400 font-semibold" : "text-zinc-400"}>
          {connection === "CONNECTED" ? "● connected" : connection === "CONNECTING" ? "… connecting" : "○ disconnected"}
        </dd>

        <dt className="text-zinc-500">Sending</dt>
        <dd className={sending ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {sending ? "● packets sending" : "○ idle"}
        </dd>

        <dt className="text-zinc-500">Engineer</dt>
        <dd className={remoteEngineerConnected ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {remoteEngineerConnected ? "● remote engineer connected" : "○ waiting for engineer"}
        </dd>

        <dt className="text-zinc-500">Mic</dt>
        <dd className={enabled ? "text-zinc-300" : "text-zinc-500"}>{enabled ? "live" : "muted / off"}</dd>

        <dt className="text-zinc-500">Packets</dt>
        <dd className="font-mono tabular-nums text-zinc-300">
          {packetsSent}
          {packetsFailed ? <span className="text-red-400"> · {packetsFailed} err</span> : null}
          {packetsDropped ? <span className="text-amber-300"> · {packetsDropped} drop</span> : null}
        </dd>

        <dt className="text-zinc-500">Endpoint</dt>
        <dd className="truncate font-mono text-[10px] text-zinc-400" title={endpointLabel}>
          {endpointLabel}
        </dd>
      </dl>

      {lastError ? (
        <p className="mt-2 truncate text-[10px] text-red-400" title={lastError}>
          ⚠ {lastError}
        </p>
      ) : null}

      <div className="mt-3 border-t border-zinc-800 pt-2">
        <button
          type="button"
          onClick={runTestPost}
          disabled={testing}
          className="w-full rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {testing ? "Sending..." : "Test POST"}
        </button>
        {testResult ? (
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-300 ring-1 ring-zinc-800">
{testResult}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
