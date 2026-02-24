# Deep-Tech Pulse

Fully automated, zero-login AI news dashboard for agentic coding teams. Aggregates content from RSS feeds, YouTube, and tool changelogs into four curated sections — refreshed every 6 hours.

**Live:** [deep-tech-web-production.up.railway.app](https://deep-tech-web-production.up.railway.app)

## Features

- **AI-Powered Summarization** — Claude Haiku + OpenAI GPT-4o-mini fallback with Zod validation
- **Trending Snapshot** — Top 3 articles ranked by composite trending score
- **Tool Spotlight** — Latest versions and key changes for Cursor, Claude, Devin, Windsurf, GitHub Copilot
- **Tabbed Content** — AI News, Videos & Demos, Market Unlocks, Best Way to Work
- **Smart Filtering** — Noise detection, relevance scoring, content safety quarantine
- **NEW Badges** — Highlights unseen articles since your last visit (localStorage)
- **Zero Login** — No authentication required, no PII collected

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, ISR) |
| Language | TypeScript 5.x |
| Database | PostgreSQL on Railway |
| ORM | Drizzle ORM + postgres.js |
| Styling | Tailwind CSS 4 |
| AI | Claude Haiku (primary) + OpenAI GPT-4o-mini (fallback) |
| Validation | Zod |
| Hosting | Railway (Hobby plan) |
| Scheduling | Railway Cron (6h interval) |
| Testing | Vitest + Playwright |

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in: DATABASE_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, YOUTUBE_API_KEY, CRON_SECRET

# Push database schema
pnpm drizzle-kit push

# Start dev server
pnpm dev

# Run pipeline manually (seeds database on first run with 30-day lookback)
pnpm run pipeline:refresh
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key (server-side only) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (fallback, server-side only) |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `CRON_SECRET` | Yes | Secret for manual refresh endpoint |
| `NEXT_PUBLIC_SITE_URL` | No | Public URL for OG tags |

## Commands

```bash
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm run pipeline:refresh   # Run pipeline manually
pnpm vitest run             # Run all tests
pnpm tsc --noEmit           # Type check
pnpm eslint . --fix         # Lint
pnpm drizzle-kit push       # Sync schema (dev)
pnpm drizzle-kit generate   # Generate migration (prod)
pnpm drizzle-kit migrate    # Apply migration (prod)
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | Dashboard (ISR, 6h revalidation) |
| POST | `/api/cron/refresh` | `x-cron-secret` header | Manual pipeline trigger (rate limited: 1/5min) |

## Railway Deployment

The project deploys to Railway with two services:

1. **Web Service** — Next.js standalone server (`node .next/standalone/server.js`)
2. **Cron Service** — Runs `pnpm run pipeline:refresh` on schedule `0 */6 * * *`

Required Railway variables: `DATABASE_URL` (reference to Postgres service), `HOSTNAME=0.0.0.0`, all API keys listed above.

## Testing

- **184 tests** across 9 test files
- Unit tests: Pipeline (RSS, YouTube, Dedup, Tools), AI (schemas, prompts), Utils
- Integration tests: Pipeline runner, Cron endpoint, AI benchmark
- E2E tests: Dashboard layout, tabs, cards, empty state, mobile viewport

## Architecture

```
RSS Feeds ──┐
YouTube ────┤──► Pipeline Runner ──► AI Summarizer ──► PostgreSQL ──► Next.js ISR
Tool Sites ─┘       (6h cron)       (Claude/OpenAI)                    (Dashboard)
```

## License

Private — internal tool for agentic coding team use.
