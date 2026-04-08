import type { ConnectionState } from "./connectionTypes";

const COPY: Record<ConnectionState, { label: string; className: string }> = {
  disconnected: { label: "Disconnected", className: "bg-zinc-700 text-zinc-200 border-zinc-600" },
  connecting: { label: "Connecting…", className: "bg-amber-900/80 text-amber-100 border-amber-700" },
  connected: { label: "Connected", className: "bg-emerald-900/80 text-emerald-100 border-emerald-700" },
  degraded: { label: "Degraded", className: "bg-orange-900/80 text-orange-100 border-orange-700" },
};

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const c = COPY[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${c.className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-90" aria-hidden />
      {c.label}
    </span>
  );
}
