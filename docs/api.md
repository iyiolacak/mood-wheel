# Public API

## `@muzluk/agent-questions`

### `AgentQuestions`

Required prop:

- `questions`: one to twelve validated `AgentQuestion` objects.

Lifecycle callbacks:

- `onAnswer(answer)`: awaited before the answer locks and the reel advances.
- `onSkip(skip)`: awaited before a skipped question advances.
- `onComplete(result)`: receives ordered answers and skipped question IDs.
- `onStepChange(index)`: fires after visible navigation settles.

Presentation and integration:

- `initialAnswers`, `initialStep`, `locale`, `messages`, `title`, `theme`
- `sound` and `assets` let a host mute or route the bundled reveal/tick cues.
- `transcribe(blob, context)` enables the optional voice action.
- `renderOption(option, state)` adds consumer-owned option visuals.
- `onDismiss` adds the package-owned close control.

Rejected lifecycle promises keep the current state and expose a retry. The
component does not persist anything on its own.

### Question kinds

- `choice`: two to six stable options, with optional custom text.
- `text`: a free-text answer.
- `mood-wheel`: exactly five stable options and an optional default value.
- `scale`: bounded numeric input.
- `time`: bounded numeric input with a localized unit and optional expansion.

Use `parseAgentQuestions` or `safeParseAgentQuestions` on all model/network
output before rendering it.

### `AdvancedSlider`

The focus-time ruler is also exported as a standalone controlled or uncontrolled
primitive. It accepts `min`, `max`, `step`, `majorStep`, `value`/`defaultValue`,
`unit`, value formatters, milestone and zone-break arrays, and change/commit/
detent callbacks. `ADVANCED_SLIDER_ASSETS` exposes the four alternating ruler
ticks and milestone impact cue.

The rail follows the finger directly, rubber-bands outside its range, projects
measured release velocity for 120ms, and lands with Muzluk's
`damping: 31, mass: 0.72, stiffness: 430` spring.

## `@muzluk/mood-wheel`

### `MoodWheel`

Accepts exactly five `{ value, label, ariaLabel? }` options. The supplied art has
five physical hit/trigger points, so other counts are rejected. It can be controlled
with `value` or initialized with `defaultValue`.

`onChange` and `onDetent` receive `{ option, index, source }`, where `source` is
`control`, `drag`, `keyboard`, or `wheel`.

Optional behavior props include `sound`, `intro`, `introPlayLimit`,
`showControls`, `showHint`, custom messages, custom asset URLs, and icon render
hooks.

`MOOD_WHEEL_ASSETS` exposes the exact bundled wheel, pointer, and tick URLs.
`layoutVariant="ultraWide"` preserves the source shelf geometry on wider cards,
and `onAttemptInteract` can reject a gesture before it captures the pointer.

The motion runtime is deliberately interruptible rather than a sequence of
transitions: wheel rotation is a damped spring, release uses a short velocity
projection before snapping to one of the five authored detents, and pointer
lean/shake follows the same gesture velocity. The source intro sweep uses
`cubic-bezier(0.65, 0, 0.35, 1)` and all of these effects honor reduced motion.

### Styling

Import the package stylesheets once in your app. The full reel composes the
mood wheel, so it needs both files. Override documented CSS variables on a
wrapper; no Tailwind or font package is required.

```tsx
import "@muzluk/agent-questions/styles.css";
import "@muzluk/mood-wheel/styles.css";
```

```css
.my-wheel {
  --mw-surface: #221a20;
  --mw-text: #fff3df;
  --mw-muted: #d6bfa7;
  --mw-focus: #ff9f43;
}
```
