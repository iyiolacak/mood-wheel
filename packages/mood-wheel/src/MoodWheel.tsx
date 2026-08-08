"use client";

import * as React from "react";
import pointerUrl from "./assets/pointer.webp";
import tickUrl from "./assets/tick.wav";
import wheelUrl from "./assets/wheel.webp";
import {
  MIN_MOOD_WHEEL_OPTIONS,
  clampWheelIndex,
  projectedWheelIndex,
  wheelOffsetFromDrag,
  wheelRotation,
  wheelSlotWidth,
} from "./model";
import "./styles.css";

export type MoodWheelOption<Value extends string = string> = Readonly<{
  value: Value;
  label: string;
  ariaLabel?: string;
}>;

export type MoodWheelChangeSource =
  | "control"
  | "drag"
  | "keyboard"
  | "wheel";

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

const DEFAULT_MESSAGES: MoodWheelMessages = {
  ariaLabel: "Mood wheel",
  hint: "Drag the wheel",
  next: "Next mood",
  previous: "Previous mood",
};

const DEFAULT_ASSETS: MoodWheelAssets = {
  pointer: pointerUrl,
  tick: tickUrl,
  wheel: wheelUrl,
};

/** Public URLs for the exact shipped wheel assets and tick cue. */
export const MOOD_WHEEL_ASSETS: MoodWheelAssets = DEFAULT_ASSETS;

const WIDE_LAYOUT_MIN_WIDTH = 640;
const WHEEL_SCROLL_THRESHOLD = 10;
const POINTER_MAX_LEAN_RADIANS = 0.2;
const INTRO_ANIMATION_MS = 1680;
const INTRO_BEZIER = [0.65, 0, 0.35, 1] as const;
const WHEEL_SPRING_STIFFNESS = 220;
const WHEEL_SPRING_DAMPING = 29;
const POINTER_SHAKE_STIFFNESS = 420;
const POINTER_SHAKE_DAMPING = 26;

type PixiRuntime = {
  app: { canvas: HTMLCanvasElement; destroy: (removeView?: boolean) => void; renderer: { resize: (w: number, h: number) => void }; ticker: { add: (fn: (ticker: { deltaTime?: number }) => void) => void } };
  wheel: { rotation: number; anchor: { set: (x: number, y?: number) => void }; position?: { set: (x: number, y: number) => void }; scale: { set: (value: number) => void }; texture: { width: number; height: number } };
  pointer: { rotation: number; anchor: { set: (x: number, y?: number) => void }; position: { set: (x: number, y: number) => void }; scale: { set: (value: number) => void }; texture: { width: number; height: number } };
  wheelWrap: { position: { set: (x: number, y: number) => void }; scale: { set: (value: number) => void } };
  targetRotation: number;
  currentRotation: number;
  rotationVelocity: number;
  targetPointerLean: number;
  pointerLean: number;
  pointerShake: number;
  pointerShakeVelocity: number;
  pointerPulse: number;
  wheelPulse: number;
  basePointerScale: number;
  basePointerX: number;
  basePointerY: number;
  baseWheelWrapScale: number;
  selectedKey: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  previousX: number;
  previousTime: number;
  velocityX: number;
  startOffset: number;
  moved: boolean;
};

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

/** Preserves every supplied slot so malformed or oversized sets cannot slip through. */
function normalizeOptions<Value extends string>(options: readonly MoodWheelOption<Value>[]) {
  return options.map((option) => {
    if (!option || typeof option.value !== "string" || typeof option.label !== "string") {
      return { value: "", label: "" } as MoodWheelOption<Value>;
    }
    return option;
  });
}

function initialIndex<Value extends string>(
  options: readonly MoodWheelOption<Value>[],
  value: Value | undefined,
) {
  const match = value === undefined ? -1 : options.findIndex((option) => option.value === value);
  return match >= 0 ? match : Math.floor(options.length / 2);
}

