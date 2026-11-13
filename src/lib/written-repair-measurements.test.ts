import { describe, expect, it } from "vitest";
import { parseWrittenConcreteMeasurements } from "./written-repair-measurements";
import { calculateConcreteRepair, INITIAL_CONCRETE_REPAIR } from "./repair-estimator";

describe("written gig measurements", () => {
  it("reads square footage, depth, concrete pricing and labor hours", () => {
    const fields = parseWrittenConcreteMeasurements(
      "Repair 24 square feet of concrete, 2 inches deep. $9 per bag and 4 labor hours at $70/hr"
    );
    expect(fields.areaSqFt).toBe(24);
    expect(fields.lengthIn).toBe(288);
    expect(fields.widthIn).toBe(12);
    expect(fields.depthIn).toBe(2);
    expect(fields.pricePerBag).toBe(9);
    expect(fields.laborHours).toBe(4);
    expect(fields.laborRatePerHour).toBe(70);
    const estimate = calculateConcreteRepair({ ...INITIAL_CONCRETE_REPAIR, ...fields });
    expect(estimate?.volumeCuFt).toBe(4);
    expect(estimate?.bagCount).toBe(8);
    expect(estimate?.laborCost).toBe(280);
  });
  it("reads feet by feet and inches depth", () => {
    const fields = parseWrittenConcreteMeasurements("Concrete patio 6 ft by 4 ft, 3 inches deep");
    expect(fields.lengthIn).toBe(72);
    expect(fields.widthIn).toBe(48);
    expect(fields.depthIn).toBe(3);
  });
  it("does not invent size or prices from a generic repair description", () => {
    const fields = parseWrittenConcreteMeasurements("Paint green baseboard and recaulk tile joint");
    expect(fields.lengthIn).toBeUndefined();
    expect(fields.areaSqFt).toBeUndefined();
    expect(fields.pricePerBag).toBeUndefined();
  });
  it("flags conflicting square footage and dimensions", () => {
    const fields = parseWrittenConcreteMeasurements("Repair 20 sq ft concrete 2 ft by 2 ft and 2 inches deep");
    expect(fields.ambiguity).toBeTruthy();
  });
});
