# Context Snapshot — Deep-Tech Pulse

## Build Progress
21/22 beads closed — Phase 5 in progress (6bl Railway deploy remaining)

## Current Phase
Phase 5 in progress. 1wl (E2E tests) and vyv (AI benchmark) closed. 6bl (Railway deploy) remaining.

## Closed Beads
| Bead ID | Task | Agent | Summary |
|---------|------|-------|---------|
| Deep-Tech-20o | 1.1 Scaffold | infra-agent | Next.js 15, TypeScript, Tailwind CSS 4, standalone output, ESLint, path aliases |
| Deep-Tech-0pr | 1.2 DB Schema | infra-agent | Drizzle ORM + postgres.js. Tables: articles, tool_spotlight, pipeline_runs + 4 indexes |
| Deep-Tech-a2a | 1.3 Env Config | infra-agent | .env.example, .env.local gitignored, railway.toml standalone deployment |
| Deep-Tech-jl1 | 2.1 RSS | pipeline-agent | RSS fetcher, 6 sources, ssrf-req-filter, per-source isolation, 12 tests |
| Deep-Tech-wkd | 2.2 YouTube | pipeline-agent | YouTube playlistItems.list, 4 channels, SSRF protection, 20 tests |
| Deep-Tech-nq0 | 2.3 Dedup | pipeline-agent | SHA-256 URL hash + Jaccard title similarity > 0.8, 29 tests |
| Deep-Tech-msw | 2.4 Tools | pipeline-agent | Tool Spotlight scraper, 5 tools, per-tool isolation, 16 tests |
| Deep-Tech-sm4 | 3.1 AI Provider | intelligence-agent | Claude Haiku + OpenAI fallback, Zod retry, 58 tests |
| Deep-Tech-8wq | 3.2 Zod Validation | intelligence-agent | ArticleAnalysisSchema, retry with schema hint, 28 tests |
| Deep-Tech-608 | 3.3 Noise Filter | intelligence-agent | relevanceScore<40 filter, isGenericAINoise, quarantine, 30 tests |
| Deep-Tech-9n7 | 2.5 Pipeline Runner | pipeline-agent | Pipeline orchestrator (RSS+YouTube+Tools parallel), dedup, AI summarize, health tracking, first-run 30-day lookback |
| Deep-Tech-e1m | 2.6 Cron Endpoint | pipeline-agent | POST /api/cron/refresh, CRON_SECRET timingSafeEqual, 5-min rate limit, 8 integration tests |
| Deep-Tech-e55 | 4.1 Dashboard Layout | dashboard-agent | page.tsx, layout.tsx, pipeline-status.tsx, ISR 6h revalidation, header with pipeline health |
| Deep-Tech-h9z | 4.2 Trending Snapshot | dashboard-agent | Top 3 articles by trendingScore, urgency chips, category tags, horizontal scroll |
| Deep-Tech-a0m | 4.3 Tool Spotlight | dashboard-agent | 5 tool cards (Cursor, Claude, Devin, Windsurf, Copilot), version, key change, horizontal strip |
| Deep-Tech-d47 | 4.4 Tabbed Content | dashboard-agent | 4 tabs (AI News, Videos, Market Unlocks, Best Way to Work), URL hash sync, load-more pagination |
| Deep-Tech-c6w | 4.5 Article/Video Cards | dashboard-agent | ArticleCard + VideoCard + UrgencyChip + CategoryTag, YouTube iframe embed, external links |
| Deep-Tech-37j | 4.6 NEW Badge | dashboard-agent | NewBadge component + useLastVisited localStorage hook for unseen article highlighting |
| Deep-Tech-2sh | 4.8 Empty State | dashboard-agent | EmptyState component + Skeleton loading + reusable Card/Badge UI primitives |
| Deep-Tech-1wl | 5.1 E2E Tests | dashboard-agent | Playwright E2E: 18 cases (core layout, empty state, populated state, mobile), lazy DB init, 7 passed/11 skipped |
| Deep-Tech-vyv | 5.2 AI Benchmark | intelligence-agent | 50 mock articles, 12 tests: Zod validation, display decisions, noise/safety filtering, prompt generation |

## Last 5 Decisions
1. Fixed ESLint errors (empty interface, unused imports/vars) that caused initial 20o REJECTION

## Active Risks
- ESLint warnings remain in test files (unused `_` prefixed vars) — non-blocking

## Discovered Work
_(none yet)_

## Key Files Changed
- package.json, tsconfig.json, next.config.ts, postcss.config.ts, eslint.config.mjs
- src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
- src/types/index.ts, .gitignore
