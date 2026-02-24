# Specification: Deep-Tech Pulse

**Created**: 2026-02-23
**Status**: Final (Debate 10/10 + Redebate 10/10)

## Overview
Deep-Tech Pulse is a fully automated, zero-login AI news dashboard for a small agentic coding team. It aggregates content from RSS feeds, YouTube Data API, and tool changelogs into four curated sections, applies AI-powered summarization with urgency labels and category tags via Claude Haiku (with OpenAI GPT-4o-mini fallback), and refreshes every 6 hours via Railway Cron. Traces to 01-vision-and-strategy.md (team productivity) and 02-problem-statement.md (information fragmentation).

## Features (ordered by priority from debate)

### Feature 1: Content Pipeline (Priority: P0 — Foundation)
- Description: Fully automated ingestion from RSS feeds (HN, TechCrunch, Verge, Ars Technica, AI Substacks), YouTube Data API (playlistItems.list), and tool changelogs (Cursor, Claude, Devin, Windsurf, GitHub Copilot). Runs every 6 hours via Railway Cron. Deduplicates by URL hash + title similarity. First-run 30-day lookback, subsequent 7-day limit.
- Acceptance Criteria: Pipeline completes without error for all sources. Partial failures logged but don't block. pipeline_runs table tracks status. ssrf-req-filter wraps all fetches. YouTube uses playlistItems.list only.
- Risk Mitigation: Per-source timeout (30s) and failure isolation — Round 1. ssrf-req-filter on all fetches — Round 2. First-run seed strategy — Round 3.
- Foundation Reference: 01-vision-and-strategy.md (automation), 04-mvp-definition.md (auto-refresh)
- Round Established: 1 (refined 2-3)

### Feature 2: AI Intelligence Layer (Priority: P0 — Foundation)
- Description: Every ingested article processed by Claude Haiku (primary) with OpenAI GPT-4o-mini as fallback. Returns structured JSON: summary (2-3 sentences), whyItMatters (1 sentence), urgency (use_now/watch_this_week/coming_soon), category (model_release/tools/research/industry_moves), relevanceScore (0-100), isGenericAINoise (boolean), contentSafe (boolean). Zod validation on every response. Fallback chain: Claude Haiku → GPT-4o-mini → store raw.
- Acceptance Criteria: All stored articles have valid Zod-parsed AI analysis OR are marked as "unsummarized". Noise filter excludes relevanceScore < 40 or isGenericAINoise. Content safety quarantine for contentSafe: false. Provider abstraction interface implemented.
- Risk Mitigation: Zod schema validation with retry — Round 3. Provider abstraction with fallback chain (Claude → OpenAI → raw) — Round 2, AI provider change. Content safety check included in summarization prompt — Round 2.
- Foundation Reference: 01-vision-and-strategy.md (AI-first curation), 03-prd.md (summarization user stories)
- Round Established: 1 (refined 2-3)

### Feature 3: Dashboard UI (Priority: P1 — Core)
- Description: Single-page dashboard with: trending snapshot (top 3 by composite score), Tool Spotlight strip, tabbed sections (AI News, Videos/Demos, Market Unlocks, Best Way to Work). Article/video cards with urgency chips, category tags, and new/unseen badges.
- Acceptance Criteria: Dashboard loads and renders all sections. Tabs switch content. Cards display all metadata (summary, urgency, category, source, date). Simple inline "No articles yet" message when DB is empty.
- Risk Mitigation: Trending uses external signal aggregation, not click tracking — Round 2. Accessibility: color + icon, semantic HTML — Round 1.
- Foundation Reference: 05-information-architecture.md (screen map), 04-mvp-definition.md (features)
- Round Established: 1 (refined 2)

### Feature 4: New/Unseen Badges (Priority: P1)
- Description: Green "NEW" badge on cards published after user's last visit. Uses localStorage timestamp. Badge disappears after click-through or 48 hours. No server-side tracking needed.
- Acceptance Criteria: First visit shows all content as new. Return visit correctly badges only content newer than last visit. Badge clears on click or after 48h.
- Risk Mitigation: localStorage is per-device — acceptable for small team, documented in UX tooltip — Round 1-2.
- Foundation Reference: 04-mvp-definition.md
- Round Established: 1

