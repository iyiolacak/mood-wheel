import * as React from "react";
import { createRoot } from "react-dom/client";
import { AgentQuestions, type AgentQuestion } from "@muzluk/agent-questions";
import { MoodWheel } from "@muzluk/mood-wheel";
import "@muzluk/agent-questions/styles.css";
import "@muzluk/mood-wheel/styles.css";
import "./demo.css";

const moods = [
  { value: "awful", label: "Awful" },
  { value: "rough", label: "Rough" },
  { value: "okay", label: "Okay" },
  { value: "good", label: "Good" },
  { value: "great", label: "Great" },
] as const;

const questions: AgentQuestion[] = [
  {
    id: "mood",
    kind: "mood-wheel",
    prompt: "How did that progress feel?",
    options: [...moods],
    defaultValue: "okay",
  },
  {
    id: "movement",
    kind: "choice",
    prompt: "What did you move forward?",
    options: [
      { value: "deep-work", label: "Deep work" },
      { value: "small-tasks", label: "Small tasks" },
      { value: "learning", label: "Learning" },
    ],
    allowCustomAnswer: true,
  },
  {
    id: "time",
    kind: "time",
    prompt: "How much time did it honestly get?",
    min: 10,
    max: 90,
    step: 5,
    defaultValue: 25,
    minLabel: "10 min",
    maxLabel: "90+ min",
    unit: "min",
    expandable: true,
  },
  {
    id: "detail",
    kind: "text",
    prompt: "What detail should the agent remember?",
    placeholder: "Name the useful detail",
  },
];

function Demo() {
  const [tab, setTab] = React.useState<"reel" | "wheel">("reel");
  return (
    <main>
      <header><p>Open-source Muzluk interaction</p><h1>Agent questions people actually answer.</h1></header>
      <nav>
        <button type="button" data-active={tab === "reel" || undefined} onClick={() => setTab("reel")}>Agent reel</button>
        <button type="button" data-active={tab === "wheel" || undefined} onClick={() => setTab("wheel")}>Mood wheel only</button>
      </nav>
      <section className="demo-card">
        {tab === "reel" ? (
          <AgentQuestions
            key="reel"
            title="Four quick details"
            questions={questions}
            onAnswer={async (answer) => console.info("answer", answer)}
            onSkip={async (skip) => console.info("skip", skip)}
            onComplete={(result) => console.info("complete", result)}
          />
        ) : (
          <MoodWheel options={moods} onChange={({ option }) => console.info("mood", option.value)} />
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
