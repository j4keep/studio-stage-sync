export function LatencyIndicator({ ms }: { ms: number }) {
  if (ms <= 0) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-500">
        Latency: —
      </div>
    );
  }
  const ok = ms <= 40;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs font-medium ${
        ok
          ? "border-emerald-800/70 bg-emerald-950/50 text-emerald-200"
          : "border-amber-800/70 bg-amber-950/40 text-amber-200"
      }`}
      title="Estimated round-trip monitoring latency"
    >
      Latency ~{ms} ms
    </div>
  );
}
