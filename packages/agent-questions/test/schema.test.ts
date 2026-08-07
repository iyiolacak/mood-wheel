import { describe, expect, it } from "vitest";
import {
  AGENT_QUESTIONS_JSON_SCHEMA,
  parseAgentQuestions,
  safeParseAgentQuestions,
} from "../src/schema";

describe("agent question schema", () => {
  it("parses a complete mixed question set", () => {
    const result = parseAgentQuestions({
      questions: [
        {
          id: "feeling",
          kind: "mood-wheel",
          prompt: "How did that feel?",
          defaultValue: "okay",
          options: [
            { value: "rough", label: "Rough" },
            { value: "okay", label: "Okay" },
            { value: "good", label: "Good" },
            { value: "great", label: "Great" },
            { value: "excellent", label: "Excellent" },
          ],
        },
        {
          id: "minutes",
          kind: "time",
          prompt: "How long?",
          min: 5,
          max: 60,
          step: 5,
          minLabel: "5 min",
          maxLabel: "60 min",
        },
      ],
    });
    expect(result.questions).toHaveLength(2);
  });

  it("rejects duplicate stable values and invalid wheel defaults", () => {
    const result = safeParseAgentQuestions({
      questions: [{
        id: "feeling",
        kind: "mood-wheel",
        prompt: "How did that feel?",
        defaultValue: "missing",
        options: [
          { value: "same", label: "One" },
          { value: "same", label: "Two" },
          { value: "three", label: "Three" },
          { value: "four", label: "Four" },
          { value: "five", label: "Five" },
        ],
      }],
    });
    expect(result.success).toBe(false);
  });

  it("requires exactly five wheel options", () => {
    const result = safeParseAgentQuestions({
      questions: [{
        id: "feeling",
        kind: "mood-wheel",
        prompt: "How did that feel?",
        options: [
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
          { value: "three", label: "Three" },
          { value: "four", label: "Four" },
          { value: "five", label: "Five" },
          { value: "six", label: "Six" },
        ],
      }],
    });
    expect(result.success).toBe(false);
  });

  it("exports a function-tool-compatible object schema", () => {
    expect(AGENT_QUESTIONS_JSON_SCHEMA).toMatchObject({ type: "object" });
  });
});
