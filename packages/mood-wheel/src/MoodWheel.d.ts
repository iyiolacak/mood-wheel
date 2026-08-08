import * as React from "react";
import "./styles.css";
export type MoodWheelOption<Value extends string = string> = Readonly<{
    value: Value;
    label: string;
    ariaLabel?: string;
}>;
export type MoodWheelChangeSource = "control" | "drag" | "keyboard" | "wheel";
export type MoodWheelChange<Value extends string = string> = Readonly<{
    index: number;
    option: MoodWheelOption<Value>;
    source: MoodWheelChangeSource;
}>;
export type MoodWheelAssets = Readonly<{
    pointer: string;
    tick: string;
    wheel: string;
}>;
export type MoodWheelMessages = Readonly<{
    ariaLabel: string;
    hint: string;
    next: string;
    previous: string;
}>;
export type MoodWheelProps<Value extends string = string> = Readonly<{
    options: readonly MoodWheelOption<Value>[];
    value?: Value;
    defaultValue?: Value;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    messages?: Partial<MoodWheelMessages>;
    assets?: Partial<MoodWheelAssets>;
    intro?: false | "limited" | "always";
    introPlayLimit?: number;
    introStorageKey?: string;
    sound?: boolean;
    showControls?: boolean;
    showHint?: boolean;
    /** Matches the two source layouts used by the web experience. */
    layoutVariant?: "default" | "ultraWide";
    /** Vertical host velocity in px/s lets the loose pointer react when its whole surface moves. */
    ambientVelocityY?: number;
    /** Lets a host gate the first interaction while an answer is busy. */
    onAttemptInteract?: () => boolean;
    onChange?: (change: MoodWheelChange<Value>) => void;
    onDetent?: (change: MoodWheelChange<Value>) => void;
    renderPreviousIcon?: () => React.ReactNode;
    renderNextIcon?: () => React.ReactNode;
}>;
/** Public URLs for the exact shipped wheel assets and tick cue. */
export declare const MOOD_WHEEL_ASSETS: MoodWheelAssets;
/**
 * A tactile, controlled-or-uncontrolled mood selector. Pixi is loaded only in
 * the browser; the image fallback remains interactive if canvas setup fails.
 */
export declare function MoodWheel<Value extends string = string>({ options: incomingOptions, value, defaultValue, disabled, className, style, messages: messageOverrides, assets: assetOverrides, intro, introPlayLimit, introStorageKey, sound, showControls, showHint, layoutVariant, ambientVelocityY, onAttemptInteract, onChange, onDetent, renderPreviousIcon, renderNextIcon, }: MoodWheelProps<Value>): React.JSX.Element;
//# sourceMappingURL=MoodWheel.d.ts.map