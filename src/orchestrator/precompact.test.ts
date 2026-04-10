import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createSnapshot,
	loadLatestSnapshot,
	loadSnapshotsByProject,
	type PreCompactConfig,
	saveSnapshot,
	snapshotToMarkdown,
} from "./precompact.js";

let tmpDir: string;
let config: PreCompactConfig;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "precompact-test-"));
	config = { snapshotDir: tmpDir, maxSnapshots: 5, includeGitDiff: false };
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── createSnapshot ──

describe("createSnapshot", () => {
	it("creates snapshot with required fields", () => {
		const snap = createSnapshot({ project: "my-project", sessionId: "abc123" });
		expect(snap.project).toBe("my-project");
		expect(snap.sessionId).toBe("abc123");
		expect(snap.timestamp).toBeTruthy();
		expect(snap.decisions).toEqual([]);
		expect(snap.modifiedFiles).toEqual([]);
		expect(snap.activeTask).toBeNull();
	});

	it("preserves optional fields", () => {
		const snap = createSnapshot({
			project: "test",
			sessionId: "s1",
			decisions: ["Use JWT", "PostgreSQL over MySQL"],
			modifiedFiles: ["src/auth.ts", "src/db.ts"],
			activeTask: "Implement login",
			notes: ["Check token expiry"],
			tokenEstimate: 50000,
		});
		expect(snap.decisions).toHaveLength(2);
		expect(snap.modifiedFiles).toHaveLength(2);
		expect(snap.activeTask).toBe("Implement login");
		expect(snap.tokenEstimate).toBe(50000);
	});
});

// ── saveSnapshot + loadLatestSnapshot ──

describe("save and load", () => {
	it("saves and loads a snapshot", () => {
		const snap = createSnapshot({
			project: "test",
			sessionId: "s1",
			decisions: ["Decision A"],
		});
		const filePath = saveSnapshot(snap, config);
		expect(fs.existsSync(filePath)).toBe(true);

		const loaded = loadLatestSnapshot(config);
		expect(loaded).not.toBeNull();
		expect(loaded!.project).toBe("test");
		expect(loaded!.decisions).toEqual(["Decision A"]);
	});

	it("loads the most recent snapshot", () => {
		const snap1 = createSnapshot({ project: "test", sessionId: "s1" });
		saveSnapshot(snap1, config);

		// Tiny delay to ensure different timestamp in filename
		const snap2 = createSnapshot({ project: "test", sessionId: "s2" });
		snap2.timestamp = new Date(Date.now() + 1000).toISOString();
		saveSnapshot(snap2 as any, config);

		const loaded = loadLatestSnapshot(config);
		expect(loaded!.sessionId).toBe("s2");
	});

	it("returns null when no snapshots exist", () => {
		expect(loadLatestSnapshot(config)).toBeNull();
	});

	it("returns null when dir doesn't exist", () => {
		const missing = { ...config, snapshotDir: "/nonexistent" };
		expect(loadLatestSnapshot(missing)).toBeNull();
	});
});

// ── loadSnapshotsByProject ──

describe("loadSnapshotsByProject", () => {
	it("filters by project", () => {
		saveSnapshot(createSnapshot({ project: "alpha", sessionId: "a1" }), config);
		saveSnapshot(createSnapshot({ project: "beta", sessionId: "b1" }), config);
		saveSnapshot(createSnapshot({ project: "alpha", sessionId: "a2" }), config);

		const alphaSnaps = loadSnapshotsByProject("alpha", config);
		expect(alphaSnaps).toHaveLength(2);
		expect(alphaSnaps.every((s) => s.project === "alpha")).toBe(true);
	});

	it("returns empty for unknown project", () => {
		saveSnapshot(createSnapshot({ project: "alpha", sessionId: "a1" }), config);
		expect(loadSnapshotsByProject("nope", config)).toHaveLength(0);
	});
});

// ── Pruning ──

describe("pruning", () => {
	it("keeps only maxSnapshots files", () => {
		const smallConfig = { ...config, maxSnapshots: 3 };
		for (let i = 0; i < 6; i++) {
			const snap = createSnapshot({ project: "test", sessionId: `s${i}` });
			snap.timestamp = new Date(Date.now() + i * 1000).toISOString();
			saveSnapshot(snap as any, smallConfig);
		}

		const files = fs
			.readdirSync(tmpDir)
			.filter((f) => f.startsWith("snapshot-"));
		expect(files.length).toBeLessThanOrEqual(3);
	});
});

// ── snapshotToMarkdown ──

describe("snapshotToMarkdown", () => {
	it("generates markdown with all sections", () => {
		const snap = createSnapshot({
			project: "my-project",
			sessionId: "abc123",
			decisions: ["Use hexagonal arch", "JWT over sessions"],
			modifiedFiles: ["src/auth.ts"],
			activeTask: "Implement authentication",
			notes: ["Check OAuth2 flow"],
			tokenEstimate: 75000,
		});

		const md = snapshotToMarkdown(snap);
		expect(md).toContain("# Context Snapshot");
		expect(md).toContain("my-project");
		expect(md).toContain("## Active Task");
		expect(md).toContain("Implement authentication");
		expect(md).toContain("## Decisions Made");
		expect(md).toContain("Use hexagonal arch");
		expect(md).toContain("## Modified Files");
		expect(md).toContain("`src/auth.ts`");
		expect(md).toContain("## Notes");
		expect(md).toContain("~75000");
	});

	it("omits empty sections", () => {
		const snap = createSnapshot({ project: "test", sessionId: "s1" });
		const md = snapshotToMarkdown(snap);
		expect(md).not.toContain("## Decisions");
		expect(md).not.toContain("## Modified");
		expect(md).not.toContain("## Active Task");
	});
});