function shouldPlayIntro(mode: MoodWheelProps["intro"], key: string, limit: number) {
  if (mode === false) return false;
  if (mode === "always") return true;
  try {
    const count = Number(window.localStorage.getItem(key) ?? "0");
    if (Number.isFinite(count) && count >= limit) return false;
    window.localStorage.setItem(key, String(Number.isFinite(count) ? count + 1 : 1));
    return true;
  } catch {
    return true;
  }
}

/** Keeps the authored wheel rising out of the viewport at every supported width. */
function layoutPixi(runtime: PixiRuntime, width: number, height: number, layoutVariant: "default" | "ultraWide") {
  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;
  const isUltraWide = layoutVariant === "ultraWide";
  const wheelWidth = isUltraWide
    ? isWide
      ? Math.min(width * 1.06, 660)
      : Math.min(width * 1.46, 520)
    : isWide
      ? Math.min(width * 0.92, 520)
      : Math.max(width * 1.22, 292);
  const wheelScale = wheelWidth / Math.max(runtime.wheel.texture.width, 1);
  const wheelY = isUltraWide
    ? isWide
      ? height + wheelScale * 234
      : height + wheelScale * 268
    : isWide
      ? height + wheelScale * 248
      : height + wheelScale * 286;

  runtime.wheelWrap.position.set(width / 2, wheelY);
  runtime.wheel.position?.set?.(0, 0);
  runtime.wheel.anchor.set(0.5, 0.98);
  runtime.wheel.scale.set(wheelScale);

  const pointerHeight = isUltraWide
    ? isWide
      ? Math.min(68, Math.max(48, height * 0.35))
      : Math.min(58, Math.max(40, height * 0.28))
    : isWide
      ? Math.min(62, Math.max(44, height * 0.32))
      : Math.min(52, Math.max(36, height * 0.26));
  const pointerScale = pointerHeight / Math.max(runtime.pointer.texture.height, 1);
  runtime.pointer.anchor.set(0.5, 0.92);
  runtime.pointer.position.set(width / 2, height + 2);
  runtime.basePointerX = width / 2;
  runtime.basePointerY = height + 2;
  runtime.pointer.scale.set(pointerScale);
  runtime.basePointerScale = pointerScale;
  runtime.baseWheelWrapScale = 1;
}

function findNeutralIndex<Value extends string>(options: readonly MoodWheelOption<Value>[], fallbackIndex: number) {
  const neutralIndex = options.findIndex((option) => {
    const label = option.label.trim().toLowerCase();
    const value = option.value.trim().toLowerCase();
    return label === "okay" || label === "flat" || value === "okay" || value === "neutral" || value === "flat";
  });
  return neutralIndex >= 0 ? neutralIndex : fallbackIndex;
}

/** Cubic-bezier easing used by the original three-stop intro sweep. */
function cubicBezierY(progress: number, [x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let t = Math.max(0, Math.min(1, progress));

  for (let index = 0; index < 5; index += 1) {
    const x = ((ax * t + bx) * t + cx) * t - progress;
    const dx = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(x) < 0.001 || Math.abs(dx) < 0.001) break;
    t = Math.min(1, Math.max(0, t - x / dx));
  }

  return ((ay * t + by) * t + cy) * t;
}

function introOffsetAt(progress: number, restingIndex: number, total: number) {
  const keyframes = [
    { at: 0, offset: restingIndex },
    { at: 0.34, offset: total - 1 },
    { at: 0.72, offset: 0 },
    { at: 1, offset: restingIndex },
  ];
  const nextIndex = keyframes.findIndex((keyframe) => keyframe.at >= progress);
  if (nextIndex <= 0) return restingIndex;
  const previous = keyframes[nextIndex - 1]!;
  const next = keyframes[nextIndex]!;
  const localProgress = (progress - previous.at) / Math.max(next.at - previous.at, 0.001);
  return previous.offset + (next.offset - previous.offset) * cubicBezierY(localProgress, INTRO_BEZIER);
}

