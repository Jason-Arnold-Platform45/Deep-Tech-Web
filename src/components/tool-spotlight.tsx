import { db } from "@/lib/db";
import { toolSpotlight } from "@/lib/db/schema";
import { formatRelativeTime, formatDate } from "@/lib/utils/format";
import type { ToolSpotlight as ToolSpotlightType } from "@/types";

/** Known tools in display order. */
const KNOWN_TOOLS = [
  "Cursor",
  "Claude",
  "Devin",
  "Windsurf",
  "GitHub Copilot",
];

interface ToolSpotlightProps {
  tools: ToolSpotlightType[];
}

/**
 * Tool Spotlight strip — shows the 5 main agentic coding tools with their
 * latest version info and key changes.
 * Server Component: data passed from parent page.
 */
export function ToolSpotlight({ tools }: ToolSpotlightProps) {
  if (tools.length === 0) {
    return (
      <section
        aria-labelledby="tool-spotlight-heading"
        data-testid="tool-spotlight"
      >
        <h2
          id="tool-spotlight-heading"
          className="text-xl font-bold text-gray-100 mb-4"
        >
          Tool Spotlight
        </h2>
        <p className="text-sm text-gray-500">
          Tool data will appear after the first pipeline run.
        </p>
      </section>
    );
  }

  // Sort tools by the KNOWN_TOOLS order, append any extras alphabetically.
  const sorted = [...tools].sort((a, b) => {
    const ai = KNOWN_TOOLS.indexOf(a.toolName);
    const bi = KNOWN_TOOLS.indexOf(b.toolName);
    if (ai === -1 && bi === -1) return a.toolName.localeCompare(b.toolName);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <section
      aria-labelledby="tool-spotlight-heading"
      data-testid="tool-spotlight"
    >
      <h2
        id="tool-spotlight-heading"
        className="text-xl font-bold text-gray-100 mb-4"
      >
        Tool Spotlight
      </h2>

      {/* Horizontal scrolling strip */}
      <div
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
        role="list"
      >
        {sorted.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}

interface ToolCardProps {
  tool: ToolSpotlightType;
}

function ToolCard({ tool }: ToolCardProps) {
  return (
    <article
      className="flex-none w-56 bg-gray-900 border border-gray-800 rounded-xl p-4 snap-start hover:border-gray-700 transition-colors"
      role="listitem"
      data-testid="tool-card"
      aria-label={`${tool.toolName}${tool.currentVersion ? ` ${tool.currentVersion}` : ""}`}
    >
      {/* Tool name */}
      <h3 className="text-sm font-bold text-gray-100 mb-1 truncate">
        {tool.toolName}
      </h3>

      {/* Version */}
      {tool.currentVersion && (
        <p className="text-xs text-blue-400 mb-2 font-mono">
          {tool.currentVersion}
        </p>
      )}

      {/* Key change summary */}
      {tool.keyChange && (
        <p className="text-xs text-gray-400 line-clamp-3 mb-3">
          {tool.keyChange}
        </p>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-1 mt-auto pt-2 border-t border-gray-800">
        <a
          href={tool.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 transition-colors truncate focus-visible:outline-none focus-visible:underline"
          data-testid="tool-source-link"
          aria-label={`View ${tool.toolName} changelog`}
        >
          View changelog
        </a>
        <time
          className="text-xs text-gray-600"
          dateTime={new Date(tool.updatedAt).toISOString()}
          title={`Last checked: ${formatDate(tool.updatedAt)}`}
        >
          Checked {formatRelativeTime(tool.updatedAt)}
        </time>
      </div>
    </article>
  );
}

/**
 * Standalone async loader — fetches all tool spotlight records.
 */
export async function fetchToolSpotlight(): Promise<ToolSpotlightType[]> {
  try {
    const rows = await db.select().from(toolSpotlight);
    return rows as unknown as ToolSpotlightType[];
  } catch {
    return [];
  }
}
