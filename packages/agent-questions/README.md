# @muzluk/agent-questions

A compact, swipeable React question reel for an agent's concrete follow-up
questions. It includes choices, text, scales, time, and the Muzluk mood wheel.

```bash
npm install @muzluk/agent-questions
```

```tsx
import {
  AgentQuestions,
  AGENT_QUESTIONS_ASSETS,
  AGENT_QUESTIONS_TOOL,
  parseAgentQuestions,
} from "@muzluk/agent-questions";
import "@muzluk/agent-questions/styles.css";
import "@muzluk/mood-wheel/styles.css";

const tool = AGENT_QUESTIONS_TOOL; // Give this schema to your model SDK.
const { questions } = parseAgentQuestions(toolResult);

<AgentQuestions
  questions={questions}
  onAnswer={persistOneAnswer}
  onComplete={sendAnswersBackToAgent}
/>
```

The component owns drafts, paging, animation, and retry presentation. Your app
owns model calls, authorization, persistence, and what happens after completion.
Set `sound={false}` for a silent host, or pass `assets={{ reveal: ... }}`. The
exact bundled reveal cue is also available as `AGENT_QUESTIONS_ASSETS.reveal`.
