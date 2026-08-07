export const MAX_MOOD_WHEEL_OPTIONS = 5;
/** The supplied wheel art has five authored hit/trigger points. */
export const MIN_MOOD_WHEEL_OPTIONS = 5;

const MAX_SPREAD_DEGREES = 176;
const SLOT_DEGREES = 38;
const MIN_DRAG_SLOT_WIDTH = 52;
const MAX_DRAG_SLOT_WIDTH = 96;

/** Keeps public indices valid even when callers replace the option list. */
export function clampWheelIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(index)));
}

/** Positions the middle option at twelve o'clock across the authored stops. */
export function wheelOptionAngle(index: number, total: number) {
  if (total <= 1) return 0;
  const spread = Math.min(MAX_SPREAD_DEGREES, SLOT_DEGREES * Math.max(total - 1, 1));
  return -spread / 2 + (spread / (total - 1)) * index;
}

/** Converts a continuous stop offset into the inverse wheel rotation. */
export function wheelRotation(offset: number, total: number) {
  return (-wheelOptionAngle(offset, total) * Math.PI) / 180;
}

/** Keeps dragging usable on narrow phones without becoming twitchy on desktop. */
export function wheelSlotWidth(viewportWidth: number, total: number) {
  const natural = viewportWidth / Math.max(total, 1);
  return Math.max(MIN_DRAG_SLOT_WIDTH, Math.min(MAX_DRAG_SLOT_WIDTH, natural));
}

/** Dragging right turns the physical wheel clockwise toward earlier options. */
export function wheelOffsetFromDrag(start: number, translationX: number, slotWidth: number) {
  return start - translationX / Math.max(slotWidth, 1);
}

/** A short velocity projection preserves flick intent without skipping the wheel. */
export function projectedWheelIndex(
  offset: number,
  velocityX: number,
  slotWidth: number,
  total: number,
) {
  // A flick can carry through one detent, but never leap over the authored
  // five-stop geometry in a single release.
  const projectedDelta = Math.max(-0.9, Math.min(0.9, velocityX / Math.max(slotWidth, 1) / 7));
  const projected = offset - projectedDelta;
  return clampWheelIndex(projected, total);
}
