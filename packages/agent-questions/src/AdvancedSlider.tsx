"use client";

import * as React from "react";
import impactUrl from "./assets/question-answered.wav";
import tickOneUrl from "./assets/slider-tick-1.wav";
import tickTwoUrl from "./assets/slider-tick-2.wav";
import tickThreeUrl from "./assets/slider-tick-3.wav";
import tickFourUrl from "./assets/slider-tick-4.wav";
import {
  buildAdvancedSliderTicks,
  fitAdvancedSliderGeometry,
  getAdvancedSliderGeometry,
  normalizeAdvancedSliderValue,
  projectAdvancedSliderValue,
  resolveAdvancedSliderRange,
  rubberBandAdvancedSliderValue,
} from "./advancedSliderModel";
import { useReducedMotion } from "./useReducedMotion";

const SLIDER_SPRING = { damping: 31, mass: 0.72, stiffness: 430 } as const;
const TICK_RATES = [0.982, 0.998, 1.012, 1.026] as const;

export const ADVANCED_SLIDER_ASSETS = {
  impact: impactUrl,
  ticks: [tickOneUrl, tickTwoUrl, tickThreeUrl, tickFourUrl],
} as const;

export type AdvancedSliderProps = Readonly<{
  ariaLabel: string;
  decrementLabel: string;
  incrementLabel: string;
  min: number;
  max: number;
  step: number;
  value?: number;
  defaultValue?: number;
  majorStep?: number;
  disabled?: boolean;
  sound?: boolean;
  unit?: string;
  formatValue?: (value: number) => string;
  milestoneValues?: readonly number[];
  hugeMilestoneValues?: readonly number[];
  zoneBreakValues?: readonly number[];
  className?: string;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  onDetent?: (value: number) => void;
}>;

type DragState = {
  pointerId: number;
  startValue: number;
  startX: number;
  previousAt: number;
  previousX: number;
  velocityX: number;
};

function isMajorTick(tick: number, min: number, majorStep: number) {
  const position = (tick - min) / majorStep;
  return Math.abs(position - Math.round(position)) < 0.000001;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d={direction === "left" ? "m12.5 4.5-5.5 5.5 5.5 5.5" : "m7.5 4.5 5.5 5.5-5.5 5.5"} /></svg>;
}

/**
 * Web port of Muzluk's focus-time ruler: direct travel, real detent crossings,
 * projected release velocity, rubber-band edges, and one highly damped settle.
 */
