import crypto from "node:crypto";

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  sourceType: "rss" | "youtube";
  contentType: "news" | "video" | "unlock" | "workflow";
  publishedAt: number;
  rawContent: string | null;
  thumbnailUrl: string | null;
  videoId?: string;
  externalSignal?: number;
}

/**
 * Canonicalise a URL then return its SHA-256 hex digest.
 * Canonicalisation: lowercase scheme+host, strip trailing slash, strip fragment.
 */
export function computeUrlHash(url: string): string {
  let canonical: string;
  try {
    const parsed = new URL(url);
    // Normalise: lowercase scheme and host, sort query params, drop fragment
    parsed.hash = "";
    const sorted = new URLSearchParams(
      [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
    parsed.search = sorted.toString();
    // Remove trailing slash from pathname (but keep root "/")
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    canonical = parsed.toString().toLowerCase();
  } catch {
    // Fallback: hash the raw string if URL is malformed
    canonical = url.toLowerCase();
  }
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Tokenise a title into a set of lowercase, punctuation-stripped words.
 * Stop-words are excluded so that near-duplicate detection focuses on
 * meaningful content tokens.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "has", "have", "had", "it", "its", "this", "that", "these", "those",
  "how", "what", "when", "where", "who", "why", "will", "can", "not",
]);

function tokenise(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Compute the Jaccard similarity coefficient between two title strings.
 * Returns a value in [0, 1]; 1 means identical token sets.
 */
export function titleSimilarity(a: string, b: string): number {
  const setA = tokenise(a);
  const setB = tokenise(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

const NEAR_DUPLICATE_THRESHOLD = 0.8;

/**
 * Deduplicate a batch of incoming articles against:
 *   1. URL hashes already persisted in the database (`existingUrlHashes`).
 *   2. Exact-duplicate URL hashes within the batch itself.
 *   3. Near-duplicate titles within the batch (Jaccard > 0.8).
 *
 * When two near-duplicate titles are found, the one with higher `externalSignal`
 * (or the first one when equal) is kept.
 *
 * The function never mutates its inputs.
 */
export function deduplicateArticles(
  newArticles: RawArticle[],
  existingUrlHashes: string[]
): RawArticle[] {
  const existingHashSet = new Set(existingUrlHashes);

  // Step 1: filter against existing DB hashes and deduplicate within the
  // batch by URL hash (keep first occurrence).
  const seenHashes = new Set<string>();
  const afterUrlDedup: RawArticle[] = [];

  for (const article of newArticles) {
    const hash = computeUrlHash(article.url);
    if (existingHashSet.has(hash) || seenHashes.has(hash)) {
      continue;
    }
    seenHashes.add(hash);
    afterUrlDedup.push(article);
  }

  // Step 2: near-duplicate title filtering within the surviving batch.
  // O(n²) is acceptable because batches are typically < 200 items.
  const result: RawArticle[] = [];

  for (const candidate of afterUrlDedup) {
    let isDuplicate = false;

    for (let i = 0; i < result.length; i++) {
      const similarity = titleSimilarity(candidate.title, result[i].title);
      if (similarity > NEAR_DUPLICATE_THRESHOLD) {
        // Keep the article with the higher external signal
        const candidateSignal = candidate.externalSignal ?? 0;
        const existingSignal = result[i].externalSignal ?? 0;
        if (candidateSignal > existingSignal) {
          result[i] = candidate;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(candidate);
    }
  }

  return result;
}
