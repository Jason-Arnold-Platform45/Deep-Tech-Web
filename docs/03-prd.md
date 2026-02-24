# Product Requirements — Deep-Tech Pulse

## User Stories

### US1: Scan the Pulse (P1)
As a team member, I want to open one page and immediately see the most important AI developments, so that I can stay current in 30 seconds without visiting multiple sources.

**Acceptance Criteria:**
- Dashboard loads with trending snapshot (top 3 items), Tool Spotlight strip, and 4 tabbed sections
- Each item has a 2-3 sentence AI summary and "why it matters" tag
- Urgency labels (Use Now / Watch This Week / Coming Soon) help me prioritize
- Category tags (Model Release / Tools / Research / Industry Moves) let me scan by topic

### US2: Track What's New (P1)
As a returning visitor, I want to instantly see what's changed since my last visit, so that I don't waste time re-reading old content.

**Acceptance Criteria:**
- Green "NEW" badge appears on items published after my last visit
- Badge clears after I click through or after 48 hours
- First visit shows all content as new
- Works without login (localStorage timestamp)

### US3: Monitor Tool Updates (P2)
As a developer using agentic coding tools, I want to see what's changed in Cursor, Claude, Devin, Windsurf, and GitHub Copilot, so that I know when to update or try new features.

**Acceptance Criteria:**
- Tool Spotlight shows: tool name, current version, key change summary, source link
- Data refreshes every 6 hours alongside content pipeline
- Shows "last checked" timestamp per tool

### US4: Browse by Category (P2)
As a team member, I want to browse content by section (News, Videos, Unlocks, Best Way to Work), so that I can focus on the type of content I'm interested in right now.

**Acceptance Criteria:**
- Four tabs switch content dynamically
- Each tab sorts by publishedAt descending
- "Load more" pagination (12 initial, +12 per click)
- Tab state preserved in URL hash

## Acceptance Criteria (from tasks.md)
See docs/tasks.md for per-task acceptance criteria. Each task's acceptance criteria maps to one or more user stories above.

## Edge Cases
- All RSS sources fail simultaneously → dashboard shows stale data with red health indicator
- Claude/OpenAI API failure → fallback chain (Claude → OpenAI → store raw as unsummarized)
- YouTube quota exhausted → skip videos this cycle, serve stale video data
- LLM returns malformed JSON → Zod validate, retry once, fallback to unsummarized
- LLM hallucination → extractive-only prompt, no external knowledge
- Compromised RSS feed → contentSafe flag + quarantine
- First visit with empty DB → simple "No articles yet" message, 30-day seed
- localStorage cleared → badges reset (everything appears new), core content unaffected
- Same device multiple users → shared localStorage, acceptable for small team
- Tool changelog page structure change → scraper fails gracefully, keeps last data

## Out of Scope
- Bookmarks & sharing — parked for later (human decision)
- Mobile-responsive layout — parked for later (human decision)
- User-generated blog posts — Round 1 (human confirmed not needed)
- Comments/discussion system — Round 1 (human confirmed not needed)
- Slack integration — Round 1 (human confirmed not needed)
- User authentication/login — Round 1 (zero-login requirement)
- Multi-tenant support — not needed for single team
- Real-time websocket updates — ISR + 6h refresh sufficient
- Full-text search — parked for v2
- Admin panel — fully automated, no admin needed
- Email notifications — check dashboard when free
- Cross-device sync — requires auth, out of scope for v1
