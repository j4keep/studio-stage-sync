import { useState } from "react";
import type { ArtistMicBridgeStats } from "./useArtistMicBridge";
import type { LocalBridgeState } from "./useLocalBridgePoll";

/**
 * Unified W.Studio bridge diagnostics panel — used on BOTH artist and engineer
 * sides so the two roles get the same visual language and the same set of
 * diagnostic fields. Role only changes the labels and which side runs the
 * Test POST button (artist sends, engineer polls/receives).
 */
type Common = {
  role: "artist" | "engineer";
  /** True when the opposite peer is reachable in the session. */
  remotePeerConnected: boolean;
};

type ArtistProps = Common & {
  role: "artist";
  stats: ArtistMicBridgeStats;
};

type EngineerProps = Common & {
  role: "engineer";
  stats: LocalBridgeState;
  /** Optional: forces "live" badge for mic — engineer side just reflects "remote audio" boolean. */
  hasRemoteAudio: boolean;
};

type Props = ArtistProps | EngineerProps;

export function BridgePanel(props: Props) {
  // Normalize role-specific stats into one shape we render from.
  const isArtist = props.role === "artist";
  const remotePeerConnected = props.remotePeerConnected;

  const connection: "CONNECTED" | "CONNECTING" | "DISCONNECTED" = isArtist
    ? props.stats.connection
    : props.stats.connected
      ? props.stats.feedActive ? "CONNECTED" : "CONNECTING"
      : "DISCONNECTED";

  const level = isArtist ? props.stats.level : props.stats.level;
  const sending = isArtist ? props.stats.sending : props.stats.feedActive;
  const packets = isArtist ? props.stats.packetsSent : props.stats.packetsReceived;
  const packetsFailed = isArtist ? props.stats.packetsFailed : props.stats.packetsFailed;
  const packetsDropped = isArtist ? props.stats.packetsDropped : 0;
  const lastError = isArtist ? props.stats.lastError : props.stats.error;
  const slotLabel = isArtist ? `slot ${props.stats.slot}` : "receive";
  const bridgeHost = isArtist ? props.stats.bridgeHost : props.stats.bridgeHost;
  const endpoint = isArtist
    ? `http://${bridgeHost}/artist-audio?slot=${props.stats.slot}`
    : props.stats.endpoint;
  const micEnabled = isArtist ? props.stats.enabled : props.hasRemoteAudio;
  const titleSide = isArtist ? "ARTIST BRIDGE" : "ENGINEER BRIDGE";

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
  const meterLabel = isArtist ? "LOCAL MIC → engineer" : "INCOMING ARTIST FEED";
  const meterRow = isArtist ? "Sending" : "Receiving";
  const peerLabel = isArtist ? "Engineer" : "Artist";
  const peerCopy = isArtist
    ? remotePeerConnected ? "● remote engineer connected" : "○ waiting for engineer"
    : remotePeerConnected ? "● remote artist connected" : "○ waiting for artist";
  const micLabel = isArtist ? "Mic" : "Remote audio";
  const micCopy = isArtist
    ? (micEnabled ? "live" : "muted / off")
    : (micEnabled ? "live" : "no track");

  // Mixed-content detection (HTTPS page → HTTP target on LAN).
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
  const isHttpTarget = endpoint.startsWith("http://");
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
    const lanHost = (bridgeHost.split(":")[0] || "localhost");
    const hash = window.location.hash || "#/";
    const url = `http://${lanHost}:8080/${hash}`;
    window.open(url, "_blank", "noopener");
  };

  // Test POST — artist sends real samples; engineer fires a GET probe.
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const runTest = async () => {
    setTesting(true);
    setTestResult(isArtist ? "POSTing..." : "GETing...");
    try {
      const t0 = performance.now();
      const res = isArtist
        ? await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ samples: [0.1, 0.1, 0.1, 0.1] }),
            mode: "cors",
            cache: "no-store",
          })
        : await fetch(endpoint, { method: "GET", mode: "cors", cache: "no-store" });
      const ms = Math.round(performance.now() - t0);
      let text = "";
      try { text = await res.text(); } catch {}
      setTestResult(`HTTP ${res.status} ${res.statusText} (${ms}ms)\n${text ? text.slice(0, 400) : "<empty body>"}`);
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
          {titleSide} · {slotLabel}
        </div>
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${stateColor}`}>
          <span className={`h-2 w-2 rounded-full ${stateDot}`} aria-hidden />
          {connection}
        </div>
      </div>

      {mixedContentBlocked ? (
        <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-[10px] text-amber-200">
          <div className="mb-1 font-bold uppercase tracking-wider text-amber-300">
            ⚠ Mixed Content blocked
          </div>
          <p className="leading-snug">
            This page is HTTPS but the bridge is plain HTTP on the LAN.
            Chrome blocks the request. Re-open the session over HTTP from the
            LAN dev server to test the bridge.
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

      {/* Meter */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>{meterLabel}</span>
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
        <dt className="text-zinc-500">Bridge</dt>
        <dd className={connection === "CONNECTED" ? "text-emerald-400 font-semibold" : "text-zinc-400"}>
          {connection === "CONNECTED" ? "● connected" : connection === "CONNECTING" ? "… connecting" : "○ disconnected"}
        </dd>

        <dt className="text-zinc-500">{meterRow}</dt>
        <dd className={sending ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {sending ? (isArtist ? "● packets sending" : "● packets arriving") : "○ idle"}
        </dd>

        <dt className="text-zinc-500">{peerLabel}</dt>
        <dd className={remotePeerConnected ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {peerCopy}
        </dd>

        <dt className="text-zinc-500">{micLabel}</dt>
        <dd className={micEnabled ? "text-zinc-300" : "text-zinc-500"}>{micCopy}</dd>

        <dt className="text-zinc-500">Packets</dt>
        <dd className="font-mono tabular-nums text-zinc-300">
          {packets}
          {packetsFailed ? <span className="text-red-400"> · {packetsFailed} err</span> : null}
          {packetsDropped ? <span className="text-amber-300"> · {packetsDropped} drop</span> : null}
        </dd>

        <dt className="text-zinc-500">Endpoint</dt>
        <dd className="truncate font-mono text-[10px] text-zinc-400" title={endpoint}>
          {endpoint}
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
          onClick={runTest}
          disabled={testing}
          className="w-full rounded-md bg-violet-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {testing ? "Sending..." : isArtist ? "Test POST" : "Test GET"}
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
