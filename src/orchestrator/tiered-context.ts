/**
 * Tiered context loading — always-on lightweight context (~2K tokens)
 * plus on-demand semantic search for specific queries. Avoids dumping
 * everything into CLAUDE.md.
 *
 * Tier 1 (always loaded, ~2K tokens):
 *   - Project name + tech stack
 *   - Active tasks summary
 *   - Recent decisions (last 5)
 *   - Git branch + last commit
 *
 * Tier 2 (on-demand, loaded when relevant):
 *   - Full project memory
 *   - Specific skill content
 *   - Historical decisions
 */

// ── Types ──

export interface TierOneContext {
	project: string;
	stack: string;
	branch: string;
	lastCommit: string;
	activeTasks: string[];
	recentDecisions: string[];
	tokenEstimate: number;
}

export interface TierTwoQuery {
	query: string;
	source: "memory" | "skills" | "history";
}

export interface TieredContextConfig {
	maxTierOneTokens: number;
	maxRecentDecisions: number;
	maxActiveTasks: number;
}

// ── Defaults ──

export const DEFAULT_CONFIG: TieredContextConfig = {
	maxTierOneTokens: 2000,
	maxRecentDecisions: 5,
	maxActiveTasks: 3,
};

// ── Token estimation ──

function estimateTokens(text: string): number {
	return Math.max(1, Math.ceil(text.length / 4));
}

// ── Tier 1 builder ──

export function buildTierOne(params: {
	project: string;
	stack: string;
	branch: string;
	lastCommit: string;
	activeTasks: string[];
	recentDecisions: string[];
	config?: TieredContextConfig;
}): TierOneContext {
	const config = params.config ?? DEFAULT_CONFIG;

	// Truncate to limits
	const tasks = params.activeTasks.slice(0, config.maxActiveTasks);
	const decisions = params.recentDecisions.slice(0, config.maxRecentDecisions);

	const ctx: TierOneContext = {
		project: params.project,
		stack: params.stack,
		branch: params.branch,
		lastCommit: params.lastCommit,
		activeTasks: tasks,
		recentDecisions: decisions,
		tokenEstimate: 0,
	};

	ctx.tokenEstimate = estimateTokens(formatTierOne(ctx));

	// If over budget, trim decisions first, then tasks
	while (
		ctx.tokenEstimate > config.maxTierOneTokens &&
		ctx.recentDecisions.length > 1
	) {
		ctx.recentDecisions.pop();
		ctx.tokenEstimate = estimateTokens(formatTierOne(ctx));
	}
	while (
		ctx.tokenEstimate > config.maxTierOneTokens &&
		ctx.activeTasks.length > 1
	) {
		ctx.activeTasks.pop();
		ctx.tokenEstimate = estimateTokens(formatTierOne(ctx));
	}

	return ctx;
}

// ── Formatting ──

export function formatTierOne(ctx: TierOneContext): string {
	const lines: string[] = [];
	lines.push(`Project: ${ctx.project} (${ctx.stack})`);
	lines.push(`Branch: ${ctx.branch} | Last: ${ctx.lastCommit}`);

	if (ctx.activeTasks.length > 0) {
		lines.push("Tasks:");
		for (const t of ctx.activeTasks) lines.push(`  - ${t}`);
	}

	if (ctx.recentDecisions.length > 0) {
		lines.push("Recent decisions:");
		for (const d of ctx.recentDecisions) lines.push(`  - ${d}`);
	}

	return lines.join("\n");
}

// ── Tier 2 routing ──

export function shouldLoadTierTwo(message: string): TierTwoQuery | null {
	const lower = message.toLowerCase();

	// History queries (check BEFORE memory — "last time" is more specific)
	if (
		lower.includes("last time") ||
		lower.includes("previously") ||
		lower.includes("before we") ||
		lower.includes("history")
	) {
		return { query: message, source: "history" };
	}

	// Memory queries
	if (
		lower.includes("remember") ||
		lower.includes("recall") ||
		lower.includes("what did we") ||
		lower.includes("acordate") ||
		lower.includes("qué hicimos")
	) {
		return { query: message, source: "memory" };
	}

	// Skill queries
	if (
		lower.includes("how does") ||
		lower.includes("skill") ||
		lower.includes("convention") ||
		lower.includes("pattern")
	) {
		return { query: message, source: "skills" };
	}

	return null;
}
