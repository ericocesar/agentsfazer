# CLAUDE

> **Source:** `CLAUDE.md`
> **Type:** generic

---

# CLAUDE.md

**fazer.ai agents** — fullstack TypeScript (Bun + Elysia + React 19 + Tailwind v4, Prisma/PostgreSQL, JWT, i18n, Biome) running LangGraph TS for AI agents over Chatwoot. Built on bunfire template. Multi-tenant, "one core, three transports" (REST v1, MCP, UI), Free vs Full.

Subsystem docs in [`docs/`](docs/). Sections below cover what's not there.

## Subsystem docs

- [`docs/ui.md`](docs/ui.md): screen map, shared primitives, tool-selection grant (replace-the-set; NATIVE/RAG), i18n/extract gotchas.
- [`docs/google-oauth.md`](docs/google-oauth.md): Google Identity Services wiring.
- [`docs/modals.md`](docs/modals.md): Modal controller, always-render rule, async checklist.
- [`docs/frontend-env-vars.md`](docs/frontend-env-vars.md): `BUN_PUBLIC_*` build propagation.
- [`docs/cdn-r2-setup.md`](docs/cdn-r2-setup.md): Cloudflare R2 for CDN assets.
- [`docs/realtime.md`](docs/realtime.md): WebSocket patterns, Bun pub/sub, frontend hook. **Gotchas**: no `response` schema on `.ws()`, key state by `String(ws.id)`.
- [`docs/i18n.md`](docs/i18n.md): `t()`/`translate()` separation, magic comments, biome lint checks.
- [`docs/eden-treaty.md`](docs/eden-treaty.md): `parseDate: false`, derive types from `Awaited<ReturnType<typeof api.X.get>>`.
- [`docs/tenancy.md`](docs/tenancy.md): Prisma `$extends` + RLS, `ScopedDb`, `runScoped`/`asSuperAdmin`, runtime role, SUPER_ADMIN gate.
- [`docs/api-and-fleet.md`](docs/api-and-fleet.md): service pattern, read API, instance identity, outbound webhooks (`emitOutbound`, delivery worker).
- [`docs/integrations.md`](docs/integrations.md): catalog (TOOLPACK/MCP/NATIVE), generic inbound receptor, pure mappers, `agentNudge`.
- [`docs/graph.md`](docs/graph.md): agent runtime — `getCheckpointer`, `createChatModel`, supervisor graph, `runAgentTurn`. All network outside txns.
- [`docs/chatwoot.md`](docs/chatwoot.md): Chatwoot integration — dual-token client, webhook receiver, attribution gate, provisioning.
- [`docs/debounce.md`](docs/debounce.md): inbound message coalescing — `armDebounce`, dedicated worker, watermark CAS, `runLoadedTurn`.
- [`docs/stt.md`](docs/stt.md): voice transcription — provider registry, `cleanTranscription`, `renderInboundMessage`.
- [`docs/tts.md`](docs/tts.md): audio replies — `shouldReplyWithAudio`, provider registry, `Contact.voiceReply`, `client.sendAudioMessage`.
- [`docs/playground.md`](docs/playground.md): agent playground — `runPlaygroundTurn`, fenced thread, production tools minus conversation tools.
- [`docs/split.md`](docs/split.md): split+typing — `deliverReply`, `splitReply`, typing pacing.
- [`docs/channel-redirect.md`](docs/channel-redirect.md): WhatsApp→web redirect — gate, single-use token, fork's widget merge.
- [`docs/service-window.md`](docs/service-window.md): WhatsApp 24h window + HSM templates — `proactiveSendMode`.
- [`docs/deploy.md`](docs/deploy.md): deploy contract — two DB roles, single-replica, per-platform notes.
- [`docs/mcp.md`](docs/mcp.md): MCP server + OAuth 2.1 — access token, grant, write tools, DCR closed.
- [`docs/logs.md`](docs/logs.md): flow logs + alerting + retention — `ExecutionLog`, `AlertChannel`, sweep worker.
- [`docs/bun-compile-segfault.md`](docs/bun-compile-segfault.md): deploy runs TS interpreted (`bun src/index.ts`), `--compile` segfaults.

