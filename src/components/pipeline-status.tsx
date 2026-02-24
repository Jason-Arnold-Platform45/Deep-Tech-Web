import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { formatRelativeTime } from "@/lib/utils/format";
import type { PipelineStatus } from "@/types";

const STATUS_CONFIG: Record<
  PipelineStatus,
  { color: string; dot: string; label: string }
> = {
  success: {
    color: "text-green-400",
    dot: "bg-green-400",
    label: "Healthy",
  },
  partial: {
    color: "text-yellow-400",
    dot: "bg-yellow-400",
    label: "Partial",
  },
  running: {
    color: "text-blue-400",
    dot: "bg-blue-400",
    label: "Running",
  },
  failed: {
    color: "text-red-400",
    dot: "bg-red-400",
    label: "Failed",
  },
};

/**
 * Pipeline health indicator — shows the status of the most recent pipeline run.
 * Server Component: reads directly from DB.
 */
export async function PipelineStatus() {
  let lastRun: {
    status: string;
    completedAt: number | null;
    sourcesSucceeded: number | null;
    sourcesFailed: number | null;
  } | null = null;

  try {
    const rows = await db
      .select({
        status: pipelineRuns.status,
        completedAt: pipelineRuns.completedAt,
        sourcesSucceeded: pipelineRuns.sourcesSucceeded,
        sourcesFailed: pipelineRuns.sourcesFailed,
      })
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1);

    lastRun = rows[0] ?? null;
  } catch {
    // DB not available — degrade gracefully.
  }

  if (!lastRun) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-gray-500"
        data-testid="pipeline-status"
        aria-label="Pipeline status: no data"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-gray-600" aria-hidden="true" />
        <span>Pipeline not yet run</span>
      </div>
    );
  }

  const status = lastRun.status as PipelineStatus;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.failed;
  const refreshedLabel = lastRun.completedAt
    ? `Last refreshed ${formatRelativeTime(lastRun.completedAt)}`
    : "Refresh in progress";

  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-testid="pipeline-status"
      aria-label={`Pipeline status: ${config.label}`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${config.dot}`}
        aria-hidden="true"
      />
      <span className={config.color}>{config.label}</span>
      <span className="text-gray-500" aria-label={refreshedLabel}>
        &mdash; {refreshedLabel}
      </span>
      {lastRun.sourcesFailed != null && lastRun.sourcesFailed > 0 && (
        <span
          className="text-yellow-500 text-xs"
          aria-label={`${lastRun.sourcesFailed} source(s) failed`}
        >
          ({lastRun.sourcesFailed} source{lastRun.sourcesFailed !== 1 ? "s" : ""} failed)
        </span>
      )}
    </div>
  );
}
