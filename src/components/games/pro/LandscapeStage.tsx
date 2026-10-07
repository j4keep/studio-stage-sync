import { ReactNode, useEffect, useState } from "react";
import { ArrowLeft, RotateCw, Smartphone } from "lucide-react";

type Props = {
  /** Rendered inside a full-screen landscape stage. */
  children: ReactNode;
  title?: string;
  onExit?: () => void;
  /** No "Play widescreen" tab and no portrait fallback — just ask the user to physically
   *  rotate their phone, then render fullscreen the instant the device is landscape. */
  auto?: boolean;
};

/**
 * Presents its children in a landscape (widescreen) stage.
 * - Device already landscape: renders full-screen as-is.
 * - Portrait (default): shows a "Play widescreen" tab. Tapping it requests fullscreen +
 *   an orientation lock, and — on browsers that ignore the lock (iOS Safari) —
 *   rotates the stage 90° so the table still fills the long side of the screen. (That CSS
 *   rotation only reads correctly once the user also physically turns the phone to match —
 *   it's a deliberate "turn to align" affordance behind an explicit tap.)
 * - Portrait with `auto`: no tap, no CSS-rotation trick — just a "rotate your phone"
 *   prompt, since faking landscape before the user turns the device just renders sideways.
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

  if (auto && portrait && !rotated) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-black px-8 text-center">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-black text-white active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" /> Exit
          </button>
        )}

        <div className="flex max-w-xs flex-col items-center">
          <RotateCw className="h-10 w-10 text-primary" />
          <p className="mt-5 text-lg font-black text-white">Play in widescreen</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            {title} is designed for landscape play.
          </p>

          <button
            type="button"
            onClick={goWide}
            className="mt-6 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-lg active:scale-95"
          >
            <Smartphone className="h-4 w-4 rotate-90" />
            Play Widescreen
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            If your phone does not rotate automatically, turn it sideways after tapping.
          </p>
        </div>
      </div>
    );
  }

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
          <button
            type="button"
            onClick={exitWide}
            aria-label="Exit widescreen"
            className="absolute right-2 top-2 z-[60] rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black text-white/80"
          >
            Exit widescreen
          </button>
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
