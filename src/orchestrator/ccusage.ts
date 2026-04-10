/**
 * ccusage integration — model pricing and compact statusline format
 * for tmux/zellij status bars. Parses Claude Code JSONL sessions and
 * calculates costs from token counts when costUSD is absent.
 *
 * Pricing source: Anthropic pricing page (May 2025)
 */

import type { TelemetrySession } from "../types/index.js";

// ── Pricing ──

export interface ModelPricing {
	inputPerMTok: number; // $ per million input tokens
	outputPerMTok: number; // $ per million output tokens
	cacheReadPerMTok?: number; // $ per million cache read tokens
	cacheWritePerMTok?: number; // $ per million cache write tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
	"claude-opus-4-6": {
		inputPerMTok: 15,
		outputPerMTok: 75,
		cacheReadPerMTok: 1.5,
		cacheWritePerMTok: 18.75,
	},
	"claude-sonnet-4-6": {
		inputPerMTok: 3,
		outputPerMTok: 15,
		cacheReadPerMTok: 0.3,
		cacheWritePerMTok: 3.75,
	},
	"claude-haiku-4-5": {
		inputPerMTok: 0.8,
		outputPerMTok: 4,
		cacheReadPerMTok: 0.08,
		cacheWritePerMTok: 1,
	},
	// Legacy models
	"claude-sonnet-4-5": {
		inputPerMTok: 3,
		outputPerMTok: 15,
		cacheReadPerMTok: 0.3,
		cacheWritePerMTok: 3.75,
	},
	"claude-3-5-sonnet": {
		inputPerMTok: 3,
		outputPerMTok: 15,
	},
};

export function getModelPricing(model: string): ModelPricing | null {
	// Direct match
	if (MODEL_PRICING[model]) return MODEL_PRICING[model];

	// Fuzzy match: strip version suffixes like -20251001
	for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
		if (model.startsWith(key)) return pricing;
	}

	return null;
}

// ── Cost calculation ──

export function calculateSessionCost(session: TelemetrySession): number {
	// If session already has cost from JSONL, use it
	if (session.totalCost > 0) return session.totalCost;

	const pricing = getModelPricing(session.model);
	if (!pricing) return 0;

	let cost = 0;
	cost += (session.inputTokens / 1_000_000) * pricing.inputPerMTok;
	cost += (session.outputTokens / 1_000_000) * pricing.outputPerMTok;

	if (pricing.cacheReadPerMTok && session.cacheReadTokens) {
		cost += (session.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMTok;
	}
	if (pricing.cacheWritePerMTok && session.cacheWriteTokens) {
		cost += (session.cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMTok;
	}

	return Math.round(cost * 10000) / 10000; // 4 decimal places
}

// ── Period cost ──

export interface PeriodCost {
	period: string; // "today", "this-week", "this-month"
	sessions: number;
	inputTokens: number;
	outputTokens: number;
	totalCost: number;
}

export function calculatePeriodCosts(
	sessions: TelemetrySession[],
): PeriodCost[] {
	const now = new Date();
	const todayStr = now.toISOString().slice(0, 10);
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

	const periods: Record<string, PeriodCost> = {
		today: {
			period: "today",
			sessions: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
		},
		"this-week": {
			period: "this-week",
			sessions: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
		},
		"this-month": {
			period: "this-month",
			sessions: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
		},
	};

	for (const session of sessions) {
		if (!session.startTime) continue;
		const sessionDate = new Date(session.startTime);
		const cost = calculateSessionCost(session);

		// This month
		if (sessionDate >= monthStart) {
			const p = periods["this-month"]!;
			p.sessions++;
			p.inputTokens += session.inputTokens;
			p.outputTokens += session.outputTokens;
			p.totalCost += cost;
		}

		// This week
		if (sessionDate >= weekAgo) {
			const p = periods["this-week"]!;
			p.sessions++;
			p.inputTokens += session.inputTokens;
			p.outputTokens += session.outputTokens;
			p.totalCost += cost;
		}

		// Today
		if (sessionDate.toISOString().slice(0, 10) === todayStr) {
			const p = periods["today"]!;
			p.sessions++;
			p.inputTokens += session.inputTokens;
			p.outputTokens += session.outputTokens;
			p.totalCost += cost;
		}
	}

	// Round costs
	for (const p of Object.values(periods)) {
		p.totalCost = Math.round(p.totalCost * 100) / 100;
	}

	return [periods["today"]!, periods["this-week"]!, periods["this-month"]!];
}

// ── Statusline ──

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
}

function formatCost(n: number): string {
	if (n >= 10) return `$${n.toFixed(0)}`;
	if (n >= 1) return `$${n.toFixed(1)}`;
	return `$${n.toFixed(2)}`;
}

/**
 * Generate a compact statusline string for tmux/zellij:
 * "🤖 $4.20 │ 2.1M tok │ 5 sessions"
 */
export function formatStatusline(todayCost: PeriodCost): string {
	const cost = formatCost(todayCost.totalCost);
	const tokens = formatTokens(todayCost.inputTokens + todayCost.outputTokens);
	return `🤖 ${cost} │ ${tokens} tok │ ${todayCost.sessions} sess`;
}
