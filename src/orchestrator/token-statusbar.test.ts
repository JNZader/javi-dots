import { describe, expect, it, vi } from "vitest";
import {
	formatTokenStatusline,
	formatTmuxStatusline,
	getContextWindow,
	getUsageLevel,
	renderProgressBar,
	shortModelName,
	tmuxColor,
} from "./token-statusbar.js";

// Mock git and child_process
vi.mock("node:child_process", () => ({
	execSync: vi.fn(() => "main\n"),
}));

describe("shortModelName", () => {
	it("shortens opus model", () => {
		expect(shortModelName("claude-opus-4-6")).toBe("opus");
	});
	it("shortens sonnet model", () => {
		expect(shortModelName("claude-sonnet-4-6")).toBe("sonnet");
	});
	it("shortens haiku model", () => {
		expect(shortModelName("claude-haiku-4-5")).toBe("haiku");
	});
	it("falls back to last segment for unknown model", () => {
		expect(shortModelName("gpt-4o")).toBe("4o");
	});
});

describe("getContextWindow", () => {
	it("returns 200K for standard opus", () => {
		expect(getContextWindow("claude-opus-4-6")).toBe(200_000);
	});
	it("returns 1M for extended context", () => {
		expect(getContextWindow("claude-opus-4-6[1m]")).toBe(1_000_000);
	});
	it("returns 200K default for unknown model", () => {
		expect(getContextWindow("gpt-4")).toBe(200_000);
	});
	it("matches prefix for versioned models", () => {
		expect(getContextWindow("claude-sonnet-4-6-20260101")).toBe(200_000);
	});
});

describe("renderProgressBar", () => {
	it("renders empty bar at 0%", () => {
		expect(renderProgressBar(0)).toBe("[░░░░░░░░]");
	});
	it("renders full bar at 100%", () => {
		expect(renderProgressBar(1)).toBe("[████████]");
	});
	it("renders half bar at 50%", () => {
		expect(renderProgressBar(0.5)).toBe("[████░░░░]");
	});
	it("clamps values above 1", () => {
		expect(renderProgressBar(1.5)).toBe("[████████]");
	});
	it("clamps values below 0", () => {
		expect(renderProgressBar(-0.2)).toBe("[░░░░░░░░]");
	});
	it("supports custom width", () => {
		expect(renderProgressBar(0.5, { width: 4 })).toBe("[██░░]");
	});
	it("supports custom characters", () => {
		expect(renderProgressBar(0.5, { fillChar: "#", emptyChar: "-" })).toBe(
			"[####----]",
		);
	});
});

describe("getUsageLevel", () => {
	it("returns normal for low usage", () => {
		expect(getUsageLevel(0.3)).toBe("normal");
	});
	it("returns warning at 70%", () => {
		expect(getUsageLevel(0.7)).toBe("warning");
	});
	it("returns critical at 90%", () => {
		expect(getUsageLevel(0.9)).toBe("critical");
	});
	it("returns critical at 100%", () => {
		expect(getUsageLevel(1.0)).toBe("critical");
	});
});

describe("tmuxColor", () => {
	it("returns green for normal", () => {
		expect(tmuxColor("normal")).toBe("#[fg=green]");
	});
	it("returns yellow for warning", () => {
		expect(tmuxColor("warning")).toBe("#[fg=yellow]");
	});
	it("returns red for critical", () => {
		expect(tmuxColor("critical")).toBe("#[fg=red]");
	});
});

describe("formatTokenStatusline", () => {
	it("formats complete statusline", () => {
		const line = formatTokenStatusline({
			model: "claude-opus-4-6",
			inputTokens: 50_000,
			outputTokens: 40_000,
			totalCost: 4.2,
		});
		expect(line).toContain("opus");
		expect(line).toContain("main");
		expect(line).toContain("[");
		expect(line).toContain("%");
		expect(line).toContain("$4.2");
	});

	it("shows correct percentage", () => {
		const line = formatTokenStatusline({
			model: "claude-opus-4-6",
			inputTokens: 100_000,
			outputTokens: 0,
			totalCost: 1,
			contextWindow: 200_000,
		});
		expect(line).toContain("50%");
	});

	it("formats low cost with 2 decimals", () => {
		const line = formatTokenStatusline({
			model: "claude-haiku-4-5",
			inputTokens: 1000,
			outputTokens: 500,
			totalCost: 0.05,
		});
		expect(line).toContain("$0.05");
	});

	it("formats high cost without decimals", () => {
		const line = formatTokenStatusline({
			model: "claude-opus-4-6",
			inputTokens: 500_000,
			outputTokens: 200_000,
			totalCost: 25.5,
		});
		expect(line).toContain("$26");
	});
});

describe("formatTmuxStatusline", () => {
	it("wraps with green for normal usage", () => {
		const line = formatTmuxStatusline({
			model: "claude-opus-4-6",
			inputTokens: 10_000,
			outputTokens: 5_000,
			totalCost: 0.5,
			contextWindow: 200_000,
		});
		expect(line).toContain("#[fg=green]");
		expect(line).toContain("#[default]");
	});

	it("wraps with yellow for warning usage", () => {
		const line = formatTmuxStatusline({
			model: "claude-opus-4-6",
			inputTokens: 140_000,
			outputTokens: 10_000,
			totalCost: 5,
			contextWindow: 200_000,
		});
		expect(line).toContain("#[fg=yellow]");
	});

	it("wraps with red for critical usage", () => {
		const line = formatTmuxStatusline({
			model: "claude-opus-4-6",
			inputTokens: 180_000,
			outputTokens: 10_000,
			totalCost: 10,
			contextWindow: 200_000,
		});
		expect(line).toContain("#[fg=red]");
	});
});
