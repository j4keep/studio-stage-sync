import type { ReactNode } from "react";
import { Maximize2, Mic, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExpandPanelId } from "./useExpandablePanels";
import type { TimerWarningLevel } from "../booking/bookingTypes";
import { formatClock, formatDurationMinutes } from "../booking/bookingTypes";

export function ExpandableShell({
  id,
  title,
  expandId,
  onToggleExpand,
  children,
  className,
}: {
  id: ExpandPanelId;
  title: string;
  expandId: ExpandPanelId | null;
  onToggleExpand: (id: ExpandPanelId) => void;
  children: ReactNode;
  className?: string;
}) {
  const expanded = expandId === id;
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        expanded && "fixed inset-0 z-[100] bg-[#121212] p-3",
        !expanded && className,
      )}
    >
      <ExpandPanelBar
        title={title}
        panelId={id}
        expandId={expandId}
        onToggle={() => onToggleExpand(id)}
        onDoubleClick={() => onToggleExpand(id)}
      />
      <div
        className="min-h-0 flex-1 overflow-auto"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button,a,input,textarea,select,[role='slider']")) return;
          onToggleExpand(id);
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ExpandPanelBar({
  title,
  panelId,
  expandId,
  onToggle,
  onDoubleClick,
  className,
}: {
  title: string;
  panelId: ExpandPanelId;
  expandId: ExpandPanelId | null;
  onToggle: () => void;
  onDoubleClick?: () => void;
  className?: string;
}) {
  const expanded = expandId === panelId;
  return (
    <div
      className={cn("mb-1 flex items-center justify-between gap-2", className)}
      onDoubleClick={onDoubleClick ?? onToggle}
    >
      <span className="truncate text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">{title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        title="Expand or exit (Esc)"
      >
        {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        {expanded ? "Exit" : "Expand"}
      </button>
    </div>
  );
}

/** When a panel is expanded, hide non-expanded main chrome rows (optional use). */
export function panelHiddenByPeerExpand(expandId: ExpandPanelId | null, selfId: ExpandPanelId): boolean {
  return expandId !== null && expandId !== selfId;
}

export function FloatingSessionDock({
  visible,
  onExitExpand,
  timerCompact,
  talkbackLabel,
  talkbackActive,
  onTalkDown,
  onTalkUp,
  talkDisabled,
}: {
  visible: boolean;
  onExitExpand: () => void;
  timerCompact: {
    remainingSeconds: number;
    totalBookedMinutes: number;
    warningLevel: TimerWarningLevel;
  } | null;
  talkbackLabel: string;
  talkbackActive: boolean;
  onTalkDown: () => void;
  onTalkUp: () => void;
  talkDisabled?: boolean;
}) {
  if (!visible) return null;
  const w = timerCompact?.warningLevel;
  return (
    <div className="pointer-events-auto fixed bottom-4 left-1/2 z-[120] flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur-md">
      {timerCompact ? (
        <div
          className={cn(
            "flex items-center gap-2 border-r border-zinc-700 pr-3 font-mono text-[11px] tabular-nums",
            w === "critical" && "text-red-300",
            w === "warning" && "text-amber-200",
            w === "caution" && "text-amber-100",
            w === "ok" && "text-zinc-200",
          )}
        >
          <span className="text-[9px] font-semibold uppercase text-zinc-500">Timer</span>
          {formatClock(timerCompact.remainingSeconds)}
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{formatDurationMinutes(timerCompact.totalBookedMinutes)}</span>
        </div>
      ) : null}
      <button
        type="button"
        disabled={talkDisabled}
        onPointerDown={(e) => {
          e.preventDefault();
          onTalkDown();
        }}
        onPointerUp={onTalkUp}
        onPointerLeave={onTalkUp}
        className={cn(
          "rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wide select-none touch-manipulation",
          talkbackActive
            ? "border-sky-500/70 bg-sky-900/50 text-sky-100"
            : "border-zinc-600 bg-zinc-800 text-zinc-300",
          talkDisabled && "opacity-40",
        )}
      >
        <Mic className="mb-0.5 inline h-3.5 w-3.5 opacity-70" aria-hidden />
        <br />
        Hold — {talkbackLabel}
      </button>
      <button
        type="button"
        onClick={onExitExpand}
        className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-[9px] font-semibold uppercase text-amber-100"
      >
        Exit full screen
      </button>
    </div>
  );
}
