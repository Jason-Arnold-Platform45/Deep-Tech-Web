/**
 * YouTube Data API v3 integration — Task 2.2
 *
 * Quota budget: ~80 units/day
 *   - playlistItems.list  →  1 unit per call  (4 channels × 1 = 4 units)
 *   - videos.list         →  1 unit per call  (batched per channel, 4 units max)
 *   Total per run: ~8 units; 6-hour cadence = ~32 units/day — well within budget.
 *
 * NEVER use search.list — costs 100 units per call.
 * Uses playlistItems.list on the "UU" uploads playlist for each channel.
 */

import https from "node:https";
import ssrfFilter from "ssrf-req-filter";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  sourceType: "youtube";
  contentType: "video";
  publishedAt: number; // Unix ms
  rawContent: string | null;
  thumbnailUrl: string | null;
  videoId: string;
  externalSignal: number; // viewCount
}

// ── Channel config ────────────────────────────────────────────────────────────

interface ChannelConfig {
  name: string;
  /** Upload playlist ID — channel UC… prefix replaced with UU… */
  playlistId: string;
}

const YOUTUBE_CHANNELS: ChannelConfig[] = [
  { name: "Fireship", playlistId: "UUsBjURrPoezykLs9EqgamOA" },
  { name: "Matt Wolfe", playlistId: "UUOmHnRJPE7YEVR2RAUJ5vIA" },
  { name: "AI Jason", playlistId: "UURcXOOqSgeGOOiGpEjEMaOw" },
  { name: "Two Minute Papers", playlistId: "UUbfYPyITQ-7l4upoX8nvctg" },
];

/** Maximum videos to fetch per channel per run. Keeps quota bounded. */
const MAX_RESULTS_PER_CHANNEL = 10;

const YT_BASE = "https://www.googleapis.com/youtube/v3";

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface SafeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Perform an HTTPS GET through the ssrf-req-filter agent, returning a simple
 * response object. All external HTTP calls in the pipeline must go through this
 * guard to prevent SSRF — even when targeting hardcoded Google API URLs.
 */
function safeFetch(url: string): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const agent = ssrfFilter(url) as https.Agent;
    https
      .get(url, { agent }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve({
            ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode ?? 0,
            json() {
              return Promise.resolve(JSON.parse(body) as unknown);
            },
          });
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Build a YouTube API URL with the given path and query parameters,
 * injecting the API key from the environment.
 */
function ytUrl(path: string, params: Record<string, string>): string {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY environment variable is not set");
  }
  const qs = new URLSearchParams({ ...params, key: apiKey });
  return `${YT_BASE}/${path}?${qs.toString()}`;
}

// ── YouTube API response shapes ────────────────────────────────────────────────

