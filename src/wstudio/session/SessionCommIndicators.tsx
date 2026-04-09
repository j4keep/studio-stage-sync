import { cn } from "@/lib/utils";
import type { Role } from "./SessionContext";
import { defaultLiveState, type SessionLiveState } from "./sessionLiveSync";

export type ConnectionQuality = "excellent" | "good" | "fair" | "poor";

export function connectionQualityFromLatency(ms: number): ConnectionQuality {
  if (ms <= 0) return "good";
  if (ms <= 35) return "excellent";
  if (ms <= 55) return "good";
  if (ms <= 85) return "fair";
  return "poor";
}

export function SessionCommIndicators({
  role,
  live,
  latencyMs,
  connectionConnected,
}: {
  role: Role;
  live: SessionLiveState;
  latencyMs: number;
  connectionConnected: boolean;
}) {
  const s: SessionLiveState = live ?? defaultLiveState();
  const q = connectionQualityFromLatency(latencyMs);
  const chips: { key: string; label: string; className: string; show: boolean }[] = [
    {
      key: "eng",
      label: "Engineer talking",
      show: role === "artist" && s.engineerPtt,
      className: "border-sky-600/50 bg-sky-950/50 text-sky-200",
    },
    {
      key: "art",
      label: "Artist talking",
      show: role === "engineer" && s.artistPtt,
      className: "border-violet-600/50 bg-violet-950/50 text-violet-200",
    },
    {
      key: "mute",
      label: "Artist muted",
      show: role === "engineer" && s.artistMuted,
      className: "border-rose-700/50 bg-rose-950/40 text-rose-200",
    },
    {
      key: "rec",
      label: "Recording",
      show: s.recording,
      className: "border-red-600/60 bg-red-950/50 text-red-200 animate-pulse",
    },
    {
      key: "lat",
      label: q === "poor" ? "Latency high" : q === "fair" ? "Latency elevated" : "Latency OK",
      show: connectionConnected && (q === "fair" || q === "poor"),
      className:
        q === "poor"
          ? "border-amber-600/60 bg-amber-950/50 text-amber-200"
          : "border-amber-700/40 bg-amber-950/30 text-amber-100/90",
    },
    {
      key: "conn",
      label: connectionConnected ? "Link OK" : "Offline",
      show: true,
      className: connectionConnected
        ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200/90"
        : "border-zinc-600 bg-zinc-900 text-zinc-500",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips
        .filter((c) => c.show)
        .map((c) => (
          <span
            key={c.key}
            className={cn(
              "rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-black/20",
              c.className,
            )}
          >
            {c.label}
          </span>
        ))}
    </div>
  );
}
