import { describe, expect, it } from "vitest";
import { calculateConcreteRepair, INITIAL_CONCRETE_REPAIR } from "./repair-estimator";

describe("concrete repair worksheet", () => {
  it("computes cubic feet from inches and rounds to whole bags with waste", () => {
    const r = calculateConcreteRepair(INITIAL_CONCRETE_REPAIR);
    expect(r?.volumeCuFt).toBe(0.333);
    expect(r?.bagCount).toBe(1);
    expect(r?.materialsCost).toBe(43);
    expect(r?.laborCost).toBe(195);
    expect(r?.estimatedTotal).toBe(258);
  });
  it("accounts for larger, deeper patches and tax", () => {
    const r = calculateConcreteRepair({
      ...INITIAL_CONCRETE_REPAIR,
      lengthIn: 48, widthIn: 24, depthIn: 3,
      taxPercent: 7,
    });
    expect(r?.volumeCuFt).toBe(2);
    expect(r?.bagCount).toBe(4);
    expect(r?.concreteCost).toBe(32);
    expect(r?.taxCost).toBe(4.69);
  });
  it("rejects missing measurements and implausible negatives", () => {
    expect(calculateConcreteRepair({ ...INITIAL_CONCRETE_REPAIR, depthIn: 0 })).toBeNull();
    expect(calculateConcreteRepair({ ...INITIAL_CONCRETE_REPAIR, widthIn: Number.NaN })).toBeNull();
    expect(calculateConcreteRepair({ ...INITIAL_CONCRETE_REPAIR, pricePerBag: -1 })).toBeNull();
  });
});
