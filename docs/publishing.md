# Publishing

The repository is ready for the first public release, but publishing is an
account-side action. Use a GitHub repository named `iyiolacak/mood-wheel`, then
create a `v0.1.0` release. The publish workflow validates the packages and
publishes them with npm provenance in dependency order:

1. `@muzluk/mood-wheel`
2. `@muzluk/agent-questions`

For a local dry run:

```bash
npm install
npm run check
npm pack --workspace @muzluk/mood-wheel
npm pack --workspace @muzluk/agent-questions
```

The packages use the MIT license and include a package-local `LICENSE` file.
Keep npm and GitHub credentials out of the repository; the workflow uses
trusted publishing rather than a long-lived npm token.
