import { useEffect, useMemo, useState } from "react";
import { parseWrittenConcreteMeasurements } from "@/lib/written-repair-measurements";
import {
  calculateConcreteRepair, INITIAL_CONCRETE_REPAIR,
  type ConcreteRepairInputs,
} from "@/lib/repair-estimator";

type Props = {
  /** A parent can use the calculated range as the proposed gig budget. */
  onUseBudget?: (low: number, high: number) => void;
  description?: string;
};

const FIELDS: { key: keyof ConcreteRepairInputs; label: string; unit: string; step?: string }[] = [
  { key: "lengthIn", label: "Repair length", unit: "in" },
  { key: "widthIn", label: "Repair width", unit: "in" },
  { key: "depthIn", label: "Removal / fill depth", unit: "in", step: "0.25" },
  { key: "bagYieldCuFt", label: "Yield per bag (check package)", unit: "cu ft", step: "0.05" },
  { key: "wastePercent", label: "Waste allowance", unit: "%", step: "1" },
  { key: "pricePerBag", label: "Your local price per bag", unit: "$", step: "0.01" },
  { key: "laborHours", label: "Labor hours (estimated)", unit: "hours", step: "0.5" },
  { key: "laborRatePerHour", label: "Local hourly labor rate", unit: "$/hr", step: "1" },
  { key: "otherMaterialsCost", label: "Prep, bonding, sealer, tools/supplies", unit: "$", step: "0.01" },
  { key: "disposalCost", label: "Disposal / travel / minimum charge", unit: "$", step: "0.01" },
  { key: "taxPercent", label: "Tax on materials (if applicable)", unit: "%", step: "0.1" },
];

const usd = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
}).format(value);

