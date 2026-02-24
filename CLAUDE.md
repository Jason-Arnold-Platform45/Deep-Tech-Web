# CLAUDE.md — Deep-Tech Pulse

## Project Overview
Deep-Tech Pulse is a fully automated, zero-login AI news dashboard for a small agentic coding team. It aggregates content from RSS feeds, YouTube, and tool changelogs into four curated sections (AI News, Videos/Demos, Market Unlocks, Best Way to Work), applies AI-powered summarization with urgency labels and category tags, and refreshes every 6 hours. The goal: any team member opens one page and knows exactly what's happening in agentic coding, what to watch, and the best new ways to work — in 30 seconds.

## Foundation Documents (read-only inputs — never modified)
- docs/01-vision-and-strategy.md   → vision, audience, success metrics
- docs/02-problem-statement.md     → pain points, evidence, opportunity
- docs/03-prd.md                   → user stories, acceptance criteria, out-of-scope
- docs/04-mvp-definition.md        → v1 scope, parked features
- docs/05-information-architecture.md → screen map, nav flows, feature connections

## Tech Stack
- Language: TypeScript 5.x
- Runtime: Node.js 22 LTS
- Framework: Next.js 15 App Router (ISR for static-first with incremental regeneration)
- Database: Turso (libSQL) via `@libsql/client` — NOT better-sqlite3
- ORM: Drizzle ORM with drizzle-kit for migrations
- Styling: Tailwind CSS 4
- AI Summarization: Gemini 1.5 Flash (free tier: 15 RPM, 1500 req/day) — retry on failure, skip to raw storage on exhaustion
- Scheduling: Railway Cron (native, runs pipeline command every 6 hours)
- Video: YouTube Data API v3 (playlistItems.list — NEVER search.list)
- Validation: Zod for LLM output schema validation
- Security: ssrf-req-filter for all external fetches, CRON_SECRET for manual refresh endpoint
- Hosting: Railway (Hobby plan — $5/mo with $5 usage credit included)
- Package Manager: pnpm
- Testing: Vitest + Playwright
- Task Tracking: Beads (`bd` CLI)

## Project Structure
```
Deep-Tech/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.ts
├── drizzle.config.ts
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
│   │   │   ├── toast.tsx
│   │   │   └── skeleton.tsx
│   │   ├── trending-snapshot.tsx
│   │   ├── tool-spotlight.tsx
│   │   ├── content-tabs.tsx
│   │   ├── article-card.tsx
│   │   ├── video-card.tsx
│   │   ├── pipeline-status.tsx
│   │   ├── new-badge.tsx
│   │   ├── urgency-chip.tsx
│   │   ├── category-tag.tsx
│   │   ├── share-button.tsx
│   │   ├── bookmark-button.tsx
│   │   └── empty-state.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── ai/
│   │   │   ├── provider.ts
│   │   │   ├── gemini.ts
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
│   │   │   ├── use-last-visited.ts
│   │   │   └── use-bookmarks.ts
│   │   └── utils/
│   │       ├── trending.ts
│   │       ├── share.ts
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
    │   │   ├── gemini.test.ts
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

## Spec Kit Commands
```bash
specify constitution <<'EOF'
[content]
EOF

specify spec <<'EOF'
[content]
EOF

specify plan <<'EOF'
[content]
EOF

specify tasks <<'EOF'
[content]
EOF
```

## Beads Commands
```bash
bd ready --json
bd update <id> --status in_progress
bd close <id> --reason "Done"
bd dep tree
bd epic status <id> --json
bd list -t epic --json
bd create "Discovered: [desc]" -t task -p 2 -l "deep-tech-pulse"
bd dep add <new-id> <current-id> --type discovered-from
bd export -o .beads/issues.jsonl
```

## Development Commands
```bash
# Dev server
pnpm dev

# Tests
pnpm vitest run

# Single test file
pnpm vitest run src/lib/pipeline/rss.test.ts

# Linter
pnpm eslint . --fix

# Type checker
pnpm tsc --noEmit

# Build
pnpm build

# Migrations (development)
pnpm drizzle-kit push