Three operational **skills** (`.claude/skills/agents-{onboarding,operation,dev}/`) cover full-journey tasks: deploy from zero, debug a live conversation, onboard a contributor.

## Architecture overview

**"One core, three transports."** All domain logic lives in `src/modules/` (35+ modules — agents, chatwoot, conversations, debounce, stt, tts, split, rag, vault, webhooks, etc.). Three API surfaces consume those services:

1. **REST v1** — `src/api/v1/` (Elysia controllers, ~27 files). Admin panel CRUD, agent config, MCP admin, knowledge base, logs.
2. **MCP server** — `src/api/v1/mcp-*.controller.ts` + `docs/mcp.md`. OAuth 2.1, write tools with dry-run by default, DCR closed. Also mounts on `src/api/v1/v1.controller.ts`.
3. **UI** — `src/client/` (React 19). Single admin console covering all modules.

**Free vs Pro editions.** The codebase has Free/Pro markers. Derivation scripts (`derive:pro`/`derive:free` in package.json) strip Pro code for Free builds. `bun run derive:free` outputs a Free-only tree.

## Agent runtime (graph)

`src/graph/` houses the LangGraph TS agent runtime:

- **`graph.ts`** — supervisor graph definition. Orchestrates the agent loop.
- **`prepare.ts`** (35KB) — prompt assembly: system prompt, tool descriptions, conversation history packing.
- **`runtime.ts`** (22KB) — `runAgentTurn`, tool execution, error handling, state management.
- **`checkpointer.ts`** — Postgres-backed checkpointer for per-conversation memory.
- **`nudge.ts`** — proactive agent wakeup logic.
- **`tools/`** — native tools available to agents:
  - `native.ts` (41KB) — first-party tools (knowledge search, conversation state, agent control).
  - `http.ts` (22KB) — HTTP tool execution (SSRF-safe, credential injection).
  - `mcp.ts` (18KB) — MCP client tool runner.
  - `rag.ts` (12KB) — RAG query + document management.
  - `assemble.ts` — tool selection and grant resolution.
  - `catalog.ts` — tool catalog registry.
  - `calculator.ts`, `toolName.ts` — utilities.

Key invariant: all network calls happen *outside* DB transactions (`docs/graph.md`).

## Tests

Extensive test suite at `tests/` mirroring `src/` structure. ~100+ test files covering every module:

- `tests/modules/` — all domain modules.
- `tests/api/` — API controllers.
- `tests/graph/` — graph runtime.
- `tests/client/` — frontend tests.
- `tests/scripts/` — CLI scripts.
- `bun test` runs all tests.

Test DB is isolated (`bun db:test:setup`), never uses the main database.

## Biome custom lint plugins

`biome-plugins/` contains GritQL-based custom lint rules enforcing project conventions:

- `require-page-container.grit` — every top-level page must wrap in `<PageContainer>`.
- `always-render-modal.grit` — `<Modal>` must always be rendered (never conditional).
- `no-dynamic-i18n-key.grit` / `no-dynamic-translate-key.grit` — i18n keys must be static strings.
- `no-bun-public-env.grit` — env vars must use `BUN_PUBLIC_*` pattern, not `process.env`.
- `no-t-rename.grit` — prevent `t()` from being renamed/aliased.

## Domain modules (35+)

Each module in `src/modules/` follows the service pattern (`docs/api-and-fleet.md`):

