# Implementation Plan: Deep-Tech Pulse

**Date**: 2026-02-23 | **Spec**: docs/spec.md | **Status**: Final

## Summary
Build a fully automated AI news dashboard using Next.js 15 (App Router, ISR, standalone output) deployed on Railway. Content pipeline fetches from RSS/YouTube/tool changelogs every 6 hours via Railway Cron, processes through Claude Haiku (with OpenAI GPT-4o-mini fallback) for summarization/tagging, stores in Railway PostgreSQL via Drizzle ORM. Zero-login single-page dashboard with trending snapshot, Tool Spotlight, tabbed content sections, and localStorage-based badges/bookmarks.

## Architecture

### Decisions from Debate
- **Next.js 15 over Astro 5** — Astro's ISR is less mature, React ecosystem richer for card-based dashboards (Round 1)
- **Railway PostgreSQL over Turso/Supabase** — Consolidates DB on same platform as hosting; eliminates extra service; free tier accepts ephemeral data (DB change)
- **Claude Haiku primary, OpenAI GPT-4o-mini fallback** — Claude Haiku for better summarization quality; GPT-4o-mini as cheap reliable fallback; provider abstraction supports both (AI provider change)
- **Railway over Vercel** — Native cron eliminates QStash; free tier; no cold starts (Redebate)
- **Railway Cron over QStash** — Direct command execution, no HTTP webhook exposure, no extra dependency (Redebate)
- **External signal trending over click tracking** — Zero-auth means no click data; HN points + YT views + relevance composite (Round 2)
- **localStorage over server sessions** — Zero-login requirement; per-device tracking acceptable for small team (Round 1-3)

### System Architecture
```
┌─────────────────────┐     ┌──────────────────────┐
│   Railway Cron      │     │   Railway Web        │
│   (every 6 hours)   │     │   (Next.js 15)       │
│                     │     │                      │
│  pnpm run           │     │  Server Components   │
│  pipeline:refresh   │     │  → read from PG      │
│                     │     │                      │
│  ┌───────────────┐  │     │  Client Components   │
│  │ RSS Fetcher   │  │     │  → localStorage      │
│  │ YouTube API   │  │     │  → badges/bookmarks  │
│  │ Tool Scraper  │──┼──→  │                      │
│  │ Dedup Engine  │  │     │  /api/cron/refresh   │
│  │ Claude/OpenAI │  │     │  (dev/manual only)   │
│  │ Zod Validator │  │     │                      │
│  └───────────────┘  │     └──────────────────────┘
│         │           │              │
│         ▼           │              │
│  ┌───────────────┐  │     ┌──────────────────────┐
│  │  Railway PG   │◄─┼─────│  Railway PG (read)   │
│  │   (write)     │  │     │  (same instance)     │
│  └───────────────┘  │     └──────────────────────┘
└─────────────────────┘
```

