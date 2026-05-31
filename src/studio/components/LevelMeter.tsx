/**
 * LevelMeter — renders a real audio level (0..1). No mock animation.
 * If `level` is omitted/<=0 the meter stays at zero.
 */
export default function LevelMeter({
  level = 0,
  active,
  label,
}: {
  /** Normalized 0..1 RMS / peak. */
  level?: number;
  /** Optional. When explicitly `false`, force the meter to zero. */
  active?: boolean;
  label?: string;
}) {
  const clamped = active === false ? 0 : Math.max(0, Math.min(1, level));
  const pct = clamped * 100;
  return (
    <div>
      {label && (
        <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-1 flex items-center justify-between">
          <span>{label}</span>
          <span className="tabular-nums text-[hsl(var(--studio-text-dim))]">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="studio-meter-track">
        <div className="studio-meter-fill transition-[width] duration-75" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
