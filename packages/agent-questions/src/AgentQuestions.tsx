"use client";

import * as React from "react";
import revealSoundUrl from "./assets/question-reveal.wav";
import { resolveMessages } from "./messages";
import { AnswerCue, type AnswerCueValue } from "./AnswerCue";
import { QuestionCard } from "./QuestionCard";
import type { AgentQuestion } from "./schema";
import type {
  AgentQuestionAnswer,
  AgentQuestionMessages,
  AgentQuestionResult,
  AgentQuestionSkip,
  RenderQuestionOption,
  VoiceTranscriber,
} from "./types";
import { useReducedMotion } from "./useReducedMotion";
import "./styles.css";

const ANSWER_LOCK_MS = 150;
const FALLBACK_HEIGHT = 220;
const CARD_GAP = 12;
const SWIPE_DISTANCE = 52;
const SWIPE_RATIO = 0.16;
const SWIPE_VELOCITY = 420;
const MAX_DRAG_RATIO = 0.94;

type DragState = {
  axis: "pending" | "vertical";
  pointerId: number;
  startX: number;
  startY: number;
  previousY: number;
  previousAt: number;
  velocityY: number;
};

type SpringState = {
  value: number;
  velocity: number;
};

type PageTransition = Readonly<{
  durationMs: number;
  index: number;
  offset: number;
}>;

type WheelGesture = {
  offset: number;
  previousAt: number;
  velocityY: number;
};

/** A tiny interruptible spring keeps paging and measured-height changes physical without a motion dependency. */
function useSpringNumber(target: number, immediate: boolean, config: { stiffness: number; damping: number; mass: number }) {
  const stateRef = React.useRef<SpringState>({ value: target, velocity: 0 });
  const frameRef = React.useRef<number | null>(null);
  const [value, setValue] = React.useState(target);

  React.useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (immediate) {
      stateRef.current = { value: target, velocity: 0 };
      setValue(target);
      return;
    }

    let previousTime = performance.now();
    const tick = (time: number) => {
      const dt = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const state = stateRef.current;
      const acceleration = ((target - state.value) * config.stiffness - state.velocity * config.damping) / config.mass;
      state.velocity += acceleration * dt;
      state.value += state.velocity * dt;
      if (Math.abs(target - state.value) < 0.08 && Math.abs(state.velocity) < 0.08) {
        state.value = target;
        state.velocity = 0;
        setValue(target);
        frameRef.current = null;
        return;
      }
      setValue(state.value);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [config.damping, config.mass, config.stiffness, immediate, target]);

  return immediate ? target : value;
}

export type AgentQuestionsProps = Readonly<{
  questions: readonly AgentQuestion[];
  title?: React.ReactNode;
  initialAnswers?: readonly AgentQuestionAnswer[];
  initialStep?: number;
  locale?: string;
  messages?: Partial<AgentQuestionMessages>;
  status?: string;
  theme?: "classic" | "ribbon";
  sound?: boolean;
  assets?: Partial<AgentQuestionAssets>;
  className?: string;
  ariaLabel?: string;
  transcribe?: VoiceTranscriber;
  renderOption?: RenderQuestionOption;
  onAnswer?: (answer: AgentQuestionAnswer) => void | Promise<void>;
  onSkip?: (skip: AgentQuestionSkip) => void | Promise<void>;
  onComplete?: (result: AgentQuestionResult) => void | Promise<void>;
  onStepChange?: (step: number) => void;
  onDismiss?: () => void;
}>;

export type AgentQuestionAssets = Readonly<{
  /** The short reveal cue played when a new card settles in. */
  reveal: string;
}>;

const DEFAULT_ASSETS: AgentQuestionAssets = { reveal: revealSoundUrl };
/** Public URL for the exact shipped question reveal cue. */
export const AGENT_QUESTIONS_ASSETS: AgentQuestionAssets = DEFAULT_ASSETS;

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="muzluk-agent-questions__small-icon">
      <path d={direction === "up" ? "m4.5 12.5 5.5-5.5 5.5 5.5" : "m4.5 7.5 5.5 5.5 5.5-5.5"} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="muzluk-agent-questions__small-icon">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

function answerMap(initialAnswers: readonly AgentQuestionAnswer[]) {
  return Object.fromEntries(initialAnswers.map((answer) => [answer.questionId, answer]));
}