export default function ConcreteRepairEstimate({ onUseBudget, description = "" }: Props) {
  // A photo cannot supply dimensions or current prices. Requiring real inputs
  // prevents the example $258 subtotal from appearing on unrelated projects.
  const [values, setValues] = useState<ConcreteRepairInputs>({
    ...INITIAL_CONCRETE_REPAIR,
    lengthIn: Number.NaN,
    widthIn: Number.NaN,
    depthIn: Number.NaN,
    pricePerBag: Number.NaN,
    laborHours: Number.NaN,
    laborRatePerHour: Number.NaN,
  });
  const [reviewed, setReviewed] = useState(false);
  const parsed = useMemo(() => parseWrittenConcreteMeasurements(description), [description]);
  useEffect(() => {
    // Use stated measurements and prices first. For planning only, offer
    // clearly labelled sample inputs when geometry is supplied. Never turn
    // these examples into an actual contractor/supplier quote.
    const area = parsed.areaSqFt ?? (
      parsed.lengthIn && parsed.widthIn
        ? parsed.lengthIn * parsed.widthIn / 144
        : undefined
    );
    setValues((current) => ({
      ...current,
      ...(parsed.lengthIn !== undefined ? { lengthIn: parsed.lengthIn } : {}),
      ...(parsed.widthIn !== undefined ? { widthIn: parsed.widthIn } : {}),
      depthIn: parsed.depthIn ?? (area && !Number.isFinite(current.depthIn) ? 2 : current.depthIn),
      pricePerBag: parsed.pricePerBag ?? (area && !Number.isFinite(current.pricePerBag) ? 8 : current.pricePerBag),
      laborHours: parsed.laborHours ?? (area && !Number.isFinite(current.laborHours)
        ? Math.max(2, Math.ceil(area / 10)) : current.laborHours),
      laborRatePerHour: parsed.laborRatePerHour ?? (area && !Number.isFinite(current.laborRatePerHour) ? 65 : current.laborRatePerHour),
    }));
    setReviewed(false);
  }, [parsed]);
  const result = useMemo(() => parsed.ambiguity ? null : calculateConcreteRepair(values), [values, parsed.ambiguity]);
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3">
      <div>
        <h3 className="text-sm font-bold">Concrete patch — measured materials & labor</h3>
        <p className="text-xs text-muted-foreground">
          A picture cannot measure depth, volume, structural condition, or local prices.
          Enter actual measurements and supplier/contractor prices below.
        </p>
      </div>
      {(parsed.areaSqFt || parsed.lengthIn || parsed.depthIn) && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs">
          <strong>Read from your written description:</strong>{" "}
          {parsed.areaSqFt ? `${parsed.areaSqFt} sq ft; ` : ""}
          {parsed.lengthIn ? `${parsed.lengthIn} in long; ` : ""}
          {parsed.widthIn ? `${parsed.widthIn} in wide; ` : ""}
          {parsed.depthIn ? `${parsed.depthIn} in deep` : "depth not specified"}.
          {" "}Check and correct the values before using the total.
        </p>
      )}
      {parsed.ambiguity && <p role="alert" className="text-xs text-destructive">{parsed.ambiguity}</p>}
      {(parsed.areaSqFt || (parsed.lengthIn && parsed.widthIn)) && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          <strong>Provisional example, not a local quote:</strong>{" "}
          {parsed.depthIn == null ? "2-inch depth assumed; " : ""}
          {parsed.pricePerBag == null ? "$8/bag assumed; " : ""}
          {parsed.laborHours == null ? "labor hours based on a rough area allowance; " : ""}
          {parsed.laborRatePerHour == null ? "$65/hour assumed. " : ""}
          Review all assumptions, actual thickness, materials and local rates before posting a budget.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(({ key, label, unit, step }) => (
          <label key={key} className="text-xs">
            <span className="block min-h-8 font-medium">{label} ({unit})</span>
            <input
              aria-label={label}
              type="number"
              min="0"
              step={step || "1"}
              value={Number.isFinite(values[key]) ? values[key] : ""}
              placeholder={key === "lengthIn" || key === "widthIn" || key === "depthIn" ? "Measure first" : key === "pricePerBag" || key === "laborRatePerHour" ? "Local quote" : key === "laborHours" ? "Estimate hours" : undefined}
              onChange={(e) => {
                const next = e.target.value === "" ? Number.NaN : Number(e.target.value);
                setValues((v) => ({ ...v, [key]: next }));
                setReviewed(false);
              }}
              className="h-10 w-full rounded-lg border border-border bg-background px-2"
            />
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        When a written description includes dimensions, a preliminary total can use clearly identified example prices and labor assumptions. Replace them with actual supplier and contractor rates.
        The initial 0.6 cu ft/bag yield and optional supply/disposal allowances are examples only; verify or replace them for the selected product and job.
      </p>
      {!result ? <p role="alert" className="text-xs text-destructive">Include square footage or length × width in your description, or enter measured dimensions here. The calculation needs dimensions and cannot use a photo alone.</p> : (
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3">
            <p>Calculated fill volume: <strong>{result.volumeCuFt} cu ft</strong></p>
            <p>Including waste: <strong>{result.volumeWithWasteCuFt} cu ft</strong></p>
            <p>Whole bags required: <strong>{result.bagCount}</strong></p>
            <p>Bagged mix: <strong>{usd(result.concreteCost)}</strong></p>
            <p>Materials & supplies: <strong>{usd(result.materialsCost)}</strong></p>
            <p>Labor: <strong>{usd(result.laborCost)}</strong></p>
            <p>Travel/disposal: <strong>{usd(result.disposalCost)}</strong></p>
            <p>Materials tax: <strong>{usd(result.taxCost)}</strong></p>
          </div>
          <p className="text-base font-bold">Planning subtotal: {usd(result.estimatedTotal)}</p>
          <p className="font-semibold">Illustrative allowance: {usd(result.planningLow)}–{usd(result.planningHigh)}</p>
          <p className="text-muted-foreground">
            The allowance is a simple -20%/+30% planning band, not a confidence interval or guaranteed price.
            Structural cracks, recurring movement, large spalls, reinforcing steel, unsafe surfaces,
            permits and site conditions need an on-site inspection.
          </p>
          {onUseBudget && (
            <label className="flex items-start gap-2 rounded-lg border border-border p-2">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              <span>I checked the dimensions, local prices and repair assumptions.</span>
            </label>
          )}
          {onUseBudget && (
            <button
              type="button"
              disabled={!reviewed}
              onClick={() => onUseBudget(Math.floor(result.planningLow), Math.ceil(result.planningHigh))}
              className="rounded-xl bg-primary px-3 py-2 font-bold text-primary-foreground disabled:opacity-50"
            >Use reviewed range as gig budget</button>
          )}
        </div>
      )}
    </section>
  );
}
