import { describe, expect, it } from "vitest";
import { classifyMessage, shouldAutoSave } from "./prompt-classifier.js";

describe("classifyMessage", () => {
	it("classifies decisions", () => {
		const result = classifyMessage(
			"We decided to use PostgreSQL over MySQL for JSONB support",
		);
		expect(result.category).toBe("decision");
		expect(result.confidence).toBeGreaterThan(0.3);
		expect(result.shouldPersist).toBe(true);
	});

	it("classifies incidents", () => {
		const result = classifyMessage(
			"The auth service is broken — users can't login",
		);
		expect(result.category).toBe("incident");
		expect(result.shouldPersist).toBe(true);
	});

	it("classifies wins", () => {
		const result = classifyMessage(
			"genial!!! deployed to production successfully",
		);
		expect(result.category).toBe("win");
	});

	it("classifies architecture", () => {
		const result = classifyMessage(
			"Let's refactor to hexagonal architecture for better testability",
		);
		expect(result.category).toBe("architecture");
		expect(result.shouldPersist).toBe(true);
	});

	it("classifies project updates", () => {
		const result = classifyMessage(
			"The sprint deadline is Friday, we need to prioritize the roadmap",
		);
		expect(result.category).toBe("project");
	});

	it("classifies questions", () => {
		const result = classifyMessage("How does the auth middleware work?");
		expect(result.category).toBe("question");
		expect(result.shouldPersist).toBe(false);
	});

	it("classifies tasks", () => {
		const result = classifyMessage("implement the user registration endpoint");
		expect(result.category).toBe("task");
	});

	it("returns uncategorized for generic text", () => {
		const result = classifyMessage("hello");
		expect(result.category).toBe("uncategorized");
		expect(result.confidence).toBe(0);
	});

	it("handles Spanish input", () => {
		const result = classifyMessage("decidimos usar JWT para la autenticación");
		expect(result.category).toBe("decision");
	});

	it("returns matched keywords", () => {
		const result = classifyMessage("I decided to switch to React 19");
		expect(result.keywords.length).toBeGreaterThan(0);
	});
});

describe("shouldAutoSave", () => {
	it("saves decisions with high confidence", () => {
		const msg = classifyMessage("We decided to use hexagonal architecture");
		expect(shouldAutoSave(msg)).toBe(true);
	});

	it("does not save questions", () => {
		const msg = classifyMessage("How does this work?");
		expect(shouldAutoSave(msg)).toBe(false);
	});

	it("does not save low-confidence matches", () => {
		const msg = classifyMessage("maybe we should use something");
		expect(shouldAutoSave(msg)).toBe(false);
	});
});
