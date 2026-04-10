import { describe, expect, it } from "vitest";
import {
	buildTierOne,
	DEFAULT_CONFIG,
	formatTierOne,
	shouldLoadTierTwo,
} from "./tiered-context.js";

describe("buildTierOne", () => {
	it("builds context with all fields", () => {
		const ctx = buildTierOne({
			project: "my-app",
			stack: "Next.js + TypeScript",
			branch: "feat/auth",
			lastCommit: "abc1234 add login page",
			activeTasks: ["Implement login", "Add tests"],
			recentDecisions: ["Use JWT", "PostgreSQL over MySQL"],
		});
		expect(ctx.project).toBe("my-app");
		expect(ctx.activeTasks).toHaveLength(2);
		expect(ctx.recentDecisions).toHaveLength(2);
		expect(ctx.tokenEstimate).toBeGreaterThan(0);
	});

	it("respects maxActiveTasks", () => {
		const ctx = buildTierOne({
			project: "test",
			stack: "node",
			branch: "main",
			lastCommit: "init",
			activeTasks: ["T1", "T2", "T3", "T4", "T5"],
			recentDecisions: [],
		});
		expect(ctx.activeTasks.length).toBeLessThanOrEqual(
			DEFAULT_CONFIG.maxActiveTasks,
		);
	});

	it("respects maxRecentDecisions", () => {
		const ctx = buildTierOne({
			project: "test",
			stack: "node",
			branch: "main",
			lastCommit: "init",
			activeTasks: [],
			recentDecisions: ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
		});
		expect(ctx.recentDecisions.length).toBeLessThanOrEqual(
			DEFAULT_CONFIG.maxRecentDecisions,
		);
	});

	it("trims to fit token budget", () => {
		const ctx = buildTierOne({
			project: "test",
			stack: "node",
			branch: "main",
			lastCommit: "init",
			activeTasks: [],
			recentDecisions: Array(50).fill(
				"A very long decision that takes many tokens and should be trimmed",
			),
			config: {
				maxTierOneTokens: 200,
				maxRecentDecisions: 50,
				maxActiveTasks: 10,
			},
		});
		expect(ctx.tokenEstimate).toBeLessThanOrEqual(200);
	});

	it("estimates tokens correctly", () => {
		const ctx = buildTierOne({
			project: "p",
			stack: "s",
			branch: "b",
			lastCommit: "c",
			activeTasks: [],
			recentDecisions: [],
		});
		expect(ctx.tokenEstimate).toBeGreaterThan(0);
		expect(ctx.tokenEstimate).toBeLessThan(100);
	});
});

describe("formatTierOne", () => {
	it("includes project and stack", () => {
		const ctx = buildTierOne({
			project: "my-app",
			stack: "React + TS",
			branch: "main",
			lastCommit: "init",
			activeTasks: ["Fix login"],
			recentDecisions: ["Use JWT"],
		});
		const text = formatTierOne(ctx);
		expect(text).toContain("my-app (React + TS)");
		expect(text).toContain("Branch: main");
		expect(text).toContain("Fix login");
		expect(text).toContain("Use JWT");
	});

	it("omits empty sections", () => {
		const ctx = buildTierOne({
			project: "test",
			stack: "node",
			branch: "main",
			lastCommit: "init",
			activeTasks: [],
			recentDecisions: [],
		});
		const text = formatTierOne(ctx);
		expect(text).not.toContain("Tasks:");
		expect(text).not.toContain("Recent decisions:");
	});
});

describe("shouldLoadTierTwo", () => {
	it("triggers memory for 'remember' queries", () => {
		const result = shouldLoadTierTwo(
			"Do you remember what we decided about auth?",
		);
		expect(result).not.toBeNull();
		expect(result!.source).toBe("memory");
	});

	it("triggers memory for Spanish 'acordate'", () => {
		const result = shouldLoadTierTwo(
			"acordate qué hicimos con la base de datos",
		);
		expect(result).not.toBeNull();
		expect(result!.source).toBe("memory");
	});

	it("triggers skills for 'how does' queries", () => {
		const result = shouldLoadTierTwo("How does the React skill work?");
		expect(result).not.toBeNull();
		expect(result!.source).toBe("skills");
	});

	it("triggers history for 'last time' queries", () => {
		const result = shouldLoadTierTwo(
			"What did we do last time with the deploy?",
		);
		expect(result).not.toBeNull();
		expect(result!.source).toBe("history");
	});

	it("returns null for regular messages", () => {
		expect(shouldLoadTierTwo("add a login button")).toBeNull();
	});

	it("returns null for simple greetings", () => {
		expect(shouldLoadTierTwo("hello")).toBeNull();
	});
});