/** Pointer capture may already be gone on a cancelled touch or browser handoff. */
function capturePointerSafely(element: Element, pointerId: number) {
  if (!(element instanceof HTMLElement)) return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The visual spring and detent state remain valid without capture.
  }
}

/** Releases a stale pointer id without turning a completed gesture into an error. */
function releasePointerSafely(element: Element, pointerId: number) {
  if (!(element instanceof HTMLElement)) return;
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Ignore stale pointer ids after the drag state has been reset.
  }
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="muzluk-mood-wheel__chevron">
      <path d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

/** Small owned gesture mark; the package ships no third-party icon assets. */
function SwipeIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={spinning ? "muzluk-mood-wheel__swipe-icon muzluk-mood-wheel__swipe-icon--spin" : "muzluk-mood-wheel__swipe-icon"}
    >
      <path d="M9 11V7.5a1.35 1.35 0 0 1 2.7 0V11m0-1.2V6.4a1.35 1.35 0 0 1 2.7 0V11m0-.8V7.5a1.35 1.35 0 0 1 2.7 0v5.9c0 3.3-1.9 5.4-4.7 5.4h-.5c-1.8 0-3.1-.9-4.1-2.3l-1.7-2.4a1.4 1.4 0 0 1 2.2-1.7L9 13.2V11Z" />
      <path d="M4.5 8.5h2.6M5.8 6.6 4 8.5l1.8 1.9" />
    </svg>
  );
}

/**
 * A tactile, controlled-or-uncontrolled mood selector. Pixi is loaded only in
 * the browser; the image fallback remains interactive if canvas setup fails.
 */
