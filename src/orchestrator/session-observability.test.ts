import { describe, expect, it } from "vitest";
import {
	calculateBurnRate,
	completeSubagent,
	createSnapshot,
	createSubagentNode,
	formatBurnRate,
	formatCompactionTimeline,
	formatSubagentTree,
	trackCompaction,
} from "./session-observability.js";
import type { TokenSnapshot } from "./session-observability.js";

describe("trackCompaction", () => {
	it("calculates reduction percentage", () => {
		const event = trackCompaction(100_000, 40_000);
		expect(event.reduction).toBe(60);
		expect(event.tokensBefore).toBe(100_000);
		expect(event.tokensAfter).toBe(40_000);
	});

	it("handles zero tokens before", () => {
		const event = trackCompaction(0, 0);
		expect(event.reduction).toBe(0);
	});

	it("includes timestamp", () => {
		const before = Date.now();
		const event = trackCompaction(50_000, 20_000);
		expect(event.timestamp).toBeGreaterThanOrEqual(before);
	});
});

describe("formatCompactionTimeline", () => {
	it("formats empty timeline", () => {
		expect(formatCompactionTimeline([])).toBe("No compaction events.");
	});

	it("formats events with bars", () => {
		const events = [
			trackCompaction(100_000, 40_000),
			trackCompaction(80_000, 30_000),
		];
		const output = formatCompactionTimeline(events);
		expect(output).toContain("## Compaction Timeline");
		expect(output).toContain("100");
		expect(output).toContain("40");
		expect(output).toContain("-60%");
	});
});

describe("subagent tree", () => {
	it("creates a running node", () => {
		const node = createSubagentNode("a1", "explore", "Investigate codebase");
		expect(node.status).toBe("running");
		expect(node.name).toBe("explore");
		expect(node.children).toEqual([]);
	});

	it("completes a node with duration", () => {
		const node = createSubagentNode("a1", "explore", "Investigate");
		// Simulate time passing
		node.startTime = Date.now() - 5000;
		completeSubagent(node, true);

		expect(node.status).toBe("completed");
		expect(node.durationMs).toBeGreaterThanOrEqual(4900);
	});

	it("marks failed nodes", () => {
		const node = createSubagentNode("a1", "test", "Run tests");
		completeSubagent(node, false);
		expect(node.status).toBe("failed");
	});

	it("formats tree with icons", () => {
		const parent = createSubagentNode("p", "orchestrator", "Main");
		const child1 = createSubagentNode("c1", "explore", "Explore");
		child1.durationMs = 3000;
		child1.status = "completed";
		const child2 = createSubagentNode("c2", "apply", "Implement");
		child2.status = "failed";
		parent.children = [child1, child2];
		parent.status = "completed";
		parent.durationMs = 10000;

		const output = formatSubagentTree([parent]);
		expect(output).toContain("✓ orchestrator");
		expect(output).toContain("✓ explore (3.0s)");
		expect(output).toContain("✗ apply");
	});
});

describe("calculateBurnRate", () => {
	it("calculates tokens per minute", () => {
		const now = Date.now();
		const snapshots: TokenSnapshot[] = [
			{ timestamp: now - 60_000, inputTokens: 1000, outputTokens: 500, totalTokens: 1500, cumulativeCost: 0.1 },
			{ timestamp: now, inputTokens: 5000, outputTokens: 2000, totalTokens: 7000, cumulativeCost: 0.5 },
		];

		const rate = calculateBurnRate(snapshots);
		expect(rate).not.toBeNull();
		expect(rate?.tokensPerMinute).toBe(5500);
		expect(rate?.costPerMinute).toBeCloseTo(0.4, 2);
	});

	it("returns null for single snapshot", () => {
		const snapshots: TokenSnapshot[] = [
			createSnapshot(1000, 500, 0.1),
		];
		expect(calculateBurnRate(snapshots)).toBeNull();
	});

	it("returns null for zero elapsed time", () => {
		const now = Date.now();
		const snapshots: TokenSnapshot[] = [
			{ timestamp: now, inputTokens: 1000, outputTokens: 500, totalTokens: 1500, cumulativeCost: 0.1 },
			{ timestamp: now, inputTokens: 2000, outputTokens: 1000, totalTokens: 3000, cumulativeCost: 0.2 },
		];
		expect(calculateBurnRate(snapshots)).toBeNull();
	});

	it("calculates ETA to context limit", () => {
		const now = Date.now();
		const snapshots: TokenSnapshot[] = [
			{ timestamp: now - 60_000, inputTokens: 0, outputTokens: 0, totalTokens: 0, cumulativeCost: 0 },
			{ timestamp: now, inputTokens: 10_000, outputTokens: 0, totalTokens: 10_000, cumulativeCost: 0.5 },
		];

		const rate = calculateBurnRate(snapshots, 200_000);
		expect(rate?.estimatedMinutesRemaining).toBe(19);
	});

	it("calculates context window usage percentage", () => {
		const now = Date.now();
		const snapshots: TokenSnapshot[] = [
			{ timestamp: now - 60_000, inputTokens: 0, outputTokens: 0, totalTokens: 0, cumulativeCost: 0 },
			{ timestamp: now, inputTokens: 50_000, outputTokens: 50_000, totalTokens: 100_000, cumulativeCost: 5 },
		];

		const rate = calculateBurnRate(snapshots, 200_000);
		expect(rate?.contextWindowUsage).toBe(50);
	});
});

describe("formatBurnRate", () => {
	it("formats burn rate string", () => {
		const output = formatBurnRate({
			tokensPerMinute: 5500,
			costPerMinute: 0.04,
			estimatedMinutesRemaining: 35.2,
			contextWindowUsage: 45,
		});
		expect(output).toContain("5500 tok/min");
		expect(output).toContain("$0.0400/min");
		expect(output).toContain("45%");
		expect(output).toContain("35.2min");
	});

	it("handles infinity ETA", () => {
		const output = formatBurnRate({
			tokensPerMinute: 0,
			costPerMinute: 0,
			estimatedMinutesRemaining: Infinity,
			contextWindowUsage: 0,
		});
		expect(output).toContain("∞");
	});
});

describe("createSnapshot", () => {
	it("creates snapshot with calculated total", () => {
		const snap = createSnapshot(5000, 2000, 0.3);
		expect(snap.totalTokens).toBe(7000);
		expect(snap.cumulativeCost).toBe(0.3);
		expect(snap.timestamp).toBeGreaterThan(0);
	});
});