### Feature 5: Tool Spotlight (Priority: P2)
- Description: Persistent strip showing key agentic coding tools: Cursor (cursor.com/changelog), Claude (docs.anthropic.com), Devin (devin.ai/blog), Windsurf (codeium.com/blog), GitHub Copilot (github.blog). Shows: tool name, current version, key change (LLM-summarized from changelog), source link. Refreshed on same 6-hour cycle.
- Acceptance Criteria: Each tool shows latest version and changelog summary. Data refreshes every 6 hours. Stale data shows last known values with timestamp.
- Risk Mitigation: Per-tool changelog scraping — Round 2-3. Correct sources (not GitHub releases) — Round 3.
- Foundation Reference: 04-mvp-definition.md
- Round Established: 1 (sources corrected Round 3)

## Data Model

### articles
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | UUID |
| title | TEXT | NOT NULL | Article/video title |
| url | TEXT | NOT NULL, UNIQUE | Canonical URL |
| url_hash | TEXT | NOT NULL, UNIQUE | SHA-256 of canonical URL for dedup |
| source | TEXT | NOT NULL | Source name (e.g., "Hacker News", "Fireship") |
| source_type | TEXT | NOT NULL | "rss" or "youtube" |
| content_type | TEXT | NOT NULL | "news", "video", "unlock", "workflow" |
| category | TEXT | NOT NULL | "model_release", "tools", "research", "industry_moves" |
| urgency | TEXT | NOT NULL | "use_now", "watch_this_week", "coming_soon" |
| summary | TEXT | | AI-generated summary (null if unsummarized) |
| why_it_matters | TEXT | | AI-generated relevance tag |
| relevance_score | INTEGER | NOT NULL, DEFAULT 0 | 0-100 AI relevance score |
| trending_score | REAL | NOT NULL, DEFAULT 0 | Composite trending score |
| external_signal | REAL | DEFAULT 0 | HN points, YT views, etc. |
| thumbnail_url | TEXT | | Image/video thumbnail |
| video_id | TEXT | | YouTube video ID (for embed) |
| published_at | BIGINT | NOT NULL | Unix timestamp (ms) |
| ingested_at | BIGINT | NOT NULL | Unix timestamp (ms) |
| is_unsummarized | BOOLEAN | NOT NULL, DEFAULT false | true if AI processing failed |
| is_quarantined | BOOLEAN | NOT NULL, DEFAULT false | true if contentSafe: false |
| raw_content | TEXT | | First 500 chars of source for unsummarized fallback |

### tool_spotlight
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | UUID |
| tool_name | TEXT | NOT NULL, UNIQUE | "cursor", "claude", "devin", etc. |
| current_version | TEXT | | Latest version string |
| last_update | TEXT | | Date of last changelog entry |
| key_change | TEXT | | LLM-summarized changelog |
| source_url | TEXT | NOT NULL | Changelog URL |
| updated_at | BIGINT | NOT NULL | Unix timestamp (ms) of last refresh |

### pipeline_runs
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | UUID |
| started_at | BIGINT | NOT NULL | Unix timestamp (ms) |
| completed_at | BIGINT | | Unix timestamp (ms) |
| status | TEXT | NOT NULL | "running", "success", "partial", "failed" |
| sources_succeeded | INTEGER | DEFAULT 0 | Count of successful sources |
| sources_failed | INTEGER | DEFAULT 0 | Count of failed sources |
| items_ingested | INTEGER | DEFAULT 0 | New items stored |
| items_filtered | INTEGER | DEFAULT 0 | Items rejected by noise filter |
| error_log | JSONB | | JSON array of error messages |

**Indexes:**
- articles: `idx_articles_category` on (category, published_at DESC)
- articles: `idx_articles_trending` on (trending_score DESC)
- articles: `idx_articles_url_hash` on (url_hash) UNIQUE
- articles: `idx_articles_published` on (published_at DESC)

## API Endpoints

