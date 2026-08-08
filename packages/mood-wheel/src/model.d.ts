export declare const MAX_MOOD_WHEEL_OPTIONS = 5;
/** The supplied wheel art has five authored hit/trigger points. */
export declare const MIN_MOOD_WHEEL_OPTIONS = 5;
/** Keeps public indices valid even when callers replace the option list. */
export declare function clampWheelIndex(index: number, total: number): number;
/** Positions the middle option at twelve o'clock across the authored stops. */
export declare function wheelOptionAngle(index: number, total: number): number;
/** Converts a continuous stop offset into the inverse wheel rotation. */
export declare function wheelRotation(offset: number, total: number): number;
/** Keeps dragging usable on narrow phones without becoming twitchy on desktop. */
export declare function wheelSlotWidth(viewportWidth: number, total: number): number;
/** Dragging right turns the physical wheel clockwise toward earlier options. */
export declare function wheelOffsetFromDrag(start: number, translationX: number, slotWidth: number): number;
/** A short velocity projection preserves flick intent without skipping the wheel. */
export declare function projectedWheelIndex(offset: number, velocityX: number, slotWidth: number, total: number): number;
//# sourceMappingURL=model.d.ts.map