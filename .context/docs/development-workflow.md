---
type: doc
name: development-workflow
description: Day-to-day engineering processes, branching, and contribution guidelines
category: workflow
generated: 2026-07-30
status: filled
scaffoldVersion: "2.0.0"
---

## Development Workflow

This repo follows a standard GitHub flow: feature branches off `main`, PRs with required checks, squash-merge to `main`. All changes go through code review.

## Branching & Releases

- **Default branch**: `main`
- **Model**: GitHub Flow (feature branches → PR → squash-merge)
- **Conventional Commits**: `feat(scope):`, `fix(scope):`, `chore(scope):`, etc.
- **Releases**: Tagged on `main` via GitHub Releases; Docker images built on tag push
- **CI**: GitHub Actions run lint, type-check, test, and build on every PR

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (hot-reload via Bun)
npm run dev

# Build for distribution
npm run build

# TypeScript type check
npm run build-check

# Run all tests
npm run test

# Watch mode
npm run test-watch

# Lint & format
npm run lint
npm run format

# Database setup
npm run prisma:migrate
npm run db:bootstrap

# i18n extraction
npm run i18n:extract
```

## Code Review Expectations

- Every PR must pass CI: lint, type-check (`tsc --noEmit`), and tests
- Tests must be added or updated alongside feature and bug-fix PRs
- Reviewers check for: correctness, test coverage, error handling, i18n, security
- Follow Conventional Commits format in squash-merge message
- Reference issues with `Closes #N` or `Fixes #N`

## Onboarding Tasks

- First PR candidates: add missing i18n keys, improve test coverage, or pick a `good-first-issue` label from the tracker
- Review `AGENTS.md` for environment tips and AI context references
- Check `.context/agents/` for role-specific playbooks
