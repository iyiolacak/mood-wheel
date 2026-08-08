import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentQuestions } from "../src/AgentQuestions";
import type { AgentQuestion } from "../src/schema";

const questions: AgentQuestion[] = [
  {
    id: "move",
    kind: "choice",
    prompt: "What moved?",
    options: [
      { value: "deep", label: "Deep work" },
      { value: "small", label: "Small task" },
    ],
  },
  {
    id: "detail",
    kind: "text",
    prompt: "What should the agent remember?",
    placeholder: "Specific detail",
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("AgentQuestions", () => {
  it("slides the measured reel to its neighbor before committing the next card", async () => {
    vi.useFakeTimers();
    const { container } = render(<AgentQuestions questions={questions} />);

    fireEvent.click(screen.getByRole("button", { name: /Deep work/i }));
    await act(async () => undefined);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    const stage = container.querySelector<HTMLElement>(".muzluk-agent-questions__stage");
    expect(stage?.style.transform).toBe("translate3d(0, -232px, 0)");
    expect(screen.getByText("What moved?")).toBeInTheDocument();

    fireEvent.transitionEnd(stage!, { propertyName: "transform" });
    expect(screen.getByText("What should the agent remember?")).toBeInTheDocument();
  });

  it("commits a stable choice before advancing", async () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<AgentQuestions questions={questions} onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole("button", { name: /Deep work/i }));
    await act(async () => undefined);
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({
      questionId: "move",
      kind: "choice",
      value: "deep",
      label: "Deep work",
    }));

    act(() => vi.advanceTimersByTime(750));
    await act(async () => undefined);
    expect(screen.getByText("What should the agent remember?")).toBeInTheDocument();
  });

  it("keeps the question active when persistence rejects", async () => {
    render(<AgentQuestions questions={questions} onAnswer={() => Promise.reject(new Error("offline"))} />);
    fireEvent.click(screen.getByRole("button", { name: /Deep work/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("did not save");
    expect(screen.getByText("What moved?")).toBeInTheDocument();
  });

  it("completes with ordered answers and explicit skips", async () => {
    const onComplete = vi.fn();
    render(<AgentQuestions questions={[questions[1]!]} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip this question" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm skip" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      answers: [],
      skippedQuestionIds: ["detail"],
    }));
  });

  it("does not show voice controls without a transcription adapter", () => {
    render(<AgentQuestions questions={[questions[1]!]} />);
    expect(screen.queryByRole("button", { name: "Answer by voice" })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Specific detail")).toBeInTheDocument();
  });
});
