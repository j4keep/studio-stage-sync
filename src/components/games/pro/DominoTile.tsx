import { cn } from "@/lib/utils";

type Props = {
  tile?: [number, number];
  faceDown?: boolean;
  orientation?: "vertical" | "horizontal";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const DIMS = {
  sm: { w: 26, h: 52, pip: 3.5, gap: 1 },
  md: { w: 40, h: 80, pip: 5, gap: 2 },
  lg: { w: 52, h: 104, pip: 6.5, gap: 2 },
} as const;

function Half({ value, pip }: { value: number; pip: number }) {
  return (
    <div className="relative flex-1">
      {PIPS[value]?.map(([r, c], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-neutral-900/90"
          style={{
            width: pip,
            height: pip,
            left: `${[22, 50, 78][c]}%`,
            top: `${[22, 50, 78][r]}%`,
            transform: "translate(-50%,-50%)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.35)",
          }}
        />
      ))}
    </div>
  );
}

export default function DominoTile({
  tile,
  faceDown,
  orientation = "vertical",
  size = "md",
  glow,
  dim,
  selected,
  onClick,
  className,
}: Props) {
  const d = DIMS[size];
  const vertical = orientation === "vertical";
  const w = vertical ? d.w : d.h;
  const h = vertical ? d.h : d.w;

  const body = faceDown ? (
    <div
      className="flex h-full w-full items-center justify-center rounded-[7px]"
      style={{
        background: "linear-gradient(155deg, hsl(260 25% 16%), hsl(258 30% 10%))",
        boxShadow: "inset 0 1px 0 hsl(266 80% 70% / 0.25), inset 0 -2px 4px rgba(0,0,0,0.6)",
      }}
    >
      <span className="text-[9px] font-black tracking-[0.14em] text-primary/70">YAJ</span>
    </div>
  ) : (
    <div
      className={cn("flex h-full w-full rounded-[7px]", vertical ? "flex-col" : "flex-row")}
      style={{
        background: "linear-gradient(160deg, #fbf7ee 0%, #efe7d6 55%, #e2d8c3 100%)",
        boxShadow:
          "inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -2px 3px rgba(120,100,70,0.25)",
        padding: d.gap,
      }}
    >
      <Half value={tile?.[0] ?? 0} pip={d.pip} />
      <div
        className={cn("relative shrink-0", vertical ? "h-[2px] w-full" : "h-full w-[2px]")}
        style={{ background: "rgba(120,100,70,0.35)" }}
      >
        <span
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: d.pip + 1,
            height: d.pip + 1,
            transform: "translate(-50%,-50%)",
            background: "radial-gradient(circle at 35% 30%, #d8b45f, #8e6d1f)",
          }}
        />
      </div>
      <Half value={tile?.[1] ?? 0} pip={d.pip} />
    </div>
  );

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "shrink-0 rounded-lg p-[2px] transition-all duration-200",
        onClick && "active:scale-95",
        dim && "opacity-45 saturate-50",
        selected && "-translate-y-2",
        className,
      )}
      style={{
        width: w + 4,
        height: h + 4,
        background: glow
          ? "linear-gradient(180deg, hsl(var(--primary) / 0.9), hsl(var(--primary) / 0.4))"
          : "rgba(0,0,0,0.35)",
        boxShadow: glow
          ? "0 0 14px hsl(var(--primary) / 0.55), 0 6px 12px rgba(0,0,0,0.45)"
          : "0 5px 10px rgba(0,0,0,0.45)",
      }}
    >
      {body}
    </Comp>
  );
}
