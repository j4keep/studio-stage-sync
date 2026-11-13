import type { ConcreteRepairInputs } from "./repair-estimator";

/** Explicit measurements only. Never hallucinate geometry from a photograph.
 * Supports square footage with depth or 2D/3D dimensions with units.
 * Not intended as a general natural-language measurement parser.
 */
export type WrittenConcreteMeasurements = Partial<Pick<ConcreteRepairInputs,
  "lengthIn" | "widthIn" | "depthIn" | "pricePerBag" | "laborHours" | "laborRatePerHour" >> & {
    areaSqFt?: number;
    ambiguity?: string;
  };

const finite = (n: number) => Number.isFinite(n) && n > 0;
const inches = (n: number, unit: string) =>
  /^(?:feet|foot|ft|')$/i.test(unit) ? n * 12 : n;
const unit = String.raw`(?:inches|inch|in\b|["″]|feet|foot|ft\b|['′])`;
const number = String.raw`(\d+(?:\.\d+)?)`;
const amount = (match: RegExpMatchArray | null, index = 1): number | undefined =>
  match && finite(Number(match[index])) ? Number(match[index]) : undefined;

export function parseWrittenConcreteMeasurements(text: string): WrittenConcreteMeasurements {
  const out: WrittenConcreteMeasurements = {};
  const input = text.toLowerCase().replace(/,/g, "");
  const area = input.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|square\s*(?:feet|foot)|ft\s*(?:\^\s*2|²))/i);
  if (area) out.areaSqFt = amount(area);

  // "24 inches long by 12 inches wide", or "6 ft x 4 ft" with common units.
  const dims = input.match(new RegExp(`${number}\\s*(${unit})\\s*(?:by|x|×)\\s*${number}\\s*(${unit})`, "i"));
  const shared = input.match(new RegExp(`${number}\\s*(?:by|x|×)\\s*${number}\\s*(${unit})`, "i"));
  if (dims) {
    out.lengthIn = inches(Number(dims[1]), dims[2]);
    out.widthIn = inches(Number(dims[3]), dims[4]);
  } else if (shared) {
    out.lengthIn = inches(Number(shared[1]), shared[3]);
    out.widthIn = inches(Number(shared[2]), shared[3]);
  } else {
    const length = input.match(new RegExp(`(?:length|long)\\s*(?:of|is|:|=)?\\s*${number}\\s*(${unit})`, "i"))
      || input.match(new RegExp(`${number}\\s*(${unit})\\s*(?:long|in length)`, "i"));
    const width = input.match(new RegExp(`(?:width|wide)\\s*(?:of|is|:|=)?\\s*${number}\\s*(${unit})`, "i"))
      || input.match(new RegExp(`${number}\\s*(${unit})\\s*(?:wide|in width)`, "i"));
    if (length) out.lengthIn = inches(Number(length[1]), length[2]);
    if (width) out.widthIn = inches(Number(width[1]), width[2]);
  }
  const depth = input.match(new RegExp(`(?:depth|deep|thick|thickness)\\s*(?:of|is|:|=)?\\s*${number}\\s*(${unit})`, "i"))
    || input.match(new RegExp(`${number}\\s*(${unit})\\s*(?:deep|thick|depth)`, "i"));
  if (depth) out.depthIn = inches(Number(depth[1]), depth[2]);

  // Geometry is only unambiguous when explicitly stated.
  // Map area into a 1-foot-wide rectangle for the existing volume formula.
  if (out.areaSqFt && !out.lengthIn && !out.widthIn) {
    out.lengthIn = out.areaSqFt * 12;
    out.widthIn = 12;
  } else if (out.areaSqFt && out.lengthIn && out.widthIn &&
             Math.abs(out.lengthIn * out.widthIn / 144 - out.areaSqFt) / out.areaSqFt > 0.1) {
    out.ambiguity = "Square footage and length × width disagree. Confirm the repair dimensions.";
  }

  const bags = input.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:per|\/)\s*bag/i)
    || input.match(/(?:bag|concrete mix)\s*(?:costs?|price|at|is|:)\s*\$\s*(\d+(?:\.\d+)?)/i);
  out.pricePerBag = amount(bags);
  const hours = input.match(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|hr)\s*(?:of\s*)?labor/i)
    || input.match(/(?:labor|work)\s*(?:takes?|time|hours?|:)\s*(\d+(?:\.\d+)?)\s*(?:hours|hrs|hr)?/i);
  out.laborHours = amount(hours);
  const rate = input.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:hour|hr)/i);
  out.laborRatePerHour = amount(rate);
  return out;
}