| Module | Purpose |
|--------|---------|
| `agents/` | Agent CRUD, config, behavior settings |
| `conversations/` | Conversation lifecycle (Chatwoot mirroring) |
| `rag/` | Knowledge bases, documents, embeddings (pgvector) |
| `vault/` | Encrypted credential storage (cofre) |
| `chatwoot/` | Chatwoot client, webhook receiver, provisioning |
| `debounce/` | Message coalescing + watermark CAS |
| `stt/` | Speech-to-text provider registry |
| `tts/` | Text-to-speech provider registry |
| `split/` | Message splitting + typing pacing |
| `handoff/` | Agent→human handoff routing |
| `followups/` | Proactive follow-up scheduling |
| `flowlog/` | Execution log + retention sweep |
| `webhooks/` | Outbound webhook delivery + dead-letter queue |
| `mcp/` | MCP server resources, grants, access tokens |
| `mcp-connections/` | Outbound MCP server connections |
| `integrations/` | Toolpack/MCP/Native integration catalog |
| `tool-definitions/` | HTTP tool definitions (custom tools) |
| `appointments/` | Google Calendar scheduling |
| `service-window/` | WhatsApp 24h window compliance |
| `channel-redirect/` | WhatsApp→web redirect funnel |
| `quotes/` | Quote/proposal generation |
| `kanban/` | Sales funnel kanban |
| `experiments/` | A/B prompt experiments |
| `business-hours/` | Business hours profiles |
| `audit/` | Audit log |
| `api-keys/` | Tenant API keys |
| `models/` | LLM provider configuration |
| `analytics/` | Dashboard KPIs + metrics |
| `updates/` | Version update notifications |
| `vision/` | Image/document vision processing |
| `guardrails/` | Content guardrails |
| `scheduler/` | Background job scheduling |
| `tenant-settings/` | Tenant-level config (embedding, Langfuse) |

## Auth: first-run setup, signup control, domain restrictions

**Invariant: first account always created via `/setup` (as `ADMIN`).** Other registration requires setup complete + `SIGNUP_ENABLED=true`. Login/linking for existing users never gated.

- **`/setup`.** When no users exist, `SetupGate` redirects to `/setup` → `POST /api/auth/setup` → `refreshSetupState()` self-heals stale flag → creates ADMIN inside advisory lock (`createInitialAdmin`), bypasses `ALLOWED_SIGNUP_DOMAINS`. Sets cookie + `completeSetup()`. State in `setup.service.ts`; `initSetupState()` runs at boot from `src/index.ts`.
  - Advisory lock serializes `/setup` across replicas, not against `bun set-admin` CLI (benign: `/setup` still produces ≤1 admin).
  - Setup token + flag are per-process memory: multi-instance → browser must hit the right instance (stale replica self-heals to 409→redirect); deleting all users reopens setup on restart; boot-time DB outage logs warning, self-heals on first POST.
- **`SETUP_TOKEN_REQUIRED`** (default `true`). Server logs one-time token + ready URL; form verifies timing-safe. Set `false` only on trusted networks.
- **`SIGNUP_ENABLED`** (default `false`). Master switch. When `false`, signup + first-time Google return 403. Alternatives: enable Google, flip to true, or `bun set-admin`.
- **`ALLOWED_SIGNUP_DOMAINS`** (csv, default empty=allow any). Gates signup + first-time Google. Existing users unaffected. `/setup` bypasses.
- **`ADMIN_SIGNUP_DOMAINS`** (csv, default empty). Auto-promotes verified-email Google signups from listed domains to ADMIN. Only enable when Google Workspace operator = app admin group; otherwise use `bun set-admin`. Pre-created admin must log in with password once before Google linking.

## Routing: BrowserRouter + serve.routes carve-out

Uses `BrowserRouter` (canonical URLs). `src/app.ts` registers `.get("/*", indexHandler)` for deep-route refreshes. Four load-bearing pieces:

1. **`serve.routes` carve-out**: `new Elysia({ serve: { routes: { "/api": false, "/api/*": false } } })` — stops Bun's static routes from intercepting `/api` before Elysia handles it.
2. **GET 404 guards**: explicit `.get("/api", ...)` + `.get("/api/*", ...)` between API group and catch-all returning JSON 404 (catch-all would serve HTML). Non-GETs caught by `onError`. WS upgrades unaffected.
3. **Dev vs prod `indexHandler`**: dev → `HTMLBundle` from `public/index.html` (HMR); prod → pre-built `dist/index.html` via `Bun.file`.
4. **`publicPath: "/"` in `build.ts`**: prevents relative asset path failures on deep routes.

