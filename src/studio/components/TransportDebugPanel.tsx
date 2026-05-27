import { useStudioTransport, useStudioPluginStatus } from "../audio/useStudioTransport";
import { useStudio } from "../state/StudioContext";

/**
 * Dev-only HQ transport debug overlay. Renders nothing in production builds.
 * Use to verify /studio is actually talking through the audio-engine
 * abstraction and not reaching into bridge code directly.
 */
export default function TransportDebugPanel({
  role,
  engineerStats,
  artistStats,
}: {
  role: "engineer" | "artist";
  engineerStats?: {
    packetsPosted: number;
    packetsFailed: number;
    packetsDropped: number;
    state: string;
    lastError: string | null;
    targetUrl: string;
  };
  artistStats?: {
    packetsPosted: number;
    packetsFailed: number;
    packetsDropped: number;
    state: string;
    lastError: string | null;
    targetUrl: string;
    level: number;
  };
}) {
  if (!import.meta.env.DEV) return null;

  const transport = useStudioTransport();
  const plugin = useStudioPluginStatus(role === "engineer");
  const { session } = useStudio();
  const caps = transport.getCapabilities();

  const stats = role === "engineer" ? engineerStats : artistStats;

  return (
    <div className="studio-card-inset p-3 text-[11px] font-mono space-y-1 border border-[hsl(var(--studio-border))]">
      <div className="flex items-center justify-between mb-1">
        <span className="uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">
          HQ Transport (dev)
        </span>
        <span className="text-[hsl(var(--studio-blue))]">{transport.id}</span>
      </div>
      <Row k="role" v={role} />
      <Row k="session" v={session?.code ?? "—"} />
      <Row k="label" v={caps.label} />
      <Row k="plugin" v={`${plugin.state} · lvl ${(plugin.level * 100).toFixed(0)}`} />
      {plugin.error && <Row k="plugin.err" v={plugin.error} danger />}
      {stats && (
        <>
          <Row k="state" v={stats.state} />
          <Row k="target" v={stats.targetUrl} />
          <Row
            k="packets"
            v={`ok=${stats.packetsPosted} fail=${stats.packetsFailed} drop=${stats.packetsDropped}`}
          />
          {typeof (stats as unknown as { level?: number }).level === "number" && (
            <Row k="mic" v={`${((stats as unknown as { level: number }).level * 100).toFixed(0)}`} />
          )}
          {stats.lastError && <Row k="err" v={stats.lastError} danger />}
        </>
      )}
    </div>
  );
}

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-[hsl(var(--studio-text-muted))] w-20 shrink-0">{k}</span>
      <span className={danger ? "text-[hsl(var(--studio-red))]" : "text-[hsl(var(--studio-text))] break-all"}>
        {v}
      </span>
    </div>
  );
}