## Directory Structure
```
Deep-Tech/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts                    ← output: "standalone"
├── tailwind.config.ts
├── postcss.config.ts
├── drizzle.config.ts
├── railway.toml                      ← cron schedule config
├── validate-team.sh
├── check-result.sh
├── reconcile-pipeline.sh
├── context-snapshot.md
├── .env.local
├── .env.example
├── .gitignore
├── .claude/
│   └── agents/
│       ├── infra-agent.md
│       ├── pipeline-agent.md
│       ├── intelligence-agent.md
│       ├── dashboard-agent.md
│       ├── review-agent.md
│       └── context-agent.md
├── .beads/
│   ├── issues.jsonl
│   ├── results/
│   └── verdicts/
├── docs/
│   ├── 01-vision-and-strategy.md
│   ├── 02-problem-statement.md
│   ├── 03-prd.md
│   ├── 04-mvp-definition.md
│   ├── 05-information-architecture.md
│   ├── constitution.md
│   ├── spec.md
│   ├── plan.md
│   ├── tasks.md
│   └── debate-rounds/
│       ├── round-1.json
│       ├── round-2.json
│       ├── round-3.json
│       ├── round-4.json
│       ├── redebate-round-1.json
│       ├── redebate-round-2.json
│       └── score-history.json
├── public/
│   ├── favicon.ico
│   └── og-image.png
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       └── cron/
│   │           └── refresh/
│   │               └── route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── toast.tsx
│   │   ├── trending-snapshot.tsx
│   │   ├── tool-spotlight.tsx
│   │   ├── content-tabs.tsx
│   │   ├── article-card.tsx
│   │   ├── video-card.tsx
│   │   ├── new-badge.tsx
│   │   ├── urgency-chip.tsx
│   │   └── category-tag.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── ai/
│   │   │   ├── provider.ts
│   │   │   ├── claude.ts
│   │   │   ├── openai.ts
│   │   │   ├── schemas.ts
│   │   │   └── prompts.ts
│   │   ├── pipeline/
│   │   │   ├── runner.ts
│   │   │   ├── rss.ts
│   │   │   ├── youtube.ts
│   │   │   ├── tools.ts
│   │   │   ├── dedup.ts
│   │   │   └── health.ts
│   │   ├── hooks/
│   │   │   └── use-last-visited.ts
│   │   └── utils/
│   │       ├── trending.ts
│   │       └── format.ts
│   └── types/
│       └── index.ts
└── tests/
    ├── unit/
    │   ├── pipeline/
    │   │   ├── rss.test.ts
    │   │   ├── youtube.test.ts
    │   │   ├── dedup.test.ts
    │   │   └── tools.test.ts
    │   ├── ai/
    │   │   ├── claude.test.ts
    │   │   ├── openai.test.ts
    │   │   ├── schemas.test.ts
    │   │   └── prompts.test.ts
    │   └── utils/
    │       └── trending.test.ts
    ├── integration/
    │   ├── pipeline-runner.test.ts
    │   └── cron-endpoint.test.ts
    └── e2e/
        └── dashboard.spec.ts
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 15.x | App Router, ISR, API routes |
| react | 19.x | UI framework |
| react-dom | 19.x | React DOM rendering |
| typescript | 5.x | Type safety |
| postgres | latest | PostgreSQL driver (postgres.js) for Railway DB |
| drizzle-orm | latest | Type-safe ORM |
| drizzle-kit | latest | Migration tooling (dev dep) |
| @anthropic-ai/sdk | latest | Claude Haiku SDK (primary AI provider) |
| openai | latest | OpenAI GPT-4o-mini SDK (fallback AI provider) |
| zod | latest | LLM output schema validation |
| ssrf-req-filter | latest | External fetch SSRF protection |
| rss-parser | latest | RSS feed parsing |
| tailwindcss | 4.x | Utility-first CSS |
| @tailwindcss/postcss | 4.x | PostCSS integration |
| vitest | latest | Unit/integration testing (dev dep) |
| @playwright/test | latest | E2E testing (dev dep) |
| eslint | latest | Linting (dev dep) |
| @next/eslint-plugin-next | latest | Next.js ESLint rules (dev dep) |

## Agent Architecture

| Agent | Cluster Owned | Access | Tools | Build Tasks |
|-------|--------------|--------|-------|-------------|
| infra-agent | infrastructure | read-write | Read,Write,Edit,Bash,Grep,Glob | Scaffold, DB, config |
| pipeline-agent | pipeline | read-write | Read,Write,Edit,Bash,Grep,Glob | RSS, YouTube, Tools, cron, dedup |
| intelligence-agent | intelligence | read-write | Read,Write,Edit,Bash,Grep,Glob | AI provider, prompts, validation |
| dashboard-agent | dashboard | read-write | Read,Write,Edit,Bash,Grep,Glob | All UI components |
| review-agent | verification | read-only | Read,Grep,Glob,Bash(ro) | 0 |
| context-agent | snapshot | read-write (context-snapshot.md only) | Read,Write,Bash(ro) | 0 |

## Close Pipeline

```
agent writes code
  → agent runs verify
  → agent writes .beads/results/bd-XXXX.json
  → coordinator: bash check-result.sh bd-XXXX
    → exit 0 → dispatch review-agent for ONE bead
    → exit 1 → reject back to agent
  → review-agent: independently verifies ONE bead (verify + tsc + tests)
  → review-agent: writes ONE verdict JSON to .beads/verdicts/bd-XXXX.json
  → CLOSE SEQUENCE (atomic — all 4 steps before next task):
    1. bd close <id> --reason "[summary]"
    2. Verdict file confirmed in .beads/verdicts/bd-XXXX.json
    3. context-agent updates context-snapshot.md
    4. CLAUDE.md Build Log row + Build Metrics incremented
  → APPROVED → next task only after all 4 complete
  → REJECTED → forward to agent → fix → resubmit
```

⚠️ BATCH CLOSE PROHIBITION: Never close multiple beads at once.
check-result.sh enforces pipeline continuity.

## Enforcement Scripts

| Script | When It Runs | What It Checks | On Failure |
|--------|-------------|----------------|------------|
| validate-team.sh | After team design, before build | Cluster↔agent mapping, no orphans, DAG valid | Build blocked until exit 0 |
| check-result.sh | After agent submits, before review | All gates true, todoCount=0 | Rejected back to agent |
| jq verdict parse | After review-agent verdict | APPROVED/REJECTED field | Coordinator acts on result |
| reconcile-pipeline.sh | After all beads closed | Results = Verdicts = Log rows = Snapshot entries | Gaps filled before commit |

## Risk-Aware Implementation Notes
- ⚠️ Railway PostgreSQL uses `postgres` (postgres.js) driver — NOT @libsql/client — DB change
- ⚠️ YouTube playlistItems.list (1 unit) NOT search.list (100 units) — Round 1
- ⚠️ LLMs return malformed JSON occasionally — always Zod validate — Round 3
- ⚠️ Cursor changelog: cursor.com/changelog NOT GitHub releases — Round 3
- ⚠️ Claude changelog: docs.anthropic.com NOT GitHub — Round 3
- ⚠️ First run needs 30-day lookback — Round 3
- ⚠️ All API keys server-side only — Round 4
- ⚠️ Railway requires output: "standalone" in next.config.ts — Redebate
- ⚠️ Railway env vars: use Shared Variables at project level — Redebate
- ⚠️ crypto.timingSafeEqual for secret comparison — global gotcha

## Deployment

### Railway Setup
1. Create Railway project with 2 services:
   - **Web service**: Next.js app (auto-detected by Nixpacks)
   - **Cron service**: `pnpm run pipeline:refresh`, schedule `0 */6 * * *`
2. Set Shared Variables at project level (all env vars)
3. Connect GitHub repo for auto-deploy
4. Custom domain via Railway settings

### Build Configuration
```toml
# railway.toml (in repo root)
[build]
builder = "nixpacks"

[deploy]
startCommand = "node .next/standalone/server.js"
```

### Environment
- Production: Railway (Free tier, $0/mo)
- Database: Railway PostgreSQL (free tier, ephemeral — pipeline re-seeds on wipe)
- AI: Claude Haiku (primary) + OpenAI GPT-4o-mini (fallback)
- YouTube: Data API v3 (free, 10K units/day)
