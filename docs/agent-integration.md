# Connect an agent

The package supplies a UI contract, not a hosted model service. The safe path is:

```text
model tool call
  -> parseAgentQuestions(unknownResult)
  -> <AgentQuestions questions={questions} />
  -> authored answer callbacks
  -> your authenticated storage or next model turn
```

## Tool definition

`AGENT_QUESTIONS_TOOL` is a provider-neutral function-tool object with the full
JSON Schema. `AGENT_QUESTIONS_JSON_SCHEMA` is available separately when an SDK
expects only parameters.

```ts
import {
  AGENT_QUESTIONS_TOOL,
  parseAgentQuestions,
} from "@muzluk/agent-questions/schema";

const response = await yourModel.generate({
  tools: [AGENT_QUESTIONS_TOOL],
  prompt: "Ask only for missing details that materially change the result.",
});

const questionSet = parseAgentQuestions(response.toolArguments);
```

Do not render raw model output. Validation rejects duplicate question IDs,
duplicate option values, invalid ranges, missing labels, oversized option sets,
and wheel defaults that do not match a stable value.

## Answer payload

Each committed answer contains:

```json
{
  "questionId": "energy-now",
  "kind": "mood-wheel",
  "value": "okay",
  "label": "Okay",
  "answeredAt": 1786118400000
}
```

Persist `value`; treat `label` as display context. Never infer an answer from
the prompt or substitute a translated label for the stable value.

## Tool-call UI adapters

For assistant-ui, render `AgentQuestions` inside the tool result component and
append the completion result as the next user message. For AI SDK or OpenAI
Responses, use the exported schema for the tool and render the validated tool
arguments. These are integration patterns, not runtime dependencies of the
package.

## Voice

Voice appears only when a transcription adapter is supplied:

```tsx
<AgentQuestions
  questions={questions}
  transcribe={async (recording, { question }) => {
    const body = new FormData();
    body.append("audio", recording);
    body.append("questionId", question.id);
    const response = await fetch("/api/transcribe", { method: "POST", body });
    if (!response.ok) throw new Error("Transcription failed");
    return (await response.json()).text;
  }}
/>
```

Keep provider keys on the server. The package never uploads audio by itself.