export function AdvancedSlider({
  ariaLabel,
  decrementLabel,
  incrementLabel,
  min,
  max,
  step,
  value,
  defaultValue,
  majorStep = 5,
  disabled = false,
  sound = true,
  unit,
  formatValue = String,
  milestoneValues = [],
  hugeMilestoneValues = [],
  zoneBreakValues = [],
  className,
  onValueChange,
  onValueCommit,
  onDetent,
}: AdvancedSliderProps) {
  const reducedMotion = useReducedMotion();
  const range = React.useMemo(() => resolveAdvancedSliderRange({ min, max, step, majorStep }), [majorStep, max, min, step]);
  const ticks = React.useMemo(() => buildAdvancedSliderTicks(range), [range]);
  const baseGeometry = React.useMemo(() => getAdvancedSliderGeometry(range, ticks.length), [range, ticks.length]);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const geometry = React.useMemo(() => {
    // A short authored range should occupy the whole control instead of leaving
    // a tiny ruler in the middle. Long ranges keep the native-width ticks and
    // become a freely browsable overflowing ruler.
    return fitAdvancedSliderGeometry(baseGeometry, ticks.length, viewportWidth);
  }, [baseGeometry, ticks.length, viewportWidth]);
  const initial = normalizeAdvancedSliderValue(value ?? defaultValue ?? (range.min + range.max) / 2, range);
  const [currentValue, setCurrentValue] = React.useState(initial);
  const [direction, setDirection] = React.useState<-1 | 0 | 1>(0);
  const [dragging, setDragging] = React.useState(false);
  const [wave, setWave] = React.useState<{ id: number; origin: number; huge: boolean } | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const visualValueRef = React.useRef(initial);
  const selectedRef = React.useRef(initial);
  const dragRef = React.useRef<DragState | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const tickIndexRef = React.useRef(0);
  const waveIdRef = React.useRef(0);
  const audioRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());
  const milestoneSet = React.useMemo(() => new Set(milestoneValues.map((item) => normalizeAdvancedSliderValue(item, range))), [milestoneValues, range]);
  const hugeSet = React.useMemo(() => new Set(hugeMilestoneValues.map((item) => normalizeAdvancedSliderValue(item, range))), [hugeMilestoneValues, range]);
  const zoneSet = React.useMemo(() => new Set(zoneBreakValues.map((item) => normalizeAdvancedSliderValue(item, range))), [range, zoneBreakValues]);

  const play = React.useCallback((url: string, volume: number, rate: number) => {
    if (!sound) return;
    try {
      const audio = audioRef.current.get(url) ?? new Audio(url);
      audioRef.current.set(url, audio);
      audio.volume = volume;
      audio.playbackRate = rate;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } catch {
      // Audio is tactile texture only; slider state never depends on playback.
    }
  }, [sound]);

  React.useEffect(() => {
    if (!sound) return;
    for (const url of [impactUrl, ...ADVANCED_SLIDER_ASSETS.ticks]) {
      const audio = audioRef.current.get(url) ?? new Audio(url);
      audio.preload = "auto";
      audioRef.current.set(url, audio);
    }
  }, [sound]);

  const paint = React.useCallback((nextVisual: number, emit = true) => {
    visualValueRef.current = nextVisual;
    const viewportWidth = viewportRef.current?.clientWidth ?? 1;
    const index = (nextVisual - range.min) / range.step;
    if (railRef.current) {
      railRef.current.style.transform = `translate3d(${viewportWidth / 2 - index * geometry.tickSlotWidth - geometry.tickSlotWidth / 2}px, 0, 0)`;
    }
    const progress = (nextVisual - range.min) / Math.max(range.max - range.min, range.step);
    rootRef.current?.style.setProperty("--as-progress-y", `${(0.5 - progress) * 4}px`);
    const detent = normalizeAdvancedSliderValue(nextVisual, range);
    if (!emit || detent === selectedRef.current) return;
    const previous = selectedRef.current;
    selectedRef.current = detent;
    setDirection(detent > previous ? 1 : -1);
    setCurrentValue(detent);
    onValueChange?.(detent);
    onDetent?.(detent);
    const huge = hugeSet.has(detent);
    const milestone = milestoneSet.has(detent);
    if (huge || milestone) {
      waveIdRef.current += 1;
      setWave({ id: waveIdRef.current, origin: Math.round((detent - range.min) / range.step), huge });
      play(impactUrl, huge ? 0.38 : 0.26, huge ? 1.08 : 0.98);
    } else {
      const soundIndex = tickIndexRef.current++;
      const progress = (detent - range.min) / Math.max(range.max - range.min, range.step);
      play(ADVANCED_SLIDER_ASSETS.ticks[soundIndex % 4]!, 0.16, (TICK_RATES[soundIndex % 4] ?? 1) + progress * 0.09);
    }
  }, [geometry.tickSlotWidth, hugeSet, milestoneSet, onDetent, onValueChange, play, range]);

  const settleTo = React.useCallback((target: number, initialVelocity = 0, commit = true) => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (reducedMotion) {
      paint(target);
      if (commit) onValueCommit?.(target);
      return;
    }
    let position = visualValueRef.current;
    let velocity = initialVelocity;
    let previousAt = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - previousAt) / 1_000));
      previousAt = now;
      const acceleration = ((target - position) * SLIDER_SPRING.stiffness - velocity * SLIDER_SPRING.damping) / SLIDER_SPRING.mass;
      velocity += acceleration * dt;
      position += velocity * dt;
      paint(position);
      if (Math.abs(target - position) < 0.002 && Math.abs(velocity) < 0.01) {
        paint(target);
        frameRef.current = null;
        if (commit) onValueCommit?.(target);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [onValueCommit, paint, reducedMotion]);

  React.useLayoutEffect(() => {
    paint(visualValueRef.current, false);
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setViewportWidth(viewport.clientWidth);
      paint(visualValueRef.current, false);
    });
    observer.observe(viewport);
    setViewportWidth(viewport.clientWidth);
    return () => observer.disconnect();
  }, [paint]);

  React.useEffect(() => {
    const next = normalizeAdvancedSliderValue(value ?? defaultValue ?? initial, range);
    if (dragRef.current) return;
    // Controlled hosts commonly echo onValueChange immediately. That echo must
    // not cancel the live release spring at every crossed detent.
    if (next === selectedRef.current) return;
    selectedRef.current = next;
    setCurrentValue(next);
    settleTo(next, 0, false);
  }, [defaultValue, initial, range, settleTo, value]);

  React.useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  React.useEffect(() => {
    if (!wave) return;
    const timer = window.setTimeout(() => setWave((current) => current?.id === wave.id ? null : current), 1_100);
    return () => window.clearTimeout(timer);
  }, [wave]);

  const stepBy = React.useCallback((amount: number) => {
    if (disabled) return;
    const target = normalizeAdvancedSliderValue(selectedRef.current + amount * range.step, range);
    if (target === selectedRef.current) return;
    settleTo(target, 0, true);
  }, [disabled, range, settleTo]);

  const formatted = formatValue(currentValue);
  const showEveryMajor = ticks.length <= 11;

  return (
    <div ref={rootRef} className={["muzluk-advanced-slider", className].filter(Boolean).join(" ")} data-dragging={dragging || undefined} data-wave={wave?.huge ? "huge" : wave ? "milestone" : undefined} data-disabled={disabled || undefined}>
      <div
        ref={viewportRef}
        className="muzluk-advanced-slider__viewport"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={range.min}
        aria-valuemax={range.max}
        aria-valuenow={currentValue}
        aria-valuetext={`${formatted}${unit ? ` ${unit}` : ""}`}
        onPointerDown={(event) => {
          if (disabled) return;
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          dragRef.current = { pointerId: event.pointerId, startValue: visualValueRef.current, startX: event.clientX, previousAt: performance.now(), previousX: event.clientX, velocityX: 0 };
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId || disabled) return;
          const now = performance.now();
          const elapsed = Math.max(8, now - drag.previousAt);
          const instantaneous = ((event.clientX - drag.previousX) / elapsed) * 1_000;
          drag.velocityX = drag.velocityX * 0.7 + instantaneous * 0.3;
          drag.previousAt = now;
          drag.previousX = event.clientX;
          const rawValue = drag.startValue - ((event.clientX - drag.startX) / geometry.pixelsPerStep) * range.step;
          paint(rubberBandAdvancedSliderValue(rawValue, range.min, range.max));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const target = projectAdvancedSliderValue({ pixelsPerStep: geometry.pixelsPerStep, range, value: visualValueRef.current, velocityX: drag.velocityX });
          const velocity = (-drag.velocityX / Math.max(1, geometry.pixelsPerStep)) * range.step;
          dragRef.current = null;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
          settleTo(target, velocity, true);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragging(false);
          settleTo(normalizeAdvancedSliderValue(visualValueRef.current, range), 0, false);
        }}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowDown"].includes(event.key)) { event.preventDefault(); stepBy(-1); }
          if (["ArrowRight", "ArrowUp"].includes(event.key)) { event.preventDefault(); stepBy(1); }
        }}
      >
        <div ref={railRef} className="muzluk-advanced-slider__rail" style={{ width: ticks.length * geometry.tickSlotWidth }}>
          {ticks.map((tick, index) => {
            const selected = tick === currentValue;
            const past = tick < currentValue;
            const major = isMajorTick(tick, range.min, range.majorStep);
            const labelIndex = Math.round((tick - range.min) / range.majorStep);
            const showLabel = major && (showEveryMajor || labelIndex % 2 === 0);
            const waveDistance = wave ? Math.abs(index - wave.origin) : 0;
            return (
              <span
                className="muzluk-advanced-slider__tick"
                data-major={major || undefined}
                data-past={past || undefined}
                data-selected={selected || undefined}
                data-zone={zoneSet.has(tick) || undefined}
                data-wave-id={wave?.id}
                key={`${tick}:${wave?.id ?? 0}`}
                style={{
                  width: geometry.tickSlotWidth,
                  "--as-tick-width": `${geometry.tickBodyWidth}px`,
                  "--as-tick-height": `${selected ? geometry.selectedTickHeight : major ? geometry.majorTickHeight : geometry.minorTickHeight}px`,
                  "--as-wave-delay": `${waveDistance * (wave?.huge ? 12 : 20)}ms`,
                  "--as-wave-color": ["#ff453a", "#ffd60a", "#30d158", "#0a84ff"][index % 4],
                  "--as-rest-color": selected ? "var(--aq-focus, #0a84ff)" : past ? "var(--aq-card-text, #f2f2f7)" : "var(--aq-tertiary, #6c6c70)",
                } as React.CSSProperties}
              >
                {showLabel ? <span className="muzluk-advanced-slider__tick-label">{tick}</span> : null}
                <i />
              </span>
            );
          })}
        </div>
      </div>

      <div className="muzluk-advanced-slider__footer">
        <div className="muzluk-advanced-slider__steps">
          <button type="button" disabled={disabled || currentValue <= range.min} aria-label={decrementLabel} onClick={() => stepBy(-1)}><Chevron direction="left" /></button>
          <button type="button" disabled={disabled || currentValue >= range.max} aria-label={incrementLabel} onClick={() => stepBy(1)}><Chevron direction="right" /></button>
        </div>
        <output className="muzluk-advanced-slider__readout" data-direction={direction} key={`${direction}:${formatted}`}><strong>{formatted}</strong>{unit ? <span>{unit}</span> : null}</output>
      </div>
    </div>
  );
}
