import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchToolUpdates, type ToolUpdate } from "@/lib/pipeline/tools";

// ---------------------------------------------------------------------------
// Mock ssrf-req-filter so tests do not make real network calls and do not
// need an actual SSRF-safe agent object.  The mock simply returns undefined,
// which our implementation handles defensively.
// ---------------------------------------------------------------------------
vi.mock("ssrf-req-filter", () => ({
  default: () => undefined,
}));

// ---------------------------------------------------------------------------
// HTML fixtures
// ---------------------------------------------------------------------------

const CURSOR_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Cursor Changelog</title>
    <meta property="og:updated_time" content="2024-03-15T00:00:00Z" />
  </head>
  <body>
    <h1>Cursor 0.42.0</h1>
    <p>This release introduces a redesigned AI panel with faster autocomplete
    responses and improved context-window management for large monorepos.</p>
    <p>Bug fixes and performance improvements across the editor.</p>
  </body>
</html>
`;

const CLAUDE_HTML = `
<!DOCTYPE html>
<html>
  <head><title>Claude Models - Anthropic</title></head>
  <body>
    <h1>Claude 3.7 Sonnet</h1>
    <time datetime="2024-03-10">March 10, 2024</time>
    <p>Claude 3.7 Sonnet is now available with extended thinking enabled by
    default. The model shows significant improvements on coding and
    mathematical reasoning benchmarks compared to Claude 3.5 Sonnet.</p>
  </body>
</html>
`;

const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
  <head><title>Blog</title></head>
  <body>
    <div>Some content without useful structure</div>
  </body>
</html>
`;

const EMPTY_HTML = `<!DOCTYPE html><html><head></head><body></body></html>`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Response-like object that global fetch returns.
 */
function mockResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchToolUpdates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Successful scrape
  // -------------------------------------------------------------------------

  describe("successful scrape with mocked HTML", () => {
    it("returns an array with one entry per configured tool", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(CURSOR_HTML));

      const results = await fetchToolUpdates();
      // 5 tools are configured in TOOL_SOURCES
      expect(results).toHaveLength(5);
    });

    it("each result has the expected shape", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(CURSOR_HTML));

      const results = await fetchToolUpdates();
      for (const result of results) {
        expect(result).toHaveProperty("toolName");
        expect(result).toHaveProperty("currentVersion");
        expect(result).toHaveProperty("lastUpdate");
        expect(result).toHaveProperty("keyChange");
        expect(result).toHaveProperty("sourceUrl");
        expect(typeof result.toolName).toBe("string");
        expect(result.toolName.length).toBeGreaterThan(0);
      }
    });

    it("extracts a version number from an h1 heading", async () => {
      vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("cursor.com")) {
          return Promise.resolve(mockResponse(CURSOR_HTML));
        }
        return Promise.resolve(mockResponse(MINIMAL_HTML));
      });

      const results = await fetchToolUpdates();
      const cursor = results.find((r) => r.toolName === "Cursor");
      expect(cursor).toBeDefined();
      expect(cursor!.currentVersion).toBe("0.42.0");
    });

    it("extracts the heading text as keyChange", async () => {
      vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("cursor.com")) {
          return Promise.resolve(mockResponse(CURSOR_HTML));
        }
        return Promise.resolve(mockResponse(MINIMAL_HTML));
      });

      const results = await fetchToolUpdates();
      const cursor = results.find((r) => r.toolName === "Cursor");
      expect(cursor!.keyChange).toBe("Cursor 0.42.0");
    });

    it("extracts a <time datetime> element as lastUpdate", async () => {
      vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("anthropic.com")) {
          return Promise.resolve(mockResponse(CLAUDE_HTML));
        }
        return Promise.resolve(mockResponse(MINIMAL_HTML));
      });

      const results = await fetchToolUpdates();
      const claude = results.find((r) => r.toolName === "Claude");
      expect(claude!.lastUpdate).toBe("2024-03-10");
    });

    it("extracts og:updated_time meta as lastUpdate when no <time> present", async () => {
      vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("cursor.com")) {
          return Promise.resolve(mockResponse(CURSOR_HTML));
        }
        return Promise.resolve(mockResponse(MINIMAL_HTML));
      });

      const results = await fetchToolUpdates();
      const cursor = results.find((r) => r.toolName === "Cursor");
      expect(cursor!.lastUpdate).toBe("2024-03-15T00:00:00Z");
    });

    it("preserves the correct sourceUrl for each tool", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(MINIMAL_HTML));

      const results = await fetchToolUpdates();
      const toolNames = results.map((r) => r.toolName);
      expect(toolNames).toContain("Cursor");
      expect(toolNames).toContain("Claude");
      expect(toolNames).toContain("Devin");
      expect(toolNames).toContain("Windsurf");
      expect(toolNames).toContain("GitHub Copilot");

      const cursor = results.find((r) => r.toolName === "Cursor");
      expect(cursor!.sourceUrl).toBe("https://cursor.com/changelog");

      const gh = results.find((r) => r.toolName === "GitHub Copilot");
      expect(gh!.sourceUrl).toBe(
        "https://github.blog/changelog/label/copilot/"
      );
    });
  });

  // -------------------------------------------------------------------------
  // Per-tool failure isolation
  // -------------------------------------------------------------------------

  describe("per-tool failure isolation", () => {
    it("returns results for all other tools when one tool fetch throws", async () => {
      let callIndex = 0;
      vi.mocked(fetch).mockImplementation(() => {
        callIndex++;
        // Fail the first fetch (Cursor) but succeed for all others
        if (callIndex === 1) {
          return Promise.reject(new Error("Network timeout"));
        }
        return Promise.resolve(mockResponse(CLAUDE_HTML));
      });

      const results = await fetchToolUpdates();
      // All 5 results should still be returned
      expect(results).toHaveLength(5);
    });

    it("returns null fields for the failed tool but valid data for others", async () => {
      vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("cursor.com")) {
          return Promise.reject(new Error("ECONNREFUSED"));
        }
        if (urlStr.includes("anthropic.com")) {
          return Promise.resolve(mockResponse(CLAUDE_HTML));
        }
        return Promise.resolve(mockResponse(MINIMAL_HTML));
      });

      const results = await fetchToolUpdates();

      const cursor = results.find((r) => r.toolName === "Cursor");
      expect(cursor!.currentVersion).toBeNull();
      expect(cursor!.lastUpdate).toBeNull();
      expect(cursor!.keyChange).toBeNull();

      // Claude should still have data
      const claude = results.find((r) => r.toolName === "Claude");
      expect(claude!.currentVersion).not.toBeNull();
    });

    it("handles HTTP error responses with null fields (graceful degradation)", async () => {
      vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("devin.ai")) {
          return Promise.resolve(mockResponse("", 503));
        }
        return Promise.resolve(mockResponse(MINIMAL_HTML));
      });

      const results = await fetchToolUpdates();
      expect(results).toHaveLength(5);

      const devin = results.find((r) => r.toolName === "Devin");
      expect(devin!.currentVersion).toBeNull();
      expect(devin!.keyChange).toBeNull();
    });

    it("handles all tools failing simultaneously", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("No internet"));

      const results = await fetchToolUpdates();
      expect(results).toHaveLength(5);

      for (const result of results) {
        expect(result.currentVersion).toBeNull();
        expect(result.lastUpdate).toBeNull();
        expect(result.keyChange).toBeNull();
        // sourceUrl must always be populated
        expect(typeof result.sourceUrl).toBe("string");
        expect(result.sourceUrl.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Graceful degradation
  // -------------------------------------------------------------------------

  describe("graceful degradation", () => {
    it("returns null fields when page has no recognisable structure", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(EMPTY_HTML));

      const results = await fetchToolUpdates();
      for (const result of results) {
        expect(result.currentVersion).toBeNull();
        expect(result.lastUpdate).toBeNull();
        expect(result.keyChange).toBeNull();
      }
    });

    it("returns null fields when page has minimal but non-matching content", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(MINIMAL_HTML));

      const results = await fetchToolUpdates();
      for (const result of results) {
        expect(result.currentVersion).toBeNull();
        expect(result.lastUpdate).toBeNull();
      }
    });

    it("always includes toolName and sourceUrl regardless of parse outcome", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse(EMPTY_HTML));

      const results = await fetchToolUpdates();
      for (const result of results) {
        expect(result.toolName).toBeTruthy();
        expect(result.sourceUrl).toBeTruthy();
        expect(result.sourceUrl).toMatch(/^https?:\/\//);
      }
    });

    it("does not throw on malformed HTML", async () => {
      const brokenHtml =
        "<<<not valid html>>><h1 no-close><p>Unclosed paragraph";
      vi.mocked(fetch).mockResolvedValue(mockResponse(brokenHtml));

      await expect(fetchToolUpdates()).resolves.toHaveLength(5);
    });

    it("truncates extremely long key changes to a readable length", async () => {
      const longParagraph = "A".repeat(5000);
      const htmlWithLongParagraph = `
        <html><body>
          <h1>Release Notes</h1>
          <p>${longParagraph}</p>
        </body></html>
      `;
      vi.mocked(fetch).mockResolvedValue(mockResponse(htmlWithLongParagraph));

      const results = await fetchToolUpdates();
      for (const result of results) {
        if (result.keyChange !== null) {
          expect(result.keyChange.length).toBeLessThanOrEqual(303); // 300 + "..."
        }
      }
    });
  });
});
