"use client";

import * as React from "react";
import { MoodWheel } from "@muzluk/mood-wheel";
import type { AgentQuestion, QuestionOption } from "./schema";
import type {
  AgentQuestionMessages,
  RenderQuestionOption,
  VoiceTranscriber,
} from "./types";
import { VoiceAnswer } from "./VoiceAnswer";

type QuestionCardProps = {
  question: AgentQuestion;
  locale: string;
  messages: AgentQuestionMessages;
  disabled: boolean;
  lockedAnswer?: string | number;
  answeredValue?: string | number;
  preview?: boolean;
  textDraft: string;
  wheelDraft?: string;
  numberDraft?: number;
  transcribe?: VoiceTranscriber;
  renderOption?: RenderQuestionOption;
  onTextDraft: (value: string) => void;
  onWheelDraft: (value: string) => void;
  onNumberDraft: (value: number) => void;
  onSubmit: (value: string | number, label: string) => void;
  onHeight: (height: number) => void;
  answerPulse: number;
  revealPulse: number;
  sound: boolean;
  resolving?: boolean;
  ambientVelocityY: number;
};

function defaultOption(option: QuestionOption, index: number, selected: boolean) {
  return (
    <>
      <span className="muzluk-agent-questions__option-letter" aria-hidden="true">{selected ? "✓" : String.fromCharCode(65 + index)}</span>
      <span className="muzluk-agent-questions__option-copy">
        <span>{option.label}</span>
        {option.description ? <small>{option.description}</small> : null}
      </span>
    </>
  );
}

function normalizeRangeValue(value: number, min: number, max: number, step: number) {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const snapped = min + Math.round((value - min) / safeStep) * safeStep;
  return Math.max(min, Math.min(max, snapped));
}

/** Matches the native shelf's compact two-column rule for short answer sets. */
function hasCompactChoices(question: Extract<AgentQuestion, { kind: "choice" }>) {
  return question.options.length <= 4 && question.options.every((option) => {
    const words = option.label.trim().split(" ").filter(Boolean);
    return words.length <= 2 && option.label.length <= 18;
  });
}

/** Keeps manually constructed questions from bypassing the wheel's five-stop contract. */
function hasAuthoredMoodStops(question: AgentQuestion) {
  if (question.kind !== "mood-wheel") return true;
  return question.options.length === 5 && new Set(question.options.map((option) => option.value)).size === 5;
}

function RangeAnswer({
  question,
  value,
  disabled,
  messages,
  locale,
  onValue,
  onSubmit,
}: {
  question: Extract<AgentQuestion, { kind: "scale" | "time" }>;
  value: number | undefined;
  disabled: boolean;
  messages: AgentQuestionMessages;
  locale: string;
  onValue: (value: number) => void;
  onSubmit: (value: number, label: string) => void;
}) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ pointerId: number; previousX: number; velocityX: number } | null>(null);
  const [maximum, setMaximum] = React.useState(question.max);
  const selected = normalizeRangeValue(value ?? question.defaultValue ?? (question.min + question.max) / 2, question.min, maximum, question.step);
  const formatter = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const unit = question.kind === "time" ? question.unit ?? (locale.toLowerCase().startsWith("tr") ? "dk" : "min") : "";
  const label = `${formatter.format(selected)}${unit ? ` ${unit}` : ""}`;

  React.useEffect(() => {
    setMaximum(question.max);
  }, [question.id, question.max]);

  const ticks = React.useMemo(() => {
    const count = Math.min(61, Math.max(2, Math.round((maximum - question.min) / question.step) + 1));
    return Array.from({ length: count }, (_, index) => normalizeRangeValue(
      question.min + ((maximum - question.min) * index) / Math.max(count - 1, 1),
      question.min,
      maximum,
      question.step,
    ));
  }, [maximum, question.min, question.step]);

  /** The finger moves the numbered rail, while the selection needle remains optically fixed. */
  const updateFromPointer = React.useCallback((clientX: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const bounds = rail.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(bounds.width, 1)));
    onValue(normalizeRangeValue(question.min + progress * (maximum - question.min), question.min, maximum, question.step));
  }, [maximum, onValue, question.min, question.step]);

  return (
    <div className="muzluk-agent-questions__range" data-kind={question.kind}>
      <output className="muzluk-agent-questions__range-output">{label}</output>
      <div
        ref={railRef}
        className="muzluk-agent-questions__range-rail"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={question.prompt}
        aria-valuetext={`${label}. ${question.minLabel} – ${question.maxLabel}.`}
        aria-valuemin={question.min}
        aria-valuemax={maximum}
        aria-valuenow={selected}
        onPointerDown={(event) => {
          if (disabled) return;
          dragRef.current = { pointerId: event.pointerId, previousX: event.clientX, velocityX: 0 };
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId || disabled) return;
          drag.velocityX = drag.velocityX * 0.72 + (event.clientX - drag.previousX) * 0.28;
          drag.previousX = event.clientX;
          updateFromPointer(event.clientX);
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          dragRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragRef.current = null; }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); onValue(normalizeRangeValue(selected - question.step, question.min, maximum, question.step)); }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); onValue(normalizeRangeValue(selected + question.step, question.min, maximum, question.step)); }
        }}
      >
        <span className="muzluk-agent-questions__range-track" aria-hidden="true">
          {ticks.map((tick, index) => <i key={`${tick}:${index}`} data-major={index % 5 === 0 || index === ticks.length - 1} />)}
        </span>
        <span className="muzluk-agent-questions__range-fill" style={{ width: `${((selected - question.min) / Math.max(maximum - question.min, 1)) * 100}%` }} aria-hidden="true" />
        <span className="muzluk-agent-questions__range-needle" style={{ left: `${((selected - question.min) / Math.max(maximum - question.min, 1)) * 100}%` }} aria-hidden="true" />
      </div>
      <div className="muzluk-agent-questions__range-labels">
        <span>{question.minLabel}</span>
        <span>{question.maxLabel}</span>
      </div>
      {question.kind === "time" && question.expandable && selected >= maximum ? (
        <button type="button" className="muzluk-agent-questions__secondary" disabled={disabled} onClick={() => setMaximum((current) => current + Math.max(10, (current - question.min) / 2))}>
          {messages.more}
        </button>
      ) : null}
      <button type="button" className="muzluk-agent-questions__primary" disabled={disabled} onClick={() => onSubmit(selected, label)}>
        {messages.choose}
      </button>
    </div>
  );
}

