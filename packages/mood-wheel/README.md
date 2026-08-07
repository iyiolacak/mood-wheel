# @muzluk/mood-wheel

A tactile React mood wheel with hand-drawn assets, five physical hit points,
direct drag, optional sound, keyboard controls, reduced motion, and a canvas
fallback.

```bash
npm install @muzluk/mood-wheel
```

```tsx
import { MoodWheel, MOOD_WHEEL_ASSETS } from "@muzluk/mood-wheel";
import "@muzluk/mood-wheel/styles.css";

const moods = [
  { value: "awful", label: "Awful" },
  { value: "rough", label: "Rough" },
  { value: "okay", label: "Okay" },
  { value: "good", label: "Good" },
  { value: "great", label: "Great" },
] as const; // Exactly five options: the supplied art has five hit points.

export function CheckIn() {
  return <MoodWheel options={moods} onChange={({ option }) => save(option.value)} />;
}
```

The source shelf geometry is available with `layoutVariant="ultraWide"`. Use
`onAttemptInteract` to gate a gesture while a host is saving, and
`MOOD_WHEEL_ASSETS.tick` when a host mixer needs the exact bundled tick cue.

Motion stays continuous across every interaction: the Pixi wheel uses an
interruptible damped spring, release projects a short swipe velocity into the
nearest authored detent, and the pointer leans and shakes from that velocity
before settling. The first-use sweep uses the source cubic-bezier
`cubic-bezier(0.65, 0, 0.35, 1)`; `prefers-reduced-motion` disables the sweep,
spring, and shake.

Use CSS variables such as `--mw-surface`, `--mw-text`, `--mw-muted`, and
`--mw-focus` to match an existing product. Stable `value` fields are returned
to application code; translated labels remain presentation-only.
