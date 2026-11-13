import { useEffect, useMemo, useState } from "react";

type Props = { description: string; onUseBudget?: (low: number, high: number) => void };
type ParsedVehicle = { year: number | null; make: string; model: string; backup: boolean; touchscreen: boolean };

export function parseVehicleAudioJob(text: string): ParsedVehicle {
  const year = text.match(/\b(19\d{2}|20\d{2})\b/);
  const backup = /(?:back[ -]?up|rear[ -]?view|reverse)\s*(?:camera|cam)|(?:camera|cam)\s*(?:back[ -]?up|rear)/i.test(text);
  const touchscreen = /touch\s*screen|carplay|android auto|display|video receiver|navigation/i.test(text);
  const make = /\bhonda\b/i.test(text) ? "Honda" : /\btoyota\b/i.test(text) ? "Toyota" :
    /\bford\b/i.test(text) ? "Ford" : /\bchevrolet|chevy\b/i.test(text) ? "Chevrolet" : "";
  const model = /\baccord\b/i.test(text) ? "Accord" : /\bcivic\b/i.test(text) ? "Civic" :
    /\bcamry\b/i.test(text) ? "Camry" : "";
  return { year: year ? Number(year[1]) : null, make, model, backup, touchscreen };
}

const USD = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/** Published national service prices are examples, NOT live quotes or vehicle fitment.
 * Source: https://www.bestbuy.com/site/services/car-electronics-professional-installation/pcmcat59600050005.c?id=pcmcat59600050005
 */
export default function CarAudioEstimate({ description, onUseBudget }: Props) {
  const parsed = useMemo(() => parseVehicleAudioJob(description), [description]);
  const [touchscreen, setTouchscreen] = useState(parsed.touchscreen);
  const [camera, setCamera] = useState(parsed.backup);
  const [deckPrice, setDeckPrice] = useState("");
  const [cameraPrice, setCameraPrice] = useState("");
  const [fitParts, setFitParts] = useState("");
  const [extraLabor, setExtraLabor] = useState("");
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    setTouchscreen(parsed.touchscreen);
    setCamera(parsed.backup);
    setReviewed(false);
  }, [parsed.touchscreen, parsed.backup, description]);

  const standardLabor = touchscreen ? 149.99 : 99.99;
  const cameraLabor = camera ? 149.99 : 0;
  const laborBenchmark = standardLabor + cameraLabor;
  const numberOrNull = (value: string) => value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const prices = [deckPrice, fitParts, extraLabor, ...(camera ? [cameraPrice] : [])].map(numberOrNull);
  const complete = prices.every(v => v !== null);
  const total = complete ? laborBenchmark + prices.reduce<number>((sum, price) => sum + (price ?? 0), 0) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-primary/30 bg-card p-3">
      <div>
        <h3 className="text-sm font-bold">Car stereo & backup camera — job-specific estimate</h3>
        <p className="text-xs text-muted-foreground">
          {parsed.year ? parsed.year : "Year not provided"} {parsed.make} {parsed.model}
          {" "}— no square footage required. Vehicle trim, factory amplifier, head unit, dash kit,
          wiring adapters, controls and camera routing can change the cost.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={touchscreen} onChange={e => { setTouchscreen(e.target.checked); setReviewed(false); }} /> Touchscreen receiver</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={camera} onChange={e => { setCamera(e.target.checked); setReviewed(false); }} /> Add rear backup camera</label>
      </div>
      <div className="rounded-lg bg-muted p-3 text-xs">
        <p className="font-semibold">Published national installation-price benchmarks (labor only)</p>
        <p>Car stereo installation: {USD(standardLabor)}</p>
        {camera && <p>Backup camera installation: {USD(cameraLabor)}</p>}
        <p className="font-bold">Combined labor benchmark: {USD(laborBenchmark)}</p>
        <p className="mt-2 text-muted-foreground">
          These are advertised Best Buy service prices, not a live YAJ supplier quote.
          Special vehicles and extra work can cost more. Parts are not included.
        </p>
        <a className="underline text-primary" target="_blank" rel="noopener noreferrer"
          href="https://www.bestbuy.com/site/services/car-electronics-professional-installation/pcmcat59600050005.c?id=pcmcat59600050005">
          View published installation pricing
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {([
          ["Receiver/head unit", deckPrice, setDeckPrice],
          ["Dash kit, harness and adapters", fitParts, setFitParts],
          ["Extra labor / integration", extraLabor, setExtraLabor],
          ...(camera ? [["Backup camera hardware", cameraPrice, setCameraPrice]] : []),
        ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
          <label key={label} className="space-y-1">
            <span className="block min-h-8 font-semibold">{label} ($)</span>
            <input type="number" min="0" step="0.01" placeholder="Enter price or 0"
              value={value} onChange={e => { setter(e.target.value); setReviewed(false); }}
              className="w-full rounded-lg border border-border bg-background p-2"/>
          </label>
        ))}
      </div>
      {parsed.year && parsed.year >= 2018 && (
        <p className="text-xs text-muted-foreground">Modern factory electronics may require specialized integration modules or may not allow a direct head-unit replacement. Confirm exact year, make, model, trim and equipment before pricing.</p>
      )}
      <p className="text-xs font-medium">
        {total !== null ? `Preliminary benchmark-based total: ${USD(total)} (before taxes)` :
          "Labor benchmark above; full total is unavailable until actual hardware and fitment costs are entered."}
      </p>
      {onUseBudget && total !== null && (
        <>
          <label className="flex gap-2 text-xs">
            <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />
            I reviewed vehicle fitment and entered current hardware and additional labor prices.
          </label>
          <button type="button" disabled={!reviewed} onClick={() => onUseBudget(Math.floor(total * .9), Math.ceil(total * 1.25))}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
            Use reviewed planning range
          </button>
        </>
      )}
    </section>
  );
}
