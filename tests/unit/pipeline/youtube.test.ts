/**
 * Unit tests for src/lib/pipeline/youtube.ts — Task 2.2
 *
 * All external HTTP and the ssrf-req-filter module are mocked so no real
 * network requests are made and no API key is required.
 *
 * The implementation uses node:https under the hood; we mock safeFetch at the
 * module boundary by replacing the https.get call via vi.mock("node:https").
 * Additionally, ssrf-req-filter is mocked to return a dummy agent object.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type https from "node:https";
import type http from "node:http";

// ── Hoist mock references so they are available inside vi.mock factories ──────
// vi.mock calls are hoisted to the top of the file by Vitest; any variables
// they close over must be declared with vi.hoisted() to avoid TDZ errors.
const { mockHttpsGet } = vi.hoisted(() => ({
  mockHttpsGet: vi.fn(),
}));

// ── Mock ssrf-req-filter ──────────────────────────────────────────────────────
vi.mock("ssrf-req-filter", () => ({
  default: vi.fn(() => ({})), // returns a dummy agent object
}));

// ── Mock node:https ────────────────────────────────────────────────────────────
// We replace https.get with a spy. The real implementation feeds data through
// an IncomingMessage event emitter; we simulate that in each test.
vi.mock("node:https", () => ({
  default: { get: mockHttpsGet },
}));

import { fetchYouTubeVideos } from "@/lib/pipeline/youtube";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal playlistItems API response object. */
function makePlaylistResponse(
  items: Array<{
    videoId: string;
    title: string;
    description?: string;
    publishedAt: string;
    thumbnailUrl?: string;
  }>,
): object {
  return {
    items: items.map((v) => ({
      snippet: {
        title: v.title,
        description: v.description ?? "",
        publishedAt: v.publishedAt,
        thumbnails: v.thumbnailUrl
          ? { high: { url: v.thumbnailUrl } }
          : undefined,
        resourceId: {
          kind: "youtube#video",
          videoId: v.videoId,
        },
      },
    })),
  };
}

/** Build a minimal videos.list statistics response object. */
function makeStatsResponse(
  items: Array<{ id: string; viewCount: string; likeCount?: string }>,
): object {
  return {
    items: items.map((v) => ({
      id: v.id,
      statistics: {
        viewCount: v.viewCount,
        likeCount: v.likeCount ?? "0",
      },
    })),
  };
}

/**
 * Simulate https.get() calling back with a fake IncomingMessage that streams
 * `body` and ends cleanly, then fires the "end" event.
 */
function simulateHttpsGet(
  url: string,
  statusCode: number,
  body: object,
): void {
  mockHttpsGet.mockImplementationOnce(
    (
      _url: string,
      _opts: https.RequestOptions,
      callback: (res: http.IncomingMessage) => void,
    ) => {
      void _url;
      void _opts;
      const bodyStr = JSON.stringify(body);
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
      const fakeRes = {
        statusCode,
        on(event: string, handler: (...args: unknown[]) => void) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
          return fakeRes;
        },
      } as unknown as http.IncomingMessage;

      // Emit after the callback is registered (next tick)
      process.nextTick(() => {
        for (const handler of listeners["data"] ?? []) {
          handler(Buffer.from(bodyStr));
        }
        for (const handler of listeners["end"] ?? []) {
          handler();
        }
      });

      callback(fakeRes);

      // Return a fake ClientRequest with an .on() method
      return { on: vi.fn() };
    },
  );
  void url; // suppress unused warning
}

/**
 * Simulate https.get() calling back with a network error.
 */
function simulateHttpsGetError(error: Error): void {
  mockHttpsGet.mockImplementationOnce(
    (
      _url: string,
      _opts: https.RequestOptions,
      _callback: (res: http.IncomingMessage) => void,
    ) => {
      const errorListeners: ((...args: unknown[]) => void)[] = [];
      const fakeReq = {
        on(event: string, handler: (...args: unknown[]) => void) {
          if (event === "error") errorListeners.push(handler);
          return fakeReq;
        },
      };
      process.nextTick(() => {
        for (const handler of errorListeners) handler(error);
      });
      return fakeReq;
    },
  );
}

