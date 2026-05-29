import { useState } from "react";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Loader2, XCircle, CircleSlash } from "lucide-react";
import { getActiveTransport, getTransport } from "@/wstudio/audio-engine";

/**
 * /studio — Helper App status panel.
 *
 * Prototype-only UI surface that prepares /studio for the future
 * W.STUDIO Helper App transport. No native helper exists yet; this
 * panel only renders state + placeholder actions.
 *
 * States: not-installed | not-running | connecting | connected | error
 */
export type HelperAppState =
  | "not-installed"
  | "not-running"
  | "connecting"
  | "connected"
  | "error";

const META: Record<HelperAppState, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  "not-installed": { label: "Not Installed", color: "text-[hsl(var(--studio-text-dim))]", Icon: CircleSlash },
  "not-running":   { label: "Not Running",   color: "text-[hsl(var(--studio-amber))]",    Icon: AlertTriangle },
  "connecting":    { label: "Connecting…",   color: "text-[hsl(var(--studio-blue))]",     Icon: Loader2 },
  "connected":     { label: "Connected",     color: "text-[hsl(var(--studio-green))]",    Icon: CheckCircle2 },
  "error":         { label: "Error",         color: "text-[hsl(var(--studio-red))]",      Icon: XCircle },
};

export default function HelperAppStatusPanel() {
  const active = getActiveTransport();
  const helper = getTransport("wstudio-helper");
  const helperCaps = helper?.getCapabilities();

  // No native helper exists yet → default to "not-installed".
  const [state, setState] = useState<HelperAppState>("not-installed");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = META[state];
  const Icon = meta.Icon;

  const checkConnection = async () => {
    setError(null);
    setState("connecting");
    // Placeholder: simulate a probe. Real impl will ping the Helper App IPC.
    await new Promise((r) => setTimeout(r, 700));
    setLastCheckedAt(Date.now());
    // No helper binary yet → always report not-installed for now.
    setState("not-installed");
    setError("Helper App not detected on this system.");
  };

  const downloadHelper = () => {
    // Placeholder action — real download link lands with the Helper App ship.
    setError("Helper App download is not available yet (coming soon).");
  };

  return (
    <div className="studio-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">
          W.STUDIO Helper App
        </div>
        <span className="text-[10px] text-[hsl(var(--studio-text-dim))]">
          active transport: <b className="text-[hsl(var(--studio-text))]">{active.id}</b>
        </span>
      </div>

      <div className="studio-card-inset px-3 py-2 flex items-center gap-2 text-sm">
        <Icon className={`w-4 h-4 ${meta.color} ${state === "connecting" ? "animate-spin" : ""}`} />
        <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="ml-auto text-[10px] text-[hsl(var(--studio-text-dim))]">
          {helperCaps?.label ?? "wstudio-helper"}
        </span>
      </div>

      {error && (
        <div className="text-[11px] text-[hsl(var(--studio-amber))] bg-[hsl(var(--studio-amber)/0.08)] border border-[hsl(var(--studio-amber)/0.25)] rounded-md px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="studio-btn" onClick={downloadHelper}>
          <Download className="w-4 h-4" /> Download Helper App
        </button>
        <button className="studio-btn" onClick={checkConnection} disabled={state === "connecting"}>
          <RefreshCw className={`w-4 h-4 ${state === "connecting" ? "animate-spin" : ""}`} /> Check Helper Connection
        </button>
      </div>

      <div className="text-[10px] text-[hsl(var(--studio-text-dim))] leading-relaxed">
        Currently routed through <b>LocalhostBridgeAdapter</b> (temporary).
        The W.STUDIO Helper App will replace the localhost bridge once shipped.
        {lastCheckedAt && (
          <> · Last check: {new Date(lastCheckedAt).toLocaleTimeString()}</>
        )}
      </div>
    </div>
  );
}
