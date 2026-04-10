import { describe, expect, it } from "vitest";
import type { TelemetrySession } from "../types/index.js";
import { analyzeGrowth, formatGrowthReport } from "./growth-analysis.js";

function makeSession(
	overrides: Partial<TelemetrySession> = {},
): TelemetrySession {
	return {
		sessionId: "s1",
		projectDir: "test",
		startTime: Date.now(),
		endTime: Date.now() + 60_000,
		durationMinutes: 30,
		inputTokens: 5000,
		outputTokens: 1000,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalCost: 0,
		model: "claude-sonnet-4-6",
		toolCalls: { Read: 10, Edit: 5, Bash: 3, Grep: 2 },
		messageCount: 20,
		...overrides,
	};
}

describe("analyzeGrowth", () => {
	it("handles empty sessions", () => {
		const report = analyzeGrowth([]);
		expect(report.sessionsAnalyzed).toBe(0);
		expect(report.insights).toHaveLength(0);
	});

	it("calculates average session duration", () => {
		const sessions = [
			makeSession({ durationMinutes: 20 }),
			makeSession({ durationMinutes: 40 }),
		];
		const report = analyzeGrowth(sessions);
		expect(report.averageSessionMinutes).toBe(30);
	});

	it("aggregates total tokens", () => {
		const sessions = [
			makeSession({ inputTokens: 1000, outputTokens: 500 }),
			makeSession({ inputTokens: 2000, outputTokens: 1000 }),
		];
		const report = analyzeGrowth(sessions);
		expect(report.totalTokens).toBe(4500);
	});

	it("ranks top tools", () => {
		const sessions = [
			makeSession({ toolCalls: { Read: 50, Edit: 20, Bash: 5 } }),
			makeSession({ toolCalls: { Read: 30, Edit: 10, Grep: 15 } }),
		];
		const report = analyzeGrowth(sessions);
		expect(report.topTools[0]!.tool).toBe("Read");
		expect(report.topTools[0]!.count).toBe(80);
	});

	it("detects good read:edit ratio", () => {
		const sessions = [makeSession({ toolCalls: { Read: 100, Edit: 20 } })];
		const report = analyzeGrowth(sessions);
		const strength = report.insights.find((i) => i.category === "strength");
		expect(strength).toBeDefined();
		expect(strength!.description).toContain("read-before-edit");
	});

	it("detects poor read:edit ratio", () => {
		const sessions = [makeSession({ toolCalls: { Read: 5, Edit: 20 } })];
		const report = analyzeGrowth(sessions);
		const weakness = report.insights.find((i) => i.category === "weakness");
		expect(weakness).toBeDefined();
		expect(weakness!.description).toContain("More edits than reads");
	});

	it("detects single model usage", () => {
		const sessions = Array(15)
			.fill(null)
			.map(() => makeSession({ model: "claude-opus-4-6" }));
		const report = analyzeGrowth(sessions);
		const rec = report.insights.find(
			(i) => i.category === "recommendation" && i.description.includes("model"),
		);
		expect(rec).toBeDefined();
	});
});

describe("formatGrowthReport", () => {
	it("produces readable output", () => {
		const sessions = [makeSession(), makeSession()];
		const report = analyzeGrowth(sessions, "this-week");
		const text = formatGrowthReport(report);
		expect(text).toContain("Growth Analysis");
		expect(text).toContain("this-week");
		expect(text).toContain("Top Tools");
	});

	it("handles no insights", () => {
		const report = analyzeGrowth([makeSession()]);
		const text = formatGrowthReport(report);
		expect(text).toContain("No notable patterns");
	});
});
