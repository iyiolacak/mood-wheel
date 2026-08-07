import { z } from "zod";

export const questionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const baseQuestionShape = {
  id: z.string().min(1),
  prompt: z.string().min(1),
  note: z.string().min(1).optional(),
  required: z.boolean().optional(),
};

const choiceQuestionSchema = z.object({
  ...baseQuestionShape,
  kind: z.literal("choice"),
  options: z.array(questionOptionSchema).min(2).max(6),
  allowCustomAnswer: z.boolean().optional(),
  placeholder: z.string().min(1).optional(),
});

const textQuestionSchema = z.object({
  ...baseQuestionShape,
  kind: z.literal("text"),
  placeholder: z.string().min(1).optional(),
});

const moodWheelQuestionSchema = z.object({
  ...baseQuestionShape,
  kind: z.literal("mood-wheel"),
  // The supplied wheel asset has five physical hit points; other counts are invalid.
  options: z.array(questionOptionSchema).length(5),
  defaultValue: z.string().min(1).optional(),
});

const rangedQuestionShape = {
  ...baseQuestionShape,
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  defaultValue: z.number().optional(),
  minLabel: z.string().min(1),
  maxLabel: z.string().min(1),
};

const scaleQuestionSchema = z.object({
  ...rangedQuestionShape,
  kind: z.literal("scale"),
});

const timeQuestionSchema = z.object({
  ...rangedQuestionShape,
  kind: z.literal("time"),
  unit: z.string().min(1).optional(),
  expandable: z.boolean().optional(),
});

export const agentQuestionSchema = z.discriminatedUnion("kind", [
  choiceQuestionSchema,
  textQuestionSchema,
  moodWheelQuestionSchema,
  scaleQuestionSchema,
  timeQuestionSchema,
]).superRefine((question, context) => {
  if ("options" in question) {
    const values = new Set<string>();
    for (const [index, option] of question.options.entries()) {
      if (values.has(option.value)) {
        context.addIssue({
          code: "custom",
          message: `Option value '${option.value}' must be unique within its question.`,
          path: ["options", index, "value"],
        });
      }
      values.add(option.value);
    }
    if (question.kind === "mood-wheel" && question.defaultValue && !values.has(question.defaultValue)) {
      context.addIssue({
        code: "custom",
        message: "defaultValue must match an option value.",
        path: ["defaultValue"],
      });
    }
  }

  if (question.kind === "scale" || question.kind === "time") {
    if (question.max <= question.min) {
      context.addIssue({ code: "custom", message: "max must be greater than min.", path: ["max"] });
    }
    if (question.defaultValue !== undefined && (question.defaultValue < question.min || question.defaultValue > question.max)) {
      context.addIssue({ code: "custom", message: "defaultValue must be within the range.", path: ["defaultValue"] });
    }
  }
});

export const agentQuestionSetSchema = z.object({
  questions: z.array(agentQuestionSchema).min(1).max(12),
}).superRefine((set, context) => {
  const ids = new Set<string>();
  for (const [index, question] of set.questions.entries()) {
    if (ids.has(question.id)) {
      context.addIssue({
        code: "custom",
        message: `Question id '${question.id}' must be unique.`,
        path: ["questions", index, "id"],
      });
    }
    ids.add(question.id);
  }
});

export type QuestionOption = z.infer<typeof questionOptionSchema>;
export type AgentQuestion = z.infer<typeof agentQuestionSchema>;
export type AgentQuestionSet = z.infer<typeof agentQuestionSetSchema>;

export const AGENT_QUESTIONS_JSON_SCHEMA = z.toJSONSchema(agentQuestionSetSchema, {
  target: "draft-7",
  reused: "ref",
});

export const AGENT_QUESTIONS_TOOL = {
  type: "function",
  name: "render_agent_questions",
  description: "Render a short set of concrete follow-up questions that the person can answer directly.",
  parameters: AGENT_QUESTIONS_JSON_SCHEMA,
} as const;

/** Parses unknown model or network output before it reaches the interface. */
export function parseAgentQuestions(input: unknown): AgentQuestionSet {
  return agentQuestionSetSchema.parse(input);
}

/** Returns structured validation issues when an agent produces invalid UI data. */
export function safeParseAgentQuestions(input: unknown) {
  return agentQuestionSetSchema.safeParse(input);
}