interface PlaylistItemSnippet {
  title: string;
  description: string;
  publishedAt: string; // ISO 8601
  thumbnails?: {
    maxres?: { url: string };
    high?: { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
  resourceId: {
    kind: string;
    videoId: string;
  };
}

interface PlaylistItemsResponse {
  items?: Array<{ snippet: PlaylistItemSnippet }>;
  error?: { code: number; message: string };
}

interface VideoStatistics {
  viewCount?: string;
  likeCount?: string;
}

interface VideosListResponse {
  items?: Array<{ id: string; statistics: VideoStatistics }>;
  error?: { code: number; message: string };
}

// ── Per-channel fetch ─────────────────────────────────────────────────────────

interface PlaylistVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: number; // Unix ms
  thumbnailUrl: string | null;
}

/**
 * Fetch the most recent videos from a single upload playlist.
 * Returns an empty array on any API error to preserve per-channel isolation.
 */
async function fetchPlaylistItems(
  channel: ChannelConfig,
  lookbackMs: number,
): Promise<PlaylistVideo[]> {
  const url = ytUrl("playlistItems", {
    part: "snippet",
    playlistId: channel.playlistId,
    maxResults: String(MAX_RESULTS_PER_CHANNEL),
  });

  let data: PlaylistItemsResponse;
  try {
    const res = await safeFetch(url);
    if (!res.ok) {
      console.error(
        `[youtube] playlistItems fetch failed for ${channel.name}: HTTP ${res.status}`,
      );
      return [];
    }
    data = (await res.json()) as PlaylistItemsResponse;
  } catch (err) {
    console.error(
      `[youtube] playlistItems network error for ${channel.name}:`,
      err,
    );
    return [];
  }

  if (data.error) {
    console.error(
      `[youtube] playlistItems API error for ${channel.name}: ${data.error.message}`,
    );
    return [];
  }

  if (!data.items || data.items.length === 0) {
    return [];
  }

  const cutoff = Date.now() - lookbackMs;
  const videos: PlaylistVideo[] = [];

  for (const item of data.items) {
    const snippet = item.snippet;

    // Skip non-video items (e.g. private/deleted placeholders)
    if (snippet.resourceId.kind !== "youtube#video") continue;

    const publishedAt = new Date(snippet.publishedAt).getTime();

    // Content age filter — skip videos older than the lookback window
    if (publishedAt < cutoff) continue;

    // Best available thumbnail
    const thumbnails = snippet.thumbnails;
    const thumbnailUrl =
      thumbnails?.maxres?.url ??
      thumbnails?.high?.url ??
      thumbnails?.medium?.url ??
      thumbnails?.default?.url ??
      null;

    videos.push({
      videoId: snippet.resourceId.videoId,
      title: snippet.title,
      description: snippet.description,
      publishedAt,
      thumbnailUrl,
    });
  }

  return videos;
}

/**
 * Batch-fetch statistics (viewCount, likeCount) for a list of video IDs.
 * A single videos.list call costs 1 quota unit regardless of batch size.
 * Returns a Map<videoId, VideoStatistics> for quick lookups.
 * Returns an empty map on any API error.
 */
async function fetchVideoStatistics(
  channelName: string,
  videoIds: string[],
): Promise<Map<string, VideoStatistics>> {
  const statsMap = new Map<string, VideoStatistics>();
  if (videoIds.length === 0) return statsMap;

  const url = ytUrl("videos", {
    part: "statistics",
    id: videoIds.join(","),
  });

  let data: VideosListResponse;
  try {
    const res = await safeFetch(url);
    if (!res.ok) {
      console.error(
        `[youtube] videos.list fetch failed for ${channelName}: HTTP ${res.status}`,
      );
      return statsMap;
    }
    data = (await res.json()) as VideosListResponse;
  } catch (err) {
    console.error(
      `[youtube] videos.list network error for ${channelName}:`,
      err,
    );
    return statsMap;
  }

  if (data.error) {
    console.error(
      `[youtube] videos.list API error for ${channelName}: ${data.error.message}`,
    );
    return statsMap;
  }

  for (const item of data.items ?? []) {
    statsMap.set(item.id, item.statistics);
  }

  return statsMap;
}

/**
 * Fetch and assemble RawArticle entries for a single YouTube channel.
 * Failures at any step return an empty array — one channel's failure must
 * never cascade to the others (per-channel isolation rule).
 */
async function fetchChannelVideos(
  channel: ChannelConfig,
  lookbackMs: number,
): Promise<RawArticle[]> {
  let playlistVideos: PlaylistVideo[];
  try {
    playlistVideos = await fetchPlaylistItems(channel, lookbackMs);
  } catch (err) {
    // fetchPlaylistItems swallows errors internally, but guard here too
    console.error(
      `[youtube] Unhandled error fetching playlist for ${channel.name}:`,
      err,
    );
    return [];
  }

  if (playlistVideos.length === 0) return [];

  const videoIds = playlistVideos.map((v) => v.videoId);
  const statsMap = await fetchVideoStatistics(channel.name, videoIds);

  const results: RawArticle[] = playlistVideos.map((video) => {
    const stats = statsMap.get(video.videoId);
    const viewCount = stats?.viewCount ? parseInt(stats.viewCount, 10) : 0;

    return {
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      source: channel.name,
      sourceType: "youtube" as const,
      contentType: "video" as const,
      publishedAt: video.publishedAt,
      rawContent: video.description.trim() || null,
      thumbnailUrl: video.thumbnailUrl,
      videoId: video.videoId,
      externalSignal: viewCount,
    };
  });

  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch recent AI/tech videos from all configured YouTube channels.
 *
 * @param lookbackDays - How many days back to include (default 7, first run uses 30).
 * @returns Flat array of RawArticle entries; one channel failing does not
 *          prevent the others from being returned.
 */
export async function fetchYouTubeVideos(
  lookbackDays = 7,
): Promise<RawArticle[]> {
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;

  // Run channels in parallel; each failure is isolated inside fetchChannelVideos
  const perChannelResults = await Promise.allSettled(
    YOUTUBE_CHANNELS.map((channel) => fetchChannelVideos(channel, lookbackMs)),
  );

  const all: RawArticle[] = [];
  for (let i = 0; i < perChannelResults.length; i++) {
    const result = perChannelResults[i];
    const channel = YOUTUBE_CHANNELS[i];
    if (result.status === "fulfilled") {
      all.push(...result.value);
    } else {
      // fetchChannelVideos swallows errors, but Promise.allSettled catches any
      // remaining throws (e.g. if YOUTUBE_API_KEY is missing)
      console.error(
        `[youtube] Channel ${channel.name} rejected:`,
        result.reason,
      );
    }
  }

  return all;
}
