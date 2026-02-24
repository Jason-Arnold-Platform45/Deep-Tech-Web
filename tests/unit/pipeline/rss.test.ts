import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawArticle } from "../../../src/lib/pipeline/rss";

// ---------------------------------------------------------------------------
// Module mocks
//
// mockParseURL is shared across all tests.  Each test configures it via
// mockResolvedValue / mockResolvedValueOnce before calling fetchRssFeeds().
// The mock is reset (call history + pending Once values) in beforeEach.
//
// vi.mock calls are hoisted to the top of the file by Vitest before any
// imports are executed, so the mocks are in place when rss.ts is first loaded.
// ---------------------------------------------------------------------------

const mockParseURL = vi.fn();

vi.mock("rss-parser", () => {
  // MockRssParser is a plain constructor function (not a vi.fn spy) so its
  // implementation is never accidentally cleared by mockReset / mockClear.
  // It always returns a fresh object carrying the shared mockParseURL spy.
  function MockRssParser(_opts?: unknown) {
    return { parseURL: mockParseURL };
  }
  // Expose as a spy so tests can assert how many times it was instantiated and
  // with which options.
  const spy = vi.fn(MockRssParser);
  return { default: spy };
});

vi.mock("ssrf-req-filter", () => ({
  default: vi.fn((_url: string) => ({ isSsrfAgent: true })),
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered.
// ---------------------------------------------------------------------------
import { fetchRssFeeds } from "../../../src/lib/pipeline/rss";
import RssParser from "rss-parser";
import ssrfFilter from "ssrf-req-filter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(
  overrides: Partial<RssParser.Item & Record<string, unknown>> & {
    offsetDaysAgo?: number;
  } = {}
): RssParser.Item & Record<string, unknown> {
  const { offsetDaysAgo = 1, ...rest } = overrides;
  const pubDate = new Date(
    Date.now() - offsetDaysAgo * 24 * 60 * 60 * 1_000
  ).toISOString();
  return {
    title: "Test Article",
    link: "https://example.com/article",
    isoDate: pubDate,
    contentSnippet: "A short snippet about AI progress.",
    ...rest,
  };
}

function makeFeed(
  items: (RssParser.Item & Record<string, unknown>)[]
): RssParser.Output<Record<string, unknown>> {
  return { items };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchRssFeeds", () => {
  beforeEach(() => {
    // Reset only the shared mockParseURL spy (call history + pending Once
    // values) before each test.  Do NOT call vi.clearAllMocks() or
    // vi.restoreAllMocks() — those would wipe the module-level vi.mock()
    // implementations.
    mockParseURL.mockReset();
    vi.mocked(ssrfFilter).mockClear();
    // Cast needed because rss-parser TypeScript declaration doesn't include spy
    // methods; the actual runtime value is the vi.fn() spy from the mock.
    (RssParser as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  // -------------------------------------------------------------------------
  // 1. Successful multi-source fetch
  // -------------------------------------------------------------------------
  it("returns articles from multiple sources when all fetches succeed", async () => {
    mockParseURL
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "HN Article", link: "https://hnrss.org/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "TechCrunch Article", link: "https://techcrunch.com/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "The Verge Article", link: "https://theverge.com/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "Ars Technica Article", link: "https://arstechnica.com/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "Simon Willison Post", link: "https://simonwillison.net/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "Latent Space Post", link: "https://latent.space/item/1" })])
      );

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(6);

    const hn = articles.find((a) => a.title === "HN Article");
    expect(hn).toBeDefined();
    expect(hn!.source).toBe("Hacker News");
    expect(hn!.sourceType).toBe("rss");
    expect(hn!.contentType).toBe("news");

    const sw = articles.find((a) => a.title === "Simon Willison Post");
    expect(sw).toBeDefined();
    expect(sw!.contentType).toBe("workflow");
  });

  // -------------------------------------------------------------------------
  // 2. Per-source failure isolation
  // -------------------------------------------------------------------------
  it("returns articles from healthy sources when one source fails", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Source 1 (Hacker News) fails
    mockParseURL
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "TechCrunch Article", link: "https://techcrunch.com/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "The Verge Article", link: "https://theverge.com/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "Ars Technica Article", link: "https://arstechnica.com/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "Simon Willison Post", link: "https://simonwillison.net/item/1" })])
      )
      .mockResolvedValueOnce(
        makeFeed([makeItem({ title: "Latent Space Post", link: "https://latent.space/item/1" })])
      );

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(5);

    const hn = articles.find((a) => a.source === "Hacker News");
    expect(hn).toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("Hacker News");
    expect(consoleSpy.mock.calls[0][0]).toContain("ECONNREFUSED");

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 3. All sources fail gracefully
  // -------------------------------------------------------------------------
  it("returns an empty array when all sources fail", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockParseURL.mockRejectedValue(new Error("Network unreachable"));

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledTimes(6);

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 4. Content age filtering (default 7-day window)
  // -------------------------------------------------------------------------
  it("filters out articles older than the lookback window", async () => {
    // All 6 sources return the same two-item feed
    mockParseURL.mockResolvedValue(
      makeFeed([
        makeItem({ title: "Recent Article", link: "https://example.com/recent", offsetDaysAgo: 3 }),
        makeItem({ title: "Old Article", link: "https://example.com/old", offsetDaysAgo: 8 }),
      ])
    );

    const articles = await fetchRssFeeds(7);

    const titles = articles.map((a) => a.title);
    expect(titles).toContain("Recent Article");
    expect(titles).not.toContain("Old Article");
  });

  // -------------------------------------------------------------------------
  // 5. 30-day lookback (first-run scenario)
  // -------------------------------------------------------------------------
  it("accepts articles up to 30 days old when lookbackDays=30", async () => {
    mockParseURL.mockResolvedValue(
      makeFeed([
        makeItem({ title: "Recent Article", link: "https://example.com/recent", offsetDaysAgo: 5 }),
        makeItem({ title: "Month-old Article", link: "https://example.com/month", offsetDaysAgo: 28 }),
        makeItem({ title: "Too Old Article", link: "https://example.com/tooold", offsetDaysAgo: 35 }),
      ])
    );

    const articles = await fetchRssFeeds(30);

    const titles = articles.map((a) => a.title);
    expect(titles).toContain("Recent Article");
    expect(titles).toContain("Month-old Article");
    expect(titles).not.toContain("Too Old Article");
  });

  // -------------------------------------------------------------------------
  // 6. Timeout handling — per-source isolation
  // -------------------------------------------------------------------------
  it("handles timeout errors per-source without crashing", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockParseURL
      .mockRejectedValueOnce(new Error("Request timed out after 30000ms"))
      .mockResolvedValue(
        makeFeed([makeItem({ title: "Healthy Article", link: "https://example.com/ok" })])
      );

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(5);

    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("timed out");

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 7. SSRF filter is applied to every source
  // -------------------------------------------------------------------------
  it("passes the ssrf agent to the parser for every source", async () => {
    mockParseURL.mockResolvedValue(makeFeed([]));

    await fetchRssFeeds();

    // ssrfFilter called once per source (6 sources)
    expect(ssrfFilter).toHaveBeenCalledTimes(6);

    // RssParser constructor called 6 times, each passing the ssrf agent
    const ParserMock = RssParser as unknown as ReturnType<typeof vi.fn>;
    expect(ParserMock).toHaveBeenCalledTimes(6);

    for (const call of ParserMock.mock.calls as Array<
      [{ requestOptions: { agent: unknown } }]
    >) {
      expect(call[0].requestOptions.agent).toEqual({ isSsrfAgent: true });
    }
  });

  // -------------------------------------------------------------------------
  // 8. RawContent is trimmed to 500 characters
  // -------------------------------------------------------------------------
  it("truncates rawContent to 500 characters", async () => {
    const longSnippet = "x".repeat(800);

    mockParseURL.mockResolvedValue(
      makeFeed([
        makeItem({
          title: "Long Content Article",
          link: "https://example.com/long",
          contentSnippet: longSnippet,
        }),
      ])
    );

    const articles = await fetchRssFeeds();

    const article = articles.find((a) => a.title === "Long Content Article");
    expect(article).toBeDefined();
    expect(article!.rawContent).toHaveLength(500);
  });

  // -------------------------------------------------------------------------
  // 9. Items without a title or URL are skipped
  // -------------------------------------------------------------------------
  it("skips items that are missing title or URL", async () => {
    mockParseURL.mockResolvedValue(
      makeFeed([
        makeItem({ title: "Valid", link: "https://example.com/valid" }),
        makeItem({ title: undefined, link: "https://example.com/notitle" }),
        makeItem({ title: "No Link", link: undefined }),
        makeItem({ title: undefined, link: undefined }),
      ])
    );

    const articles = await fetchRssFeeds();

    // "Valid" item survives from all 6 sources
    const valid = articles.filter((a) => a.title === "Valid");
    expect(valid).toHaveLength(6);

    // Items without title/link are never included
    const noLink = articles.filter((a) => a.title === "No Link");
    expect(noLink).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 10. Items with no parseable date are skipped
  // -------------------------------------------------------------------------
  it("skips items with unparseable or missing dates", async () => {
    mockParseURL.mockResolvedValue(
      makeFeed([
        makeItem({ title: "Dated Article", link: "https://example.com/dated", offsetDaysAgo: 1 }),
        {
          title: "Undated Article",
          link: "https://example.com/undated",
          isoDate: undefined,
          pubDate: undefined,
        },
      ])
    );

    const articles = await fetchRssFeeds();

    const undated = articles.filter((a) => a.title === "Undated Article");
    expect(undated).toHaveLength(0);

    const dated = articles.filter((a) => a.title === "Dated Article");
    expect(dated).toHaveLength(6);
  });

  // -------------------------------------------------------------------------
  // 11. Thumbnail extraction from enclosure
  // -------------------------------------------------------------------------
  it("extracts thumbnailUrl from an enclosure image field", async () => {
    mockParseURL.mockResolvedValue(
      makeFeed([
        makeItem({
          title: "Article With Thumbnail",
          link: "https://example.com/thumb",
          enclosure: { url: "https://example.com/thumb.jpg", type: "image/jpeg" },
        }),
      ])
    );

    const articles = await fetchRssFeeds();

    const article = articles.find((a) => a.title === "Article With Thumbnail");
    expect(article).toBeDefined();
    expect(article!.thumbnailUrl).toBe("https://example.com/thumb.jpg");
  });

  // -------------------------------------------------------------------------
  // 12. publishedAt is stored as unix milliseconds
  // -------------------------------------------------------------------------
  it("stores publishedAt as a unix millisecond timestamp", async () => {
    const knownDate = "2026-02-20T12:00:00.000Z";
    const expectedMs = new Date(knownDate).getTime();

    mockParseURL.mockResolvedValue(
      makeFeed([{ title: "Timestamped Article", link: "https://example.com/ts", isoDate: knownDate }])
    );

    const articles = await fetchRssFeeds(30);

    const article = articles.find((a) => a.title === "Timestamped Article");
    expect(article).toBeDefined();
    expect(article!.publishedAt).toBe(expectedMs);
  });
});