// ── Test data ─────────────────────────────────────────────────────────────────

const NOW = Date.now();
const RECENT_ISO = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
const OLD_ISO = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

// Playlist responses keyed by playlist ID substring
const PLAYLIST_BODIES: Record<string, object> = {
  UUsBjURrPoezykLs9EqgamOA: makePlaylistResponse([
    {
      videoId: "vid-fire-1",
      title: "Fireship Video 1",
      description: "Cool stuff",
      publishedAt: RECENT_ISO,
      thumbnailUrl: "https://img.youtube.com/fireship/hq.jpg",
    },
  ]),
  UUOmHnRJPE7YEVR2RAUJ5vIA: makePlaylistResponse([
    {
      videoId: "vid-matt-1",
      title: "Matt Wolfe Video 1",
      description: "AI news",
      publishedAt: RECENT_ISO,
    },
  ]),
  UURcXOOqSgeGOOiGpEjEMaOw: makePlaylistResponse([
    {
      videoId: "vid-jason-1",
      title: "AI Jason Video 1",
      publishedAt: RECENT_ISO,
    },
  ]),
  UUbfYPyITQ_7l4upoX8nvctg: makePlaylistResponse([
    {
      videoId: "vid-tmp-1",
      title: "Two Minute Papers Video 1",
      publishedAt: RECENT_ISO,
    },
  ]),
};

const STATS_BODIES: Record<string, object> = {
  "vid-fire-1": makeStatsResponse([
    { id: "vid-fire-1", viewCount: "100000", likeCount: "4500" },
  ]),
  "vid-matt-1": makeStatsResponse([{ id: "vid-matt-1", viewCount: "55000" }]),
  "vid-jason-1": makeStatsResponse([{ id: "vid-jason-1", viewCount: "22000" }]),
  "vid-tmp-1": makeStatsResponse([{ id: "vid-tmp-1", viewCount: "88000" }]),
};

// ── Helper: queue successful mocks for all 4 channels ────────────────────────

