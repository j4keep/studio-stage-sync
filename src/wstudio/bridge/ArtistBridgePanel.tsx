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

  // ---- Local Bridge Test Mode --------------------------------------------
  // The Lovable preview/published app is served over HTTPS, but the engineer
  // bridge listens on plain HTTP on the LAN. Chrome blocks HTTPS→HTTP as Mixed
  // Content, so POSTs silently fail with "Failed to fetch". This block detects
  // that case and surfaces a clear remediation path: re-open the same hash
  // route over HTTP from the LAN dev origin (vite already binds 0.0.0.0:8080).
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
  const isHttpTarget = endpointLabel.startsWith("http://");
  const mixedContentBlocked = isHttpsPage && isHttpTarget;

  const [hostInput, setHostInput] = useState<string>(() => {
    try { return localStorage.getItem("wstudio.bridge.host") || bridgeHost; } catch { return bridgeHost; }
  });
  const saveHost = () => {
    try {
      const v = hostInput.trim();
      if (v) localStorage.setItem("wstudio.bridge.host", v);
      else localStorage.removeItem("wstudio.bridge.host");
    } catch {}
    window.location.reload();
  };
  const openOverHttp = () => {
    // Reload current hash route from http://<bridge-lan-ip>:8080 (vite dev
    // server). The artist Mac must have network reach to that host.
    const lanHost = (bridgeHost.split(":")[0] || "localhost");
    const hash = window.location.hash || "#/";
    const url = `http://${lanHost}:8080/${hash}`;
    window.open(url, "_blank", "noopener");
  };


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

      {/* Mixed Content / Local Bridge Test Mode banner. HTTPS pages can't POST
          to http:// LAN targets — Chrome silently fails with "Failed to fetch".
          Surface this clearly with a one-click "Open over HTTP" remediation. */}
      {mixedContentBlocked ? (
        <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-[10px] text-amber-200">
          <div className="mb-1 font-bold uppercase tracking-wider text-amber-300">
            ⚠ Mixed Content blocked
          </div>
          <p className="leading-snug">
            This page is HTTPS but the engineer bridge is plain HTTP on the LAN.
            Chrome blocks the POST. To test the artist bridge locally, re-open
            the session over HTTP from the LAN dev server.
          </p>
          <button
            type="button"
            onClick={openOverHttp}
            className="mt-2 w-full rounded-md bg-amber-500 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950 hover:bg-amber-400"
          >
            Open session over HTTP
          </button>
        </div>
      ) : null}


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

      <div className="mt-3 space-y-2 border-t border-zinc-800 pt-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
            Bridge host:port
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              placeholder="192.168.12.155:47999"
              className="flex-1 rounded bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-200 ring-1 ring-zinc-800 focus:outline-none focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={saveHost}
              className="rounded bg-zinc-700 px-2 py-1 text-[10px] font-bold uppercase text-zinc-100 hover:bg-zinc-600"
            >
              Save
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={runTestPost}
          disabled={testing}
          className="w-full rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {testing ? "Sending..." : "Test POST"}
        </button>
        {testResult ? (
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[10px] text-zinc-300 ring-1 ring-zinc-800">
{testResult}
          </pre>
        ) : null}
      </div>

    </section>
  );
}
