---
type: doc
name: tooling
description: Scripts, IDE settings, automation, and developer productivity tips
category: tooling
generated: 2026-07-30
status: filled
scaffoldVersion: "2.0.0"
---

## Tooling & Productivity Guide

This project uses Bun as the primary runtime and build tool, with Biome for formatting/linting, and Prisma for database management. AI agent context is managed via OpenCode dotcontext.

## Required Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Bun | >=1.1 | Runtime, package manager, test runner |
| Node.js | >=20 | Legacy scripts, Prisma CLI |
| Docker | Latest | Local services (Postgres, Chatwoot) |
| Biome | ^1.9 | Lint + format |

## Recommended Automation

```bash
# Format all files
npm run format

# Lint with error-on-warnings
npm run lint

# Type-check (full project)
npm run build-check

# Type-check (Cloudflare Worker)
npm run build-check:worker
```

Pre-commit hooks via Husky lint-staged run Biome on staged files.

## IDE / Editor Setup

- **VS Code** recommended
- Extensions: Biome extension (for editor lint/format), Prisma extension (schema highlighting)
- Set `editor.formatOnSave` and default formatter to Biome
- `tsconfig.json` is configured for strict TypeScript

## Productivity Tips

```bash
# Quick dev loop
npm run dev                    # Start server
npm run test -- --watch        # Tests in watch mode
bun run build.ts               # Build dist/ bundle

# Database
npm run prisma:migrate         # Create migration
npm run db:reset               # Full reset + bootstrap
npm run db:bootstrap           # Seed roles/tenants/admin

# i18n
npm run i18n:extract           # Extract translation keys

# Admin
npm run set-admin              # Promote a user to admin

# Context management (AI agents)
# Use dotcontext tools in OpenCode to regenerate docs, agents, and skills
# See .context/config/ for sensors and policies
```

### Docker

```bash
# Start all services (Postgres, Chatwoot, app)
docker compose up -d

# Production variant
docker compose -f docker-compose.prod.yml up -d

# Coolify deploy
docker compose -f docker-compose.coolify.yml up -d
```
