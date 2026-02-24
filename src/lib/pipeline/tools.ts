import ssrfFilter from "ssrf-req-filter";

export interface ToolUpdate {
  toolName: string;
  currentVersion: string | null;
  lastUpdate: string | null;
  keyChange: string | null;
  sourceUrl: string;
}

interface ToolSource {
  name: string;
  url: string;
  slug: string;
}

const TOOL_SOURCES: ToolSource[] = [
  {
    name: "Cursor",
    url: "https://cursor.com/changelog",
    slug: "cursor",
  },
  {
    name: "Claude",
    url: "https://docs.anthropic.com/en/docs/about-claude/models",
    slug: "claude",
  },
  {
    name: "Devin",
    url: "https://devin.ai/blog",
    slug: "devin",
  },
  {
    name: "Windsurf",
    url: "https://codeium.com/blog",
    slug: "windsurf",
  },
  {
    name: "GitHub Copilot",
    url: "https://github.blog/changelog/label/copilot/",
    slug: "github-copilot",
  },
];

/**
 * Version pattern: matches common semver forms and date-based versions.
 * Examples: "1.0", "3.2.1", "0.45", "2024-03-15"
 */
const VERSION_PATTERN =
  /\b(\d{4}-\d{2}-\d{2}|\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)\b/;

/**
 * Strip HTML tags and collapse whitespace from a raw HTML string.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extract the first heading text (<h1>…<h6>) from raw HTML.
 */
function extractFirstHeading(html: string): string | null {
  const match = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!match) return null;
  const text = stripHtml(match[1]).trim();
  return text.length > 0 ? text : null;
}

/**
 * Extract the first non-empty paragraph text from raw HTML.
 */
function extractFirstParagraph(html: string): string | null {
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]).trim();
    // Skip very short paragraphs (likely navigation fragments)
    if (text.length >= 30) {
      // Truncate to a readable summary length
      return text.length > 300 ? text.slice(0, 297) + "..." : text;
    }
  }
  return null;
}

/**
 * Extract a version string from the heading or from the full page text.
 */
function extractVersion(headingText: string | null, bodyText: string): string | null {
  // Prefer version found in the heading
  if (headingText) {
    const m = headingText.match(VERSION_PATTERN);
    if (m) return m[1];
  }
  // Fall back to first version-like token in the body
  const m = bodyText.match(VERSION_PATTERN);
  return m ? m[1] : null;
}

/**
 * Derive a "lastUpdate" string from an <time> element or meta tags in the HTML.
 */
function extractLastUpdate(html: string): string | null {
  // Try <time datetime="...">
  const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (timeMatch) return timeMatch[1];

  // Try og:updated_time or article:modified_time meta
  const metaMatch = html.match(
    /<meta[^>]+(?:property|name)=["'](?:og:updated_time|article:modified_time)["'][^>]+content=["']([^"']+)["']/i
  );
  if (metaMatch) return metaMatch[1];

  return null;
}

/**
 * Fetch and parse the changelog/blog page for a single tool.
 * Returns null fields on any extraction failure; never throws.
 */
async function fetchSingleToolUpdate(source: ToolSource): Promise<ToolUpdate> {
  const base: ToolUpdate = {
    toolName: source.name,
    currentVersion: null,
    lastUpdate: null,
    keyChange: null,
    sourceUrl: source.url,
  };

  try {
    const agent = ssrfFilter(source.url);
    const response = await fetch(source.url, {
      // ssrf-req-filter works via a Node.js http(s).Agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(agent ? { agent } as any : {}),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DeepTechPulse/1.0; +https://deep-tech-pulse.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(
        `[tools] ${source.name}: HTTP ${response.status} from ${source.url}`
      );
      return base;
    }

    const html = await response.text();
    const heading = extractFirstHeading(html);
    const bodyText = stripHtml(html);

    base.currentVersion = extractVersion(heading, bodyText);
    base.lastUpdate = extractLastUpdate(html);
    base.keyChange = heading ?? extractFirstParagraph(html);
  } catch (err) {
    // Per-source isolation: log and return graceful fallback
    console.warn(
      `[tools] ${source.name}: fetch failed —`,
      err instanceof Error ? err.message : String(err)
    );
  }

  return base;
}

/**
 * Fetch update information for all configured agentic coding tools.
 * Each tool is fetched independently; a failure in one never blocks others.
 */
export async function fetchToolUpdates(): Promise<ToolUpdate[]> {
  const results = await Promise.allSettled(
    TOOL_SOURCES.map((source) => fetchSingleToolUpdate(source))
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Promise.allSettled guarantees no rejection from fetchSingleToolUpdate
    // (it catches internally), but we handle it defensively here.
    console.error(
      `[tools] Unexpected rejection for ${TOOL_SOURCES[index].name}:`,
      result.reason
    );
    return {
      toolName: TOOL_SOURCES[index].name,
      currentVersion: null,
      lastUpdate: null,
      keyChange: null,
      sourceUrl: TOOL_SOURCES[index].url,
    };
  });
}
