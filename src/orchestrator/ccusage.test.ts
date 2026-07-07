import { describe, expect, it } from "vitest";
import type { TelemetrySession } from "../types/index.js";
import {
	calculatePeriodCosts,
	calculateSessionCost,
	formatStatusline,
	getModelPricing,
	MODEL_PRICING,
} from "./ccusage.js";

function makeSession(
	overrides: Partial<TelemetrySession> = {},
): TelemetrySession {
	return {
		sessionId: "test-session",
		projectDir: "test-project",
		startTime: Date.now(),
		endTime: Date.now() + 60000,
		durationMinutes: 1,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalCost: 0,
		model: "claude-sonnet-4-6",
		toolCalls: {},
		messageCount: 1,
		...overrides,
	};
}

// ── getModelPricing ──

describe("getModelPricing", () => {
	it("returns pricing for known model", () => {
		const p = getModelPricing("claude-sonnet-4-6");
		expect(p).not.toBeNull();
		expect(p!.inputPerMTok).toBe(3);
		expect(p!.outputPerMTok).toBe(15);
	});

	it("fuzzy matches model with version suffix", () => {
		const p = getModelPricing("claude-haiku-4-5-20251001");
		expect(p).not.toBeNull();
		expect(p!.inputPerMTok).toBe(0.8);
	});

	it("returns null for unknown model", () => {
		expect(getModelPricing("gpt-4o")).toBeNull();
	});

	it("has pricing for opus, sonnet, haiku", () => {
		expect(MODEL_PRICING["claude-opus-4-6"]).toBeDefined();
		expect(MODEL_PRICING["claude-sonnet-4-6"]).toBeDefined();
		expect(MODEL_PRICING["claude-haiku-4-5"]).toBeDefined();
	});
});

// ── calculateSessionCost ──

describe("calculateSessionCost", () => {
	it("uses totalCost from JSONL when available", () => {
		const session = makeSession({ totalCost: 1.5 });
		expect(calculateSessionCost(session)).toBe(1.5);
	});

	it("calculates from tokens when no costUSD", () => {
		const session = makeSession({
			inputTokens: 1_000_000,
			outputTokens: 100_000,
			model: "claude-sonnet-4-6",
		});
		// 1M input * $3/M + 100K output * $15/M = $3 + $1.5 = $4.5
		const cost = calculateSessionCost(session);
		expect(cost).toBeCloseTo(4.5, 1);
	});

	it("includes cache costs when available", () => {
		const session = makeSession({
			inputTokens: 500_000,
			outputTokens: 50_000,
			cacheReadTokens: 200_000,
			cacheWriteTokens: 100_000,
			model: "claude-sonnet-4-6",
		});
		// input: 0.5M * $3 = $1.5
		// output: 0.05M * $15 = $0.75
		// cache read: 0.2M * $0.3 = $0.06
		// cache write: 0.1M * $3.75 = $0.375
		const cost = calculateSessionCost(session);
		expect(cost).toBeCloseTo(2.685, 2);
	});

	it("returns 0 for unknown model without costUSD", () => {
		const session = makeSession({ model: "unknown-model" });
		expect(calculateSessionCost(session)).toBe(0);
	});

	it("opus costs more than sonnet", () => {
		const base = { inputTokens: 1_000_000, outputTokens: 100_000 };
		const opusCost = calculateSessionCost(
			makeSession({ ...base, model: "claude-opus-4-6" }),
		);
		const sonnetCost = calculateSessionCost(
			makeSession({ ...base, model: "claude-sonnet-4-6" }),
		);
		expect(opusCost).toBeGreaterThan(sonnetCost);
	});
});

// ── calculatePeriodCosts ──

describe("calculatePeriodCosts", () => {
	it("returns today, this-week, this-month", () => {
		const periods = calculatePeriodCosts([]);
		expect(periods).toHaveLength(3);
		expect(periods[0]!.period).toBe("today");
		expect(periods[1]!.period).toBe("this-week");
		expect(periods[2]!.period).toBe("this-month");
	});

	it("counts today's sessions", () => {
		// The implementation buckets "today" by UTC date via
		// `toISOString().slice(0, 10)`, so using local-day arithmetic here is a
		// footgun. The most stable assertion is simply two sessions at the same
		// current timestamp — guaranteed same UTC day.
		const now = Date.now();
		const sessions = [
			makeSession({ startTime: now, inputTokens: 1000, totalCost: 0.5 }),
			makeSession({
				startTime: now,
				inputTokens: 2000,
				totalCost: 1.0,
			}),
		];
		const periods = calculatePeriodCosts(sessions);
		expect(periods[0]!.sessions).toBe(2);
		expect(periods[0]!.totalCost).toBe(1.5);
	});

	it("excludes old sessions from today", () => {
		const yesterday = Date.now() - 2 * 24 * 60 * 60 * 1000;
		const sessions = [
			makeSession({ startTime: Date.now(), totalCost: 1 }),
			makeSession({ startTime: yesterday, totalCost: 5 }),
		];
		const periods = calculatePeriodCosts(sessions);
		expect(periods[0]!.sessions).toBe(1); // today
		expect(periods[0]!.totalCost).toBe(1);
	});

	it("accumulates tokens across sessions", () => {
		const sessions = [
			makeSession({
				startTime: Date.now(),
				inputTokens: 500,
				outputTokens: 100,
			}),
			makeSession({
				startTime: Date.now(),
				inputTokens: 300,
				outputTokens: 200,
			}),
		];
		const today = calculatePeriodCosts(sessions)[0]!;
		expect(today.inputTokens).toBe(800);
		expect(today.outputTokens).toBe(300);
	});
});

// ── formatStatusline ──

describe("formatStatusline", () => {
	it("formats compact statusline", () => {
		const line = formatStatusline({
			period: "today",
			sessions: 5,
			inputTokens: 2_100_000,
			outputTokens: 300_000,
			totalCost: 4.2,
		});
		expect(line).toContain("$4.2");
		expect(line).toContain("2.4M tok");
		expect(line).toContain("5 sess");
	});

	it("formats zero cost", () => {
		const line = formatStatusline({
			period: "today",
			sessions: 0,
			inputTokens: 0,
			outputTokens: 0,
			totalCost: 0,
		});
		expect(line).toContain("$0.00");
		expect(line).toContain("0 tok");
		expect(line).toContain("0 sess");
	});

	it("formats large costs without decimals", () => {
		const line = formatStatusline({
			period: "today",
			sessions: 50,
			inputTokens: 100_000_000,
			outputTokens: 10_000_000,
			totalCost: 42,
		});
		expect(line).toContain("$42");
	});

	it("formats K tokens", () => {
		const line = formatStatusline({
			period: "today",
			sessions: 1,
			inputTokens: 50_000,
			outputTokens: 5_000,
			totalCost: 0.5,
		});
		expect(line).toContain("55K tok");
	});
});
