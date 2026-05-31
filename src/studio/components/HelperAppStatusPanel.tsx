import { useEffect, useState } from "react";
import { Download, RefreshCw, CheckCircle2, AlertTriangle, Loader2, XCircle, CircleSlash } from "lucide-react";
import { getActiveTransport } from "@/wstudio/audio-engine";
import { getActiveHelperTransport, type HelperStatus } from "@/wstudio/audio-engine/helper";

/**
 * /studio — Helper App status panel.
 *
 * Real status comes from the active HelperTransport (HttpHelperTransport)
 * which polls http://127.0.0.1:48000/status. When the helper responds
 * ok we show "Helper Running".
 */
type UiState = "not-installed" | "not-running" | "connecting" | "connected" | "error";

const META: Record<UiState, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  "not-installed": { label: "Not Installed", color: "text-[hsl(var(--studio-text-dim))]", Icon: CircleSlash },
  "not-running":   { label: "Not Running",   color: "text-[hsl(var(--studio-amber))]",    Icon: AlertTriangle },
  "connecting":    { label: "Connecting…",   color: "text-[hsl(var(--studio-blue))]",     Icon: Loader2 },
  "connected":     { label: "Helper Running", color: "text-[hsl(var(--studio-green))]",   Icon: CheckCircle2 },
  "error":         { label: "Error",         color: "text-[hsl(var(--studio-red))]",      Icon: XCircle },
};

function mapState(s: HelperStatus): UiState {
  switch (s.state) {
    case "CONNECTED": return "connected";
    case "CONNECTING": return "connecting";
    case "ERROR": return "error";
    case "NOT_INSTALLED": return "not-installed";
    case "NOT_RUNNING":
    default: return "not-running";
  }
}

export default function HelperAppStatusPanel() {
  const active = getActiveTransport();
  const helper = getActiveHelperTransport();

  const [status, setStatus] = useState<HelperStatus>(() => helper.getStatus());
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const off = helper.subscribeToHelperStatus(setStatus);
    return () => { off(); };
  }, [helper]);

  const ui = checking ? "connecting" : mapState(status);
  const meta = META[ui];
  const Icon = meta.Icon;

  const checkConnection = async () => {
    setChecking(true);
    try { await helper.connect(); } finally { setChecking(false); }
  };

  const downloadHelper = () => {
    window.open("https://wheuat.com/wstudio-helper", "_blank", "noopener,noreferrer");
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
        <Icon className={`w-4 h-4 ${meta.color} ${ui === "connecting" ? "animate-spin" : ""}`} />
        <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="ml-auto text-[10px] text-[hsl(var(--studio-text-dim))]">
          {helper.label}
        </span>
      </div>

      {status.error && ui !== "connected" && (
        <div className="text-[11px] text-[hsl(var(--studio-amber))] bg-[hsl(var(--studio-amber)/0.08)] border border-[hsl(var(--studio-amber)/0.25)] rounded-md px-2 py-1.5">
          {status.error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="studio-btn" onClick={downloadHelper}>
          <Download className="w-4 h-4" /> Download Helper App
        </button>
        <button className="studio-btn" onClick={checkConnection} disabled={checking}>
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} /> Check Helper Connection
        </button>
      </div>

      <div className="text-[10px] text-[hsl(var(--studio-text-dim))] leading-relaxed">
        Helper endpoint: <b>127.0.0.1:48000</b>
        {status.version && <> · v{status.version}</>}
        {status.lastSeenAt && <> · Last seen {new Date(status.lastSeenAt).toLocaleTimeString()}</>}
      </div>
    </div>
  );
}