# Migrations (production — generate + apply)
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Seed (first-run uses 30-day lookback automatically)
# No manual seed needed — pipeline auto-seeds on first run
```

## Code Style & Conventions
- File naming: kebab-case for all files (`article-card.tsx`, `use-last-visited.ts`)
- Component naming: PascalCase for components (`ArticleCard`, `TrendingSnapshot`)
- Variable naming: camelCase for variables/functions, SCREAMING_SNAKE for constants
- Import ordering: (1) React/Next.js, (2) external packages, (3) internal `@/lib`, (4) internal `@/components`, (5) types
- Error handling: try/catch with typed errors, per-source isolation in pipeline, never let one failure cascade
- State management: React Server Components for data fetching, localStorage hooks for client state (last-visited, bookmarks)
- API response format: `{ data: T, error?: string, meta?: { lastRefreshed: string, status: string } }`
- Component structure: Server Components by default, `"use client"` only when localStorage/interactivity needed
- File organization: co-locate tests in `tests/` mirroring `src/` structure

## Architecture Decisions
- **Next.js 15 over Astro 5** — Astro's ISR is less mature, and the React ecosystem provides richer card/dashboard components (Round 1)
- **Turso over Supabase** — Supabase's auth/realtime features are unused overhead for a zero-login read-heavy dashboard; Turso's SQLite simplicity is ideal (Round 1)
- **Gemini Flash free tier over paid alternatives** — 1500 req/day free tier covers 200 articles/day; retry logic + raw storage fallback eliminates need for paid backup (Round 1-2, updated for zero-cost constraint)
- **Railway Cron over QStash/Vercel Cron** — Railway runs cron as a native service, calling the pipeline script directly (no HTTP webhook needed); simpler and included in Hobby plan (updated post-debate: hosting moved to Railway)
- **External signal trending over click tracking** — Zero-auth means no click data; HN points + YouTube views + relevance score composite provides meaningful ranking (Round 2)
- **localStorage over server sessions** — No login required; per-device tracking acceptable for small team; no PII collected or transmitted (Round 1-3)
- **Zod validation on LLM output** — Gemini Flash returns malformed JSON ~2-5% of the time; Zod catches this with retry logic (Round 3)
- **Provider abstraction for LLM** — Single interface, swap providers via config; prevents vendor lock-in (Round 2)

## Common Patterns

### Database Query (Drizzle + Turso)
```typescript
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { desc, gt } from "drizzle-orm";

const recentArticles = await db
  .select()
  .from(articles)
  .where(gt(articles.publishedAt, Date.now() - 7 * 24 * 60 * 60 * 1000))
  .orderBy(desc(articles.trendingScore))
  .limit(20);
```

### AI Provider Interface
```typescript
import { z } from "zod";

export const ArticleAnalysisSchema = z.object({
  summary: z.string().min(20).max(500),
  whyItMatters: z.string().min(10).max(200),
  urgency: z.enum(["use_now", "watch_this_week", "coming_soon"]),
  category: z.enum(["model_release", "tools", "research", "industry_moves"]),
  relevanceScore: z.number().int().min(0).max(100),
  isGenericAINoise: z.boolean(),
  contentSafe: z.boolean(),
});

export interface AIProvider {
  summarize(content: string): Promise<z.infer<typeof ArticleAnalysisSchema>>;
}
```

### Cron Endpoint (Manual Refresh via API)
```typescript
import crypto from "node:crypto";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret) return new Response("Missing secret", { status: 401 });

  const expected = process.env.CRON_SECRET!;
  const isValid = crypto.timingSafeEqual(
    Buffer.from(secret),
    Buffer.from(expected)
  );
  if (!isValid) return new Response("Invalid secret", { status: 401 });

  // Process refresh...
}
```

### Railway Cron (Production Scheduling)
```json
// railway.toml or Railway dashboard
// Cron service runs: pnpm run pipeline:refresh
// Schedule: every 6 hours (0 */6 * * *)
// This calls the pipeline runner directly — no HTTP needed
```

### localStorage Hook (Last Visited)
```typescript
"use client";
import { useState, useEffect } from "react";

const LAST_VISITED_KEY = "deep-tech-pulse-last-visited";

export function useLastVisited() {
  const [lastVisited, setLastVisited] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_VISITED_KEY);
    if (stored) setLastVisited(parseInt(stored, 10));
    localStorage.setItem(LAST_VISITED_KEY, Date.now().toString());
  }, []);

  const isNew = (publishedAt: number) => publishedAt > lastVisited;
  return { lastVisited, isNew };
}
```

### Server Component Data Fetching
```typescript
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function NewsSection() {
  const news = await db
    .select()
    .from(articles)
    .where(eq(articles.category, "model_release"))
    .orderBy(desc(articles.publishedAt))
    .limit(12);

  return <ContentGrid items={news} />;
}
```

## Testing Strategy
- Unit tests: Pipeline functions (RSS parsing, YouTube fetch, deduplication, trending score), AI schema validation, utility functions. Located in `tests/unit/` mirroring `src/` structure. Naming: `[module].test.ts`
- Integration tests: Full pipeline runner with mocked external APIs, cron endpoint with CRON_SECRET verification. Located in `tests/integration/`. Naming: `[feature].test.ts`
- E2E tests: Dashboard loads, tabs switch, cards render, badges appear, share/bookmark work. Located in `tests/e2e/`. Naming: `[flow].spec.ts`
- Single file command: `pnpm vitest run tests/unit/pipeline/rss.test.ts`

## Environment Variables
```env
# Database
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# AI Provider (Gemini free tier only)
GEMINI_API_KEY=

