import type * as React from "react";
import type { AgentQuestion, QuestionOption } from "./schema";

export type AgentQuestionAnswer = Readonly<{
  questionId: string;
  kind: AgentQuestion["kind"];
  value: string | number;
  label: string;
  answeredAt: number;
}>;

export type AgentQuestionSkip = Readonly<{
  questionId: string;
  index: number;
}>;

export type AgentQuestionResult = Readonly<{
  answers: readonly AgentQuestionAnswer[];
  skippedQuestionIds: readonly string[];
}>;

export type AgentQuestionMessages = Readonly<{
  ariaLabel: string;
  choose: string;
  customAnswer: string;
  dismiss: string;
  error: string;
  finish: string;
  hint: string;
  more: string;
  nextQuestion: string;
  previousQuestion: string;
  record: string;
  recording: string;
  retryFinish: string;
  skip: string;
  skipConfirm: string;
  submit: string;
  transcribing: string;
  typeAnswer: string;
  voiceError: string;
}>;

export type VoiceTranscriber = (
  recording: Blob,
  context: Readonly<{ question: AgentQuestion; locale: string }>,
) => Promise<string>;

export type RenderQuestionOption = (
  option: QuestionOption,
  state: Readonly<{ selected: boolean; index: number }>,
) => React.ReactNode;
