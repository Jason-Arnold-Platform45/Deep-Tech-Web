import RssParser from "rss-parser";
import ssrfFilter from "ssrf-req-filter";

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  sourceType: "rss";
  contentType: "news" | "video" | "unlock" | "workflow";
  publishedAt: number;
  rawContent: string | null;
  thumbnailUrl: string | null;
}

interface RssSource {
  name: string;
  url: string;
  contentType: "news" | "video" | "unlock" | "workflow";
}

const RSS_SOURCES: RssSource[] = [
  {
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    contentType: "news" as const,
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    contentType: "news" as const,
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    contentType: "news" as const,
  },
  {
    name: "Ars Technica AI",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    contentType: "news" as const,
  },
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    contentType: "workflow" as const,
  },
  {
    name: "Latent Space",
    url: "https://www.latent.space/feed",
    contentType: "news" as const,
  },
];

const SOURCE_TIMEOUT_MS = 30_000;

/**
 * Extracts a thumbnail URL from an RSS item's enclosure or media fields.
 * Returns null if none is available.
 */
function extractThumbnail(
  item: RssParser.Item & Record<string, unknown>
): string | null {
  // Standard RSS enclosure with image MIME type
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image/")) {
    return item.enclosure.url;
  }

  // media:thumbnail (common in many feeds)
  const mediaThumbnail = item["media:thumbnail"] as
    | { $?: { url?: string }; url?: string }
    | undefined;
  if (mediaThumbnail) {
    if (mediaThumbnail.$?.url) return mediaThumbnail.$.url;
    if (typeof mediaThumbnail.url === "string") return mediaThumbnail.url;
  }

  // media:content with medium="image"
  const mediaContent = item["media:content"] as
    | { $?: { url?: string; medium?: string } }
    | undefined;
  if (mediaContent?.$?.medium === "image" && mediaContent.$.url) {
    return mediaContent.$.url;
  }

  return null;
}

/**
 * Extracts plain-text raw content (first 500 chars) from an RSS item.
 * Falls back through contentSnippet → summary → null.
 */
function extractRawContent(item: RssParser.Item): string | null {
  const raw = item.contentSnippet ?? item.summary ?? null;
  if (!raw) return null;
  return raw.slice(0, 500);
}

/**
 * Fetches and parses a single RSS source.
 * Uses ssrf-req-filter as the HTTP/HTTPS agent and enforces a 30-second timeout.
 */
async function fetchSingleFeed(
  source: RssSource,
  cutoffMs: number
): Promise<RawArticle[]> {
  const agent = ssrfFilter(source.url);

  // Create a fresh parser per source so each can carry its own agent + timeout.
  const parser = new RssParser({
    timeout: SOURCE_TIMEOUT_MS,
    // requestOptions is merged into the Node http.get / https.get options object
    // inside rss-parser, which means `agent` is honoured by the underlying
    // http/https module — exactly the pattern documented by ssrf-req-filter.
    requestOptions: {
      agent,
    },
    customFields: {
      item: [
        ["media:thumbnail", "media:thumbnail"],
        ["media:content", "media:content"],
      ],
    },
  });

  const feed = await parser.parseURL(source.url);

  const articles: RawArticle[] = [];

  for (const item of feed.items) {
    const title = item.title?.trim();
    const link = item.link?.trim();

    if (!title || !link) continue;

    // Determine publish time; skip items with no parseable date
    const pubDateStr = item.isoDate ?? item.pubDate ?? null;
    const publishedAt = pubDateStr ? new Date(pubDateStr).getTime() : NaN;
    if (isNaN(publishedAt)) continue;

    // Age filter — drop items older than the lookback window
    if (publishedAt < cutoffMs) continue;

    articles.push({
      title,
      url: link,
      source: source.name,
      sourceType: "rss",
      contentType: source.contentType,
      publishedAt,
      rawContent: extractRawContent(item),
      thumbnailUrl: extractThumbnail(
        item as unknown as RssParser.Item & Record<string, unknown>
      ),
    });
  }

  return articles;
}

/**
 * Fetches all configured RSS feeds concurrently.
 *
 * @param lookbackDays - How many days back to accept articles (default 7;
 *                       use 30 for the first pipeline run to seed the DB).
 * @returns Flat array of parsed articles across all sources that succeeded.
 *          Per-source failures are isolated — one failure never blocks others.
 */
export async function fetchRssFeeds(lookbackDays = 7): Promise<RawArticle[]> {
  const cutoffMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1_000;

  const results = await Promise.allSettled(
    RSS_SOURCES.map((source) => fetchSingleFeed(source, cutoffMs))
  );

  const articles: RawArticle[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      // Log per-source failure without throwing — isolation guarantee
      console.error(
        `[rss] Failed to fetch "${RSS_SOURCES[i].name}": ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
      );
    }
  }

  return articles;
}
