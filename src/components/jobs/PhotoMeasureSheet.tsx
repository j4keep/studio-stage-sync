import { useMemo, useState, type MouseEvent } from "react";
import { measureFromPhoto, type ImagePoint } from "@/lib/photo-measurement";

type Props = {
  photo: string;
  onAddMeasurement: (description: string) => void;
};

type MeasurementRole = "length" | "width" | "height" | "depth" | "distance";

export default function PhotoMeasureSheet({ photo, onAddMeasurement }: Props) {
  const [points, setPoints] = useState<ImagePoint[]>([]);
  const [reference, setReference] = useState("");
  const [unit, setUnit] = useState<"in" | "ft">("in");
  const [role, setRole] = useState<MeasurementRole>("length");
  const [added, setAdded] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);

  const possibleResult = useMemo(() => measureFromPhoto(points, Number(reference), aspectRatio), [points, reference, aspectRatio]);
  const result = measuring ? possibleResult : null;
  const validReference = reference.trim().length > 0 && Number.isFinite(Number(reference)) && Number(reference) > 0;

  const mark = (e: MouseEvent<SVGSVGElement>) => {
    if (points.length === 4) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = (e.clientX - bounds.left) / bounds.width;
    const y = (e.clientY - bounds.top) / bounds.height;
    setPoints(prev => [...prev, { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }]);
    setAdded(false);
    setMeasuring(false);
  };

  const save = () => {
    if (!result) return;
    const measurementInches = unit === "ft" ? result.measuredLength * 12 : result.measuredLength;
    const rounded = Math.round(measurementInches * 100) / 100;
    onAddMeasurement(
      `Photo-calibrated approximate ${role}: ${rounded} inches (using ${reference} ${unit} reference; confirm with a tape measure). ` +
      `Measured ${role}: ${rounded} in.`
    );
    setAdded(true);
  };

  const nextStep = [
    "Tap the first end of the reference object.",
    "Tap its second end, then enter its real length.",
    "Tap the first end of the project area.",
    "Tap the second end of the project area.",
    "Enter the reference length and tap Measure to calculate.",
  ][points.length];

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3">
      <div>
        <h3 className="text-sm font-bold">YAJ Smart Measure — calibrated photo</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Put a ruler, measuring tape, or another object of known length beside the project,
          on the <strong>same flat surface and at the same distance</strong> from the camera.
          Tap both ends of the reference, then both ends of the area to measure.
        </p>
      </div>
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <img src={photo} alt="Project to measure" onLoad={e => { const img = e.currentTarget; if (img.naturalHeight > 0) setAspectRatio(img.naturalWidth / img.naturalHeight); }} className="block h-auto w-full select-none" draggable={false} />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={mark}
          role="button"
          aria-label={nextStep}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-manipulation"
        >
          {points.length > 1 && (
            <line x1={points[0].x * 100} y1={points[0].y * 100} x2={points[1].x * 100} y2={points[1].y * 100}
              stroke="#fbbf24" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          )}
          {points.length > 3 && (
            <line x1={points[2].x * 100} y1={points[2].y * 100} x2={points[3].x * 100} y2={points[3].y * 100}
              stroke="#22d3ee" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          )}
          {points.map((p, i) => (
            <circle key={i} cx={p.x * 100} cy={p.y * 100} r="1.2" fill={i < 2 ? "#fbbf24" : "#22d3ee"}
              stroke="#111827" strokeWidth="0.25" />
          ))}
        </svg>
      </div>
      <p className="text-xs font-semibold" aria-live="polite">{nextStep}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => { setPoints([]); setAdded(false); setMeasuring(false); }}>Reset points</button>
        {points.length > 0 && <button type="button" className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => { setPoints(p => p.slice(0, -1)); setAdded(false); setMeasuring(false); }}>Undo last point</button>}
        <button type="button" disabled={points.length !== 4 || !validReference}
          onClick={() => { setMeasuring(true); setAdded(false); }}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
          Measure
        </button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {points.length}/4 points marked. First two define the known reference; the next two define the target.
        {points.length === 4 && !validReference ? " Enter the real reference length to enable Measure." : ""}
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <label className="space-y-1">
          <span className="block font-semibold">Real reference length</span>
          <input type="number" value={reference} min="0.01" step="any" onChange={e => { setReference(e.target.value); setAdded(false); setMeasuring(false); }}
            placeholder="e.g. 12" className="w-full rounded-lg border border-border bg-background p-2" />
        </label>
        <label className="space-y-1">
          <span className="block font-semibold">Reference units</span>
          <select value={unit} onChange={e => { setUnit(e.target.value as "in" | "ft"); setAdded(false); setMeasuring(false); }}
            className="w-full rounded-lg border border-border bg-background p-2">
            <option value="in">inches</option>
            <option value="ft">feet</option>
          </select>
        </label>
        <label className="col-span-2 space-y-1">
          <span className="block font-semibold">What are you measuring?</span>
          <select value={role} onChange={e => { setRole(e.target.value as MeasurementRole); setAdded(false); }}
            className="w-full rounded-lg border border-border bg-background p-2">
            <option value="length">Length</option>
            <option value="width">Width</option>
            <option value="height">Height</option>
            <option value="depth">Depth (only if reference is on same plane)</option>
            <option value="distance">Other distance</option>
          </select>
        </label>
      </div>
      {result ? (
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <p className="text-base font-bold">Approx. {role}: {result.measuredLength} {unit}</p>
          <p className="text-xs">Photo-calibrated estimate; perspective, lens distortion, point placement and uneven surfaces can cause substantial error. Not a survey, area scan, or structural measurement.</p>
          <button type="button" disabled={added} onClick={save}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
            {added ? "Added to gig description" : "Add approximate measurement to gig description"}
          </button>
        </div>
      ) : <p className="text-xs text-muted-foreground">Mark four points, enter the real reference length, then tap Measure. Two dots alone cannot determine real-world distance without a scale.</p>}
    </section>
  );
}
