# Contributing

Install dependencies with `npm ci`, then run `npm run check` before opening a
pull request. Changes to the wheel interaction must include keyboard, pointer,
reduced-motion, and narrow-viewport coverage. Changes to the public question
contract must update the JSON Schema and agent integration examples.

Do not add third-party icon assets. Keep visible labels separate from stable
values, and never infer an answer from question text.
