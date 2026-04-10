/**
 * Token progress bar statusline — rich visual status for tmux/zellij
 * showing model, git branch, token usage bar, and cost.
 *
 * Format: "opus │ main │ [████░░░░] 45% │ $4.20"
 */

import { execSync } from "node:child_process";

// ── Context window sizes (tokens) per model family ──

export const CONTEXT_WINDOWS: Record<string, number> = {
	"claude-opus-4-6": 200_000,
	"claude-sonnet-4-6": 200_000,
	"claude-haiku-4-5": 200_000,
	"claude-sonnet-4-5": 200_000,
	"claude-3-5-sonnet": 200_000,
	"claude-3-opus": 200_000,
	"claude-3-haiku": 200_000,
	// Extended context (1M)
	"claude-opus-4-6[1m]": 1_000_000,
	"claude-sonnet-4-6[1m]": 1_000_000,
};

export function getContextWindow(model: string): number {
	if (CONTEXT_WINDOWS[model]) return CONTEXT_WINDOWS[model];
	// Fuzzy: match prefix
	for (const [key, size] of Object.entries(CONTEXT_WINDOWS)) {
		if (model.startsWith(key)) return size;
	}
	return 200_000; // safe default
}

// ── Model short name ──

export function shortModelName(model: string): string {
	if (model.includes("opus")) return "opus";
	if (model.includes("sonnet")) return "sonnet";
	if (model.includes("haiku")) return "haiku";
	return model.split("-").pop() ?? model;
}

// ── Git branch ──

export function getCurrentBranch(): string {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
			encoding: "utf-8",
			timeout: 2000,
		}).trim();
	} catch {
		return "";
	}
}

// ── Progress bar ──

export interface ProgressBarOptions {
	width: number;
	fillChar: string;
	emptyChar: string;
}

const DEFAULT_BAR: ProgressBarOptions = {
	width: 8,
	fillChar: "█",
	emptyChar: "░",
};

export function renderProgressBar(
	ratio: number,
	options: Partial<ProgressBarOptions> = {},
): string {
	const opts = { ...DEFAULT_BAR, ...options };
	const clamped = Math.max(0, Math.min(1, ratio));
	const filled = Math.round(clamped * opts.width);
	const empty = opts.width - filled;
	return `[${opts.fillChar.repeat(filled)}${opts.emptyChar.repeat(empty)}]`;
}

// ── Statusline ──

export interface StatuslineInput {
	model: string;
	inputTokens: number;
	outputTokens: number;
	totalCost: number;
	contextWindow?: number;
}

export function formatTokenStatusline(input: StatuslineInput): string {
	const model = shortModelName(input.model);
	const branch = getCurrentBranch();
	const totalTokens = input.inputTokens + input.outputTokens;
	const ctxWindow = input.contextWindow ?? getContextWindow(input.model);
	const ratio = totalTokens / ctxWindow;
	const percent = Math.round(ratio * 100);
	const bar = renderProgressBar(ratio);
	const cost =
		input.totalCost >= 10
			? `$${input.totalCost.toFixed(0)}`
			: input.totalCost >= 1
				? `$${input.totalCost.toFixed(1)}`
				: `$${input.totalCost.toFixed(2)}`;

	const parts = [model];
	if (branch) parts.push(branch);
	parts.push(`${bar} ${percent}%`);
	parts.push(cost);

	return parts.join(" │ ");
}

// ── Threshold alerts ──

export type UsageLevel = "normal" | "warning" | "critical";

export function getUsageLevel(ratio: number): UsageLevel {
	if (ratio >= 0.9) return "critical";
	if (ratio >= 0.7) return "warning";
	return "normal";
}

/**
 * Get a tmux-compatible color code for the usage level.
 */
export function tmuxColor(level: UsageLevel): string {
	switch (level) {
		case "critical":
			return "#[fg=red]";
		case "warning":
			return "#[fg=yellow]";
		case "normal":
			return "#[fg=green]";
	}
}

/**
 * Full tmux statusline with color based on usage level.
 */
export function formatTmuxStatusline(input: StatuslineInput): string {
	const totalTokens = input.inputTokens + input.outputTokens;
	const ctxWindow = input.contextWindow ?? getContextWindow(input.model);
	const ratio = totalTokens / ctxWindow;
	const level = getUsageLevel(ratio);
	const color = tmuxColor(level);
	const reset = "#[default]";
	const line = formatTokenStatusline(input);
	return `${color}${line}${reset}`;
}
