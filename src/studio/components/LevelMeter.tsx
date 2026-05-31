import { useEffect, useState } from "react";

export default function LevelMeter({ active = false, label }: { active?: boolean; label?: string }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    const id = window.setInterval(() => {
      setLevel(20 + Math.random() * 70);
    }, 90);
    return () => window.clearInterval(id);
  }, [active]);
  return (
    <div>
      {label && <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-1">{label}</div>}
      <div className="studio-meter-track">
        <div className="studio-meter-fill" style={{ width: `${level}%` }} />
      </div>
    </div>
  );
}
