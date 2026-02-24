import { db } from "@/lib/db";
import { toolSpotlight } from "@/lib/db/schema";
import { formatRelativeTime, formatDate } from "@/lib/utils/format";
import type { ToolSpotlight as ToolSpotlightType } from "@/types";

/** Known tools in display order with accent colors. */
const TOOL_CONFIG: Record<string, { icon: string; accent: string }> = {
  Cursor: { icon: "⚡", accent: "from-blue-400/40 to-cyan-400/20" },
  Claude: { icon: "🧠", accent: "from-orange-400/40 to-amber-400/20" },
  Devin: { icon: "🤖", accent: "from-purple-400/40 to-violet-400/20" },
  Windsurf: { icon: "🌊", accent: "from-teal-400/40 to-emerald-400/20" },
  "GitHub Copilot": { icon: "✈️", accent: "from-green-400/40 to-lime-400/20" },
};

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
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl" aria-hidden="true">🛠️</span>
          <h2
            id="tool-spotlight-heading"
            className="text-xl font-bold text-gray-100 tracking-tight"
          >
            Tool Spotlight
          </h2>
        </div>
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
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl" aria-hidden="true">🛠️</span>
        <h2
          id="tool-spotlight-heading"
          className="text-xl font-bold text-gray-100 tracking-tight"
        >
          Tool Spotlight
        </h2>
      </div>

      {/* 5-across grid at desktop */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
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
  const config = TOOL_CONFIG[tool.toolName] ?? { icon: "📦", accent: "from-gray-500/20 to-gray-600/10" };

  return (
    <article
      className="glass-card rounded-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300"
      role="listitem"
      data-testid="tool-card"
      aria-label={`${tool.toolName}${tool.currentVersion ? ` ${tool.currentVersion}` : ""}`}
    >
      {/* Gradient accent header */}
      <div className={`h-2 bg-gradient-to-r ${config.accent}`} />

      <div className="p-4">
        {/* Tool name with icon */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg" aria-hidden="true">{config.icon}</span>
          <h3 className="text-sm font-bold text-gray-100 truncate">
            {tool.toolName}
          </h3>
        </div>

        {/* Version */}
        {tool.currentVersion && (
          <p className="text-xs text-brand-400 mb-2 font-[family-name:var(--font-mono)] bg-brand-500/10 inline-block px-2 py-0.5 rounded">
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
        <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-white/10">
          <a
            href={tool.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors truncate focus-visible:outline-none focus-visible:underline"
            data-testid="tool-source-link"
            aria-label={`View ${tool.toolName} changelog`}
          >
            View changelog →
          </a>
          <time
            className="text-xs text-gray-600"
            dateTime={new Date(tool.updatedAt).toISOString()}
            title={`Last checked: ${formatDate(tool.updatedAt)}`}
          >
            Checked {formatRelativeTime(tool.updatedAt)}
          </time>
        </div>
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