Root cause: [oven-sh/bun#17595](https://github.com/oven-sh/bun/issues/17595), [#17363](https://github.com/oven-sh/bun/issues/17363) — static routes table has priority over `fetch`. Confirmed Elysia 1.4.28.

**On Elysia upgrade**: smoke-test by registering `.get("/*", htmlBundle)` + `.get("/api/health", () => ({ ok: true }))` in a temp dir (no carve-out). If JSON, bug fixed → remove carve-out. Only runtime check, not issue/PR status.

## Dev setup

- Scan ports for existing PostgreSQL before setting `DATABASE_URL`. Default 5432, pick next if busy.
- **Never bare `prisma migrate reset`**: wipes `public` schema grants → `42501`. Use `bun db:reset` or re-run `bun db:bootstrap`.
- **`psql $DATABASE_URL` returns zero rows for tenant-scoped tables** (RLS enforced on runtime role). Use `MIGRATION_DATABASE_URL` (superuser, read-only) or `SET app.tenant_id = '<id>'` before SELECT. See `docs/tenancy.md`.

## Common commands

| Command                            | Description                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun dev`                          | Start dev server with hot reload (port 3000)                                             |
| `bun build`                        | Build frontend assets to `dist/`                                                         |
| `bun test`                         | Run tests                                                                                |
| `bun test:coverage`                | Run tests with coverage report                                                           |
| `bun lint`                         | Lint with Biome                                                                          |
| `bun format`                       | Format with Biome                                                                        |
| `bun check`                        | Lint + type-check + i18n + tests                                                         |
| `bun prisma:migrate`               | Run database migrations                                                                  |
| `bun db:bootstrap`                 | Provision the NON-superuser runtime role + schema grants (run after any reset)           |
| `bun db:reset`                     | Reset the database AND re-provision runtime-role grants (never bare `migrate reset`)     |
| `bun db:test:setup`                | Provision/migrate the isolated test database                                             |
| `bun prisma:generate`              | Generate Prisma client                                                                   |
| `bun i18n:extract`                 | Extract translation keys (also runs in the pre-commit hook)                              |
| `bun set-admin <email> [password]` | Promote a user to admin (creates the user if it doesn't exist; optionally sets password) |

## Project layout

**App:**
- `src/modules/`: core domain services — one folder per subsystem. The "one core, three transports" services here; REST v1 / MCP / UI project over them
- `src/graph/`: LangGraph TS agent runtime + `tools/` (native tools)
- `src/api/`: Elysia backend — `features/` (auth, admin, health, i18n), `v1/` (REST v1 + MCP mount), `lib/`, `middlewares/`, `locales/`
- `src/lib/`: shared libs, incl. `tenancy/` (Prisma `$extends` + Postgres RLS)
- `src/client/`: React frontend (`pages/`, `components/`, `contexts/`, `hooks/`, `lib/`, `locales/`)
- `src/app.ts`: Elysia app setup · `src/config.ts`: env config · `src/index.ts`: entry point
- `prisma/`: schema + migrations · `public/`: static assets + `index.html` · `build.ts`: custom build (Tailwind plugin)
- `scripts/`: tooling scripts · `tests/`: test suite mirroring `src/` · `workers/cdn/`: Cloudflare Worker
- `Dockerfile` + `docker-compose.yml` (dev) / `.prod.yml` / `.coolify.yml` / `.portainer.yml` (deploy targets)

## Frontend architecture

- `ProtectedRoute` wraps children in `<Layout>`. Page components must NOT wrap in `<Layout>`, render content only
- `<Layout>` composes `<Header>` + `<Sidebar>` + `<main>`. Nav items defined in `src/client/lib/navigation.tsx`
- `<UserMenu>` is single entry point for user actions (theme, language, settings, logout). Do not add those to header/sidebar
- `<Sidebar>` footer block (`SidebarFooter`) with external links via `SUPPORT_LINK`/`SECONDARY_LINKS`. Footer pinned below nav, collapses to icon-only, hidden if both empty
- `<SidebarProvider>` manages sidebar state (`collapsed`, `width` in localStorage, `mobileOpen`). Ctrl/Cmd+B toggles collapse
- `<TooltipProvider>` wraps app. `<Modal>`, `<Tooltip>`, `<Toast>`, sidebar drawer, `<UserMenu>` wrap Radix primitives for focus trap + ARIA
- `<PageContainer>` is single source of page-level max-width. Every top-level page in `src/client/pages/*.tsx` must wrap root JSX in it. Sizes: `narrow` (`max-w-3xl`), `wide` (`max-w-7xl`, default), `full` (no max-width). Enforced by `biome-plugins/require-page-container.grit`. Sub-pages under layout routes out of scope. Auth pages suppress with `// biome-ignore lint/plugin: <reason>`

## Theming

- Colors are CSS custom properties in `@theme` block (`public/index.css`, dark defaults). Light overrides in `html[data-theme="light"]`
- Always define both dark + light values for new colors
- Never hardcoded Tailwind colors or hex values. Use CSS variable classes (`bg-error`, `text-accent`, `border-border`)
- Use `text-accent-foreground` for text on accent backgrounds
- Use `useThemedAsset` hook for theme-aware static assets
- `ThemeProvider` wraps app. Use `useTheme()` for `{ theme, resolvedTheme, setTheme }`
- Inline script in `public/index.html` sets `data-theme` before hydration (prevents flash)
- Theme stored in localStorage under `@app:theme` (`auto`, `light`, `dark`)

## CSP

`src/app.ts` configures `elysia-helmet` with CSP always enabled (enforce in prod, Report-Only in dev). Defaults cover `default-src`, `base-uri`, `form-action`, `frame-ancestors`, `object-src`, `script-src-attr`, `upgrade-insecure-requests`. Explicit directives in `src/api/lib/csp.ts`: `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`.

Inline scripts allowed via `'sha256-...'`. Prod hashes from `dist/index.html`, dev from `public/index.html`. Dev also adds `'unsafe-inline'`/`'unsafe-eval'`.

GSI directives (`accounts.google.com`) added automatically when `GOOGLE_CLIENT_ID` set. When GSI enabled, COOP relaxed to `same-origin-allow-popups` (required for GSI popup).

**Any inline script edit requires `bun run build` before prod start** — hash mismatch blocks the script. Dev shows console warnings only.

## Encryption

- `ENCRYPTION_KEY` encrypts sensitive data at rest. Use `encryptJson()`/`decryptJson()` from `src/api/lib/crypto.ts`
- **Store base64 blob in plain `String` column, never `Json`** — prevents accidental logging/serialization
- Key must be strong (min 32 chars). Changing it invalidates all encrypted data
- Never log, expose in API responses, or include in frontend bundles

## Code style

- Biome (2-space indent, LF). Path alias `@/`→`src/`. Strict TS. Husky pre-commit hooks
- Prefer `Bun.file(path).text()`/`.json()` over `node:fs`
- Always run `bun check` after code changes
- Comments: only with tags (`// TODO:`, `// NOTE:`, `// FIXME:`), never obvious/redundant
- **Cursor styles**: `cursor: pointer` global on `button`/`select`/`[role="button"]`. Never `cursor-pointer` individually. Only use for overrides like `cursor-not-allowed`
- Use `cn()` utility for classNames. Conditional classes with object syntax, not ternary
- Add `aria-*` for accessibility
- **FormField `group` prop**: a `<FormField>` whose children are NOT a single focusable control MUST receive `group`. Without it, `<label>` click forwards to first focusable child. Only omit when single child is a real `<input>`/`<select>`/`<textarea>`
- **Never use HTML `title` attribute** (native tooltip). Use `<Tooltip>` primitive instead. Does NOT apply to `title` prop of components or `<title>` element
- Always check `.env.example` when adding new env vars

## Branding

- "fazer.ai" always lowercase. "fazer-ai" OK in slugs/identifiers. Never "Fazer.ai" or "Fazer.AI"

## UX

- Always consider loading states, debouncing, error handling, and user feedback

### Loading states: skeletons over spinners

- **Skeletons default** for content loading (pages, lists, tables, cards, dashboards). Use `<Skeleton>` primitive. Wrap region with `role="status"` + sr-only `t("common.loading")`.
- **`<DataBoundary>` is the chokepoint.** Its `loading` branch renders skeleton (generic or caller-supplied `skeleton` prop). `role="status"` + sr-only inside `DataBoundary`.
- **Spinners exceptional** — button loading states (`<Button loading>`) and app-boot/auth/invite-token splash (no meaningful layout to skeleton).
- Don't skeleton sub-perceptible (<~300ms) or unknown-shape loads.
