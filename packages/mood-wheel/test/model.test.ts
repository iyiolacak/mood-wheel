import { describe, expect, it } from "vitest";
import {
  clampWheelIndex,
  projectedWheelIndex,
  wheelOffsetFromDrag,
  wheelOptionAngle,
  wheelRotation,
  wheelSlotWidth,
} from "../src/model";

describe("mood wheel model", () => {
  it("centers the middle of a five-stop wheel", () => {
    expect(wheelOptionAngle(2, 5)).toBe(0);
    expect(wheelRotation(2, 5)).toBe(-0);
  });

  it("turns clockwise when the pointer drags right", () => {
    expect(wheelOffsetFromDrag(2, 60, 60)).toBe(1);
  });

  it("keeps slot travel usable across viewport sizes", () => {
    expect(wheelSlotWidth(220, 5)).toBe(52);
    expect(wheelSlotWidth(1_000, 5)).toBe(96);
  });

  it("projects flicks but clamps to real stops", () => {
    expect(projectedWheelIndex(2, -700, 70, 5)).toBe(3);
    expect(projectedWheelIndex(2, -5_000, 70, 5)).toBe(3);
    expect(projectedWheelIndex(4, -5_000, 70, 5)).toBe(4);
    expect(clampWheelIndex(-4, 5)).toBe(0);
  });
});
