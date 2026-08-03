import { createPortal } from "react-dom";
import { Eye, EyeOff, MonitorUp, X } from "lucide-react";

type Props = {
  open: boolean;
  preview: MediaStream | null;
  broadcasting: boolean;
  onShow: () => void;
  onPause: () => void;
  onStop: () => void;
};

/**
 * Incognito-style privacy curtain while a competitor shares their screen.
 * Crowd sees nothing until they tap “Show to crowd”.
 */
export default function BattleScreenSharePrivacy({
  open,
  preview,
  broadcasting,
  onShow,
  onPause,
  onStop,
}: Props) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#050508] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 20% 0%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(236,72,153,0.16), transparent 50%)",
        }}
      />

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/90">
            Private preview
          </p>
          <h2
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Screen share
          </h2>
        </div>
        <button
          type="button"
          onClick={onStop}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
          aria-label="Stop screen share"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 mx-4 mt-1 flex-1 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-[0_0_50px_-18px_rgba(34,211,238,0.45)]">
        {preview ? (
          <video
            ref={(el) => {
              if (!el) return;
              if (el.srcObject !== preview) el.srcObject = preview;
              void el.play().catch(() => undefined);
            }}
            muted
            playsInline
            autoPlay
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/50">
            <MonitorUp className="h-10 w-10" />
            <p className="text-sm font-bold">Waiting for screen…</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 py-3">
          <p className="text-center text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
            {broadcasting
              ? "Live to the crowd"
              : "Crowd cannot see this yet"}
          </p>
        </div>
      </div>

      <div className="relative z-10 space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        <p className="text-center text-xs font-medium text-white/55">
          {broadcasting
            ? "Pause anytime before switching tabs or opening something private."
            : "Line up what you want to show, then unpause for the crowd."}
        </p>
        <div className="flex items-center justify-center gap-2">
          {broadcasting ? (
            <button
              type="button"
              onClick={onPause}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-3 text-sm font-black text-black"
            >
              <EyeOff className="h-4 w-4" /> Pause for crowd
            </button>
          ) : (
            <button
              type="button"
              onClick={onShow}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-3 text-sm font-black text-black"
            >
              <Eye className="h-4 w-4" /> Show to crowd
            </button>
          )}
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/20"
          >
            Stop
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
