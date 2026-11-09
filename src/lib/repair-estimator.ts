/** Transparent, deterministic preliminary concrete-repair worksheet.
 * Dimensions/prices are provided by the person estimating, not inferred from pixels.
 * Assumes rectangular removal/replacement with bagged mix. A licensed pro should
 * evaluate settlement, structural cracking, drainage and load-bearing slabs.
 */
export type ConcreteRepairInputs = {
  lengthIn: number;
  widthIn: number;
  depthIn: number;
  bagYieldCuFt: number;
  wastePercent: number;
  pricePerBag: number;
  laborHours: number;
  laborRatePerHour: number;
  otherMaterialsCost: number;
  disposalCost: number;
  taxPercent: number;
};

export type ConcreteRepairResult = {
  volumeCuFt: number;
  volumeWithWasteCuFt: number;
  bagCount: number;
  concreteCost: number;
  laborCost: number;
  materialsCost: number;
  disposalCost: number;
  taxCost: number;
  estimatedTotal: number;
  planningLow: number;
  planningHigh: number;
};

const good = (n: number) => Number.isFinite(n) && n >= 0;
const money = (n: number) => Math.round(n * 100) / 100;

export function calculateConcreteRepair(i: ConcreteRepairInputs): ConcreteRepairResult | null {
  const numbers = Object.values(i);
  if (!numbers.every(good) ||
      i.lengthIn <= 0 || i.widthIn <= 0 || i.depthIn <= 0 ||
      i.bagYieldCuFt <= 0 || i.wastePercent > 100 || i.taxPercent > 30 ||
      i.lengthIn > 12000 || i.widthIn > 12000 || i.depthIn > 120) return null;
  const volumeCuFt = (i.lengthIn * i.widthIn * i.depthIn) / 1728;
  const volumeWithWasteCuFt = volumeCuFt * (1 + i.wastePercent / 100);
  const bagCount = Math.ceil(volumeWithWasteCuFt / i.bagYieldCuFt);
  if (!Number.isSafeInteger(bagCount) || bagCount > 100000) return null;
  const concreteCost = money(bagCount * i.pricePerBag);
  const materialsCost = money(concreteCost + i.otherMaterialsCost);
  const laborCost = money(i.laborHours * i.laborRatePerHour);
  const disposalCost = money(i.disposalCost);
  const taxCost = money(materialsCost * i.taxPercent / 100);
  const estimatedTotal = money(materialsCost + laborCost + disposalCost + taxCost);
  // Allowance illustrates uncertainty, not a statistically validated prediction interval.
  return {
    volumeCuFt: Math.round(volumeCuFt * 1000) / 1000,
    volumeWithWasteCuFt: Math.round(volumeWithWasteCuFt * 1000) / 1000,
    bagCount,
    concreteCost, materialsCost, laborCost, disposalCost, taxCost, estimatedTotal,
    planningLow: money(estimatedTotal * 0.8),
    planningHigh: money(estimatedTotal * 1.3),
  };
}

export const INITIAL_CONCRETE_REPAIR: ConcreteRepairInputs = {
  lengthIn: 24,
  widthIn: 12,
  depthIn: 2,
  bagYieldCuFt: 0.6, // Example 80-lb concrete mix yield; check exact bag label
  wastePercent: 10,
  pricePerBag: 8, // Illustrative planning assumptions ONLY, not live local prices
  laborHours: 3,
  laborRatePerHour: 65,
  otherMaterialsCost: 35,
  disposalCost: 20,
  taxPercent: 0,
};
