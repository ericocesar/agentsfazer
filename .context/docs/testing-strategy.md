---
type: doc
name: testing-strategy
description: Test frameworks, patterns, coverage requirements, and quality gates
category: testing
generated: 2026-07-30
status: filled
scaffoldVersion: "2.0.0"
---

## Testing Strategy

Quality is maintained through unit tests, integration tests, and CI gates. Tests live alongside source code under `tests/`, mirroring the `src/` structure.

## Test Types

- **Unit**: Bun test (`bun test`), files named `*.test.ts`. Located in `tests/` dirs per layer.
- **Integration**: Tests that exercise real API routes, database, and Chatwoot API. Live in `tests/api/` and `tests/modules/`.
- **E2E**: Limited — some realtime event tests in `tests/api/features/realtime/`. Full E2E expects a running instance.
- **Utilities**: Shared test helpers in `tests/utils/` (Prisma mocks, Chatwoot instance seeding).

## Running Tests

```bash
# All tests
npm run test

# Watch mode (iterate on failing spec)
npm run test-watch

# With coverage
npm run test:coverage

# CI-like: build + test
npm run build && npm run test
```

## Quality Gates

- All tests must pass before merge (CI gate)
- No hard minimum coverage yet, but new code should include tests
- `npm run lint` (Biome) must pass — no warnings on `--error-on-warnings`
- `npm run build-check` (tsc --noEmit) must pass
- PRs without tests for new features or bug fixes will be flagged in review

## Troubleshooting

- Flaky DB tests: ensure test DB is seeded via `npm run db:test:setup`
- Prisma mock helpers in `tests/utils/prisma-mock.ts` avoid real DB for unit tests
- Chatwoot integration tests require a seeded Chatwoot instance — see `tests/utils/chatwoot.ts`
