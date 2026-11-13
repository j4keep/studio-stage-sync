import { useEffect, useMemo, useState } from "react";

type Props = { description: string; onUseBudget?: (low: number, high: number) => void };
type Scope = "whole" | "vents";
export function parseDuctCleaningJob(text: string) {
  const n = text.match(/(?:\b(\d{1,2})\s*(?:air\s*)?(?:vents?|registers?)\b|\b(?:vents?|registers?)\s*[:=]?\s*(\d{1,2})\b)/i);
  const vents = n ? Number(n[1] || n[2]) : null;
  return { vents: vents && vents > 0 && vents <= 80 ? vents : null };
}

const usd = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD", maximumFractionDigits:0}).format(n);

export default function DuctCleaningEstimate({ description, onUseBudget }: Props) {
  const detected = useMemo(() => parseDuctCleaningJob(description), [description]);
  const [scope, setScope] = useState<Scope>(detected.vents ? "vents" : "whole");
  const [vents, setVents] = useState(String(detected.vents ?? ""));
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { setScope(detected.vents ? "vents" : "whole"); setVents(String(detected.vents ?? "")); setConfirmed(false); }, [description, detected.vents]);
  const count = Number(vents);
  const valid = scope === "whole" || (Number.isInteger(count) && count > 0 && count <= 80);
  const range = !valid ? null : scope === "whole"
    ? { min: 271, max: 509 }
    : { min: count * 25, max: count * 50 };
  return <section className="space-y-3 rounded-xl border border-emerald-500/30 bg-card p-3 text-sm">
    <div className="font-bold">Air duct / vent cleaning estimate</div>
    <p className="text-xs text-muted-foreground">National planning benchmark, not a local quote. Select what you want cleaned.</p>
    <label className="block text-xs font-semibold">Job size
      <select value={scope} onChange={e => {setScope(e.target.value as Scope); setConfirmed(false);}}
        className="mt-1 w-full rounded-lg border border-border bg-background p-3">
        <option value="whole">Whole-home duct system</option>
        <option value="vents">Individual vents only</option>
      </select>
    </label>
    {scope === "vents" && <label className="block text-xs font-semibold">Number of vents
      <input type="number" min="1" max="80" value={vents} onChange={e => {setVents(e.target.value); setConfirmed(false);}}
        className="mt-1 w-full rounded-lg border border-border bg-background p-3" placeholder="e.g. 8"/>
    </label>}
    {range ? <div className="rounded-xl bg-emerald-500/10 p-3">
      <p className="text-xs">Estimated national price range</p>
      <p className="text-xl font-bold">{usd(range.min)}–{usd(range.max)}</p>
      <p className="text-xs text-muted-foreground">Actual pricing varies by location, number of systems, duct accessibility, and whether cleaning includes the full HVAC system.</p>
    </div> : <p className="text-xs text-destructive">Enter how many vents need cleaning.</p>}
    <p className="text-xs text-muted-foreground">
      Based on Angi's October 2026 published national estimates ($271–$509 whole-system and $25–$50 per vent).
      <a className="ml-1 underline text-primary" href="https://www.angi.com/articles/how-much-does-air-duct-cleaning-cost.htm" target="_blank" rel="noopener noreferrer">Price source</a>.
      Does not include repairs, mold remediation or additional equipment.
    </p>
    {range && onUseBudget && <>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
        Use this unverified national range as my optional planning budget.
      </label>
      <button type="button" disabled={!confirmed} onClick={()=>onUseBudget(range.min,range.max)}
        className="w-full rounded-lg bg-primary p-3 text-sm font-bold text-primary-foreground disabled:opacity-40">Use budget range</button>
    </>}
  </section>;
}