export function MoodWheel<Value extends string = string>({
  options: incomingOptions,
  value,
  defaultValue,
  disabled = false,
  className,
  style,
  messages: messageOverrides,
  assets: assetOverrides,
  intro = "limited",
  introPlayLimit = 3,
  introStorageKey = "muzluk:mood-wheel:intro:v1",
  sound = true,
  showControls = true,
  showHint = true,
  layoutVariant = "default",
  ambientVelocityY = 0,
  onAttemptInteract,
  onChange,
  onDetent,
  renderPreviousIcon,
  renderNextIcon,
}: MoodWheelProps<Value>) {
  const options = React.useMemo(() => normalizeOptions(incomingOptions), [incomingOptions]);
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides };
  const assets = { ...DEFAULT_ASSETS, ...assetOverrides };
  const controlledIndex = initialIndex(options, value);
  const [internalIndex, setInternalIndex] = React.useState(() => initialIndex(options, defaultValue));
  const selectedIndex = value === undefined ? clampWheelIndex(internalIndex, options.length) : controlledIndex;
  const selected = options[selectedIndex];
  const reducedMotion = useReducedMotion();
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const runtimeRef = React.useRef<PixiRuntime | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const offsetRef = React.useRef(selectedIndex);
  const selectedIndexRef = React.useRef(selectedIndex);
  const introPlayedRef = React.useRef(false);
  const introFrameRef = React.useRef<number | null>(null);
  const reduceMotionRef = React.useRef(false);
  const audioPoolRef = React.useRef<HTMLAudioElement[]>([]);
  const audioPoolIndexRef = React.useRef(0);
  const lastTickAtRef = React.useRef(0);
  const [fallbackOffset, setFallbackOffset] = React.useState(selectedIndex);
  const [pixiReady, setPixiReady] = React.useState(false);
  const [runtimeReadyToken, setRuntimeReadyToken] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const hintSpinPlayedRef = React.useRef(false);
  const previousAmbientVelocityRef = React.useRef(0);
  const [hintSpinActive, setHintSpinActive] = React.useState(false);
  selectedIndexRef.current = selectedIndex;
  reduceMotionRef.current = reducedMotion;

  React.useEffect(() => {
    audioPoolRef.current = [];
    audioPoolIndexRef.current = 0;
  }, [assets.tick]);

  React.useEffect(() => {
    if (!showHint || reducedMotion || hintSpinPlayedRef.current) return;
    hintSpinPlayedRef.current = true;
    const timer = window.setTimeout(() => setHintSpinActive(true), 0);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, showHint]);

  const stopIntro = React.useCallback(() => {
    if (introFrameRef.current !== null) cancelAnimationFrame(introFrameRef.current);
    introFrameRef.current = null;
  }, []);

  const playTick = React.useCallback(() => {
    if (!sound) return;
    const now = Date.now();
    if (now - lastTickAtRef.current < 34) return;
    lastTickAtRef.current = now;
    try {
      const pool = audioPoolRef.current;
      const poolIndex = audioPoolIndexRef.current % 3;
      audioPoolIndexRef.current = (poolIndex + 1) % 3;
      const audio = pool[poolIndex] ?? new Audio(assets.tick);
      pool[poolIndex] = audio;
      audio.volume = 0.34;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } catch {
      // Sound is supplementary; selection must never depend on playback.
    }
  }, [assets.tick, sound]);

  const publishIndex = React.useCallback(
    (next: number, source: MoodWheelChangeSource) => {
      const index = clampWheelIndex(next, options.length);
      const option = options[index];
      if (!option || index === selectedIndex) return;
      if (value === undefined) setInternalIndex(index);
      const change: MoodWheelChange<Value> = { index, option, source };
      playTick();
      onDetent?.(change);
      onChange?.(change);
    },
    [onChange, onDetent, options, playTick, selectedIndex, value],
  );

  const setVisualOffset = React.useCallback((offset: number) => {
    const bounded = Math.max(0, Math.min(options.length - 1, offset));
    offsetRef.current = bounded;
    const runtime = runtimeRef.current;
    if (!runtime) setFallbackOffset(bounded);
    if (runtime) runtime.targetRotation = wheelRotation(bounded, options.length);
  }, [options.length]);

  React.useEffect(() => {
    if (dragRef.current || introFrameRef.current !== null) return;
    offsetRef.current = selectedIndex;
    setFallbackOffset(selectedIndex);
    const runtime = runtimeRef.current;
    if (runtime) {
      runtime.targetRotation = wheelRotation(selectedIndex, options.length);
      const nextKey = String(selectedIndex);
      if (runtime.selectedKey !== nextKey) {
        const previousIndex = Number.parseInt(runtime.selectedKey, 10);
        const direction = Number.isFinite(previousIndex) ? Math.sign(selectedIndex - previousIndex) : 0;
        runtime.selectedKey = nextKey;
        runtime.pointerPulse = reducedMotion ? 0 : 1;
        runtime.wheelPulse = reducedMotion ? 0 : 1;
        if (direction !== 0 && !reducedMotion) {
          runtime.targetPointerLean = direction * POINTER_MAX_LEAN_RADIANS;
          runtime.pointerShakeVelocity += direction * 0.65;
        }
      }
    }
  }, [options.length, reducedMotion, selectedIndex]);

  React.useEffect(() => {
    const runtime = runtimeRef.current;
    const previous = previousAmbientVelocityRef.current;
    previousAmbientVelocityRef.current = ambientVelocityY;
    if (!runtime || reducedMotion) return;
    const lean = Math.max(-0.13, Math.min(0.13, -ambientVelocityY / 3_600));
    const impulse = Math.max(-1.1, Math.min(1.1, (ambientVelocityY - previous) / 2_400));
    runtime.targetPointerLean = lean;
    runtime.pointerShakeVelocity += impulse;
  }, [ambientVelocityY, reducedMotion]);

  React.useEffect(() => {
    const root = mountRef.current;
    if (!root || options.length !== MIN_MOOD_WHEEL_OPTIONS) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const start = async () => {
      try {
        const PIXI = await import("pixi.js");
        const [wheelTexture, pointerTexture] = await Promise.all([
          PIXI.Assets.load(assets.wheel),
          PIXI.Assets.load(assets.pointer),
        ]);
        if (cancelled || !mountRef.current) return;
        const app = new PIXI.Application();
        await app.init({
          antialias: true,
          autoDensity: true,
          backgroundAlpha: 0,
          resolution: Math.min(Math.max(window.devicePixelRatio || 1, 1), 2),
          width: Math.max(root.clientWidth, 1),
          height: Math.max(root.clientHeight, 1),
        });
        if (cancelled || !mountRef.current) {
          app.destroy(true);
          return;
        }

        const wheelWrap = new PIXI.Container();
        const wheel = new PIXI.Sprite(wheelTexture);
        const pointer = new PIXI.Sprite(pointerTexture);
        wheelWrap.addChild(wheel);
        app.stage.addChild(wheelWrap, pointer);
        const rotation = wheelRotation(selectedIndexRef.current, options.length);
        const runtime = {
          app,
          wheel,
          pointer,
          wheelWrap,
          targetRotation: rotation,
          currentRotation: rotation,
          rotationVelocity: 0,
          targetPointerLean: 0,
          pointerLean: 0,
          pointerShake: 0,
          pointerShakeVelocity: 0,
          pointerPulse: 0,
          wheelPulse: 0,
          basePointerScale: 1,
          basePointerX: 0,
          basePointerY: 0,
          baseWheelWrapScale: 1,
          selectedKey: String(selectedIndexRef.current),
        } as unknown as PixiRuntime;
        runtimeRef.current = runtime;
        root.appendChild(app.canvas);
        app.canvas.className = "muzluk-mood-wheel__canvas";
        setRuntimeReadyToken((token) => token + 1);

        const resize = () => {
          const width = Math.max(root.clientWidth, 1);
          const height = Math.max(root.clientHeight, 1);
          app.renderer.resize(width, height);
          layoutPixi(runtime, width, height, layoutVariant);
        };
        observer = new ResizeObserver(resize);
        observer.observe(root);
        resize();

        app.ticker.add((ticker) => {
          const live = runtimeRef.current;
          if (!live) return;
          // Keep the wheel in one continuous physical system. A spring with
          // velocity preserves momentum when the finger changes direction,
          // which is what keeps the detent snap from feeling like a CSS jump.
          const frameScale = Math.min(2.5, ticker.deltaTime || 1);
          const dt = Math.min(0.04, frameScale / 60);
          if (reduceMotionRef.current) {
            live.currentRotation = live.targetRotation;
            live.rotationVelocity = 0;
            live.wheel.rotation = live.currentRotation;
            live.wheelWrap.scale.set(live.baseWheelWrapScale);
            live.pointer.scale.set(live.basePointerScale);
            live.pointerLean = 0;
            live.targetPointerLean = 0;
            live.pointerShake = 0;
            live.pointerShakeVelocity = 0;
            live.pointer.rotation = 0;
            return;
          }

          const rotationError = live.targetRotation - live.currentRotation;
          const rotationAcceleration = rotationError * WHEEL_SPRING_STIFFNESS - live.rotationVelocity * WHEEL_SPRING_DAMPING;
          live.rotationVelocity += rotationAcceleration * dt;
          live.rotationVelocity = Math.max(-14, Math.min(14, live.rotationVelocity));
          live.currentRotation += live.rotationVelocity * dt;
          if (Math.abs(rotationError) < 0.0004 && Math.abs(live.rotationVelocity) < 0.0004) {
            live.currentRotation = live.targetRotation;
            live.rotationVelocity = 0;
          }
          live.wheel.rotation = live.currentRotation;

          live.pointerLean += (live.targetPointerLean - live.pointerLean) * (1 - Math.pow(0.68, frameScale));
          live.targetPointerLean *= Math.pow(0.76, frameScale);
          const pointerShakeAcceleration = -live.pointerShake * POINTER_SHAKE_STIFFNESS - live.pointerShakeVelocity * POINTER_SHAKE_DAMPING;
          live.pointerShakeVelocity += pointerShakeAcceleration * dt;
          live.pointerShakeVelocity = Math.max(-9, Math.min(9, live.pointerShakeVelocity));
          live.pointerShake += live.pointerShakeVelocity * dt;
          live.pointerShake = Math.max(-0.1, Math.min(0.1, live.pointerShake));
          const pointerAngle = live.pointerLean + live.pointerShake;
          live.pointer.rotation = pointerAngle;
          // The loose pin does not rotate in a mathematically perfect fixed
          // socket: its base slips a few pixels as inertia loads either side.
          live.pointer.position.set(live.basePointerX + Math.sin(pointerAngle) * 7, live.basePointerY + Math.abs(pointerAngle) * 2);

          const wheelPulse = live.wheelPulse;
          if (wheelPulse > 0) {
            live.wheelPulse = Math.max(0, wheelPulse - 0.075 * frameScale);
            const ease = 1 - Math.pow(1 - wheelPulse, 3);
            live.wheelWrap.scale.set(live.baseWheelWrapScale * (1 + ease * 0.025));
          } else {
            live.wheelWrap.scale.set(live.baseWheelWrapScale);
          }
          const pointerPulse = live.pointerPulse;
          if (pointerPulse > 0) {
            live.pointerPulse = Math.max(0, pointerPulse - 0.12 * frameScale);
            const ease = 1 - Math.pow(1 - pointerPulse, 3);
            live.pointer.scale.set(live.basePointerScale * (1 + ease * 0.035));
          } else {
            live.pointer.scale.set(live.basePointerScale);
          }
        });
        setPixiReady(true);
      } catch {
        // The DOM image beneath the canvas is the production fallback.
        setPixiReady(false);
      }
    };

    void start();
    return () => {
      cancelled = true;
      observer?.disconnect();
      stopIntro();
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      runtime?.app.destroy(true);
      setPixiReady(false);
    };
  }, [assets.pointer, assets.wheel, layoutVariant, options.length, stopIntro]);

  React.useEffect(() => {
    if (runtimeReadyToken === 0 || disabled || reducedMotion || options.length !== MIN_MOOD_WHEEL_OPTIONS || introPlayedRef.current) return;
    if (!shouldPlayIntro(intro, introStorageKey, Math.max(1, introPlayLimit))) return;
    introPlayedRef.current = true;
    const resting = findNeutralIndex(options, selectedIndexRef.current);
    const started = performance.now() + 180;

    const frame = (time: number) => {
      const progress = Math.max(0, Math.min(1, (time - started) / INTRO_ANIMATION_MS));
      setVisualOffset(introOffsetAt(progress, resting, options.length));
      if (progress < 1) {
        introFrameRef.current = requestAnimationFrame(frame);
      } else {
        introFrameRef.current = null;
        setVisualOffset(selectedIndexRef.current);
      }
    };
    introFrameRef.current = requestAnimationFrame(frame);
    return stopIntro;
  }, [disabled, intro, introPlayLimit, introStorageKey, options, reducedMotion, runtimeReadyToken, setVisualOffset, stopIntro]);

  const shift = React.useCallback((direction: -1 | 1, source: MoodWheelChangeSource) => {
    if (disabled) return;
    stopIntro();
    if (onAttemptInteract && !onAttemptInteract()) return;
    const next = clampWheelIndex(selectedIndex + direction, options.length);
    const runtime = runtimeRef.current;
    if (runtime) {
      runtime.targetPointerLean = Math.max(-POINTER_MAX_LEAN_RADIANS, Math.min(POINTER_MAX_LEAN_RADIANS, direction * POINTER_MAX_LEAN_RADIANS));
      if (!reducedMotion) runtime.pointerShakeVelocity += direction * 0.65;
    }
    setVisualOffset(next);
    publishIndex(next, source);
  }, [disabled, onAttemptInteract, options.length, publishIndex, reducedMotion, selectedIndex, setVisualOffset, stopIntro]);

  const pickEdge = React.useCallback((index: number) => {
    if (disabled) return;
    stopIntro();
    if (onAttemptInteract && !onAttemptInteract()) return;
    const runtime = runtimeRef.current;
    if (runtime && !reducedMotion) {
      const direction = Math.sign(index - selectedIndex);
      if (direction !== 0) runtime.pointerShakeVelocity += direction * 0.65;
    }
    setVisualOffset(index);
    publishIndex(index, "control");
  }, [disabled, onAttemptInteract, publishIndex, reducedMotion, selectedIndex, setVisualOffset, stopIntro]);

  const hasUsableOptions = options.every((option) => option.value.length > 0 && option.label.trim().length > 0);
  const hasUniqueValues = hasUsableOptions && new Set(options.map((option) => option.value)).size === options.length;
  if (options.length !== MIN_MOOD_WHEEL_OPTIONS || !hasUsableOptions || !hasUniqueValues) {
    return (
      <div className={["muzluk-mood-wheel muzluk-mood-wheel--invalid", className].filter(Boolean).join(" ")} style={style} role="alert">
        A mood wheel needs exactly five unique options so its authored hit points stay aligned.
      </div>
    );
  }

  const rotation = wheelRotation(fallbackOffset, options.length);
  const first = options[0];
  const last = options[options.length - 1];

  return (
    <div className={["muzluk-mood-wheel", className].filter(Boolean).join(" ")} style={style} data-disabled={disabled || undefined} data-layout={layoutVariant} data-dragging={dragging || undefined}>
      <div
        ref={mountRef}
        className="muzluk-mood-wheel__viewport"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={messages.ariaLabel}
        aria-valuemin={1}
        aria-valuemax={options.length}
        aria-valuenow={selectedIndex + 1}
        aria-valuetext={selected?.ariaLabel ?? selected?.label}
        data-pixi-ready={pixiReady || undefined}
        data-selected-value={selected?.value}
        data-dragging={dragging || undefined}
        onPointerDown={(event) => {
          if (disabled) return;
          stopIntro();
          if (onAttemptInteract && !onAttemptInteract()) return;
          setDragging(true);
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            previousX: event.clientX,
            previousTime: event.timeStamp || performance.now(),
            velocityX: 0,
            startOffset: offsetRef.current,
            moved: false,
          };
          capturePointerSafely(event.currentTarget, event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId || disabled) return;
          const totalX = event.clientX - drag.startX;
          const totalY = event.clientY - drag.startY;
          if (!drag.moved && Math.abs(totalY) > 8 && Math.abs(totalY) > Math.abs(totalX) * 1.08) {
            dragRef.current = null;
            setDragging(false);
            releasePointerSafely(event.currentTarget, event.pointerId);
            return;
          }
          const frameDeltaX = event.clientX - drag.previousX;
          const now = event.timeStamp || performance.now();
          const elapsed = Math.max(8, now - drag.previousTime);
          const instantaneousVelocity = (frameDeltaX / elapsed) * 1_000;
          drag.velocityX = drag.velocityX * 0.72 + instantaneousVelocity * 0.28;
          drag.previousX = event.clientX;
          drag.previousTime = now;
          const width = event.currentTarget.getBoundingClientRect().width;
          const slotWidth = wheelSlotWidth(width, options.length);
          const offset = wheelOffsetFromDrag(drag.startOffset, event.clientX - drag.startX, slotWidth);
          drag.moved = drag.moved || Math.abs(event.clientX - drag.startX) > 2;
          setVisualOffset(offset);
          const next = clampWheelIndex(offset, options.length);
          const runtime = runtimeRef.current;
          if (runtime) {
            runtime.targetPointerLean = Math.max(
              -POINTER_MAX_LEAN_RADIANS,
              Math.min(POINTER_MAX_LEAN_RADIANS, (frameDeltaX / Math.max(slotWidth * 0.34, 1)) * POINTER_MAX_LEAN_RADIANS),
            );
            if (!reducedMotion) {
              const swipeVelocity = frameDeltaX / Math.max(slotWidth, 1);
              runtime.pointerShakeVelocity += Math.max(-1.4, Math.min(1.4, swipeVelocity * 0.42));
            }
          }
          publishIndex(next, "drag");
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const width = event.currentTarget.getBoundingClientRect().width;
          const slotWidth = wheelSlotWidth(width, options.length);
          const next = projectedWheelIndex(offsetRef.current, drag.velocityX, slotWidth, options.length);
          dragRef.current = null;
          setDragging(false);
          if (drag.moved) {
            setVisualOffset(next);
            publishIndex(next, "drag");
          } else {
            // A tap is not a partial drag: return to the selected detent.
            setVisualOffset(selectedIndex);
          }
          if (runtimeRef.current) runtimeRef.current.targetPointerLean = 0;
          releasePointerSafely(event.currentTarget, event.pointerId);
        }}
        onPointerCancel={(event) => {
          dragRef.current = null;
          setDragging(false);
          setVisualOffset(selectedIndex);
          if (runtimeRef.current) runtimeRef.current.targetPointerLean = 0;
          releasePointerSafely(event.currentTarget, event.pointerId);
        }}
        onWheel={(event) => {
          if (disabled) return;
          // Vertical wheel/trackpad travel belongs to the containing question reel.
          // Horizontal travel keeps controlling the authored wheel itself.
          if (Math.abs(event.deltaY) >= Math.abs(event.deltaX) && !event.shiftKey) return;
          const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
          if (Math.abs(delta) < WHEEL_SCROLL_THRESHOLD) return;
          event.preventDefault();
          shift(delta > 0 ? 1 : -1, "wheel");
        }}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            shift(-1, "keyboard");
          }
          if (["ArrowRight", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            shift(1, "keyboard");
          }
        }}
      >
        <img
          alt=""
          aria-hidden="true"
          className="muzluk-mood-wheel__fallback-wheel"
          src={assets.wheel}
          style={{ transform: `translate(-50%, 48%) rotate(${rotation}rad)`, transition: dragging ? "none" : undefined }}
        />
        <img
          alt=""
          aria-hidden="true"
          className="muzluk-mood-wheel__fallback-pointer"
          src={assets.pointer}
          style={{ transform: `translateX(calc(-50% + ${reducedMotion ? 0 : Math.sin(Math.max(-0.13, Math.min(0.13, -ambientVelocityY / 3_600))) * 7}px)) rotate(${reducedMotion ? 0 : Math.max(-0.13, Math.min(0.13, -ambientVelocityY / 3_600))}rad)` }}
        />
      </div>

      {showControls ? (
        <div className="muzluk-mood-wheel__controls">
          <button type="button" disabled={disabled} onClick={() => pickEdge(0)} className="muzluk-mood-wheel__edge">
            {first?.label}
          </button>
          <button type="button" disabled={disabled || selectedIndex <= 0} onClick={() => shift(-1, "control")} aria-label={messages.previous} className="muzluk-mood-wheel__icon-button">
            {renderPreviousIcon?.() ?? <Chevron direction="left" />}
          </button>
          <output className="muzluk-mood-wheel__current" aria-live="polite">{selected?.label}</output>
          <button type="button" disabled={disabled || selectedIndex >= options.length - 1} onClick={() => shift(1, "control")} aria-label={messages.next} className="muzluk-mood-wheel__icon-button">
            {renderNextIcon?.() ?? <Chevron direction="right" />}
          </button>
          <button type="button" disabled={disabled} onClick={() => pickEdge(options.length - 1)} className="muzluk-mood-wheel__edge muzluk-mood-wheel__edge--last">
            {last?.label}
          </button>
        </div>
      ) : null}

      {showHint ? <p className="muzluk-mood-wheel__hint"><SwipeIcon spinning={hintSpinActive} /><span>{messages.hint}</span></p> : null}
    </div>
  );
}
