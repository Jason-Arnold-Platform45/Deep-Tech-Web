import { describe, it, expect } from "vitest";
import {
  computeUrlHash,
  titleSimilarity,
  deduplicateArticles,
  type RawArticle,
} from "@/lib/pipeline/dedup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArticle(overrides: Partial<RawArticle> = {}): RawArticle {
  return {
    title: "Test Article Title",
    url: "https://example.com/article-1",
    source: "Test Source",
    sourceType: "rss",
    contentType: "news",
    publishedAt: Date.now(),
    rawContent: null,
    thumbnailUrl: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeUrlHash
// ---------------------------------------------------------------------------

describe("computeUrlHash", () => {
  it("returns a 64-character hex SHA-256 string", () => {
    const hash = computeUrlHash("https://example.com/article");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hash for the same URL", () => {
    const url = "https://example.com/post/123";
    expect(computeUrlHash(url)).toBe(computeUrlHash(url));
  });

  it("produces different hashes for different URLs", () => {
    const hashA = computeUrlHash("https://example.com/a");
    const hashB = computeUrlHash("https://example.com/b");
    expect(hashA).not.toBe(hashB);
  });

  it("normalises trailing slashes (canonical URLs match)", () => {
    const hashA = computeUrlHash("https://example.com/article");
    const hashB = computeUrlHash("https://example.com/article/");
    expect(hashA).toBe(hashB);
  });

  it("normalises to lowercase", () => {
    const hashA = computeUrlHash("https://EXAMPLE.COM/Article");
    const hashB = computeUrlHash("https://example.com/article");
    expect(hashA).toBe(hashB);
  });

  it("strips URL fragments before hashing", () => {
    const hashA = computeUrlHash("https://example.com/page#section");
    const hashB = computeUrlHash("https://example.com/page");
    expect(hashA).toBe(hashB);
  });

  it("handles malformed URLs without throwing", () => {
    expect(() => computeUrlHash("not-a-valid-url")).not.toThrow();
    const hash = computeUrlHash("not-a-valid-url");
    expect(hash).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// titleSimilarity
// ---------------------------------------------------------------------------

describe("titleSimilarity", () => {
  it("returns 1.0 for identical titles", () => {
    const title = "OpenAI releases GPT-5 with major reasoning improvements";
    expect(titleSimilarity(title, title)).toBe(1);
  });

  it("returns 0 for completely unrelated titles", () => {
    const a = "OpenAI releases new language model";
    const b = "Basketball championship results announced";
    expect(titleSimilarity(a, b)).toBe(0);
  });

  it("returns > 0.8 for near-duplicate titles", () => {
    const a = "Anthropic releases Claude 3.7 with extended thinking";
    const b = "Anthropic releases Claude 3.7 with extended thinking capability";
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.8);
  });

  it("returns <= 0.8 for clearly different titles", () => {
    const a = "New AI model achieves state-of-the-art coding benchmark";
    const b = "Startup raises $200M for autonomous vehicle platform";
    expect(titleSimilarity(a, b)).toBeLessThanOrEqual(0.8);
  });

  it("is case-insensitive", () => {
    const sim = titleSimilarity(
      "GPT-4 Achieves Record Benchmark Score",
      "gpt-4 achieves record benchmark score"
    );
    expect(sim).toBe(1);
  });

  it("ignores common stop-words when computing similarity", () => {
    // "the" and "a" are stop words — adding them should not change the score
    const a = "Model beats human performance on reasoning tasks";
    const b = "The model beats human performance on the reasoning tasks";
    // Should still be close to 1 because stop-words are filtered out
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.9);
  });

  it("handles empty string inputs without throwing", () => {
    expect(() => titleSimilarity("", "some title")).not.toThrow();
    expect(() => titleSimilarity("", "")).not.toThrow();
    expect(titleSimilarity("", "")).toBe(1);
    expect(titleSimilarity("", "some title")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deduplicateArticles
// ---------------------------------------------------------------------------

describe("deduplicateArticles", () => {
  describe("exact URL deduplication", () => {
    it("filters out articles whose URL hash matches an existing DB hash", () => {
      const article = makeArticle({ url: "https://example.com/known" });
      const existingHash = computeUrlHash("https://example.com/known");

      const result = deduplicateArticles([article], [existingHash]);
      expect(result).toHaveLength(0);
    });

    it("keeps articles whose URL hash does not exist in the DB", () => {
      const article = makeArticle({ url: "https://example.com/new" });
      const existingHash = computeUrlHash("https://example.com/other");

      const result = deduplicateArticles([article], [existingHash]);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/new");
    });

    it("deduplicates within the batch itself — keeps only first occurrence", () => {
      const url = "https://example.com/duplicate";
      const a = makeArticle({ url, title: "Article A" });
      const b = makeArticle({ url, title: "Article B" });

      const result = deduplicateArticles([a, b], []);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Article A");
    });

    it("handles canonical URL variants as duplicates (trailing slash)", () => {
      const a = makeArticle({ url: "https://example.com/page" });
      const b = makeArticle({ url: "https://example.com/page/" });

      const result = deduplicateArticles([a, b], []);
      expect(result).toHaveLength(1);
    });
  });

  describe("near-duplicate title deduplication", () => {
    it("removes near-duplicates with Jaccard similarity > 0.8", () => {
      const a = makeArticle({
        url: "https://source-a.com/story",
        title: "Anthropic releases Claude 3.7 with extended thinking",
      });
      const b = makeArticle({
        url: "https://source-b.com/story",
        title: "Anthropic releases Claude 3.7 with extended thinking capability",
      });

      const result = deduplicateArticles([a, b], []);
      expect(result).toHaveLength(1);
    });

    it("keeps articles with dissimilar titles (Jaccard <= 0.8)", () => {
      const a = makeArticle({
        url: "https://example.com/a",
        title: "New AI model achieves state-of-the-art coding benchmark score",
      });
      const b = makeArticle({
        url: "https://example.com/b",
        title: "Startup raises $200M for autonomous vehicle software platform",
      });

      const result = deduplicateArticles([a, b], []);
      expect(result).toHaveLength(2);
    });

    it("retains the higher-signal article when near-duplicates compete", () => {
      const lowSignal = makeArticle({
        url: "https://source-a.com/story",
        title: "OpenAI releases GPT-5 turbo with reasoning improvements",
        externalSignal: 50,
      });
      const highSignal = makeArticle({
        url: "https://source-b.com/story",
        title: "OpenAI releases GPT-5 turbo with reasoning improvements today",
        externalSignal: 200,
      });

      const result = deduplicateArticles([lowSignal, highSignal], []);
      expect(result).toHaveLength(1);
      expect(result[0].externalSignal).toBe(200);
    });

    it("keeps the first article when signals are equal", () => {
      const first = makeArticle({
        url: "https://source-a.com/story",
        title: "OpenAI releases GPT-5 turbo with reasoning improvements",
        externalSignal: 100,
      });
      const second = makeArticle({
        url: "https://source-b.com/story",
        title: "OpenAI releases GPT-5 turbo with reasoning improvements today",
        externalSignal: 100,
      });

      const result = deduplicateArticles([first, second], []);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://source-a.com/story");
    });
  });

  describe("cross-cycle deduplication", () => {
    it("filters a batch article that appeared in a previous pipeline cycle", () => {
      const previousUrl = "https://example.com/old-story";
      const previousHash = computeUrlHash(previousUrl);

      const incoming = makeArticle({
        url: previousUrl,
        title: "Story from last cycle",
      });

      const result = deduplicateArticles([incoming], [previousHash]);
      expect(result).toHaveLength(0);
    });

    it("allows new articles through even when old hashes are provided", () => {
      const oldHash = computeUrlHash("https://example.com/old");
      const newArticle = makeArticle({ url: "https://example.com/new" });

      const result = deduplicateArticles([newArticle], [oldHash]);
      expect(result).toHaveLength(1);
    });

    it("handles a large existingUrlHashes set efficiently", () => {
      const existingHashes = Array.from({ length: 1000 }, (_, i) =>
        computeUrlHash(`https://example.com/old-${i}`)
      );
      // Use completely distinct titles so near-duplicate filtering does not collapse them.
      const uniqueTitles = [
        "Cursor releases autonomous refactoring agent powered by Claude",
        "Google DeepMind unveils AlphaCode 3 with full repo context",
        "Vercel ships AI-native deployment pipeline for edge functions",
        "OpenAI introduces operator mode for GPT-5 agentic workflows",
        "Meta open-sources Code Llama 70B fine-tuned on GitHub",
        "Microsoft integrates Copilot into Azure DevOps CI pipelines",
        "Mistral releases Codestral 2 with 128k context window",
        "GitHub launches Copilot Workspace for multi-file refactoring",
        "Replit Ghostwriter now supports debugging across 40 languages",
        "JetBrains AI Assistant adds full project-wide semantic search",
        "Tabnine ships privacy-first model trained on enterprise codebases",
        "Amazon CodeWhisperer integrates with AWS Lambda console",
        "Sourcegraph Cody adds streaming diff previews for edits",
        "Warp terminal ships AI command suggestions with shell history",
        "Pieces for Developers launches offline snippet enrichment model",
        "Continue.dev open-sources custom LLM context providers",
        "Codeium Windsurf introduces cascade mode for chained edits",
        "Devin 2 enables multi-agent parallel task orchestration",
        "Linear ships AI issue triage using project history embeddings",
        "Swimm integrates with Cursor for living documentation updates",
      ];
      const newArticles = uniqueTitles.map((title, i) =>
        makeArticle({
          url: `https://example.com/new-${i}`,
          title,
        })
      );

      const result = deduplicateArticles(newArticles, existingHashes);
      expect(result).toHaveLength(20);
    });
  });

  describe("edge cases", () => {
    it("returns an empty array for an empty input batch", () => {
      const result = deduplicateArticles([], []);
      expect(result).toHaveLength(0);
    });

    it("returns an empty array when all articles are known duplicates", () => {
      const articles = [
        makeArticle({ url: "https://example.com/a" }),
        makeArticle({ url: "https://example.com/b" }),
      ];
      const hashes = articles.map((a) => computeUrlHash(a.url));

      const result = deduplicateArticles(articles, hashes);
      expect(result).toHaveLength(0);
    });

    it("does not mutate the input array", () => {
      const articles = [
        makeArticle({ url: "https://example.com/a" }),
        makeArticle({ url: "https://example.com/b" }),
      ];
      const copy = [...articles];
      deduplicateArticles(articles, []);
      expect(articles).toEqual(copy);
    });

    it("does not mutate existing hashes array", () => {
      const hashes = [computeUrlHash("https://example.com/known")];
      const copy = [...hashes];
      deduplicateArticles([makeArticle()], hashes);
      expect(hashes).toEqual(copy);
    });
  });
});
