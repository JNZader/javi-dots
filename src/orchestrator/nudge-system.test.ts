import { describe, expect, it } from "vitest";
import {
	addNudge,
	addNudgeRelative,
	checkNudges,
	createStore,
	dismissNudge,
	formatPending,
	getPending,
	parseNudgeCommand,
} from "./nudge-system.js";

describe("nudge store", () => {
	it("creates empty store", () => {
		const store = createStore();
		expect(store.nudges).toHaveLength(0);
	});

	it("adds nudge with absolute time", () => {
		const store = createStore();
		const nudge = addNudge(store, "Check deploy", Date.now() + 60_000);
		expect(nudge.message).toBe("Check deploy");
		expect(nudge.fired).toBe(false);
	});

	it("adds nudge with relative delay", () => {
		const store = createStore();
		const nudge = addNudgeRelative(store, "Standup", 30 * 60_000);
		expect(nudge.fireAt).toBeGreaterThan(Date.now());
	});

	it("dismisses nudge", () => {
		const store = createStore();
		const nudge = addNudge(store, "Test", Date.now() + 60_000);
		expect(dismissNudge(store, nudge.id)).toBe(true);
		expect(nudge.dismissed).toBe(true);
	});

	it("returns false for unknown nudge", () => {
		const store = createStore();
		expect(dismissNudge(store, "nope")).toBe(false);
	});
});

describe("checkNudges", () => {
	it("fires ready nudges", () => {
		const store = createStore();
		addNudge(store, "Past nudge", Date.now() - 1000);
		addNudge(store, "Future nudge", Date.now() + 60_000);

		const fired = checkNudges(store);
		expect(fired).toHaveLength(1);
		expect(fired[0]!.message).toBe("Past nudge");
	});

	it("does not fire dismissed nudges", () => {
		const store = createStore();
		const nudge = addNudge(store, "Dismissed", Date.now() - 1000);
		dismissNudge(store, nudge.id);

		const fired = checkNudges(store);
		expect(fired).toHaveLength(0);
	});

	it("does not fire same nudge twice", () => {
		const store = createStore();
		addNudge(store, "Once", Date.now() - 1000);

		checkNudges(store);
		const second = checkNudges(store);
		expect(second).toHaveLength(0);
	});
});

describe("getPending", () => {
	it("returns only unfired, undismissed nudges", () => {
		const store = createStore();
		addNudge(store, "Pending", Date.now() + 60_000);
		const fired = addNudge(store, "Fired", Date.now() - 1000);
		checkNudges(store); // fires the past one
		const dismissed = addNudge(store, "Dismissed", Date.now() + 60_000);
		dismissNudge(store, dismissed.id);

		expect(getPending(store)).toHaveLength(1);
		expect(getPending(store)[0]!.message).toBe("Pending");
	});
});

describe("parseNudgeCommand", () => {
	it("parses 'in 30m'", () => {
		const result = parseNudgeCommand("remind me in 30m to check deploy");
		expect(result).not.toBeNull();
		expect(result!.delayMs).toBe(30 * 60_000);
		expect(result!.message).toContain("check deploy");
	});

	it("parses 'in 2h'", () => {
		const result = parseNudgeCommand("in 2h review PR");
		expect(result).not.toBeNull();
		expect(result!.delayMs).toBe(2 * 60 * 60_000);
	});

	it("parses 'stop me at 11'", () => {
		const result = parseNudgeCommand("stop me at 11");
		expect(result).not.toBeNull();
		expect(result!.message).toContain("11");
		expect(result!.delayMs).toBeGreaterThan(0);
	});

	it("parses 'pará a las 23:30'", () => {
		const result = parseNudgeCommand("pará a las 23:30");
		expect(result).not.toBeNull();
		expect(result!.message).toContain("23:30");
	});

	it("returns null for non-nudge input", () => {
		expect(parseNudgeCommand("hello world")).toBeNull();
	});
});

describe("formatPending", () => {
	it("shows pending nudges with remaining time", () => {
		const store = createStore();
		addNudge(store, "Check deploy", Date.now() + 15 * 60_000);
		const text = formatPending(getPending(store));
		expect(text).toContain("Check deploy");
		expect(text).toContain("⏳");
	});

	it("shows no pending message", () => {
		expect(formatPending([])).toContain("No pending");
	});
});
