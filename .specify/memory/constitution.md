<!-- Sync Impact Report
Version change: 0.0.0 → 1.0.0
Modified principles: N/A (initial creation)
Added sections: Core Principles (7), Quality Standards, Close Pipeline, Risk Mitigations, Scope, Governance
Removed sections: None
Templates requiring updates: ✅ spec-template.md (aligned), ✅ plan-template.md (aligned), ✅ tasks-template.md (aligned)
Follow-up TODOs: None
-->

# Deep-Tech Pulse Constitution

## Core Principles

### I. Zero Friction Access
The dashboard MUST require zero authentication, zero setup, and zero configuration from end users. Any team member opens the URL and immediately sees current AI news. localStorage is used for client-side personalization (last-visited badges, bookmarks) but is never required for core functionality. No PII is collected or transmitted.

### II. AI-First Curation
Every piece of ingested content MUST be processed by the AI intelligence layer (Gemini 1.5 Flash free tier) before display. Processing includes: summarization, "why it matters" tag, urgency label (Use Now / Watch This Week / Coming Soon), category tag (Model Release / Tools / Research / Industry Moves), relevance scoring, and noise filtering. Content that fails AI processing is stored raw with an "unsummarized" indicator — never silently dropped.

### III. Agentic Coding Focus
The noise filter MUST distinguish agentic coding content (AI-assisted development, code generation, autonomous agents, AI IDEs, developer tooling) from generic AI news (chatbots, image generation, policy debates). Content with relevanceScore < 40 or isGenericAINoise: true is excluded from display. This is the core differentiator — without it, the dashboard is just another RSS reader.

### IV. Full Automation
Content ingestion MUST be fully automated with zero human curation. The pipeline runs every 6 hours via Railway Cron, fetching from RSS feeds, YouTube Data API, and tool changelog sources. Per-source failure isolation ensures one broken feed never blocks the pipeline. First-run uses 30-day lookback; subsequent runs use 7-day limit.

### V. Cost Discipline
All external services MUST use free tiers: Gemini 1.5 Flash (1500 req/day), YouTube Data API (10K units/day), Turso (9GB). Railway Hobby ($5/mo) is the only paid service. No paid LLM fallback — retry Gemini on failure, store raw on exhaustion. YouTube MUST use playlistItems.list (1 unit), NEVER search.list (100 units).

### VI. Scan in 30 Seconds
The dashboard layout MUST enable a busy developer to get the "pulse" in 30 seconds. Trending snapshot at top (3 highest-urgency items), Tool Spotlight strip below, then tabbed content sections. Urgency labels use traffic-light color + text (not color alone). Mobile-first: single-column stack, 44px touch targets, horizontal tab scroll.

### VII. Resilience Over Perfection
The system MUST degrade gracefully at every layer. LLM failure → retry once → store raw. Source failure → log warning → continue with other sources. Empty database → show "warming up" state. Pipeline failure → show stale data with yellow/red health indicator. No single failure should produce a broken or empty dashboard.

## Quality Standards

- Every LLM response validated with Zod schema before storage
- All external fetches wrapped with ssrf-req-filter
- All API keys server-side only — never in "use client" components
- Secret comparison via crypto.timingSafeEqual, never ===
- Deduplication by URL hash + title similarity (Jaccard > 0.8)
- Semantic HTML, keyboard navigation, color+icon accessibility
- Mobile-first: 44px touch targets, single-column responsive layout
- Per-source failure isolation in pipeline
- Pipeline health tracking with pipeline_runs table

## Close Pipeline

Every bead follows this pipeline without exception:
1. Agent submits result JSON → check-result.sh validates gates + pipeline continuity
2. review-agent independently verifies one bead → writes one verdict JSON
3. Close sequence runs atomically (all 4 steps before next task):
   1. bd close <id>
   2. Verdict file written to .beads/verdicts/bd-XXXX.json
   3. context-agent updates context-snapshot.md with this beadId
   4. Coordinator updates CLAUDE.md Build Log and Build Metrics

check-result.sh verifies that the previous bead's context-snapshot.md entry and
Build Log row exist. Skipping bookkeeping on one bead blocks the next bead.
No bead may be closed outside this pipeline. Context window pressure never justifies
skipping or batching the close sequence.

## Risk Mitigations Built In

- Gemini Flash malformed JSON → Zod validation + retry once + fallback to unsummarized — Round 3
- YouTube API quota exhaustion → playlistItems.list at 1 unit/call, budget ~80/day of 10K — Round 1
- Content source compromise → LLM contentSafe flag + quarantine pipeline — Round 2
- First-run empty dashboard → 30-day lookback on initial run — Round 3
- Tool Spotlight stale data → per-tool changelog scraping on same 6-hour cycle — Round 2-3
- Trending without click data → external signal aggregation (HN points, YT views, relevance score) — Round 2
- API key exposure → server-side only rule, video embeds via iframe URL — Round 4
- Railway standalone mode → output: "standalone" in next.config.ts — Redebate
- Railway env vars → shared variables at project level — Redebate

## Scope

### In Scope
- Four content sections: AI News, Videos/Demos, Market Unlocks, Best Way to Work
- AI summarization with "why it matters" tags
- Urgency labels: Use Now, Watch This Week, Coming Soon
- Category tags: Model Release, Tools, Research, Industry Moves
- Trending snapshot (top 3 by composite score)
- Tool Spotlight (Cursor, Claude, Devin, Windsurf, GitHub Copilot)
- New/unseen badges via localStorage
- One-click share + bookmarks
- Pipeline health indicator
- Mobile-responsive design
- 6-hour auto-refresh via Railway Cron

### Out of Scope
- User-generated blog posts — Round 1
- Comments/discussion — Round 1
- Slack integration — Round 1
- User authentication — Round 1
- Multi-tenant support — Round 1
- Real-time websocket updates — Round 1
- Full-text search — Round 1 (v2)

## Governance

This constitution supersedes all other design documents for conflict resolution. Amendments require:
1. Identification of the conflicting principle or gap
2. Debate-style evaluation of the proposed change with challenger review
3. Update to this document with round reference
4. Propagation to CLAUDE.md, spec.md, and affected agent definitions

**Version**: 1.0.0 | **Ratified**: 2026-02-23 | **Last Amended**: 2026-02-23
