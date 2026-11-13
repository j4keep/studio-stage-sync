import { describe, expect, it } from "vitest";
import { classifyGigEstimate } from "./gig-estimate-kind";
import { parseVehicleAudioJob } from "@/components/jobs/CarAudioEstimate";
import { measureFromPhoto } from "./photo-measurement";

describe("trade-specific gig estimating", () => {
  it("does not request concrete measurements for automotive audio jobs", () => {
    expect(classifyGigEstimate("Replace the radio in a 1990 Honda Accord and add a backup camera")).toBe("car_audio");
    expect(classifyGigEstimate("Install a car stereo and rearview camera")).toBe("car_audio");
    expect(classifyGigEstimate("Repair 24 sq ft of cracked concrete sidewalk")).toBe("concrete");
    expect(classifyGigEstimate("Install a TV on the wall")).toBe("general");
    expect(classifyGigEstimate("Air Conditioning Ceiling Vent & Duct Cleaning")).toBe("duct_cleaning");
    expect(classifyGigEstimate("I need the AC clean ducks")).toBe("duct_cleaning");
  });
  it("recognizes vehicle year and hardware options", () => {
    expect(parseVehicleAudioJob("1990 Honda Accord car radio with backup camera")).toMatchObject({
      year: 1990, make: "Honda", model: "Accord", backup: true, touchscreen: false,
    });
    expect(parseVehicleAudioJob("2026 Honda Accord touchscreen stereo and rearview camera")).toMatchObject({
      year: 2026, backup: true, touchscreen: true,
    });
  });
  it("compensates for photo aspect ratio", () => {
    const marked = [
      { x: .1, y: .2 }, { x: .2, y: .2 },
      { x: .1, y: .5 }, { x: .2, y: .5 },
    ];
    const wide = measureFromPhoto(marked, 12, 2);
    expect(wide?.measuredLength).toBe(12);
    const tall = measureFromPhoto(marked, 12, .5);
    expect(tall?.measuredLength).toBe(12);
  });
});
