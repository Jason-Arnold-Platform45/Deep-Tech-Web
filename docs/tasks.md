# Tasks: Deep-Tech Pulse

## How to Use
Loaded into Beads via `bd` CLI commands (Step 12). Run `bd ready --json` for next task.
Beads handles ordering. validate-team.sh enforces cluster coverage before build starts.

## Phase 1: Project Setup

- [ ] Task 1.1: Scaffold Next.js 15 project with TypeScript, Tailwind CSS 4, pnpm
  - Acceptance: `pnpm dev` starts without errors. `pnpm tsc --noEmit` passes. `pnpm build` succeeds. next.config.ts has `output: "standalone"`. Tailwind classes render in browser. Path alias `@/` resolves. ESLint configured. .gitignore includes .env.local, node_modules, .next.
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: infra
  - Foundation Reference: 04-mvp-definition.md
  - Depends On: none

- [ ] Task 1.2: Configure Railway PostgreSQL + Drizzle ORM with schema
  - Acceptance: Drizzle config connects to Railway PostgreSQL via `postgres` (postgres.js) driver. Schema defines articles, tool_spotlight, pipeline_runs tables per spec.md data model (snake_case columns, PostgreSQL types). All indexes created. `pnpm drizzle-kit push` succeeds. DB connection tested with a simple query.
  - Verify: `pnpm drizzle-kit push && pnpm tsc --noEmit`
  - Cluster: infra
  - Foundation Reference: 03-prd.md
  - Risk Note: Use `postgres` driver with `drizzle-orm/postgres-js` — DB change
  - Depends On: Task 1.1

- [ ] Task 1.3: Set up environment variables and Railway deployment config
  - Acceptance: .env.example lists all vars (DATABASE_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, YOUTUBE_API_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL). railway.toml configured for standalone deployment. .env.local gitignored. README documents Railway Shared Variables setup.
  - Verify: `pnpm build && test -f railway.toml && test -f .env.example`
  - Cluster: infra
  - Foundation Reference: 04-mvp-definition.md
  - Risk Note: Railway Shared Variables for cross-service env vars — Redebate
  - Depends On: Task 1.1

## Phase 2: Content Pipeline