function orderedAnswers(questions: readonly AgentQuestion[], answers: Record<string, AgentQuestionAnswer>) {
  return questions.flatMap((question) => answers[question.id] ? [answers[question.id]!] : []);
}

function resultFor(
  questions: readonly AgentQuestion[],
  answers: Record<string, AgentQuestionAnswer>,
  skipped: ReadonlySet<string>,
): AgentQuestionResult {
  return {
    answers: orderedAnswers(questions, answers),
    skippedQuestionIds: questions.filter((question) => skipped.has(question.id)).map((question) => question.id),
  };
}

function canStartPageSwipe(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest("textarea, input, select, [contenteditable='true']");
}

/** Pointer capture can disappear during a native scroll or browser handoff. */
function capturePointerSafely(element: Element, pointerId: number) {
  if (!(element instanceof HTMLElement)) return;
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Paging can still resolve from the last sampled drag position.
  }
}

/** Do not let a stale pointer id interrupt a settled reel transition. */
function releasePointerSafely(element: Element, pointerId: number) {
  if (!(element instanceof HTMLElement)) return;
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // Ignore stale ids after resetDrag has restored the idle state.
  }
}

/**
 * Complete agent follow-up surface: one measured card, physical paging, async
 * commits, retries, and explicit answer/skip receipts owned by the caller.
 */