/** Renders one public question kind without application or backend dependencies. */
export function QuestionCard({
  question,
  locale,
  messages,
  disabled,
  lockedAnswer: _lockedAnswer,
  answeredValue,
  preview = false,
  textDraft,
  wheelDraft,
  numberDraft,
  transcribe,
  renderOption,
  onTextDraft,
  onWheelDraft,
  onNumberDraft,
  onSubmit,
  onHeight,
  answerPulse: _answerPulse,
  revealPulse: _revealPulse,
  sound,
  resolving: _resolving = false,
  ambientVelocityY,
}: QuestionCardProps) {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const validMoodWheel = hasAuthoredMoodStops(question);

  React.useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => {
      onHeight(Math.ceil(node.getBoundingClientRect().height));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeight, question.id, textDraft, voiceError]);

  return (
    <article ref={rootRef} className="muzluk-agent-questions__card" aria-hidden={preview || undefined} data-preview={preview || undefined}>
      <div className="muzluk-agent-questions__prompt">
        <p>{question.prompt}</p>
        {question.note ? <small>{question.note}</small> : null}
      </div>

      {question.kind === "choice" ? (
        <div className="muzluk-agent-questions__choice-list" data-compact={hasCompactChoices(question)}>
          {question.options.map((option, index) => (
            <button
              type="button"
              key={option.value}
              className="muzluk-agent-questions__option"
              data-selected={answeredValue === option.value || undefined}
              disabled={disabled || preview}
              onClick={() => onSubmit(option.value, option.label)}
            >
              {renderOption?.(option, { selected: answeredValue === option.value, index }) ?? defaultOption(option, index, answeredValue === option.value)}
            </button>
          ))}
          {question.allowCustomAnswer ? (
            <form className="muzluk-agent-questions__text-row" onSubmit={(event) => { event.preventDefault(); if (textDraft.trim()) onSubmit(textDraft.trim(), textDraft.trim()); }}>
              <textarea value={textDraft} disabled={disabled || preview} rows={1} placeholder={question.placeholder ?? messages.customAnswer} onChange={(event) => onTextDraft(event.currentTarget.value)} />
              {!textDraft.trim() ? <VoiceAnswer compact disabled={disabled || preview} locale={locale} messages={messages} question={question} transcribe={transcribe} onText={onTextDraft} onError={setVoiceError} /> : null}
              <button type="submit" className="muzluk-agent-questions__send" disabled={disabled || preview || !textDraft.trim()} aria-label={messages.submit}>↗</button>
            </form>
          ) : null}
        </div>
      ) : question.kind === "text" ? (
        <form className="muzluk-agent-questions__text-answer" onSubmit={(event) => { event.preventDefault(); if (textDraft.trim()) onSubmit(textDraft.trim(), textDraft.trim()); }}>
          <textarea value={textDraft} disabled={disabled || preview} rows={3} placeholder={question.placeholder ?? messages.typeAnswer} onChange={(event) => { setVoiceError(null); onTextDraft(event.currentTarget.value); }} />
          <div className="muzluk-agent-questions__text-actions">
            <VoiceAnswer disabled={disabled || preview} locale={locale} messages={messages} question={question} transcribe={transcribe} onText={(spoken) => onTextDraft([textDraft.trim(), spoken].filter(Boolean).join(" "))} onError={setVoiceError} />
            <button type="submit" className="muzluk-agent-questions__primary" disabled={disabled || preview || !textDraft.trim()}>{messages.submit}</button>
          </div>
          {voiceError ? <p className="muzluk-agent-questions__field-error" role="alert">{voiceError}</p> : null}
        </form>
      ) : question.kind === "mood-wheel" ? (
        <div className="muzluk-agent-questions__wheel-answer">
          <MoodWheel
            options={question.options}
            value={(wheelDraft ?? (typeof answeredValue === "string" ? answeredValue : undefined) ?? question.defaultValue)}
            disabled={disabled || preview}
            sound={sound}
            ambientVelocityY={ambientVelocityY}
            messages={{ hint: messages.hint, ariaLabel: question.prompt }}
            onChange={({ option }) => onWheelDraft(option.value)}
          />
          <button
            type="button"
            className="muzluk-agent-questions__primary"
            disabled={disabled || preview || !validMoodWheel || !(wheelDraft ?? (typeof answeredValue === "string" ? answeredValue : undefined) ?? question.defaultValue)}
            onClick={() => {
              const value = wheelDraft ?? (typeof answeredValue === "string" ? answeredValue : undefined) ?? question.defaultValue;
              const option = question.options.find((candidate) => candidate.value === value);
              if (option) onSubmit(option.value, option.label);
            }}
          >
            {messages.choose}
          </button>
        </div>
      ) : (
        <div data-no-question-swipe>
          <RangeAnswer question={question} value={numberDraft} disabled={disabled || preview} messages={messages} locale={locale} onValue={onNumberDraft} onSubmit={onSubmit} />
        </div>
      )}
    </article>
  );
}
