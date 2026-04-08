import type { ReactNode } from "react";

export function PushControl({
  active,
  onClick,
  children,
  variant = "default",
  disabled,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40";
  const styles =
    variant === "danger"
      ? active
        ? "bg-rose-600 text-white border border-rose-400"
        : "bg-zinc-800 text-zinc-200 border border-zinc-600 hover:bg-zinc-700"
      : active
        ? "bg-violet-600 text-white border border-violet-400"
        : "bg-zinc-800 text-zinc-200 border border-zinc-600 hover:bg-zinc-700";
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}
