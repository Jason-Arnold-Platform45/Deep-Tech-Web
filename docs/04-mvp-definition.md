# MVP Definition — Deep-Tech Pulse

## What Ships in v1

### Core Content Sections
1. **AI News** — aggregated from HN, TechCrunch, Verge, Ars Technica, AI Substacks via RSS
2. **Videos & Demos** — from YouTube channels (Fireship, Matt Wolfe, AI Jason, Two Minute Papers) via playlistItems.list
3. **Market Unlocks & Breakthroughs** — from Product Hunt AI, GitHub Trending, ArXiv CS.AI RSS
4. **Best Way to Work** — from dev workflow Substacks/blogs, Cursor/Claude/Devin changelogs

### AI Intelligence Layer
- Claude Haiku summarization (primary) with OpenAI GPT-4o-mini fallback
- 2-3 sentence summary per article
- "Why it matters" tag (1 sentence, agentic coding context)
- Urgency labels: Use Now / Watch This Week / Coming Soon
- Category tags: Model Release / Tools / Research / Industry Moves
- Noise filtering (relevanceScore < 40 or isGenericAINoise excluded)
- Content safety quarantine (contentSafe: false)

### Dashboard Features
- Trending snapshot (top 3 by composite score)
- Tool Spotlight strip (Cursor, Claude, Devin, Windsurf, GitHub Copilot)
- Tabbed content sections with pagination
- New/unseen badges (localStorage)

### Infrastructure
- 6-hour auto-refresh via Railway Cron
- Railway PostgreSQL database (free tier — ephemeral, pipeline re-seeds on wipe)
- Zod validation on all LLM responses
- ssrf-req-filter on all external fetches
- Per-source failure isolation
- Deduplication (URL hash + title similarity)
- First-run 30-day lookback seed

## What's Parked for Later

| Feature | Reason | Round |
|---------|--------|-------|
| Bookmarks & sharing | Parked — human decision, not needed for v1 | - |
| Mobile-responsive layout | Parked — human decision, desktop-first for v1 | - |
| Full-text search | Nice-to-have but not critical for "scan in 30 seconds" use case | 1 |
| Cross-device sync | Requires authentication, violates zero-login principle | 1 |
| Slack integration | Human explicitly excluded from v1 scope | 1 |
| Comments/discussion | Human explicitly excluded | 1 |
| User-generated posts | Human explicitly excluded | 1 |
| Admin panel | Fully automated — no manual curation needed | 1 |
| Email digest | Team prefers on-demand checking over push notifications | 1 |
| Multi-language support | Single English-speaking team | 1 |
| Custom RSS source management | Sources hardcoded in v1, could be configurable in v2 | 1 |
| Reading time estimation | Nice-to-have, not critical | - |
| Content archival/search | Database persists content; search UI is v2 | 1 |

## MVP Success Criteria
1. **Dashboard loads** with content from all 4 sections within 3 seconds
2. **Pipeline completes** a full refresh cycle without errors (or with isolated, logged errors)
3. **AI summaries are accurate** — extractive, no hallucination, correct urgency labels (validated by 50-article benchmark)
4. **Noise filter works** — generic AI content excluded, agentic coding content included
5. **New badges work** — returning visitors see what's changed since last visit
6. **Tool Spotlight current** — shows latest version/changelog for all 5 tools
7. **Total cost reasonable** — Railway free tier ($0/mo) + AI provider costs within budget
9. **Zero manual intervention** — runs autonomously after deployment with no human curation