function queueAllChannelMocks(): void {
  const channels = [
    { playlistId: "UUsBjURrPoezykLs9EqgamOA", videoId: "vid-fire-1" },
    { playlistId: "UUOmHnRJPE7YEVR2RAUJ5vIA", videoId: "vid-matt-1" },
    { playlistId: "UURcXOOqSgeGOOiGpEjEMaOw", videoId: "vid-jason-1" },
    { playlistId: "UUbfYPyITQ-7l4upoX8nvctg", videoId: "vid-tmp-1" },
  ];

  // Because fetchYouTubeVideos calls channels in parallel via Promise.allSettled,
  // we use a URL-dispatch mock rather than sequential queuing.
  mockHttpsGet.mockImplementation(
    (
      url: string,
      _opts: https.RequestOptions,
      callback: (res: http.IncomingMessage) => void,
    ) => {
      const statusCode = 200;
      let body: object = {};

      if (url.includes("playlistItems")) {
        const channel = channels.find((c) => url.includes(c.playlistId));
        body = channel
          ? (PLAYLIST_BODIES[
              // Map the URL playlist ID key (with dash) to our dict key (with underscore for TMP)
              channel.playlistId === "UUbfYPyITQ-7l4upoX8nvctg"
                ? "UUbfYPyITQ_7l4upoX8nvctg"
                : channel.playlistId
            ] ?? { items: [] })
          : { items: [] };
      } else if (url.includes("videos") && url.includes("statistics")) {
        const channel = channels.find((c) => url.includes(c.videoId));
        body = channel ? (STATS_BODIES[channel.videoId] ?? { items: [] }) : { items: [] };
      }

      const bodyStr = JSON.stringify(body);
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
      const fakeRes = {
        statusCode,
        on(event: string, handler: (...args: unknown[]) => void) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
          return fakeRes;
        },
      } as unknown as http.IncomingMessage;

      process.nextTick(() => {
        for (const handler of listeners["data"] ?? []) handler(Buffer.from(bodyStr));
        for (const handler of listeners["end"] ?? []) handler();
      });

      callback(fakeRes);
      return { on: vi.fn() };
    },
  );
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "test-api-key";
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("fetchYouTubeVideos", () => {
  describe("successful fetch", () => {
    it("returns one RawArticle per video across all channels", async () => {
      queueAllChannelMocks();
      const articles = await fetchYouTubeVideos(7);
      expect(articles).toHaveLength(4);
    });

    it("maps fields correctly for a Fireship video", async () => {
      queueAllChannelMocks();
      const articles = await fetchYouTubeVideos(7);
      const fireship = articles.find((a) => a.videoId === "vid-fire-1");

      expect(fireship).toBeDefined();
      expect(fireship!.title).toBe("Fireship Video 1");
      expect(fireship!.url).toBe("https://www.youtube.com/watch?v=vid-fire-1");
      expect(fireship!.source).toBe("Fireship");
      expect(fireship!.sourceType).toBe("youtube");
      expect(fireship!.contentType).toBe("video");
      expect(fireship!.thumbnailUrl).toBe(
        "https://img.youtube.com/fireship/hq.jpg",
      );
      expect(fireship!.rawContent).toBe("Cool stuff");
      expect(fireship!.externalSignal).toBe(100000);
    });

    it("sets externalSignal (viewCount) from statistics", async () => {
      queueAllChannelMocks();
      const articles = await fetchYouTubeVideos(7);
      const matt = articles.find((a) => a.videoId === "vid-matt-1");
      expect(matt!.externalSignal).toBe(55000);
    });

    it("sets thumbnailUrl to null when no thumbnails present", async () => {
      queueAllChannelMocks();
      const articles = await fetchYouTubeVideos(7);
      const jason = articles.find((a) => a.videoId === "vid-jason-1");
      expect(jason!.thumbnailUrl).toBeNull();
    });

    it("sets rawContent to null when description is empty", async () => {
      queueAllChannelMocks();
      const articles = await fetchYouTubeVideos(7);
      const jason = articles.find((a) => a.videoId === "vid-jason-1");
      expect(jason!.rawContent).toBeNull();
    });

    it("stores publishedAt as a Unix timestamp in milliseconds", async () => {
      queueAllChannelMocks();
      const articles = await fetchYouTubeVideos(7);
      const fireship = articles.find((a) => a.videoId === "vid-fire-1");
      expect(fireship!.publishedAt).toBe(new Date(RECENT_ISO).getTime());
    });

    it("includes the YOUTUBE_API_KEY in request URLs", async () => {
      const capturedUrls: string[] = [];
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          capturedUrls.push(url);
          // Return empty responses to keep the test fast
          const body = JSON.stringify({ items: [] });
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(body));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      await fetchYouTubeVideos(7);
      expect(capturedUrls.some((u) => u.includes("key=test-api-key"))).toBe(true);
    });

    it("uses playlistItems.list — never search.list", async () => {
      const capturedUrls: string[] = [];
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          capturedUrls.push(url);
          const body = JSON.stringify({ items: [] });
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(body));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      await fetchYouTubeVideos(7);
      expect(capturedUrls.some((u) => u.includes("search"))).toBe(false);
      expect(capturedUrls.some((u) => u.includes("playlistItems"))).toBe(true);
    });
  });

  describe("per-channel failure isolation", () => {
    /**
     * Shared helper: sets up a URL-dispatching mock where Fireship returns HTTP
     * 403 and all other channels succeed.
     */
    function mockFireshipFails403(): void {
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          let statusCode = 200;
          let body: object = { items: [] };

          if (url.includes("playlistItems")) {
            if (url.includes("UUsBjURrPoezykLs9EqgamOA")) {
              statusCode = 403;
              body = { error: { code: 403, message: "Forbidden" } };
            } else if (url.includes("UUOmHnRJPE7YEVR2RAUJ5vIA")) {
              body = PLAYLIST_BODIES["UUOmHnRJPE7YEVR2RAUJ5vIA"];
            } else if (url.includes("UURcXOOqSgeGOOiGpEjEMaOw")) {
              body = PLAYLIST_BODIES["UURcXOOqSgeGOOiGpEjEMaOw"];
            } else if (url.includes("UUbfYPyITQ-7l4upoX8nvctg")) {
              body = PLAYLIST_BODIES["UUbfYPyITQ_7l4upoX8nvctg"];
            }
          } else if (url.includes("videos") && url.includes("statistics")) {
            if (url.includes("vid-matt-1")) body = STATS_BODIES["vid-matt-1"];
            else if (url.includes("vid-jason-1")) body = STATS_BODIES["vid-jason-1"];
            else if (url.includes("vid-tmp-1")) body = STATS_BODIES["vid-tmp-1"];
          }

          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );
    }

    it("returns videos from healthy channels when one channel returns HTTP 403", async () => {
      mockFireshipFails403();
      const articles = await fetchYouTubeVideos(7);

      expect(articles).toHaveLength(3);
      expect(articles.some((a) => a.source === "Fireship")).toBe(false);
      expect(articles.some((a) => a.source === "Matt Wolfe")).toBe(true);
      expect(articles.some((a) => a.source === "AI Jason")).toBe(true);
      expect(articles.some((a) => a.source === "Two Minute Papers")).toBe(true);
    });

    it("returns videos from healthy channels when one channel throws a network error", async () => {
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          // Two Minute Papers playlist — simulate network error via request .on("error")
          if (
            url.includes("playlistItems") &&
            url.includes("UUbfYPyITQ-7l4upoX8nvctg")
          ) {
            const errorListeners: ((...args: unknown[]) => void)[] = [];
            const fakeReq = {
              on(event: string, handler: (...args: unknown[]) => void) {
                if (event === "error") errorListeners.push(handler);
                return fakeReq;
              },
            };
            process.nextTick(() => {
              for (const h of errorListeners) h(new Error("Network timeout"));
            });
            return fakeReq;
          }

          // All other channels succeed
          let body: object = { items: [] };
          if (url.includes("playlistItems")) {
            if (url.includes("UUsBjURrPoezykLs9EqgamOA"))
              body = PLAYLIST_BODIES["UUsBjURrPoezykLs9EqgamOA"];
            else if (url.includes("UUOmHnRJPE7YEVR2RAUJ5vIA"))
              body = PLAYLIST_BODIES["UUOmHnRJPE7YEVR2RAUJ5vIA"];
            else if (url.includes("UURcXOOqSgeGOOiGpEjEMaOw"))
              body = PLAYLIST_BODIES["UURcXOOqSgeGOOiGpEjEMaOw"];
          } else if (url.includes("videos") && url.includes("statistics")) {
            if (url.includes("vid-fire-1")) body = STATS_BODIES["vid-fire-1"];
            else if (url.includes("vid-matt-1")) body = STATS_BODIES["vid-matt-1"];
            else if (url.includes("vid-jason-1")) body = STATS_BODIES["vid-jason-1"];
          }

          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      const articles = await fetchYouTubeVideos(7);

      expect(articles).toHaveLength(3);
      expect(articles.some((a) => a.source === "Two Minute Papers")).toBe(false);
      expect(articles.some((a) => a.source === "Fireship")).toBe(true);
    });

    it("returns empty array when ALL channels fail", async () => {
      mockHttpsGet.mockImplementation(
        (
          _url: string,
          _opts: https.RequestOptions,
          _callback: (res: http.IncomingMessage) => void,
        ) => {
          const errorListeners: ((...args: unknown[]) => void)[] = [];
          const fakeReq = {
            on(event: string, handler: (...args: unknown[]) => void) {
              if (event === "error") errorListeners.push(handler);
              return fakeReq;
            },
          };
          process.nextTick(() => {
            for (const h of errorListeners) h(new Error("Complete outage"));
          });
          return fakeReq;
        },
      );

      const articles = await fetchYouTubeVideos(7);
      expect(articles).toHaveLength(0);
    });

    it("still returns playlist videos even if the statistics call fails", async () => {
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          let statusCode = 200;
          let body: object;

          if (url.includes("playlistItems")) {
            // All playlists succeed
            if (url.includes("UUsBjURrPoezykLs9EqgamOA"))
              body = PLAYLIST_BODIES["UUsBjURrPoezykLs9EqgamOA"];
            else if (url.includes("UUOmHnRJPE7YEVR2RAUJ5vIA"))
              body = PLAYLIST_BODIES["UUOmHnRJPE7YEVR2RAUJ5vIA"];
            else if (url.includes("UURcXOOqSgeGOOiGpEjEMaOw"))
              body = PLAYLIST_BODIES["UURcXOOqSgeGOOiGpEjEMaOw"];
            else body = PLAYLIST_BODIES["UUbfYPyITQ_7l4upoX8nvctg"];
          } else {
            // Statistics calls fail with 500
            statusCode = 500;
            body = { error: { code: 500, message: "Internal Server Error" } };
          }

          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      const articles = await fetchYouTubeVideos(7);

      // All 4 videos returned, but with externalSignal = 0 (no stats)
      expect(articles).toHaveLength(4);
      for (const article of articles) {
        expect(article.externalSignal).toBe(0);
      }
    });
  });

  describe("content age filtering", () => {
    /** Build a dispatch mock returning custom playlist body for Fireship only. */
    function mockWithFireshipPlaylist(playlistBody: object): void {
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          let body: object = { items: [] };

          if (url.includes("playlistItems") && url.includes("UUsBjURrPoezykLs9EqgamOA")) {
            body = playlistBody;
          } else if (url.includes("videos") && url.includes("statistics")) {
            // Return stats for any requested video IDs
            body = makeStatsResponse([
              { id: "vid-recent", viewCount: "1000" },
              { id: "vid-a", viewCount: "500" },
              { id: "vid-b", viewCount: "300" },
              { id: "vid-old-but-in-window", viewCount: "9000" },
            ]);
          }

          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );
    }

    it("excludes videos older than the lookback window", async () => {
      mockWithFireshipPlaylist(
        makePlaylistResponse([
          { videoId: "vid-recent", title: "Recent", publishedAt: RECENT_ISO },
          { videoId: "vid-old", title: "Old", publishedAt: OLD_ISO },
        ]),
      );

      const articles = await fetchYouTubeVideos(7);
      expect(articles).toHaveLength(1);
      expect(articles[0].videoId).toBe("vid-recent");
    });

    it("includes all videos within the lookback window", async () => {
      const twoDaysAgo = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
      const fiveDaysAgo = new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString();
      mockWithFireshipPlaylist(
        makePlaylistResponse([
          { videoId: "vid-a", title: "Video A", publishedAt: twoDaysAgo },
          { videoId: "vid-b", title: "Video B", publishedAt: fiveDaysAgo },
        ]),
      );

      const articles = await fetchYouTubeVideos(7);
      expect(articles).toHaveLength(2);
    });

    it("returns empty array when all videos are outside the lookback window", async () => {
      // Stale-only playlist — statistics should never be called
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          if (url.includes("videos") && url.includes("statistics")) {
            throw new Error("statistics should not be called when list is empty");
          }

          const body = makePlaylistResponse([
            { videoId: "vid-stale", title: "Stale", publishedAt: OLD_ISO },
          ]);
          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      const articles = await fetchYouTubeVideos(7);
      expect(articles).toHaveLength(0);
    });

    it("respects a 30-day lookback for first-run seeding", async () => {
      mockWithFireshipPlaylist(
        makePlaylistResponse([
          { videoId: "vid-recent", title: "Recent", publishedAt: RECENT_ISO },
          // OLD_ISO is exactly 30 days ago; use 31-day window to include it
          { videoId: "vid-old-but-in-window", title: "Old but included", publishedAt: OLD_ISO },
        ]),
      );

      const articles = await fetchYouTubeVideos(31);
      expect(articles.some((a) => a.videoId === "vid-old-but-in-window")).toBe(true);
      expect(articles).toHaveLength(2);
    });
  });

  describe("quota-aware limiting", () => {
    it("requests at most 10 results per channel (maxResults=10 in URL)", async () => {
      const capturedUrls: string[] = [];
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          capturedUrls.push(url);
          const body = JSON.stringify({ items: [] });
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(body));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      await fetchYouTubeVideos(7);

      const playlistUrls = capturedUrls.filter((u) => u.includes("playlistItems"));
      for (const u of playlistUrls) {
        expect(u).toContain("maxResults=10");
      }
    });

    it("makes exactly one playlistItems call per channel (4 total)", async () => {
      const capturedUrls: string[] = [];
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          capturedUrls.push(url);
          const body = JSON.stringify({ items: [] });
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(body));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      await fetchYouTubeVideos(7);

      const playlistUrls = capturedUrls.filter((u) => u.includes("playlistItems"));
      expect(playlistUrls).toHaveLength(4);
    });

    it("batches all video IDs into a single videos.list call per channel", async () => {
      const capturedUrls: string[] = [];
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          capturedUrls.push(url);
          let body: object = { items: [] };

          if (url.includes("playlistItems") && url.includes("UUsBjURrPoezykLs9EqgamOA")) {
            body = makePlaylistResponse([
              { videoId: "vid-1", title: "V1", publishedAt: RECENT_ISO },
              { videoId: "vid-2", title: "V2", publishedAt: RECENT_ISO },
              { videoId: "vid-3", title: "V3", publishedAt: RECENT_ISO },
            ]);
          } else if (url.includes("videos") && url.includes("statistics")) {
            body = makeStatsResponse([
              { id: "vid-1", viewCount: "100" },
              { id: "vid-2", viewCount: "200" },
              { id: "vid-3", viewCount: "300" },
            ]);
          }

          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      await fetchYouTubeVideos(7);

      const statsUrls = capturedUrls.filter(
        (u) => u.includes("videos") && u.includes("statistics"),
      );
      // Only one videos.list call for Fireship (batched); others return empty playlists
      expect(statsUrls).toHaveLength(1);
      expect(statsUrls[0]).toContain("vid-1");
      expect(statsUrls[0]).toContain("vid-2");
      expect(statsUrls[0]).toContain("vid-3");
    });

    it("skips the videos.list call entirely when no videos pass the age filter", async () => {
      const capturedUrls: string[] = [];
      mockHttpsGet.mockImplementation(
        (
          url: string,
          _opts: https.RequestOptions,
          callback: (res: http.IncomingMessage) => void,
        ) => {
          capturedUrls.push(url);

          // All channels return only stale videos
          const body = makePlaylistResponse([
            { videoId: "vid-stale", title: "Stale", publishedAt: OLD_ISO },
          ]);
          const bodyStr = JSON.stringify(body);
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const fakeRes = {
            statusCode: 200,
            on(event: string, handler: (...args: unknown[]) => void) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(handler);
              return fakeRes;
            },
          } as unknown as http.IncomingMessage;
          process.nextTick(() => {
            for (const h of listeners["data"] ?? []) h(Buffer.from(bodyStr));
            for (const h of listeners["end"] ?? []) h();
          });
          callback(fakeRes);
          return { on: vi.fn() };
        },
      );

      const articles = await fetchYouTubeVideos(7);
      expect(articles).toHaveLength(0);

      const statsUrls = capturedUrls.filter(
        (u) => u.includes("videos") && u.includes("statistics"),
      );
      expect(statsUrls).toHaveLength(0);
    });
  });
});
