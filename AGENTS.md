# Agent integration contract

When connecting these packages to an agent-generated experience:

1. Validate every tool result with `parseAgentQuestions` before rendering.
2. Give every question and option a stable, non-translated ID/value.
3. Use `mood-wheel` only for a short emotional or feeling spectrum with exactly five stops; fewer or more stops cannot align with the supplied asset.
4. Use `time` for duration and `scale` for other measurable ranges.
5. Ask only for missing information that materially changes the next action.
6. Persist answers in the consumer's authenticated callback; these packages have no backend.
7. Handle rejected callbacks and preserve the person's authored answer for retry.
8. Do not add third-party icon assets to either published package.
