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
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="muzluk-agent-questions__small-icon">
      <path d="m4.5 10.5 3.4 3.4 7.6-8" />
    </svg>
  );
}

function defaultOption(option: QuestionOption, index: number) {
  return (
    <>
      <span className="muzluk-agent-questions__option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
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
  const [maximum, setMaximum] = React.useState(question.max);
  const selected = normalizeRangeValue(value ?? question.defaultValue ?? (question.min + question.max) / 2, question.min, maximum, question.step);
  const formatter = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const unit = question.kind === "time" ? question.unit ?? (locale.toLowerCase().startsWith("tr") ? "dk" : "min") : "";
  const label = `${formatter.format(selected)}${unit ? ` ${unit}` : ""}`;

  React.useEffect(() => {
    setMaximum(question.max);
  }, [question.id, question.max]);

  return (
    <div className="muzluk-agent-questions__range">
      <output className="muzluk-agent-questions__range-output">{label}</output>
      <input
        type="range"
        aria-label={question.prompt}
        aria-valuetext={`${label}. ${question.minLabel} – ${question.maxLabel}.`}
        min={question.min}
        max={maximum}
        step={question.step}
        value={selected}
        disabled={disabled}
        onChange={(event) => onValue(Number(event.currentTarget.value))}
      />
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
  lockedAnswer,
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
  answerPulse,
  revealPulse,
  sound,
  resolving = false,
}: QuestionCardProps) {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [answerResolving, setAnswerResolving] = React.useState(false);
  const [revealing, setRevealing] = React.useState(false);
  const locked = lockedAnswer !== undefined;
  const validMoodWheel = hasAuthoredMoodStops(question);

  React.useEffect(() => {
    if (preview || answerPulse === 0) return;
    setAnswerResolving(true);
    const timer = window.setTimeout(() => setAnswerResolving(false), 340);
    return () => window.clearTimeout(timer);
  }, [answerPulse, preview]);

  React.useEffect(() => {
    if (preview || revealPulse === 0) return;
    setRevealing(true);
    const timer = window.setTimeout(() => setRevealing(false), 260);
    return () => window.clearTimeout(timer);
  }, [preview, revealPulse]);

  React.useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || preview) return;
    const measure = () => {
      onHeight(Math.ceil(node.getBoundingClientRect().height));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeight, preview, question.id, textDraft, voiceError]);

  return (
    <article ref={rootRef} className="muzluk-agent-questions__card" aria-hidden={preview || undefined} data-preview={preview || undefined} data-resolving={(resolving || answerResolving) || undefined} data-revealing={revealing || undefined}>
      <div className="muzluk-agent-questions__prompt">
        <p>{question.prompt}</p>
        {question.note ? <small>{question.note}</small> : null}
      </div>

      {locked ? (
        <div className="muzluk-agent-questions__locked"><CheckIcon /><span>{String(lockedAnswer)}</span></div>
      ) : question.kind === "choice" ? (
        <div className="muzluk-agent-questions__choice-list">
          {question.options.map((option, index) => (
            <button
              type="button"
              key={option.value}
              className="muzluk-agent-questions__option"
              disabled={disabled || preview}
              onClick={() => onSubmit(option.value, option.label)}
            >
              {renderOption?.(option, { selected: false, index }) ?? defaultOption(option, index)}
            </button>
          ))}
          {question.allowCustomAnswer ? (
            <form className="muzluk-agent-questions__text-row" onSubmit={(event) => { event.preventDefault(); if (textDraft.trim()) onSubmit(textDraft.trim(), textDraft.trim()); }}>
              <textarea value={textDraft} disabled={disabled || preview} rows={1} placeholder={question.placeholder ?? messages.customAnswer} onChange={(event) => onTextDraft(event.currentTarget.value)} />
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
        <div className="muzluk-agent-questions__wheel-answer" data-no-question-swipe>
          <MoodWheel
            options={question.options}
            value={wheelDraft ?? question.defaultValue}
            disabled={disabled || preview}
            sound={sound}
            messages={{ hint: messages.hint, ariaLabel: question.prompt }}
            onChange={({ option }) => onWheelDraft(option.value)}
          />
          <button
            type="button"
            className="muzluk-agent-questions__primary"
            disabled={disabled || preview || !validMoodWheel || !(wheelDraft ?? question.defaultValue)}
            onClick={() => {
              const value = wheelDraft ?? question.defaultValue;
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
