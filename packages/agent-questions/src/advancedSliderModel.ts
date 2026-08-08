export type AdvancedSliderRange = Readonly<{
  majorStep: number;
  max: number;
  min: number;
  step: number;
}>;

export type AdvancedSliderGeometry = Readonly<{
  majorTickHeight: number;
  minorTickHeight: number;
  pixelsPerStep: number;
  selectedTickHeight: number;
  tickBodyWidth: number;
  tickSlotWidth: number;
}>;

const RELEASE_PROJECTION_SECONDS = 0.12;

function stepPrecision(step: number) {
  const [, decimalPart] = String(step).split(".");
  return decimalPart?.length ?? 0;
}

/** Repairs untrusted range input while retaining the authored focus-slider defaults. */
export function resolveAdvancedSliderRange({
  majorStep = 5,
  max = 120,
  min = 5,
  step = 1,
}: Partial<AdvancedSliderRange>): AdvancedSliderRange {
  const finiteMin = Number.isFinite(min) ? min : 5;
  const finiteMax = Number.isFinite(max) ? max : 120;
  const safeMin = Math.min(finiteMin, finiteMax);
  const safeMax = Math.max(finiteMin, finiteMax);
  return {
    majorStep: Number.isFinite(majorStep) && majorStep > 0 ? majorStep : 5,
    max: safeMax > safeMin ? safeMax : safeMin + 1,
    min: safeMin,
    step: Number.isFinite(step) && step > 0 ? step : 1,
  };
}

/** Clamps and snaps a presentation value to a real selectable detent. */
export function normalizeAdvancedSliderValue(rawValue: number, range: AdvancedSliderRange) {
  const bounded = Math.min(range.max, Math.max(range.min, rawValue));
  const snapped = range.min + Math.round((bounded - range.min) / range.step) * range.step;
  const factor = 10 ** stepPrecision(range.step);
  return Math.min(range.max, Math.max(range.min, Math.round(snapped * factor) / factor));
}

/** Builds the finite moving ruler once. */
export function buildAdvancedSliderTicks(range: AdvancedSliderRange) {
  const count = Math.max(0, Math.round((range.max - range.min) / range.step));
  const ticks: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    const tick = normalizeAdvancedSliderValue(range.min + index * range.step, range);
    if (ticks[ticks.length - 1] !== tick) ticks.push(tick);
  }
  if (ticks[ticks.length - 1] !== range.max) ticks.push(range.max);
  return ticks;
}

/** Matches the compact native focus control's ruler geometry. */
export function getAdvancedSliderGeometry(range: AdvancedSliderRange, tickCount: number): AdvancedSliderGeometry {
  const isIntegerScale = range.min === 0 && Number.isInteger(range.step) && tickCount <= 21;
  const smallRange = isIntegerScale ? range.max <= 5 ? "tiny" : range.max <= 10 ? "small" : "medium" : null;
  const tickSlotWidth = smallRange === "tiny" ? 34 : smallRange === "small" ? 27 : smallRange === "medium" ? 19 : 11;
  const bodyGap = smallRange === "tiny" || smallRange === "small" ? 6 : smallRange === "medium" ? 5 : 3;
  return {
    majorTickHeight: 38,
    minorTickHeight: 28,
    pixelsPerStep: tickSlotWidth,
    selectedTickHeight: 48,
    tickBodyWidth: Math.max(7, tickSlotWidth - bodyGap),
    tickSlotWidth,
  };
}

/** Projects measured release velocity for 120ms, then selects one bounded detent. */
export function projectAdvancedSliderValue({
  pixelsPerStep,
  range,
  value,
  velocityX,
}: Readonly<{ pixelsPerStep: number; range: AdvancedSliderRange; value: number; velocityX: number }>) {
  const projectedPixels = velocityX * RELEASE_PROJECTION_SECONDS;
  return normalizeAdvancedSliderValue(value - (projectedPixels / Math.max(1, pixelsPerStep)) * range.step, range);
}

/** Gives edge drags continuous resistance without changing the public value range. */
export function rubberBandAdvancedSliderValue(value: number, minimum: number, maximum: number) {
  const dimension = Math.max(1, maximum - minimum);
  const constant = 0.42;
  if (value < minimum) {
    const overshoot = value - minimum;
    return minimum + (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
  }
  if (value > maximum) {
    const overshoot = value - maximum;
    return maximum + (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
  }
  return value;
}
