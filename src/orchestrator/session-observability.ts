/**
 * Session observability — compaction visualization, subagent execution
 * trees, and token burn rate tracking.
 *
 * Parses Claude Code JSONL session logs to extract:
 * - Compaction events (when context was compressed)
 * - Subagent spawns and completions
 * - Token burn rate over time
 */

// ── Types ──

export interface CompactionEvent {
	timestamp: number;
	tokensBefore: number;
	tokensAfter: number;
	reduction: number; // percentage
}

export interface SubagentNode {
	id: string;
	name: string;
	description: string;
	startTime: number;
	endTime?: number;
	durationMs?: number;
	children: SubagentNode[];
	status: "running" | "completed" | "failed";
}

export interface TokenSnapshot {
	timestamp: number;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	cumulativeCost: number;
}

export interface BurnRate {
	tokensPerMinute: number;
	costPerMinute: number;
	estimatedMinutesRemaining: number;
	contextWindowUsage: number;
}

export interface SessionObservability {
	sessionId: string;
	compactions: CompactionEvent[];
	subagentTree: SubagentNode[];
	snapshots: TokenSnapshot[];
	burnRate: BurnRate | null;
}

// ── Compaction tracking ──

export function trackCompaction(
	tokensBefore: number,
	tokensAfter: number,
): CompactionEvent {
	const reduction =
		tokensBefore > 0
			? ((tokensBefore - tokensAfter) / tokensBefore) * 100
			: 0;

	return {
		timestamp: Date.now(),
		tokensBefore,
		tokensAfter,
		reduction: Math.round(reduction * 10) / 10,
	};
}

export function formatCompactionTimeline(
	events: CompactionEvent[],
): string {
	if (events.length === 0) return "No compaction events.";

	const lines: string[] = ["## Compaction Timeline", ""];
	for (const evt of events) {
		const time = new Date(evt.timestamp).toLocaleTimeString();
		const bar = renderMiniBar(1 - evt.reduction / 100, 10);
		lines.push(
			`${time} │ ${evt.tokensBefore} → ${evt.tokensAfter} │ ${bar} -${evt.reduction}%`,
		);
	}
	return lines.join("\n");
}

// ── Subagent tree ──

export function createSubagentNode(
	id: string,
	name: string,
	description: string,
): SubagentNode {
	return {
		id,
		name,
		description,
		startTime: Date.now(),
		children: [],
		status: "running",
	};
}

export function completeSubagent(
	node: SubagentNode,
	success: boolean,
): SubagentNode {
	node.endTime = Date.now();
	node.durationMs = node.endTime - node.startTime;
	node.status = success ? "completed" : "failed";
	return node;
}

export function formatSubagentTree(
	nodes: SubagentNode[],
	indent: number = 0,
): string {
	const lines: string[] = [];
	const prefix = "  ".repeat(indent);

	for (const node of nodes) {
		const icon =
			node.status === "completed"
				? "✓"
				: node.status === "failed"
					? "✗"
					: "⟳";
		const duration = node.durationMs
			? ` (${(node.durationMs / 1000).toFixed(1)}s)`
			: "";
		lines.push(`${prefix}${icon} ${node.name}${duration}`);
		if (node.description) {
			lines.push(`${prefix}  ${node.description}`);
		}
		if (node.children.length > 0) {
			lines.push(formatSubagentTree(node.children, indent + 1));
		}
	}

	return lines.join("\n");
}

// ── Token burn rate ──

export function calculateBurnRate(
	snapshots: TokenSnapshot[],
	contextWindow: number = 200_000,
): BurnRate | null {
	if (snapshots.length < 2) return null;

	const first = snapshots[0];
	const last = snapshots[snapshots.length - 1];
	const elapsedMs = last.timestamp - first.timestamp;

	if (elapsedMs <= 0) return null;

	const elapsedMinutes = elapsedMs / 60_000;
	const tokenDelta = last.totalTokens - first.totalTokens;
	const costDelta = last.cumulativeCost - first.cumulativeCost;

	const tokensPerMinute = tokenDelta / elapsedMinutes;
	const costPerMinute = costDelta / elapsedMinutes;

	const remainingTokens = contextWindow - last.totalTokens;
	const estimatedMinutesRemaining =
		tokensPerMinute > 0 ? remainingTokens / tokensPerMinute : Infinity;

	return {
		tokensPerMinute: Math.round(tokensPerMinute),
		costPerMinute: Math.round(costPerMinute * 10000) / 10000,
		estimatedMinutesRemaining: Math.round(estimatedMinutesRemaining * 10) / 10,
		contextWindowUsage: Math.round((last.totalTokens / contextWindow) * 1000) / 10,
	};
}

export function formatBurnRate(rate: BurnRate): string {
	const eta =
		rate.estimatedMinutesRemaining === Number.POSITIVE_INFINITY
			? "∞"
			: `${rate.estimatedMinutesRemaining}min`;

	return [
		`Burn: ${rate.tokensPerMinute} tok/min`,
		`Cost: $${rate.costPerMinute.toFixed(4)}/min`,
		`Context: ${rate.contextWindowUsage}%`,
		`ETA to limit: ${eta}`,
	].join(" │ ");
}

// ── Helpers ──

function renderMiniBar(ratio: number, width: number): string {
	const clamped = Math.max(0, Math.min(1, ratio));
	const filled = Math.round(clamped * width);
	return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── Snapshot creation ──

export function createSnapshot(
	inputTokens: number,
	outputTokens: number,
	cumulativeCost: number,
): TokenSnapshot {
	return {
		timestamp: Date.now(),
		inputTokens,
		outputTokens,
		totalTokens: inputTokens + outputTokens,
		cumulativeCost,
	};
}
