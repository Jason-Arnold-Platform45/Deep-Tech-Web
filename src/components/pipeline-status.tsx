import { db } from "@/lib/db";
import { pipelineRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { formatRelativeTime } from "@/lib/utils/format";
import type { PipelineStatus } from "@/types";

const STATUS_CONFIG: Record<
  PipelineStatus,
  { color: string; dot: string; label: string; glow: string }
> = {
  success: {
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    label: "Healthy",
    glow: "shadow-[0_0_6px_rgba(52,211,153,0.4)]",
  },
  partial: {
    color: "text-amber-400",
    dot: "bg-amber-400",
    label: "Partial",
    glow: "shadow-[0_0_6px_rgba(251,191,36,0.4)]",
  },
  running: {
    color: "text-brand-400",
    dot: "bg-brand-400",
    label: "Running",
    glow: "shadow-[0_0_6px_rgba(129,140,248,0.4)]",
  },
  failed: {
    color: "text-red-400",
    dot: "bg-red-400",
    label: "Failed",
    glow: "shadow-[0_0_6px_rgba(248,113,113,0.4)]",
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
        className={`inline-block w-2 h-2 rounded-full ${config.dot} ${config.glow}`}
        aria-hidden="true"
      />
      <span className={config.color}>{config.label}</span>
      <span className="text-gray-500" aria-label={refreshedLabel}>
        &mdash; {refreshedLabel}
      </span>
      {lastRun.sourcesFailed != null && lastRun.sourcesFailed > 0 && (
        <span
          className="text-amber-500 text-xs"
          aria-label={`${lastRun.sourcesFailed} source(s) failed`}
        >
          ({lastRun.sourcesFailed} source{lastRun.sourcesFailed !== 1 ? "s" : ""} failed)
        </span>
      )}
    </div>
  );
}
