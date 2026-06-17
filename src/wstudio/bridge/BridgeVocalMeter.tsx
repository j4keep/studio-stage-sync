export function BridgeVocalMeter({
  level,
  label,
  description,
}: {
  level: number;
  label: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</div>
          <p className="mt-0.5 text-[11px] text-zinc-500">{description}</p>
        </div>
        <span className="font-mono text-xs text-zinc-400 tabular-nums">{Math.round(level * 100)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-800 via-amber-500 to-red-500 transition-[width] duration-75"
          style={{ width: `${Math.round(Math.min(1, level) * 100)}%` }}
        />
      </div>
    </section>
  );
}