- [ ] Task 2.1: Implement RSS feed fetcher with ssrf-req-filter
  - Acceptance: Fetches from configured RSS feeds (HN API, TechCrunch, Verge, Ars Technica RSS). Each source has 30s timeout. ssrf-req-filter wraps all fetch calls. Returns parsed articles array. Per-source failure isolation (one failure doesn't block others). Content age filter (7-day default, 30-day first-run). Unit tests pass with mocked feeds.
  - Verify: `pnpm vitest run tests/unit/pipeline/rss.test.ts && pnpm tsc --noEmit`
  - Cluster: pipeline
  - Foundation Reference: 03-prd.md, 04-mvp-definition.md
  - Risk Note: ssrf-req-filter mandatory on all fetches — Round 2
  - Depends On: Task 1.2

- [ ] Task 2.2: Implement YouTube Data API integration
  - Acceptance: Fetches from configured YouTube channel playlists using playlistItems.list (NEVER search.list). Retrieves video metadata (title, description, thumbnailUrl, viewCount, likeCount) via videos.list. Respects 10K daily quota budget (~80 units/day). YouTube API key used server-side only. Returns parsed video array. Unit tests pass with mocked API responses.
  - Verify: `pnpm vitest run tests/unit/pipeline/youtube.test.ts && pnpm tsc --noEmit`
  - Cluster: pipeline
  - Foundation Reference: 03-prd.md
  - Risk Note: playlistItems.list (1 unit) NOT search.list (100 units) — Round 1
  - Depends On: Task 1.2

- [ ] Task 2.3: Implement deduplication engine
  - Acceptance: Deduplicates by URL hash (SHA-256 of canonical URL). Near-duplicate detection via title similarity (Jaccard > 0.8). Cross-cycle dedup by checking existing DB records before processing. Returns only new, unique articles. Unit tests cover exact dupes, near-dupes, and unique content.
  - Verify: `pnpm vitest run tests/unit/pipeline/dedup.test.ts && pnpm tsc --noEmit`
  - Cluster: pipeline
  - Foundation Reference: 03-prd.md
  - Depends On: Task 1.2

- [ ] Task 2.4: Implement Tool Spotlight scraper
  - Acceptance: Scrapes changelogs for Cursor (cursor.com/changelog), Claude (docs.anthropic.com), Devin (devin.ai/blog), Windsurf (codeium.com/blog), GitHub Copilot (github.blog). Extracts latest version, date, and changelog text. Compares against stored data — skips if unchanged. Per-tool failure isolation. Unit tests pass with mocked HTML responses.
  - Verify: `pnpm vitest run tests/unit/pipeline/tools.test.ts && pnpm tsc --noEmit`
  - Cluster: pipeline
  - Foundation Reference: 04-mvp-definition.md
  - Risk Note: Cursor changelog is cursor.com/changelog NOT GitHub releases — Round 3
  - Depends On: Task 1.2

- [ ] Task 2.5: Implement pipeline runner with health tracking
  - Acceptance: Orchestrates full pipeline: fetch RSS → fetch YouTube → fetch Tools → dedup → AI process → store. Records pipeline_runs entry (status, counts). Handles partial failures. First-run detection (article count = 0 → 30-day lookback). Integration test passes with all sources mocked.
  - Verify: `pnpm vitest run tests/integration/pipeline-runner.test.ts && pnpm tsc --noEmit`
  - Cluster: pipeline
  - Foundation Reference: 04-mvp-definition.md
  - Risk Note: First run needs 30-day lookback — Round 3
  - Depends On: Task 2.1, Task 2.2, Task 2.3, Task 2.4, Task 3.1

- [ ] Task 2.6: Implement cron endpoint + Railway cron config
  - Acceptance: /api/cron/refresh route verifies CRON_SECRET header via crypto.timingSafeEqual. Rate limited to 1 per 5 minutes (in-memory). Calls pipeline runner. Returns status JSON. railway.toml or package.json script `pipeline:refresh` calls runner directly for Railway Cron. Integration test passes.
  - Verify: `pnpm vitest run tests/integration/cron-endpoint.test.ts && pnpm tsc --noEmit`
  - Cluster: pipeline
  - Foundation Reference: 04-mvp-definition.md
  - Risk Note: crypto.timingSafeEqual for secret comparison — global gotcha
  - Depends On: Task 2.5

## Phase 3: AI Intelligence Layer

- [ ] Task 3.1: Implement AI provider abstraction + Claude/OpenAI integration
  - Acceptance: AIProvider interface defined with summarize() method. ClaudeProvider (primary) implements interface using @anthropic-ai/sdk. OpenAIProvider (fallback) implements interface using openai SDK. Fallback chain: Claude Haiku → GPT-4o-mini → store raw. Structured prompt returns JSON matching ArticleAnalysisSchema. Provider selection via environment config.
  - Verify: `pnpm vitest run tests/unit/ai/claude.test.ts && pnpm vitest run tests/unit/ai/openai.test.ts && pnpm tsc --noEmit`
  - Cluster: intelligence
  - Foundation Reference: 03-prd.md
  - Risk Note: Claude primary, OpenAI GPT-4o-mini fallback — AI provider change
  - Depends On: Task 1.2

- [ ] Task 3.2: Implement Zod schema validation + retry logic
  - Acceptance: ArticleAnalysisSchema validates all LLM fields (summary, whyItMatters, urgency, category, relevanceScore, isGenericAINoise, contentSafe). Parse failure triggers one retry with schema hint prompt. Second failure marks article as unsummarized. Never crashes pipeline. Unit tests cover valid JSON, malformed JSON, partial JSON, retry success, retry failure.
  - Verify: `pnpm vitest run tests/unit/ai/schemas.test.ts && pnpm tsc --noEmit`
  - Cluster: intelligence
  - Foundation Reference: 03-prd.md
  - Risk Note: LLMs return malformed JSON occasionally — always Zod validate — Round 3
  - Depends On: Task 3.1

- [ ] Task 3.3: Implement noise filter + content safety
  - Acceptance: Articles with relevanceScore < 40 excluded from display. Articles with isGenericAINoise: true excluded. Articles with contentSafe: false quarantined (stored with isQuarantined=1, never displayed). Prompt specifically asks about agentic coding relevance. Unit tests verify filtering logic.
  - Verify: `pnpm vitest run tests/unit/ai/prompts.test.ts && pnpm tsc --noEmit`
  - Cluster: intelligence
  - Foundation Reference: 03-prd.md
  - Risk Note: Must distinguish agentic coding from generic AI — Round 2
  - Depends On: Task 3.2

## Phase 4: Dashboard UI

- [ ] Task 4.1: Build dashboard layout
  - Acceptance: Single-page layout with header (title), main content area, footer (privacy notice). Server Component by default. Semantic HTML (nav, main, section).
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: dashboard
  - Foundation Reference: 05-information-architecture.md
  - Depends On: Task 1.2

- [ ] Task 4.2: Build trending snapshot section
  - Acceptance: Displays top 3 articles by trendingScore. Hero-sized cards with title, summary, urgency chip, category tag, source. Horizontal scroll on desktop, vertical stack on mobile. trendingScore computed as: normalize(externalSignal) × 0.6 + relevanceScore × 0.3 + recencyBoost × 0.1. Recency boost decays over 24h.
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: dashboard
  - Foundation Reference: 05-information-architecture.md
  - Depends On: Task 4.1

- [ ] Task 4.3: Build Tool Spotlight strip
  - Acceptance: Persistent strip showing 5 tools with: name, version, key change, source link. Reads from tool_spotlight table. Horizontal layout on desktop, scrollable on mobile. Shows "last checked" timestamp per tool.
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: dashboard
  - Foundation Reference: 04-mvp-definition.md
  - Depends On: Task 4.1

- [ ] Task 4.4: Build tabbed content sections (News, Videos, Unlocks, Ways)
  - Acceptance: Four tabs switch content dynamically. Each tab shows cards sorted by publishedAt DESC. "Load more" pagination (12 cards initial, +12 per click). Tab state preserved in URL hash.
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: dashboard
  - Foundation Reference: 05-information-architecture.md
  - Depends On: Task 4.1

- [ ] Task 4.5: Build article-card + video-card components
  - Acceptance: Article card: title, summary (or raw content if unsummarized with "Raw" badge), urgency chip (🔴🟡🔵 + text), category tag, source, date, NEW badge. Video card: same + YouTube iframe embed. "Unsummarized" badge for raw articles.
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: dashboard
  - Foundation Reference: 05-information-architecture.md
  - Depends On: Task 4.4

- [ ] Task 4.6: Implement new/unseen badges (localStorage)
  - Acceptance: useLastVisited hook stores timestamp in localStorage. Cards published after last visit show green "NEW" badge. Badge clears on click-through or after 48h. First visit: all content shows as new. "use client" component only.
  - Verify: `pnpm build && pnpm tsc --noEmit`
  - Cluster: dashboard
  - Foundation Reference: 04-mvp-definition.md
  - Risk Note: localStorage per-device only — acceptable for small team — Round 1
  - Depends On: Task 4.5

## Phase 5: Integration & Polish

- [ ] Task 5.1: End-to-end integration test
  - Acceptance: Playwright test: dashboard loads, trending shows 3 cards, Tool Spotlight shows tools, tabs switch, cards render with all metadata, badges appear.
  - Verify: `pnpm playwright test tests/e2e/dashboard.spec.ts`
  - Cluster: dashboard
  - Foundation Reference: 03-prd.md
  - Depends On: Task 2.6, Task 3.3, Task 4.6

- [ ] Task 5.2: AI quality benchmark (50 articles)
  - Acceptance: Run 50 real AI news articles through Claude Haiku summarization (with OpenAI fallback). Verify: summaries are accurate (extractive, no hallucination), urgency labels are appropriate, relevanceScore correctly identifies agentic coding vs generic AI, noise filter rejects generic content. Document results.
  - Verify: `pnpm vitest run tests/integration/ai-benchmark.test.ts`
  - Cluster: intelligence
  - Foundation Reference: 03-prd.md
  - Risk Note: Claude Haiku quality unvalidated for this domain — AI provider change
  - Depends On: Task 3.3

- [ ] Task 5.3: Railway deployment + production verification
  - Acceptance: App deploys to Railway. Web service serves dashboard. Cron service runs pipeline every 6 hours. Shared variables configured. Custom domain (if applicable). First pipeline run seeds content (30-day lookback). Health indicator shows green after successful run.
  - Verify: `curl -s https://[deployed-url] | grep "Deep-Tech Pulse"`
  - Cluster: infra
  - Foundation Reference: 04-mvp-definition.md
  - Risk Note: Railway requires output: "standalone" — Redebate
  - Depends On: Task 5.1

## Cluster Summary
- infra: 4 tasks (1.1, 1.2, 1.3, 5.3) — scaffold, database, config, deployment
- pipeline: 6 tasks (2.1, 2.2, 2.3, 2.4, 2.5, 2.6) — RSS, YouTube, tools, dedup, runner, cron
- intelligence: 4 tasks (3.1, 3.2, 3.3, 5.2) — AI provider, validation, filtering, benchmark
- dashboard: 7 tasks (4.1-4.6, 5.1) — layout, trending, tools UI, tabs, cards, badges, e2e
- review-agent: 0 build tasks (verification only)
- context-agent: 0 build tasks (snapshot updates only)
Total clusters: 4 (+ 2 mandatory = 6 agent files)
Total tasks: 21
