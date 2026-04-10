/**
 * Growth analysis — analyze session logs to identify repeated patterns,
 * common mistakes, and skill gaps for developer improvement.
 */

import type { TelemetrySession } from "../types/index.js";

// ── Types ──

export interface GrowthInsight {
	category: "strength" | "weakness" | "pattern" | "recommendation";
	description: string;
	evidence: string;
	frequency: number; // how often observed
}

export interface GrowthReport {
	period: string;
	sessionsAnalyzed: number;
	insights: GrowthInsight[];
	topTools: Array<{ tool: string; count: number }>;
	topModels: Array<{ model: string; count: number }>;
	averageSessionMinutes: number;
	totalTokens: number;
}

// ── Analysis ──

export function analyzeGrowth(
	sessions: TelemetrySession[],
	period: string = "all-time",
): GrowthReport {
	if (sessions.length === 0) {
		return {
			period,
			sessionsAnalyzed: 0,
			insights: [],
			topTools: [],
			topModels: [],
			averageSessionMinutes: 0,
			totalTokens: 0,
		};
	}

	const insights: GrowthInsight[] = [];

	// Aggregate tool usage
	const toolCounts: Record<string, number> = {};
	const modelCounts: Record<string, number> = {};
	let totalMinutes = 0;
	let totalTokens = 0;

	for (const session of sessions) {
		totalMinutes += session.durationMinutes;
		totalTokens += session.inputTokens + session.outputTokens;
		modelCounts[session.model] = (modelCounts[session.model] ?? 0) + 1;
		for (const [tool, count] of Object.entries(session.toolCalls)) {
			toolCounts[tool] = (toolCounts[tool] ?? 0) + count;
		}
	}

	// Top tools
	const topTools = Object.entries(toolCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([tool, count]) => ({ tool, count }));

	// Top models
	const topModels = Object.entries(modelCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([model, count]) => ({ model, count }));

	// Pattern detection
	const avgMinutes = totalMinutes / sessions.length;

	// Long sessions pattern
	const longSessions = sessions.filter(
		(s) => s.durationMinutes > avgMinutes * 2,
	);
	if (longSessions.length > sessions.length * 0.2) {
		insights.push({
			category: "pattern",
			description: "Frequent long sessions detected",
			evidence: `${longSessions.length}/${sessions.length} sessions are over ${Math.round(avgMinutes * 2)}min`,
			frequency: longSessions.length,
		});
	}

	// Heavy Read tool usage (might indicate not reading code before editing)
	const readCount = toolCounts["Read"] ?? 0;
	const editCount = toolCounts["Edit"] ?? 0;
	if (readCount > 0 && editCount > 0) {
		const readEditRatio = readCount / editCount;
		if (readEditRatio < 1) {
			insights.push({
				category: "weakness",
				description:
					"More edits than reads — may be editing without understanding",
				evidence: `Read:Edit ratio is ${readEditRatio.toFixed(1)} (${readCount} reads, ${editCount} edits)`,
				frequency: editCount,
			});
		} else if (readEditRatio > 3) {
			insights.push({
				category: "strength",
				description: "Good read-before-edit discipline",
				evidence: `Read:Edit ratio is ${readEditRatio.toFixed(1)} — reading before modifying`,
				frequency: readCount,
			});
		}
	}

	// Bash overuse (might indicate not using dedicated tools)
	const bashCount = toolCounts["Bash"] ?? 0;
	const grepCount = toolCounts["Grep"] ?? 0;
	const globCount = toolCounts["Glob"] ?? 0;
	if (bashCount > (grepCount + globCount) * 3 && bashCount > 50) {
		insights.push({
			category: "recommendation",
			description: "High Bash usage — consider using dedicated Grep/Glob tools",
			evidence: `${bashCount} Bash calls vs ${grepCount + globCount} Grep+Glob calls`,
			frequency: bashCount,
		});
	}

	// Model diversity
	if (topModels.length === 1 && sessions.length > 10) {
		insights.push({
			category: "recommendation",
			description:
				"Using only one model — consider trying different models for different tasks",
			evidence: `All ${sessions.length} sessions used ${topModels[0]!.model}`,
			frequency: sessions.length,
		});
	}

	return {
		period,
		sessionsAnalyzed: sessions.length,
		insights,
		topTools,
		topModels,
		averageSessionMinutes: Math.round(avgMinutes),
		totalTokens,
	};
}

// ── Formatting ──

export function formatGrowthReport(report: GrowthReport): string {
	const lines: string[] = [];
	lines.push(`## Growth Analysis (${report.period})\n`);
	lines.push(
		`**Sessions**: ${report.sessionsAnalyzed} | **Avg duration**: ${report.averageSessionMinutes}min | **Tokens**: ${formatTokens(report.totalTokens)}\n`,
	);

	if (report.topTools.length > 0) {
		lines.push("### Top Tools");
		for (const t of report.topTools.slice(0, 5)) {
			lines.push(`  ${t.tool}: ${t.count} calls`);
		}
		lines.push("");
	}

	if (report.insights.length > 0) {
		lines.push("### Insights");
		for (const i of report.insights) {
			const icon = {
				strength: "💪",
				weakness: "⚠️",
				pattern: "📊",
				recommendation: "💡",
			}[i.category];
			lines.push(`${icon} **${i.description}**`);
			lines.push(`  ${i.evidence}`);
		}
		lines.push("");
	} else {
		lines.push("No notable patterns detected yet. Keep coding!\n");
	}

	return lines.join("\n");
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
}