export function AgentQuestions({
  questions,
  title,
  initialAnswers = [],
  initialStep = 0,
  locale = "en",
  messages: messageOverrides,
  status,
  theme = "classic",
  sound = true,
  assets: assetOverrides,
  className,
  ariaLabel,
  transcribe,
  renderOption,
  onAnswer,
  onSkip,
  onComplete,
  onStepChange,
  onDismiss,
}: AgentQuestionsProps) {
  const messages = resolveMessages(locale, messageOverrides);
  const assets = { ...DEFAULT_ASSETS, ...assetOverrides };
  const reducedMotion = useReducedMotion();
  const signature = React.useMemo(() => JSON.stringify(questions), [questions]);
  const [answers, setAnswers] = React.useState<Record<string, AgentQuestionAnswer>>(() => answerMap(initialAnswers));
  const [skipped, setSkipped] = React.useState<Set<string>>(() => new Set());
  const [textDrafts, setTextDrafts] = React.useState<Record<string, string>>({});
  const [wheelDrafts, setWheelDrafts] = React.useState<Record<string, string>>({});
  const [numberDrafts, setNumberDrafts] = React.useState<Record<string, number>>({});
  const [activeIndex, setActiveIndex] = React.useState(() => Math.max(0, Math.min(initialStep, questions.length - 1)));
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCompletion, setRetryCompletion] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [confirmSkipId, setConfirmSkipId] = React.useState<string | null>(null);
  const [height, setHeight] = React.useState(FALLBACK_HEIGHT);
  const [dragY, setDragY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [pageTransition, setPageTransition] = React.useState<PageTransition | null>(null);
  const [reelVelocityY, setReelVelocityY] = React.useState(0);
  const [answerPulse, setAnswerPulse] = React.useState(0);
  const [answerCue, setAnswerCue] = React.useState<AnswerCueValue | null>(null);
  const [revealPulse, setRevealPulse] = React.useState(0);
  const dragRef = React.useRef<DragState | null>(null);
  const dragConsumedRef = React.useRef(false);
  const wheelGestureRef = React.useRef<WheelGesture | null>(null);
  const wheelSettleRef = React.useRef<number | null>(null);
  const previousActiveRef = React.useRef<number | null>(null);
  const latestCompletionRef = React.useRef<AgentQuestionResult | null>(null);
  const revealAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const lastRevealAtRef = React.useRef(0);

  const playReveal = React.useCallback(() => {
    if (!sound || reducedMotion) return;
    const now = Date.now();
    if (now - lastRevealAtRef.current < 180) return;
    lastRevealAtRef.current = now;
    try {
      const audio = revealAudioRef.current ?? new Audio(assets.reveal);
      revealAudioRef.current = audio;
      audio.volume = 0.48;
      audio.playbackRate = 1.01;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } catch {
      // Sound is a cue, never a dependency of navigation.
    }
  }, [assets.reveal, reducedMotion, sound]);

  React.useEffect(() => {
    setAnswers(answerMap(initialAnswers));
    setSkipped(new Set());
    setTextDrafts({});
    setWheelDrafts({});
    setNumberDrafts({});
    setActiveIndex(Math.max(0, Math.min(initialStep, questions.length - 1)));
    setPendingId(null);
    setError(null);
    setRetryCompletion(false);
    setCompleted(false);
    setConfirmSkipId(null);
    setAnswerCue(null);
    setAnswerPulse(0);
    setRevealPulse(0);
    setDragY(0);
    setDragging(false);
    setPageTransition(null);
    setReelVelocityY(0);
    latestCompletionRef.current = null;
    previousActiveRef.current = null;
    if (wheelSettleRef.current !== null) window.clearTimeout(wheelSettleRef.current);
    wheelSettleRef.current = null;
    wheelGestureRef.current = null;
  }, [signature]);

  React.useEffect(() => () => {
    if (wheelSettleRef.current !== null) window.clearTimeout(wheelSettleRef.current);
  }, []);

  React.useEffect(() => {
    if (previousActiveRef.current === activeIndex) return;
    const previous = previousActiveRef.current;
    previousActiveRef.current = activeIndex;
    if (previous !== null) onStepChange?.(activeIndex);
    setRevealPulse((current) => current + 1);
    playReveal();
  }, [activeIndex, onStepChange, playReveal]);

  const active = questions[activeIndex];
  const previous = questions[activeIndex - 1];
  const next = questions[activeIndex + 1];
  const paging = pageTransition !== null;
  const busy = pendingId !== null || paging;
  const animatedHeight = useSpringNumber(height, reducedMotion, { stiffness: 420, damping: 44, mass: 0.7 });
  const animatedDragY = useSpringNumber(dragY, dragging || reducedMotion, { stiffness: 470, damping: 42, mass: 0.72 });

  /** Moves the measured reel a full card before atomically adopting its neighbor. */
  const requestNavigation = React.useCallback((index: number, releaseVelocityY = 0) => {
    const target = Math.max(0, Math.min(index, questions.length - 1));
    if (target === activeIndex || pageTransition) return;
    setConfirmSkipId(null);
    setDragY(0);
    if (reducedMotion) {
      setActiveIndex(target);
      return;
    }
    const direction = target > activeIndex ? 1 : -1;
    const offset = direction > 0 ? -(height + CARD_GAP) : height + CARD_GAP;
    const durationMs = Math.round(Math.max(260, Math.min(430, 430 - Math.abs(releaseVelocityY) * 0.08)));
    setReelVelocityY(offset / Math.max(durationMs / 1_000, 0.001));
    setPageTransition({
      durationMs,
      index: target,
      offset,
    });
  }, [activeIndex, height, pageTransition, questions.length, reducedMotion]);

  /** Transition events can be suppressed by a host tab switch, so paging also has a deterministic settle fallback. */
  const completePageTransition = React.useCallback(() => {
    if (!pageTransition) return;
    const target = pageTransition.index;
    setPageTransition(null);
    setDragY(0);
    setReelVelocityY(0);
    setActiveIndex(target);
  }, [pageTransition]);

  React.useEffect(() => {
    if (!pageTransition) return;
    const timer = window.setTimeout(completePageTransition, 520);
    return () => window.clearTimeout(timer);
  }, [completePageTransition, pageTransition]);

  const finish = React.useCallback(async (nextResult: AgentQuestionResult) => {
    latestCompletionRef.current = nextResult;
    setRetryCompletion(false);
    try {
      await onComplete?.(nextResult);
      setCompleted(true);
    } catch {
      setError(messages.error);
      setRetryCompletion(true);
    }
  }, [messages.error, onComplete]);

  const submit = React.useCallback(async (question: AgentQuestion, value: string | number, label: string) => {
    if (busy || completed) return;
    const answer: AgentQuestionAnswer = {
      questionId: question.id,
      kind: question.kind,
      value,
      label,
      answeredAt: Date.now(),
    };
    setPendingId(question.id);
    setError(null);
    setAnswerCue({ key: `${question.id}:${Date.now()}:${String(value)}`, step: activeIndex });
    try {
      await onAnswer?.(answer);
      const nextAnswers = { ...answers, [question.id]: answer };
      const nextSkipped = new Set(skipped);
      nextSkipped.delete(question.id);
      setAnswers(nextAnswers);
      setSkipped(nextSkipped);
      setConfirmSkipId(null);
      setAnswerPulse((current) => current + 1);
      if (!reducedMotion) await new Promise<void>((resolve) => window.setTimeout(resolve, ANSWER_LOCK_MS));
      if (activeIndex >= questions.length - 1) {
        await finish(resultFor(questions, nextAnswers, nextSkipped));
      } else {
        requestNavigation(activeIndex + 1);
      }
    } catch {
      setError(messages.error);
    } finally {
      setPendingId(null);
    }
  }, [activeIndex, answers, busy, completed, finish, messages.error, onAnswer, questions, reducedMotion, requestNavigation, skipped]);

  const skipQuestion = React.useCallback(async (question: AgentQuestion, confirmLast = false) => {
    if (busy || completed || question.required) return;
    const isLast = activeIndex >= questions.length - 1;
    if (isLast && !confirmLast) {
      setConfirmSkipId(question.id);
      return;
    }
    setPendingId(question.id);
    setError(null);
    try {
      await onSkip?.({ questionId: question.id, index: activeIndex });
      const nextSkipped = new Set(skipped);
      nextSkipped.add(question.id);
      setSkipped(nextSkipped);
      setConfirmSkipId(null);
      if (isLast) {
        await finish(resultFor(questions, answers, nextSkipped));
      } else {
        requestNavigation(activeIndex + 1);
      }
    } catch {
      setError(messages.error);
    } finally {
      setPendingId(null);
    }
  }, [activeIndex, answers, busy, completed, finish, messages.error, onSkip, questions, requestNavigation, skipped]);

  const goBackward = React.useCallback(() => {
    if (busy || dragging || activeIndex <= 0) return;
    requestNavigation(activeIndex - 1);
  }, [activeIndex, busy, dragging, requestNavigation]);

  const goForward = React.useCallback(async () => {
    if (!active || busy || dragging || activeIndex >= questions.length - 1) return;
    if (answers[active.id] || skipped.has(active.id)) {
      requestNavigation(activeIndex + 1);
      return;
    }
    await skipQuestion(active, true);
  }, [active, activeIndex, answers, busy, dragging, questions.length, requestNavigation, skipQuestion, skipped]);

  /** Trackpad and mouse-wheel input moves the same reel continuously, then commits at release. */
  const settleWheelGesture = React.useCallback(async () => {
    const gesture = wheelGestureRef.current;
    wheelGestureRef.current = null;
    wheelSettleRef.current = null;
    if (!gesture || !active) return;
    const commit = Math.abs(gesture.offset) >= Math.max(38, height * 0.12) || Math.abs(gesture.velocityY) >= SWIPE_VELOCITY;
    setDragging(false);
    setDragY(0);
    setReelVelocityY(0);
    if (!commit) return;
    if (gesture.offset < 0) {
      if (answers[active.id] || skipped.has(active.id)) requestNavigation(activeIndex + 1, gesture.velocityY);
      else await skipQuestion(active, true);
    } else if (activeIndex > 0) {
      requestNavigation(activeIndex - 1, gesture.velocityY);
    }
  }, [active, activeIndex, answers, height, requestNavigation, skipQuestion, skipped]);

  const resetDrag = React.useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setDragY(0);
    setReelVelocityY(0);
  }, []);

  async function releaseDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientY - drag.startY;
    const threshold = Math.max(SWIPE_DISTANCE, height * SWIPE_RATIO);
    const commit = Math.abs(distance) >= threshold || Math.abs(drag.velocityY) >= SWIPE_VELOCITY;
    const forward = distance < 0;
    resetDrag();
    releasePointerSafely(event.currentTarget, event.pointerId);
    if (!commit || !active) return;
    if (forward) {
      if (answers[active.id] || skipped.has(active.id)) requestNavigation(activeIndex + 1, drag.velocityY);
      else await skipQuestion(active, true);
    } else if (activeIndex > 0) {
      requestNavigation(activeIndex - 1, drag.velocityY);
    }
  }

  if (!active || questions.length === 0) return null;

  const currentAnswer = answers[active.id];
  const progress = ((activeIndex + 1) / questions.length) * 100;
  const formatter = new Intl.NumberFormat(locale);
  const position = `${formatter.format(activeIndex + 1)}/${formatter.format(questions.length)}`;
  const stageOffset = pageTransition?.offset ?? animatedDragY;
  const stageTransform = `translate3d(0, ${stageOffset}px, 0)`;
  const commitDistance = Math.min(Math.max(height, 1) * SWIPE_RATIO, SWIPE_DISTANCE);
  const directProgress = Math.max(0, Math.min(Math.abs(dragY) / Math.max(commitDistance, 1), 1));
  const commitProgress = pageTransition ? 1 : directProgress;
  const dragDirection = stageOffset < 0 ? 1 : stageOffset > 0 ? -1 : 0;

  const card = (question: AgentQuestion, preview: boolean) => (
    <QuestionCard
      key={`${question.id}:${preview ? "preview" : "active"}`}
      question={question}
      locale={locale}
      messages={messages}
      disabled={busy || completed}
      lockedAnswer={answers[question.id]?.label ?? answers[question.id]?.value}
      answeredValue={answers[question.id]?.value}
      preview={preview}
      textDraft={textDrafts[question.id] ?? ""}
      wheelDraft={wheelDrafts[question.id]}
      numberDraft={numberDrafts[question.id]}
      transcribe={transcribe}
      sound={sound}
      renderOption={renderOption}
      onTextDraft={(value) => setTextDrafts((current) => ({ ...current, [question.id]: value }))}
      onWheelDraft={(value) => setWheelDrafts((current) => ({ ...current, [question.id]: value }))}
      onNumberDraft={(value) => setNumberDrafts((current) => ({ ...current, [question.id]: value }))}
      onSubmit={(value, label) => void submit(question, value, label)}
      onHeight={(nextHeight) => setHeight((current) => {
        const safeHeight = nextHeight > 1 ? nextHeight : FALLBACK_HEIGHT;
        return Math.abs(current - safeHeight) < 1 ? current : safeHeight;
      })}
      answerPulse={answerPulse}
      revealPulse={revealPulse}
      resolving={!preview && pendingId === question.id}
      ambientVelocityY={reelVelocityY}
    />
  );

  return (
    <section
      className={["muzluk-agent-questions", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? messages.ariaLabel}
      data-theme={theme}
      data-status={status}
      data-complete={completed || undefined}
    >
      {title ? <h2 className="muzluk-agent-questions__title">{title}</h2> : null}

      {onDismiss ? (
        <header className="muzluk-agent-questions__header">
          <button type="button" className="muzluk-agent-questions__dismiss" onClick={onDismiss} aria-label={messages.dismiss}><CloseIcon /></button>
        </header>
      ) : null}

      <div className="muzluk-agent-questions__progress-row">
        <div className="muzluk-agent-questions__step-buttons">
          <button type="button" disabled={busy || dragging || activeIndex <= 0} onClick={goBackward} aria-label={messages.previousQuestion}><Chevron direction="up" /></button>
          <button type="button" disabled={busy || dragging || activeIndex >= questions.length - 1 || active.required && !currentAnswer} onClick={() => void goForward()} aria-label={messages.nextQuestion}><Chevron direction="down" /></button>
        </div>
        <div className="muzluk-agent-questions__progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <span className="muzluk-agent-questions__position">{position}</span>
      </div>

      {error ? <p className="muzluk-agent-questions__error" role="alert">{error}</p> : null}

      <div
        className="muzluk-agent-questions__window"
        style={{ height: animatedHeight }}
        data-active-index={activeIndex}
        data-dragging={dragging || undefined}
        data-paging={paging || undefined}
        onClickCapture={(event) => {
          if (!dragConsumedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          dragConsumedRef.current = false;
        }}
      >
        <AnswerCue cue={answerCue} reducedMotion={reducedMotion} className="muzluk-agent-questions__answer-cue" />
        <div
          className="muzluk-agent-questions__stage"
          style={{
            transform: stageTransform,
            "--aq-page-duration": `${pageTransition?.durationMs ?? 430}ms`,
          } as React.CSSProperties}
          tabIndex={0}
          onTransitionEnd={(event) => {
            if (event.propertyName !== "transform" || event.target !== event.currentTarget || !pageTransition) return;
            completePageTransition();
          }}
          onPointerDown={(event) => {
            if (busy || paging || !canStartPageSwipe(event.target)) return;
            dragRef.current = {
              axis: "pending",
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              previousY: event.clientY,
              previousAt: performance.now(),
              velocityY: 0,
            };
            dragConsumedRef.current = false;
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const horizontalDistance = event.clientX - drag.startX;
            const verticalDistance = event.clientY - drag.startY;
            if (drag.axis === "pending") {
              if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 8) return;
              if (Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.08) {
                dragRef.current = null;
                setDragging(false);
                return;
              }
              drag.axis = "vertical";
              setDragging(true);
              capturePointerSafely(event.currentTarget, event.pointerId);
            }
            const now = performance.now();
            const elapsed = Math.max(1, now - drag.previousAt);
            drag.velocityY = ((event.clientY - drag.previousY) / elapsed) * 1_000;
            setReelVelocityY((current) => current * 0.68 + drag.velocityY * 0.32);
            drag.previousY = event.clientY;
            drag.previousAt = now;
            const raw = verticalDistance;
            if (Math.abs(raw) > 10) dragConsumedRef.current = true;
            const blockedBack = raw > 0 && activeIndex <= 0;
            const blockedForward = raw < 0 && (activeIndex >= questions.length - 1 || active.required && !currentAnswer);
            const resistance = blockedBack || blockedForward ? 0.18 : 1;
            const max = height * MAX_DRAG_RATIO;
            setDragY(Math.max(-max, Math.min(max, raw * resistance)));
          }}
          onPointerUp={(event) => void releaseDrag(event)}
          onPointerCancel={(event) => {
            resetDrag();
            setReelVelocityY(0);
            releasePointerSafely(event.currentTarget, event.pointerId);
          }}
          onWheel={(event) => {
            if ((event.target as HTMLElement).closest("[data-no-question-swipe], input, textarea")) return;
            if (Math.abs(event.deltaY) < 0.5 || busy) return;
            event.preventDefault();
            const now = performance.now();
            const previous = wheelGestureRef.current;
            const elapsed = Math.max(8, now - (previous?.previousAt ?? now - 16));
            const signedDelta = -event.deltaY;
            const blockedBack = signedDelta > 0 && activeIndex <= 0;
            const blockedForward = signedDelta < 0 && (activeIndex >= questions.length - 1 || active.required && !currentAnswer);
            const offset = Math.max(-height * MAX_DRAG_RATIO, Math.min(height * MAX_DRAG_RATIO, (previous?.offset ?? 0) + signedDelta * (blockedBack || blockedForward ? 0.18 : 0.72)));
            const instantVelocity = (signedDelta / elapsed) * 1_000;
            const velocityY = (previous?.velocityY ?? 0) * 0.62 + instantVelocity * 0.38;
            wheelGestureRef.current = { offset, previousAt: now, velocityY };
            setDragging(true);
            setDragY(offset);
            setReelVelocityY(velocityY);
            if (wheelSettleRef.current !== null) window.clearTimeout(wheelSettleRef.current);
            wheelSettleRef.current = window.setTimeout(() => void settleWheelGesture(), 86);
          }}
          onKeyDown={(event) => {
            if (["ArrowDown", "PageDown"].includes(event.key)) { event.preventDefault(); void goForward(); }
            if (["ArrowUp", "PageUp"].includes(event.key)) { event.preventDefault(); goBackward(); }
          }}
        >
          {previous ? <div className="muzluk-agent-questions__neighbor" style={{ top: -(height + CARD_GAP), transform: `scale(${dragDirection < 0 ? 0.96 + commitProgress * 0.04 : 0.96})`, opacity: dragDirection < 0 ? 0.9 + commitProgress * 0.1 : 0.9 }}>{card(previous, true)}</div> : null}
          <div className="muzluk-agent-questions__current-card" style={{ transform: `scale(${1 - commitProgress * 0.015})` }}>{card(active, false)}</div>
          {next ? <div className="muzluk-agent-questions__neighbor" style={{ top: height + CARD_GAP, transform: `scale(${dragDirection > 0 ? 0.96 + commitProgress * 0.04 : 0.96})`, opacity: dragDirection > 0 ? 0.9 + commitProgress * 0.1 : 0.9 }}>{card(next, true)}</div> : null}
        </div>
      </div>

      {retryCompletion ? (
        <button type="button" className="muzluk-agent-questions__primary" disabled={busy} onClick={() => { const result = latestCompletionRef.current; if (result) void finish(result); }}>{messages.retryFinish}</button>
      ) : !currentAnswer && !active.required ? (
        <button type="button" className={confirmSkipId === active.id ? "muzluk-agent-questions__primary" : "muzluk-agent-questions__skip"} disabled={busy} onClick={() => void skipQuestion(active, confirmSkipId === active.id)}>
          {confirmSkipId === active.id ? messages.skipConfirm : messages.skip}
        </button>
      ) : null}
    </section>
  );
}

export const QuestionReel = AgentQuestions;
