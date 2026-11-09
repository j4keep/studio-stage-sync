import type { GigAiResult } from "@/lib/yaj-jobs-ai";

export default function GigEstimateDetails({ result }: { result: GigAiResult }) {
  const usd = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
      : "Needs local quote";
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3 text-xs">
      <p className="text-sm font-bold">Preliminary AI assessment — not a contractor quote</p>
      {result.observations?.length ? <div><strong>Visible observations:</strong>
        <ul className="list-inside list-disc">{result.observations.map((v, i) => <li key={i}>{v}</li>)}</ul>
      </div> : null}
      <p><strong>Suggested work:</strong> {result.description}</p>
      {result.materials?.length ? (
        <div className="overflow-x-auto">
          <strong>Potential materials and costs</strong>
          <table className="w-full text-left">
            <thead><tr><th>Material</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead>
            <tbody>{result.materials.map((m, i) => <tr key={i} className="border-t border-border">
              <td>{m.name}</td>
              <td>{m.quantity == null ? "Measure first" : `${m.quantity} ${m.unit}`}</td>
              <td>{usd(m.unit_cost)}</td>
              <td>{usd(m.extended_cost)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : null}
      {result.labor ? <p><strong>Labor:</strong> {result.labor.hours_min == null ? "Hours need confirmation" : `${result.labor.hours_min}–${result.labor.hours_max ?? "?"} hours`} · Rate: {usd(result.labor.hourly_rate)} · Subtotal: {usd(result.labor.subtotal_min)}–{usd(result.labor.subtotal_max)}</p> : null}
      {result.measurements_needed?.length ? <div><strong>Measurements needed:</strong>
        <ul className="list-inside list-disc">{result.measurements_needed.map((v,i) => <li key={i}>{v}</li>)}</ul>
      </div> : null}
      {result.assumptions?.length ? <p><strong>Assumptions:</strong> {result.assumptions.join("; ")}</p> : null}
      <p className="font-medium">Pricing basis: {result.cost_basis || "No verified local pricing provided."}</p>
      <p className="text-muted-foreground">Photos and sampled video frames cannot confirm hidden damage, quantities, building codes or the safest repair. Verify on site; get licensed professional advice for structural, gas or electrical hazards.</p>
    </section>
  );
}
