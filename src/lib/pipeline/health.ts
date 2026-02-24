/**
 * Pipeline health tracking for Deep-Tech Pulse.
 *
 * Provides a lightweight status check that the dashboard header uses to
 * surface the pipeline health indicator to users.  All database access is
 * read-only and returns a safe default if no runs are recorded yet.
 */

import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineStatus = "ok" | "partial" | "failed" | "unknown";

export interface PipelineHealth {
  /** Aggregated health classification derived from the latest run. */
  status: PipelineStatus;
  /**
   * Unix millisecond timestamp of the most recently *successful* run
   * (status = "ok" or "partial").  null if no successful run exists.
   */
  lastSuccessAt: number | null;
  /**
   * Unix millisecond timestamp of the most recent run regardless of status.
   * null if no runs exist at all.
   */
  lastRunAt: number | null;
  /** Raw status string from the latest pipeline_runs row. */
  lastRunStatus: string | null;
  /** How many items were ingested in the most recent run. */
  lastItemsIngested: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps the raw database status string to the typed PipelineStatus enum.
 * Unrecognised values fall back to "unknown" rather than throwing.
 */
function mapStatus(raw: string | null): PipelineStatus {
  switch (raw) {
    case "ok":
      return "ok";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a snapshot of the pipeline health for use in the dashboard header.
 *
 * Queries:
 *   1. The most recent pipeline_runs row (any status) → latest run summary.
 *   2. The most recent pipeline_runs row with status "ok" or "partial" → last
 *      success timestamp.
 *
 * Both queries use indexed columns (started_at) so they are O(log n).
 * Never throws — returns a safe "unknown" default on any database error.
 */
export async function getPipelineHealth(): Promise<PipelineHealth> {
  const defaultHealth: PipelineHealth = {
    status: "unknown",
    lastSuccessAt: null,
    lastRunAt: null,
    lastRunStatus: null,
    lastItemsIngested: 0,
  };

  try {
    // 1. Most recent run (any status)
    const [latestRun] = await db
      .select({
        status: pipelineRuns.status,
        completedAt: pipelineRuns.completedAt,
        startedAt: pipelineRuns.startedAt,
        itemsIngested: pipelineRuns.itemsIngested,
      })
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1);

    if (!latestRun) {
      // No runs recorded yet — fresh deployment
      return defaultHealth;
    }

    const lastRunAt = latestRun.completedAt ?? latestRun.startedAt;
    const mappedStatus = mapStatus(latestRun.status);

    // 2. Most recent *successful* run (ok | partial)
    // Only query for a separate success row if the latest run itself was not
    // successful — avoids a second round-trip in the common case.
    let lastSuccessAt: number | null = null;

    if (mappedStatus === "ok" || mappedStatus === "partial") {
      lastSuccessAt = lastRunAt;
    } else {
      // Latest run was failed/unknown — look back for the last success
      const [lastSuccess] = await db
        .select({
          completedAt: pipelineRuns.completedAt,
          startedAt: pipelineRuns.startedAt,
        })
        .from(pipelineRuns)
        .where(eq(pipelineRuns.status, "ok"))
        .orderBy(desc(pipelineRuns.startedAt))
        .limit(1);

      if (lastSuccess) {
        lastSuccessAt = lastSuccess.completedAt ?? lastSuccess.startedAt;
      } else {
        // Also check for "partial" runs
        const [lastPartial] = await db
          .select({
            completedAt: pipelineRuns.completedAt,
            startedAt: pipelineRuns.startedAt,
          })
          .from(pipelineRuns)
          .where(eq(pipelineRuns.status, "partial"))
          .orderBy(desc(pipelineRuns.startedAt))
          .limit(1);

        if (lastPartial) {
          lastSuccessAt = lastPartial.completedAt ?? lastPartial.startedAt;
        }
      }
    }

    return {
      status: mappedStatus,
      lastSuccessAt,
      lastRunAt,
      lastRunStatus: latestRun.status,
      lastItemsIngested: latestRun.itemsIngested ?? 0,
    };
  } catch (err) {
    console.error("[health] Failed to query pipeline health:", err);
    return defaultHealth;
  }
}