| Method | Path | Description | Auth | Request Body | Response | Rate Limit (Anon) | Rate Limit (Auth) |
|--------|------|-------------|------|--------------|----------|-------------------|-------------------|
| GET | / | Dashboard page (SSR) | None | N/A | HTML | No limit (ISR cached) | N/A |
| POST | /api/cron/refresh | Manual pipeline trigger | CRON_SECRET header | None | `{ status, itemsIngested }` | 1 per 5 min (in-memory) | N/A |

Note: Production pipeline runs via Railway Cron (direct command, not HTTP). The API endpoint is for dev/testing only.

## UI/UX Requirements

### Layout (Single Page, Sectioned)
```
┌─────────────────────────────────────────┐
│  HEADER: Deep-Tech Pulse                │
├─────────────────────────────────────────┤
│  📈 TRENDING SNAPSHOT (top 3 cards)     │
│  Large hero cards, horizontal scroll    │
├─────────────────────────────────────────┤
│  🔧 TOOL SPOTLIGHT strip                │
│  Cursor | Claude | Devin | Windsurf | + │
│  Version • Key change • [Link →]       │
├─────────────────────────────────────────┤
│  TABS: News | Videos | Unlocks | Ways   │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │🟢NEW │ │      │ │🟡    │           │
│  │Card  │ │Card  │ │Card  │           │
│  │      │ │      │ │      │           │
│  └──────┘ └──────┘ └──────┘           │
│  [Load more →]                          │
├─────────────────────────────────────────┤
│  FOOTER: privacy notice (no PII)        │
│  "Preferences stored in your browser"   │
└─────────────────────────────────────────┘
```

### Accessibility
- Semantic HTML: nav, main, section, article elements
- Color + icon for urgency (🔴 Use Now, 🟡 Watch This Week, 🔵 Coming Soon) — not color-only
- Keyboard navigable (tab through cards, enter to open)
- Contrast ratio meets WCAG AA

### States
- Empty (first run): Simple inline "No articles yet" message (no dedicated component)
- Unsummarized content: "Raw" badge, shows first 2 sentences of source content

## Edge Cases & Risks

| Edge Case | Solution | Round |
|-----------|----------|-------|
| All sources fail simultaneously | Dashboard shows stale data with red health indicator + "last success" timestamp | 2 |
| Claude Haiku API failure | Fall back to GPT-4o-mini for this article. If both fail, store raw | AI provider change |
| OpenAI API failure | Store article as raw/unsummarized. Catches up next cycle | AI provider change |
| YouTube quota exhausted | Log warning, skip YouTube sources for this cycle, display stale video data | 1 |
| RSS feed returns malformed XML | Per-source try/catch. Log error. Skip source. Continue pipeline | 1 |
| Duplicate article from multiple sources | URL hash dedup catches exact dupes. Jaccard > 0.8 on title catches near-dupes | 1 |
| Tool changelog page structure changes | Scraper fails gracefully, keeps last known data, logs warning | 3 |
| First visit with empty DB | 30-day lookback seeds content. Simple "No articles yet" inline message until pipeline completes | 3 |
| localStorage cleared by user | All badges reset (everything appears new). Expected behavior — no data loss | 1-2 |
| LLM returns malformed JSON | Zod parse → retry with schema hint → store as unsummarized on second failure | 3 |
| LLM hallucination in summary | Prompt instructs extractive-only (facts from article). No external knowledge injection | 2 |
| Compromised RSS feed (spam/malicious) | contentSafe: false flag from LLM → quarantined (stored, not displayed) | 2 |
| Railway cron + web service env var mismatch | Use Railway Shared Variables at project level — applied to all services | Redebate |
| Multiple users on same device/browser | Same localStorage — last-visited resets for all. Acceptable for small team | 1 |

## Provider Decisions

