import { ConnectionStatus } from "../state/StudioContext";

const labelMap: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  connected: "Connected",
  error: "Error",
};

export default function PluginStatusPanel({
  status, lastSignalMs, sampleRate = 48000, buffer = 256,
}: {
  status: ConnectionStatus;
  lastSignalMs?: number | null;
  sampleRate?: number;
  buffer?: number;
}) {
  const dotClass =
    status === "connected" ? "ok"
    : status === "connecting" ? "warn"
    : status === "error" ? "err"
    : "";

  const ring =
    status === "connected" ? "studio-glow-blue"
    : status === "connecting" ? "ring-1 ring-[hsl(var(--studio-amber)/0.4)]"
    : status === "error" ? "ring-1 ring-[hsl(var(--studio-red)/0.4)]"
    : "ring-1 ring-[hsl(var(--studio-border))]";

  const ago = lastSignalMs ? `${Math.max(0, Math.round((Date.now() - lastSignalMs) / 1000))}s ago` : "—";

  return (
    <div className={`studio-card p-4 ${ring}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Plugin</div>
          <div className="text-sm font-semibold">W.STUDIO Plugin</div>
          <div className="text-xs text-[hsl(var(--studio-text-dim))]">Logic Pro · AU</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`studio-status-dot ${dotClass}`} />
          <span className="text-xs font-medium">{labelMap[status]}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="studio-card-inset p-2">
          <div className="text-[10px] uppercase text-[hsl(var(--studio-text-muted))]">Last signal</div>
          <div className="text-sm font-mono">{ago}</div>
        </div>
        <div className="studio-card-inset p-2">
          <div className="text-[10px] uppercase text-[hsl(var(--studio-text-muted))]">Sample rate</div>
          <div className="text-sm font-mono">{sampleRate / 1000} kHz</div>
        </div>
        <div className="studio-card-inset p-2">
          <div className="text-[10px] uppercase text-[hsl(var(--studio-text-muted))]">Buffer</div>
          <div className="text-sm font-mono">{buffer}</div>
        </div>
      </div>
    </div>
  );
}
