"use client";

import * as React from "react";
import { MoodWheel } from "@muzluk/mood-wheel";
import { AdvancedSlider } from "./AdvancedSlider";
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
  sound,
  onValue,
  onSubmit,
}: {
  question: Extract<AgentQuestion, { kind: "scale" | "time" }>;
  value: number | undefined;
  disabled: boolean;
  messages: AgentQuestionMessages;
  locale: string;
  sound: boolean;
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

  const milestoneValues = question.kind === "time"
    ? [30, 60].filter((item) => item >= question.min && item <= maximum)
    : [question.min + Math.floor((maximum - question.min) / (question.step * 2)) * question.step];
  const hugeMilestoneValues = question.kind === "time"
    ? [90].filter((item) => item >= question.min && item <= maximum)
    : [maximum];

  return (
    <div className="muzluk-agent-questions__range" data-kind={question.kind}>
      <AdvancedSlider
        ariaLabel={question.prompt}
        decrementLabel={messages.previousQuestion}
        incrementLabel={messages.nextQuestion}
        min={question.min}
        max={maximum}
        step={question.step}
        majorStep={question.kind === "time" ? 5 : question.step}
        value={selected}
        disabled={disabled}
        sound={sound}
        formatValue={(nextValue) => formatter.format(nextValue)}
        unit={unit}
        milestoneValues={milestoneValues}
        hugeMilestoneValues={hugeMilestoneValues}
        onValueChange={onValue}
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
              <button type="submit" className="muzluk-agent-questions__send" disabled={disabled || preview || !textDraft.trim()} aria-label={messages.submit}>{messages.submit}</button>
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
          <RangeAnswer question={question} value={numberDraft} disabled={disabled || preview} messages={messages} locale={locale} sound={sound} onValue={onNumberDraft} onSubmit={onSubmit} />
        </div>
      )}
    </article>
  );
}
