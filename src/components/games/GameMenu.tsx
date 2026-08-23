import { ReactNode, useState } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";

export type GameMenuAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Shows the row in an "on" state — e.g. Mute after it's been toggled on. */
  active?: boolean;
  /** Renders the row in red — reserved for Quit Game. */
  destructive?: boolean;
};

type Props = {
  actions: GameMenuAction[];
  /** Anything else to embed as its own row inside the open menu — e.g. GameLiveDock, which
   *  already owns its own trigger + sub-panel, so it's dropped in as-is rather than
   *  reimplemented as a plain action. */
  extra?: ReactNode;
  /** Positions the trigger button itself; defaults to a small round icon-button look
   *  matching every game's existing back/mute/quit buttons. */
  triggerClassName?: string;
  /** Which edge the dropdown panel hangs from — "right" (default) for triggers placed near
   *  the right side of the screen, "left" for triggers placed near the left (e.g. Tower
   *  Escape's top-left menu) so the panel doesn't render off-screen. */
  align?: "left" | "right";
};

/**
 * One "..." trigger that replaces a whole row of separate icon buttons (back, mute, pause,
 * quit, how-to-play, customize, go live) with a single dropdown — the same interaction
 * pattern GameLiveDock already uses for its own sub-menu, just generalized so every game's
 * header collapses to one control instead of four or five crowding the screen.
 */
export default function GameMenu({ actions, extra, triggerClassName, align = "right" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    // pointer-events-auto is required here, not just on the trigger: every HUD that renders
    // this wraps it in a `pointer-events-none` overlay (so clicks pass through to the game
    // underneath everywhere else), and `pointer-events` inherits — so without this, the
    // trigger button was clickable but the open panel's own action buttons silently were not.
    <div className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Game menu"
        aria-expanded={open}
        className={triggerClassName ?? "flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-2 text-white backdrop-blur-sm active:scale-95"}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`absolute top-full z-40 mt-2 flex w-52 flex-col gap-1 rounded-2xl border border-white/15 bg-black/90 p-2 shadow-xl backdrop-blur-xl ${
              align === "left" ? "left-0" : "right-0"
            }`}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-black transition active:scale-[0.98] ${
                  a.destructive
                    ? "text-rose-300 hover:bg-rose-500/15"
                    : a.active
                      ? "bg-white/15 text-white"
                      : "text-white/90 hover:bg-white/10"
                }`}
              >
                <a.icon className="h-4 w-4 shrink-0" />
                {a.label}
              </button>
            ))}
            {extra}
          </div>
        </>
      )}
    </div>
  );
}
