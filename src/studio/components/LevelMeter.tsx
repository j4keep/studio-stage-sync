/**
 * LevelMeter — passive meter driven by REAL audio level data only.
 * Pass `level` (0–100). No fake animation. If no real data, bar sits at 0.
 */
export default function LevelMeter({
  level = 0,
  label,
  offlineLabel,
  active = true,
}: {
  level?: number;
  label?: string;
  /** Shown next to the label when active=false to indicate why the meter isn't moving. */
  offlineLabel?: string;
  /** When false the meter is forced to 0 (e.g. transport offline). */
  active?: boolean;
}) {
  const v = Math.max(0, Math.min(100, active ? level : 0));
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">{label}</div>
          {!active && offlineLabel && (
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--studio-text-dim))]">{offlineLabel}</div>
          )}
        </div>
      )}
      <div className="studio-meter-track">
        <div className="studio-meter-fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
