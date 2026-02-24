/**
 * Manual refresh endpoint — POST /api/cron/refresh
 *
 * Triggers an immediate pipeline run outside the normal 6-hour Railway Cron
 * schedule. Protected by CRON_SECRET header verified with crypto.timingSafeEqual.
 *
 * Rate limited: max 1 refresh per 5 minutes (in-memory).
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/runner";

// ── Rate limiting (in-memory) ────────────────────────────────────────────────

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
let lastRefreshAt = 0;

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Verify CRON_SECRET header
  const secret = request.headers.get("x-cron-secret");
  if (!secret) {
    return NextResponse.json(
      { error: "Missing x-cron-secret header" },
      { status: 401 }
    );
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/refresh] CRON_SECRET environment variable is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  // Timing-safe comparison to prevent timing attacks
  const secretBuf = Buffer.from(secret);
  const expectedBuf = Buffer.from(expected);

  if (
    secretBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(secretBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  // 2. Rate limit check
  const now = Date.now();
  if (now - lastRefreshAt < RATE_LIMIT_MS) {
    const retryAfterSec = Math.ceil(
      (RATE_LIMIT_MS - (now - lastRefreshAt)) / 1000
    );
    return NextResponse.json(
      {
        error: "Rate limited — max 1 refresh per 5 minutes",
        retryAfterSeconds: retryAfterSec,
      },
      { status: 429 }
    );
  }

  // 3. Run pipeline
  lastRefreshAt = now;

  try {
    const result = await runPipeline();
    return NextResponse.json({
      data: result,
      meta: {
        lastRefreshed: new Date().toISOString(),
        status: result.status,
      },
    });
  } catch (err) {
    console.error("[cron/refresh] Pipeline failed:", err);
    return NextResponse.json(
      {
        error: "Pipeline execution failed",
        meta: { lastRefreshed: new Date().toISOString(), status: "failed" },
      },
      { status: 500 }
    );
  }
}
