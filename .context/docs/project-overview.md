---
type: doc
name: project-overview
description: High-level overview of the project, its purpose, and key components
category: overview
generated: 2026-07-30
status: filled
scaffoldVersion: "2.0.0"
---

## Project Overview

fazer.ai agents is a multi-tenant AI agent platform that connects LLM-powered agents to customer communication channels via Chatwoot. It provides agent management, conversation handling, tool execution, RAG, vision/TTS/STT, guardrails, handoff, and MCP server support. Built for self-hosted deployment.

## Codebase Reference

> **Semantic Snapshot**: Use `dotcontext_context({ action: "getMap", section: "all" })` for generated stack, architecture layers, key files, and dependency hotspots.

## Quick Facts

- **Root**: `/Users/ericocesar/Mac.local/boltdev/temp/agents`
- **Languages**: TypeScript
- **Runtime**: Bun
- **Entry**: `src/index.ts`
- **Package**: `agents` (private, `fazer-ai/agents-master`)
- **Database**: PostgreSQL via Prisma ORM
- **Frontend**: React SPA under `src/client/`
- **Orchestration**: Agent graph pipeline in `src/graph/`

## Entry Points

- `src/index.ts` — Application entry (Bun HTTP server)
- `src/app.ts` — Express-style app with middleware, routes, and features
- `src/api/v1/` — REST API v1 routes
- `src/client/` — React SPA frontend
- `workers/cdn/` — Cloudflare Worker for CDN
- `scripts/` — CLI utilities (setup, db bootstrap, i18n, etc.)

## Key Exports

- Agent graph runtime (`src/graph/runtime.ts`, `src/graph/prepare.ts`)
- Chatwoot integration (`src/modules/chatwoot/`)
- MCP server & tools (`src/modules/mcp/`)
- Multi-provider AI: vision, TTS, STT (`src/modules/vision/`, `tts/`, `stt/`)
- RAG knowledge base (`src/modules/rag/`)
- Multi-tenant auth & features (`src/api/features/`)

## File Structure & Code Organization

- `src/` — Application source: API, client, modules, graph, lib
- `src/modules/` — Feature modules (agents, chatwoot, mcp, rag, vision, tts, etc.)
- `src/graph/` — Agent execution graph orchestration
- `src/client/` — React frontend pages, components, hooks
- `src/api/` — REST API routes, middlewares, feature services
- `src/lib/` — Shared utilities, errors, tenancy, SSRF guard
- `generated/` — Prisma client & models
- `workers/cdn/` — Cloudflare Worker assets
- `scripts/` — CLI tools (setup, seed, migration, i18n)
- `tests/` — Test suites (api, modules, graph, client, utils)
- `prisma/` — Prisma schema and migrations
- `docs/` — Documentation

## Technology Stack Summary

- **Runtime**: Bun (TypeScript ESM)
- **Database**: PostgreSQL + Prisma ORM
- **HTTP**: Express-like router with middleware
- **Frontend**: React, React Router, custom design system
- **AI Providers**: OpenAI, Anthropic, Google, OpenRouter, and more per module
- **Build**: Custom `build.ts` script + `bun build`
- **Lint/Format**: Biome
- **Testing**: Bun test (Jest-compatible)
- **CICD**: GitHub Actions
- **Deploy**: Docker multi-stage, Coolify / Portainer

## Getting Started Checklist

1. Clone the repo and run `npm install` (Bun workspace).
2. Copy `.env.example` to `.env` and configure database, Chatwoot, AI providers.
3. Run `npm run prisma:migrate && npm run db:bootstrap` to set up the database.
4. Run `npm run dev` to start the development server.
5. Open the SPA at the configured URL and run the setup wizard.

## Next Steps

- Review `AGENTS.md` for dev environment tips and testing instructions.
- See `.context/docs/development-workflow.md` for daily engineering process.
- See `.context/docs/testing-strategy.md` for test patterns.
- See `.context/docs/tooling.md` for CLI and IDE setup.
