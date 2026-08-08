import { describe, expect, it } from "vitest";
import {
  buildAdvancedSliderTicks,
  getAdvancedSliderGeometry,
  normalizeAdvancedSliderValue,
  projectAdvancedSliderValue,
  resolveAdvancedSliderRange,
  rubberBandAdvancedSliderValue,
} from "../src/advancedSliderModel";

describe("advanced slider model", () => {
  it("snaps fractional values without floating-point tails", () => {
    const range = resolveAdvancedSliderRange({ min: 0, max: 2, step: 0.2, majorStep: 1 });
    expect(normalizeAdvancedSliderValue(0.61, range)).toBe(0.6);
    expect(buildAdvancedSliderTicks(range).at(-1)).toBe(2);
  });

  it("keeps the compact focus ruler geometry", () => {
    const range = resolveAdvancedSliderRange({ min: 5, max: 120, step: 1 });
    expect(getAdvancedSliderGeometry(range, 116)).toEqual({
      majorTickHeight: 38,
      minorTickHeight: 28,
      pixelsPerStep: 11,
      selectedTickHeight: 48,
      tickBodyWidth: 8,
      tickSlotWidth: 11,
    });
  });

  it("projects release velocity for the authored 120ms window", () => {
    const range = resolveAdvancedSliderRange({ min: 5, max: 120, step: 1 });
    expect(projectAdvancedSliderValue({ pixelsPerStep: 11, range, value: 60, velocityX: -650 })).toBe(67);
    expect(projectAdvancedSliderValue({ pixelsPerStep: 11, range, value: 118, velocityX: -3_000 })).toBe(120);
  });

  it("resists beyond both ends while keeping the presentation continuous", () => {
    expect(rubberBandAdvancedSliderValue(-10, 0, 100)).toBeLessThan(0);
    expect(rubberBandAdvancedSliderValue(-10, 0, 100)).toBeGreaterThan(-10);
    expect(rubberBandAdvancedSliderValue(110, 0, 100)).toBeGreaterThan(100);
    expect(rubberBandAdvancedSliderValue(110, 0, 100)).toBeLessThan(110);
  });
});
