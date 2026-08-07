import type { AgentQuestionMessages } from "./types";

export const englishAgentQuestionMessages: AgentQuestionMessages = {
  ariaLabel: "Agent follow-up questions",
  choose: "Choose this",
  customAnswer: "Write your own answer",
  dismiss: "Dismiss questions",
  error: "That answer did not save. Try again.",
  finish: "Finish",
  hint: "Drag the wheel",
  more: "Actually more?",
  nextQuestion: "Next question",
  previousQuestion: "Previous question",
  record: "Answer by voice",
  recording: "Use this recording",
  retryFinish: "Retry finish",
  skip: "Skip this question",
  skipConfirm: "Confirm skip",
  submit: "Answer this question",
  transcribing: "Writing that down…",
  typeAnswer: "Type your answer…",
  voiceError: "Could not turn that into text. Type it here or try again.",
};

export const turkishAgentQuestionMessages: AgentQuestionMessages = {
  ariaLabel: "Ajan takip soruları",
  choose: "Seç",
  customAnswer: "Kendi yanıtını yaz",
  dismiss: "Soruları kapat",
  error: "Bu yanıt kaydedilemedi. Tekrar dene.",
  finish: "Bitir",
  hint: "Tekerleği kaydır",
  more: "Aslında daha fazla mı?",
  nextQuestion: "Sonraki soru",
  previousQuestion: "Önceki soru",
  record: "Sesle yanıtla",
  recording: "Bu kaydı kullan",
  retryFinish: "Bitirmeyi tekrar dene",
  skip: "Bu soruyu atla",
  skipConfirm: "Atlamayı onayla",
  submit: "Bu soruyu cevapla",
  transcribing: "Yazıya dökülüyor…",
  typeAnswer: "Yanıtını yaz…",
  voiceError: "Ses yazıya dönüşmedi. Buraya yazabilir veya yeniden deneyebilirsin.",
};

export function resolveMessages(locale: string, overrides?: Partial<AgentQuestionMessages>) {
  const defaults = locale.toLowerCase().startsWith("tr")
    ? turkishAgentQuestionMessages
    : englishAgentQuestionMessages;
  return { ...defaults, ...overrides };
}
