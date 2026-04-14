export function BridgeOutputRouting({
  vocalPathReady,
  routed,
  routingError,
}: {
  vocalPathReady: boolean;
  routed: boolean;
  routingError: string | null;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        Output routing · bridge out
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={routed && vocalPathReady ? "inline-flex h-2 w-2 rounded-full bg-emerald-400" : "inline-flex h-2 w-2 rounded-full bg-zinc-600"}
          aria-hidden
        />
        <span className={routed && vocalPathReady ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
          {routed && vocalPathReady ? "Playing to default output" : "Not routing"}
        </span>
      </div>

      {routingError && <p className="text-xs text-red-400/90">{routingError}</p>}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Bridge audio plays to your browser's default output. Use a macOS Multi-Output Device
        (Speakers + BlackHole) so your DAW records while you monitor.
      </p>
    </section>
  );
}
