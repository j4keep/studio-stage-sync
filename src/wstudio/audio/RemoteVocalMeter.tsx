/** Simple peak-style meter for remote artist level (UI only; wire to RTC stats later). */
export function RemoteVocalMeter({ level }: { level: number }) {
  const pct = Math.min(100, Math.max(0, level * 100));
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        <span>Remote vocal</span>
        <span className="tabular-nums text-zinc-300">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-700 via-amber-500 to-rose-600 transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
