import { useEffect, useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { TowerInput } from "@/lib/tower-escape/engine";

type Props = {
  /** Mutable input the engine reads each frame — no React state in the hot path. */
  input: React.MutableRefObject<TowerInput>;
  onJump: () => void;
};

/**
 * Mobile controls: move left / right, jump, climb up, drop down.
 * Keyboard (WASD / arrows / space) is wired in the same place so desktop feels native.
 */
export default function TowerControls({ input, onJump }: Props) {
  const held = useRef<Set<string>>(new Set());

  useEffect(() => {
    const map: Record<string, keyof TowerInput> = {
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      " ": "jump",
      z: "jump",
      Z: "jump",
    };
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      if (k === "jump" && !input.current.jump) onJump();
      input.current[k] = true;
      held.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k) return;
      input.current[k] = false;
      held.current.delete(e.key);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [input, onJump]);

  const bind = (key: keyof TowerInput, fire?: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      input.current[key] = true;
      fire?.();
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      input.current[key] = false;
    },
    onPointerCancel: () => {
      input.current[key] = false;
    },
    onPointerLeave: () => {
      input.current[key] = false;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const pad =
    "flex items-center justify-center rounded-2xl border border-white/20 bg-black/45 text-white backdrop-blur-md active:scale-95 active:bg-primary/70 transition select-none touch-none";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 select-none pb-5 pl-4 pr-4">
      <div className="flex items-end justify-between">
        <div className="pointer-events-auto flex items-end gap-2">
          <button type="button" aria-label="Move left" className={`${pad} h-16 w-16`} {...bind("left")}>
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button type="button" aria-label="Move right" className={`${pad} h-16 w-16`} {...bind("right")}>
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>

        <div className="pointer-events-auto flex items-end gap-2">
          <div className="flex flex-col gap-2">
            <button type="button" aria-label="Climb up" className={`${pad} h-12 w-12`} {...bind("up")}>
              <ChevronUp className="h-6 w-6" />
            </button>
            <button type="button" aria-label="Drop down" className={`${pad} h-12 w-12`} {...bind("down")}>
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>
          <button
            type="button"
            aria-label="Jump"
            className={`${pad} h-16 w-16 border-primary/60 bg-primary/35 text-[13px] font-black uppercase tracking-wide`}
            {...bind("jump", onJump)}
          >
            Jump
          </button>
        </div>
      </div>
    </div>
  );
}
