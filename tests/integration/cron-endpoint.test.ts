import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — vi.hoisted ensures these are available when vi.mock factories
// are hoisted to the top of the file by Vitest.
// ---------------------------------------------------------------------------

const { mockRunPipeline } = vi.hoisted(() => ({
  mockRunPipeline: vi.fn(),
}));

vi.mock("@/lib/pipeline/runner", () => ({
  runPipeline: mockRunPipeline,
}));

// Mock NextResponse since we're running outside Next.js runtime
vi.mock("next/server", () => {
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...init?.headers },
      });
    }
  }
  return { NextResponse: MockNextResponse };
});

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { POST } from "../../src/app/api/cron/refresh/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/cron/refresh", {
    method: "POST",
    headers,
  });
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cron/refresh", () => {
  const VALID_SECRET = "test-cron-secret-abc123";
  const BASE_TIME = new Date("2026-02-24T12:00:00.000Z").getTime();
  // Each test gets a time window 30 minutes apart so the module-level
  // lastRefreshAt from a prior test (including any internal time advancement)
  // is always outside the 5-minute rate limit window.
  let testIndex = 0;

  beforeEach(() => {
    testIndex++;
    mockRunPipeline.mockReset();
    process.env.CRON_SECRET = VALID_SECRET;
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME + testIndex * 30 * 60 * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
  });

  // -------------------------------------------------------------------------
  // 1. Missing x-cron-secret header → 401
  // -------------------------------------------------------------------------
  it("returns 401 when x-cron-secret header is missing", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    const body = await parseJson(response);
    expect(body.error).toBe("Missing x-cron-secret header");
  });

  // -------------------------------------------------------------------------
  // 2. Invalid x-cron-secret → 401
  // -------------------------------------------------------------------------
  it("returns 401 when x-cron-secret is invalid", async () => {
    const response = await POST(
      makeRequest({ "x-cron-secret": "wrong-secret" })
    );

    expect(response.status).toBe(401);
    const body = await parseJson(response);
    expect(body.error).toBe("Invalid secret");
  });

  // -------------------------------------------------------------------------
  // 3. Valid secret → pipeline runs, returns { data, meta }
  // -------------------------------------------------------------------------
  it("triggers pipeline and returns { data, meta } with valid secret", async () => {
    mockRunPipeline.mockResolvedValueOnce({
      status: "ok",
      itemsIngested: 42,
      itemsFiltered: 3,
    });

    const response = await POST(
      makeRequest({ "x-cron-secret": VALID_SECRET })
    );

    expect(response.status).toBe(200);
    expect(mockRunPipeline).toHaveBeenCalledOnce();

    const body = await parseJson(response);
    expect(body.data).toEqual({
      status: "ok",
      itemsIngested: 42,
      itemsFiltered: 3,
    });
    expect(body.meta).toBeDefined();
    const meta = body.meta as Record<string, unknown>;
    expect(meta.lastRefreshed).toBeDefined();
    expect(meta.status).toBe("ok");
  });

  // -------------------------------------------------------------------------
  // 4. Rate limiting → 429 within 5 minutes
  // -------------------------------------------------------------------------
  it("returns 429 when called again within 5 minutes", async () => {
    mockRunPipeline.mockResolvedValue({
      status: "ok",
      itemsIngested: 10,
      itemsFiltered: 0,
    });

    // First call should succeed
    const first = await POST(
      makeRequest({ "x-cron-secret": VALID_SECRET })
    );
    expect(first.status).toBe(200);

    // Advance only 2 minutes (still within 5-minute window)
    vi.advanceTimersByTime(2 * 60 * 1000);

    // Second call should be rate-limited
    const second = await POST(
      makeRequest({ "x-cron-secret": VALID_SECRET })
    );
    expect(second.status).toBe(429);

    const body = await parseJson(second);
    expect(body.error).toContain("Rate limited");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);

    // Pipeline should only have been called once
    expect(mockRunPipeline).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // 5. Rate limit expires after 5 minutes
  // -------------------------------------------------------------------------
  it("allows a new request after 5 minutes have elapsed", async () => {
    mockRunPipeline.mockResolvedValue({
      status: "ok",
      itemsIngested: 5,
      itemsFiltered: 1,
    });

    // First call
    await POST(makeRequest({ "x-cron-secret": VALID_SECRET }));

    // Advance past the 5-minute window
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    // Second call should succeed
    const response = await POST(
      makeRequest({ "x-cron-secret": VALID_SECRET })
    );
    expect(response.status).toBe(200);
    expect(mockRunPipeline).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 6. Pipeline failure → 500
  // -------------------------------------------------------------------------
  it("returns 500 when pipeline throws an error", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    mockRunPipeline.mockRejectedValueOnce(new Error("DB connection lost"));

    const response = await POST(
      makeRequest({ "x-cron-secret": VALID_SECRET })
    );

    expect(response.status).toBe(500);
    const body = await parseJson(response);
    expect(body.error).toBe("Pipeline execution failed");
    expect(body.meta).toBeDefined();
    const meta = body.meta as Record<string, unknown>;
    expect(meta.status).toBe("failed");

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 7. Missing CRON_SECRET env var → 500
  // -------------------------------------------------------------------------
  it("returns 500 when CRON_SECRET env var is not set", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    delete process.env.CRON_SECRET;

    const response = await POST(
      makeRequest({ "x-cron-secret": "any-value" })
    );

    expect(response.status).toBe(500);
    const body = await parseJson(response);
    expect(body.error).toBe("Server misconfiguration");

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 8. Timing-safe comparison — different-length secrets rejected
  // -------------------------------------------------------------------------
  it("rejects secrets with different byte lengths", async () => {
    const response = await POST(
      makeRequest({ "x-cron-secret": "x" })
    );

    expect(response.status).toBe(401);
    const body = await parseJson(response);
    expect(body.error).toBe("Invalid secret");
  });
});