# Scheduling (manual refresh endpoint only — Railway Cron handles production)
CRON_SECRET=

# YouTube
YOUTUBE_API_KEY=

# App
NEXT_PUBLIC_SITE_URL=
```

## Agent Team
Generated from tasks.md capability clusters. Finalized by validate-team.sh.
- infra-agent: Infrastructure cluster — scaffold, database, config, migrations, env setup
- pipeline-agent: Pipeline cluster — RSS ingestion, YouTube API, Tool Spotlight scraping, Railway Cron scheduling, dedup, health tracking
- intelligence-agent: Intelligence cluster — LLM provider abstraction, Gemini integration, Zod validation, prompts, noise filtering, content safety
- dashboard-agent: Dashboard cluster — trending snapshot, tabbed sections, cards, badges, bookmarks, sharing, mobile layout, empty state, pipeline health UI, Tool Spotlight UI
- review-agent: Pre-close verification, zero build tasks
- context-agent: context-snapshot.md updates, zero build tasks

## Close Pipeline
Every bead follows this exact sequence. No step may be skipped or reordered:
agent writes code → agent runs verify → agent writes .beads/results/bd-XXXX.json → coordinator runs: bash check-result.sh bd-XXXX → exit 0 → dispatch review-agent for this ONE bead → exit 1 → reject back to agent (review-agent not dispatched) → review-agent independently verifies ONE bead (runs verify, tsc, tests) → review-agent writes .beads/verdicts/bd-XXXX.json (one verdict per bead) → CLOSE SEQUENCE (atomic — all 4 steps execute together before next task): → coordinator parses verdict via jq → REJECTED → forward issues to agent → fix → resubmit → restart pipeline → APPROVED → execute all 4 steps atomically: 1. bd close <id> --reason "[summary]" 2. Write .beads/verdicts/bd-XXXX.json inline if not already written 3. dispatch context-agent → snapshot updated with this beadId 4. Update CLAUDE.md Build Log (add row) + Build Metrics (increment counters) → next task

⚠️ ATOMIC CLOSE RULE: Steps 1–4 of the close sequence execute together as one unit.
Under NO circumstances does the coordinator move to the next task if any of steps 1–4
are incomplete. Context window pressure does not override this rule.

⚠️ BATCH CLOSE PROHIBITION: The coordinator must NEVER batch-close multiple beads at once.
Each bead gets its own individual check-result.sh run, review-agent dispatch, verdict file,
Build Log row, and context-snapshot.md entry. No exceptions.

check-result.sh enforces pipeline continuity: it verifies that the PREVIOUS bead's
context-snapshot.md entry and Build Log row exist before allowing the next bead through.
This means skipping context updates blocks future beads from passing the gate.

`bd close` is only valid after an APPROVED verdict has been parsed from JSON.
`bd close --force` is not used in this workflow.
review-agent reviews one bead per dispatch — never batched.

## Enforcement Scripts
| Script | When It Runs | What It Checks | On Failure |
|--------|-------------|----------------|------------|
| validate-team.sh | After team design, before build | Cluster↔agent mapping, no orphans, DAG valid | Build blocked until exit 0 |
| check-result.sh | After agent submits, before review dispatch | All gates true, todoCount=0, verify output present | Rejected back to agent |
| jq verdict parse | After review-agent writes verdict | APPROVED/REJECTED field | Coordinator acts on result |
| reconcile-pipeline.sh | After all beads closed (Step 5) | Results = Verdicts = Log rows = Snapshot entries | Gaps filled before commit |

## Build Metrics
Tracked throughout the build to monitor pipeline health:
- Beads closed: [21/22]
- check-result.sh passes/rejections: [21/0]
- review-agent approvals/rejections: [21/2] (20o REJECTED→re-approved; e1m REJECTED→re-approved)
- context-snapshot.md entries: [21]
- Build Log rows: [21]

## Build Log
| Bead ID | Task | Agent | Result | Verdict | Closed |
|---------|------|-------|--------|---------|--------|
| Deep-Tech-20o | 1.1 Scaffold | infra-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-0pr | 1.2 DB Schema | infra-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-a2a | 1.3 Env Config | infra-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-jl1 | 2.1 RSS | pipeline-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-wkd | 2.2 YouTube | pipeline-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-nq0 | 2.3 Dedup | pipeline-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-msw | 2.4 Tools | pipeline-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-sm4 | 3.1 AI Provider | intelligence-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-8wq | 3.2 Zod Validation | intelligence-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-608 | 3.3 Noise Filter | intelligence-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-9n7 | 2.5 Pipeline Runner | pipeline-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-e1m | 2.6 Cron Endpoint | pipeline-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-e55 | 4.1 Dashboard Layout | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-h9z | 4.2 Trending Snapshot | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-a0m | 4.3 Tool Spotlight | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-d47 | 4.4 Tabbed Content | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-c6w | 4.5 Article/Video Cards | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-37j | 4.6 NEW Badge | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-2sh | 4.8 Empty State | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-1wl | 5.1 E2E Tests | dashboard-agent | 10 gates pass | APPROVED | Yes |
| Deep-Tech-vyv | 5.2 AI Benchmark | intelligence-agent | 10 gates pass | APPROVED | Yes |

## Workflow Rules
- Read `~/.claude/project-memory.md` at session start for cross-project gotchas
- Read all 5 foundation docs at session start — they define the product context
- Run `bd ready --json` at start of every session
- Claim task with `bd update <id> --status in_progress` before working
- Close task with `bd close <id>` only after the full close pipeline completes
- Discovered work → `bd create` + `bd dep add` run directly
- Linter + type checker after every change
- Tests after every code change (single file, not full suite)
- Follow directory structure exactly
- Check existing patterns before generating new code
- Delegate by capability cluster — not by generic role
- Context window pressure NEVER justifies skipping the close sequence

## Security Rules
- ALL API keys are server-side only — never imported in `"use client"` components
- YouTube video embeds use `https://www.youtube.com/embed/{videoId}` — no API key needed client-side
- Video metadata (title, thumbnail) stored in DB at ingest time — client reads DB, not YouTube API
- Manual refresh endpoint `/api/cron/refresh` requires CRON_SECRET header verified with `crypto.timingSafeEqual`
- Production refresh runs via Railway Cron (direct command, no HTTP endpoint)
- `ssrf-req-filter` wraps all external `fetch()` calls in the pipeline
- No PII collected or transmitted — localStorage data never leaves the device
- Rate limit the manual refresh endpoint: max 1 refresh per 5 minutes (in-memory)

