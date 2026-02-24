# Information Architecture — Deep-Tech Pulse

## Screen Map

Deep-Tech Pulse is a **single-page dashboard**. There are no separate pages, routes, or navigation flows. Everything lives on one scrollable page with tabbed sections.

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  ┌─── HEADER ───────────────────────────────┐   │
│  │ Logo/Title                                │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── TRENDING SNAPSHOT ────────────────────┐   │
│  │ [Hero Card 1] [Hero Card 2] [Hero Card 3]│   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── TOOL SPOTLIGHT ───────────────────────┐   │
│  │ Cursor v0.45 │ Claude 4.5 │ Devin │ ...  │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── CONTENT TABS ─────────────────────────┐   │
│  │ [News] [Videos] [Unlocks] [Best Ways]     │   │
│  │                                            │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐       │   │
│  │  │ Card   │ │ Card   │ │ Card   │       │   │
│  │  │ 🟢NEW  │ │        │ │ 🟡     │       │   │
│  │  │        │ │        │ │        │       │   │
│  │  └────────┘ └────────┘ └────────┘       │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐       │   │
│  │  │ Card   │ │ Card   │ │ Card   │       │   │
│  │  └────────┘ └────────┘ └────────┘       │   │
│  │                                            │   │
│  │  [Load more →]                             │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── FOOTER ───────────────────────────────┐   │
│  │ Privacy notice: localStorage only         │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
└─────────────────────────────────────────────────┘
```

## Navigation Flows

### Primary Flow: Scan and Go
1. User opens dashboard URL
2. Eyes land on **Trending Snapshot** (top 3 most important items)
3. Scans **Tool Spotlight** for tool updates
4. Switches between **Tabs** to browse by category
5. Clicks card to read source article (opens in new tab)
6. Done — 30 seconds for the pulse check

### Secondary Flow: Track What's New
1. User returns to dashboard
2. **NEW badges** highlight what changed since last visit
3. Scans new items only
4. Badges clear on click or after 48h

### Error Flows
1. **First visit, empty DB**: Simple "No articles yet" message → pipeline runs → content appears in ~2-5 min
2. **Unsummarized content**: "Raw" badge → first 2 sentences of source content displayed

## Feature Connections

### Data Flow
```
RSS Sources ─┐
YouTube API ──┼── Pipeline Runner ── Claude/OpenAI ── PostgreSQL ── Dashboard
Tool Changelogs┘                         │
                                         │
                                   Zod Validation
                                   Noise Filter
                                   Content Safety
```

### Shared Data
- **articles table** → feeds Trending Snapshot, Content Tabs, and card components
- **tool_spotlight table** → feeds Tool Spotlight strip
- **pipeline_runs table** → tracks pipeline execution history
- **localStorage** → feeds NEW badges, last-visited tracking

### Feature Interactions
| Feature A | Feature B | Interaction |
|-----------|-----------|-------------|
| AI Summarization | All Cards | Every card displays AI summary + tags |
| Noise Filter | Content Tabs | Filtered articles never appear in any tab |
| Trending Score | Trending Snapshot | Top 3 by composite score populate snapshot |
| New Badges | All Cards | localStorage timestamp compared to publishedAt |
| Tool Spotlight | Pipeline | Scraped on same 6-hour cycle as content |

## Component Ownership

| Screen Area | Capability Cluster | Agent |
|-------------|-------------------|-------|
| Header | dashboard | dashboard-agent |
| Trending Snapshot | dashboard | dashboard-agent |
| Tool Spotlight Strip | dashboard | dashboard-agent |
| Content Tabs | dashboard | dashboard-agent |
| Article/Video Cards | dashboard | dashboard-agent |
| NEW Badges | dashboard | dashboard-agent |
| Pipeline Runner | pipeline | pipeline-agent |
| RSS/YouTube/Tool Fetchers | pipeline | pipeline-agent |
| Cron Endpoint | pipeline | pipeline-agent |
| AI Provider + Prompts | intelligence | intelligence-agent |
| Zod Validation + Retry | intelligence | intelligence-agent |
| Noise Filter + Safety | intelligence | intelligence-agent |
| DB Schema + Migrations | infra | infra-agent |
| Project Scaffold | infra | infra-agent |
| Railway Deployment | infra | infra-agent |
