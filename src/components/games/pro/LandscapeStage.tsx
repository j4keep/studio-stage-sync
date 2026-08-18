import { ReactNode, useEffect, useState } from "react";
import { RotateCw, Smartphone } from "lucide-react";

type Props = {
  /** Rendered inside a full-screen landscape stage. */
  children: ReactNode;
  title?: string;
  onExit?: () => void;
  /** Skip the "Play widescreen" prompt — auto-rotate into landscape immediately,
   *  with no portrait option and no exit button covering the game's own UI. */
  auto?: boolean;
};

/**
 * Presents its children in a landscape (widescreen) stage.
 * - Device already landscape: renders full-screen as-is.
 * - Portrait (default): shows a "Play widescreen" tab. Tapping it requests fullscreen +
 *   an orientation lock, and — on browsers that ignore the lock (iOS Safari) —
 *   rotates the stage 90° so the table still fills the long side of the screen.
 * - Portrait with `auto`: skips the tab entirely and rotates immediately — this game
 *   only exists in widescreen.
 */
export default function LandscapeStage({ children, title = "Widescreen table", onExit, auto = false }: Props) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const portrait = size.h > size.w;

  useEffect(() => {
    if (!portrait) setRotated(false);
  }, [portrait]);

  const goWide = async () => {
    try {
      const el = document.documentElement as any;
      if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
      const so = (screen as any).orientation;
      if (so?.lock) {
        await so.lock("landscape");
        return; // real orientation change will flip us to landscape
      }
    } catch {
      /* fall through to the CSS rotation */
    }
    setRotated(true);
  };

  const exitWide = () => {
    setRotated(false);
    try {
      (screen as any).orientation?.unlock?.();
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
      /* ignore */
    }
  };

  // Auto mode: rotate immediately, no prompt to accept/decline.
  useEffect(() => {
    if (auto && portrait && !rotated) void goWide();
  }, [auto, portrait, rotated]);

  if (portrait && !rotated && !auto) {
    return (
      <div className="fixed inset-0 z-[100] w-full overflow-hidden bg-black">
        {children}
        <button
          type="button"
          onClick={goWide}
          className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/50 bg-primary px-5 py-3 text-xs font-black text-primary-foreground shadow-lg active:scale-95"
        >
          <RotateCw className="h-4 w-4" />
          Play widescreen
          <Smartphone className="h-4 w-4 rotate-90" />
        </button>
      </div>
    );
  }

  if (portrait && !rotated && auto) {
    // Waiting on the fullscreen/orientation-lock request from the effect above to resolve.
    return <div className="fixed inset-0 z-[100] overflow-hidden bg-black" />;
  }

  if (portrait && rotated) {
    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: size.h,
            height: size.w,
            transform: `rotate(90deg) translateY(-${size.w}px)`,
          }}
        >
          {children}
          {!auto && (
            <button
              type="button"
              onClick={exitWide}
              aria-label="Exit widescreen"
              className="absolute right-2 top-2 z-[60] rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black text-white/80"
            >
              Exit widescreen
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black" aria-label={title}>
      {children}
      {onExit ? null : null}
    </div>
  );
}