## Known Gotchas
- Turso uses `@libsql/client` NOT `better-sqlite3` — Round 1
- YouTube: `playlistItems.list` (1 unit) NOT `search.list` (100 units) — Round 1
- Railway Cron runs commands directly — no HTTP webhook security needed for production cron — redebate
- Railway requires `output: "standalone"` in next.config.ts — without it, Nixpacks build fails — redebate
- Railway env vars: use Shared Variables (project level) so both web + cron services get them — redebate
- Gemini Flash returns malformed JSON ~2-5% — always Zod validate with retry — Round 3
- Cursor changelog is at `cursor.com/changelog` NOT GitHub releases — Round 3
- Claude versioning at `docs.anthropic.com` NOT GitHub — Round 3
- First pipeline run needs 30-day lookback (not 7-day) or dashboard launches empty — Round 3
- All API keys server-side only — video embeds use iframe URL — Round 4
- `drizzle-kit push` for dev, `drizzle-kit generate` + `migrate` for prod — Round 4
- `ssrf-req-filter` on ALL external fetches even with hardcoded URLs — Round 2
- Token/secret comparison: use `crypto.timingSafeEqual` NOT `===` — global gotcha

## Out of Scope
- User-generated blog posts — Round 1 (human decision)
- Comments/discussion system — Round 1 (human decision)
- Slack integration — Round 1 (human decision)
- User authentication/login — Round 1 (human decision, zero-login requirement)
- Multi-tenant support — not needed for single small team
- Real-time websocket updates — ISR with 6-hour refresh is sufficient
- Full-text search — v2 feature, simple category/urgency filtering for v1

## Debate Score History
See docs/debate-rounds/score-history.json for full audit trail.
Final score: [10/10] reached in Round 4.