| Provider | Selected | Alternative 1 | Alternative 2 | Why Selected | Round |
|----------|----------|---------------|---------------|-------------|-------|
| Framework | Next.js 15 | Astro 5 | Nuxt 4 | Native ISR, richest React ecosystem, Railway compatible | 1 |
| Database | Railway PostgreSQL | Turso (libSQL) | Supabase (Postgres) | Same platform as hosting (consolidation), battle-tested, free tier (ephemeral — pipeline re-seeds on wipe) | DB change |
| ORM | Drizzle | Prisma | Kysely | Type-safe, lightweight, works with postgres.js driver | 1, DB change |
| AI Summarization | Claude Haiku (primary) + GPT-4o-mini (fallback) | Gemini Flash | — | Claude for quality; GPT-4o-mini as cheap reliable fallback | AI provider change |
| Hosting | Railway (Free tier) | Vercel (Hobby) | Cloudflare Pages | Native cron, $0/mo ($1 credit), no cold starts, database wipe acceptable | Redebate |
| Scheduling | Railway Cron | QStash (Upstash) | Vercel Cron | Native to Railway, no extra dependency, direct command execution | Redebate |
| Styling | Tailwind CSS 4 | CSS Modules | styled-components | Utility-first, fast prototyping | 1 |
| Validation | Zod | Yup | io-ts | Best TypeScript integration, widely adopted, lightweight | 3 |
| Testing | Vitest + Playwright | Jest + Cypress | Bun test | Fast, Vite-native, good Next.js integration | 1 |

## Security

### Secret Management
- All API keys stored as environment variables, never in code
- Railway Shared Variables for cross-service env vars
- .env.local gitignored, .env.example committed with empty values

### API Key Isolation
- ALL API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, YOUTUBE_API_KEY, DATABASE_URL) are server-side only
- Never imported in "use client" components
- YouTube video embeds use iframe URL (no API key needed)
- Video metadata stored in DB at ingest time — client reads DB, not YouTube API

### Endpoint Security
- /api/cron/refresh: CRON_SECRET header verified with crypto.timingSafeEqual
- Rate limited: max 1 request per 5 minutes (in-memory)
- Production cron runs via Railway direct command (no HTTP exposure)

### External Fetch Security
- ssrf-req-filter wraps ALL external fetch() calls in the pipeline
- 30-second timeout per source
- Per-source failure isolation

### Privacy / Data Protection
- Zero PII collected or transmitted
- localStorage data never leaves the device
- No cookies set (no cookie banner needed)
- No analytics tracking
- Footer privacy notice: "This site stores reading preferences in your browser's local storage. No personal data is collected or transmitted."

### Input Validation
- Zod schema validation on all LLM responses before storage
- URL hash validation on dedup
- Content age validation (7-day / 30-day limit)

### Content Safety
- LLM contentSafe flag on every article
- contentSafe: false → quarantined (stored but never displayed)
- Catches compromised feeds, spam injection, off-topic content

## Decisions Log

| Decision | Round | Why | Alternative Rejected | Comparative Analysis |
|----------|-------|-----|---------------------|---------------------|
| Next.js 15 over Astro | 1 | Native ISR, richer component ecosystem | Astro ISR less mature, Nuxt Vue-only | See Provider Decisions table |
| Railway PostgreSQL over Turso | DB change | Consolidates on Railway platform, eliminates extra service, free tier (ephemeral — pipeline re-seeds on wipe) | Turso: extra service/account, SQLite less standard | See Provider Decisions table |
| Claude Haiku primary + OpenAI fallback | AI provider change | Better summarization quality with reliable fallback | Single-provider risk | See Provider Decisions table |
| Railway over Vercel | Redebate | Native cron, $0/mo ($1 credit), no cold starts, QStash eliminated | Vercel Hobby: 1x/day cron. Vercel Pro: $20/mo | See Provider Decisions table |
| External signal trending | 2 | No click tracking without auth | Click-based impossible without login | HN points + YT views + relevanceScore composite |
| Zod over raw JSON.parse | 3 | LLMs return malformed JSON occasionally | JSON.parse crashes pipeline | Retry + schema hint + fallback chain |
| localStorage over sessions | 1 | Zero-login requirement | Server sessions need auth | Per-device acceptable for small team |
| Railway Cron over QStash | Redebate | Direct command, no HTTP webhook, included in free tier | QStash: extra dependency, webhook security needed | Simpler architecture, fewer moving parts |
| output: "standalone" | Redebate | Railway uses Nixpacks, needs standalone Next.js output | Default output incompatible with Railway | One-line config in next.config.ts |
