# Agent questions people actually answer

Two MIT React packages extracted from Muzluk's web question experience:

- [`@muzluk/agent-questions`](./packages/agent-questions) — a swipeable reel for agent follow-up questions.
- [`@muzluk/mood-wheel`](./packages/mood-wheel) — the tactile mood wheel by itself.

The packages include the authored wheel, pointer, and sound assets. They do not
include Muzluk's backend, authentication, analytics, Tailwind configuration,
fonts, or third-party icons.

The sound cues ship with the packages and are played only from a user gesture or
an explicit answer transition. `MOOD_WHEEL_ASSETS` exposes the wheel's exact
wheel/pointer/tick URLs, and `AGENT_QUESTIONS_ASSETS` exposes the exact question
reveal cue if your host needs to preload or route audio through its own mixer.

## Install the full agent question UI

```bash
npm install @muzluk/agent-questions
```

```tsx
import { AgentQuestions, parseAgentQuestions } from "@muzluk/agent-questions";
import "@muzluk/agent-questions/styles.css";
import "@muzluk/mood-wheel/styles.css";

const { questions } = parseAgentQuestions(modelToolResult);

export function FollowUpQuestions() {
  return (
    <AgentQuestions
      title="Two quick details"
      questions={questions}
      onAnswer={(answer) => saveAnswer(answer)}
      onComplete={({ answers, skippedQuestionIds }) =>
        continueAgent({ answers, skippedQuestionIds })
      }
    />
  );
}
```

## Install only the mood wheel

```bash
npm install @muzluk/mood-wheel
```

```tsx
import { MoodWheel } from "@muzluk/mood-wheel";
import "@muzluk/mood-wheel/styles.css";

const options = [
  { value: "awful", label: "Awful" },
  { value: "rough", label: "Rough" },
  { value: "okay", label: "Okay" },
  { value: "good", label: "Good" },
  { value: "great", label: "Great" },
] as const;

export function MoodQuestion() {
  return <MoodWheel options={options} onChange={({ option }) => console.log(option.value)} />;
}
```

## What the reel supports

- choice questions, optionally with a custom answer
- free text, with an optional consumer-owned transcription adapter
- the five-stop mood wheel
- numeric scales and expandable time ranges
- touch swiping, mouse-wheel paging, progress controls, and keyboard navigation
- async answer/skip/complete callbacks with inline retry states
- English and Turkish defaults plus complete message overrides
- classic and ribbon presets plus CSS variables and render hooks
- SSR-safe rendering, reduced motion, and a non-canvas wheel fallback

See [agent integration](./docs/agent-integration.md), [public API](./docs/api.md),
[publishing](./docs/publishing.md), and [asset provenance](./ASSETS.md).

## Development

```bash
npm install
npm run check
npm run dev
```

The first public release is `0.1.0`. Publishing is performed from a GitHub
release through npm trusted publishing with provenance.
