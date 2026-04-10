/**
 * PreCompact hook — saves a context snapshot before Claude Code's
 * automatic context compaction triggers, so no decisions or state
 * are lost. Generates a JSON snapshot file that can be loaded after
 * compaction to restore critical context.
 */

import fs from "fs";
import os from "os";
import path from "path";

// ── Types ──

export interface ContextSnapshot {
	timestamp: string;
	project: string;
	sessionId: string;
	decisions: string[];
	modifiedFiles: string[];
	activeTask: string | null;
	notes: string[];
	tokenEstimate: number;
}

export interface PreCompactConfig {
	snapshotDir: string;
	maxSnapshots: number; // keep N most recent
	includeGitDiff: boolean;
}

// ── Defaults ──

export const DEFAULT_CONFIG: PreCompactConfig = {
	snapshotDir: path.join(os.homedir(), ".claude", "snapshots"),
	maxSnapshots: 10,
	includeGitDiff: false,
};

// ── Snapshot creation ──

export function createSnapshot(params: {
	project: string;
	sessionId: string;
	decisions?: string[];
	modifiedFiles?: string[];
	activeTask?: string | null;
	notes?: string[];
	tokenEstimate?: number;
}): ContextSnapshot {
	return {
		timestamp: new Date().toISOString(),
		project: params.project,
		sessionId: params.sessionId,
		decisions: params.decisions ?? [],
		modifiedFiles: params.modifiedFiles ?? [],
		activeTask: params.activeTask ?? null,
		notes: params.notes ?? [],
		tokenEstimate: params.tokenEstimate ?? 0,
	};
}

// ── File operations ──

function snapshotFilename(snapshot: ContextSnapshot): string {
	const ts = snapshot.timestamp.replace(/[:.]/g, "-").slice(0, 19);
	return `snapshot-${ts}-${snapshot.sessionId.slice(0, 8)}.json`;
}

export function saveSnapshot(
	snapshot: ContextSnapshot,
	config: PreCompactConfig = DEFAULT_CONFIG,
): string {
	fs.mkdirSync(config.snapshotDir, { recursive: true });

	const filename = snapshotFilename(snapshot);
	const filePath = path.join(config.snapshotDir, filename);

	fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

	// Prune old snapshots
	pruneSnapshots(config);

	return filePath;
}

export function loadLatestSnapshot(
	config: PreCompactConfig = DEFAULT_CONFIG,
): ContextSnapshot | null {
	if (!fs.existsSync(config.snapshotDir)) return null;

	const files = fs
		.readdirSync(config.snapshotDir)
		.filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
		.sort()
		.reverse();

	if (files.length === 0) return null;

	try {
		const content = fs.readFileSync(
			path.join(config.snapshotDir, files[0]!),
			"utf-8",
		);
		return JSON.parse(content) as ContextSnapshot;
	} catch {
		return null;
	}
}

export function loadSnapshotsByProject(
	project: string,
	config: PreCompactConfig = DEFAULT_CONFIG,
): ContextSnapshot[] {
	if (!fs.existsSync(config.snapshotDir)) return [];

	const files = fs
		.readdirSync(config.snapshotDir)
		.filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
		.sort()
		.reverse();

	const snapshots: ContextSnapshot[] = [];
	for (const file of files) {
		try {
			const content = fs.readFileSync(
				path.join(config.snapshotDir, file),
				"utf-8",
			);
			const snapshot = JSON.parse(content) as ContextSnapshot;
			if (snapshot.project === project) {
				snapshots.push(snapshot);
			}
		} catch {
			// Skip malformed files
		}
	}

	return snapshots;
}

function pruneSnapshots(config: PreCompactConfig): void {
	if (!fs.existsSync(config.snapshotDir)) return;

	const files = fs
		.readdirSync(config.snapshotDir)
		.filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
		.sort();

	// Remove oldest files beyond maxSnapshots
	while (files.length > config.maxSnapshots) {
		const oldest = files.shift()!;
		try {
			fs.unlinkSync(path.join(config.snapshotDir, oldest));
		} catch {
			// ignore
		}
	}
}

// ── Summary for context restoration ──

export function snapshotToMarkdown(snapshot: ContextSnapshot): string {
	const lines: string[] = [];
	lines.push(`# Context Snapshot — ${snapshot.timestamp.slice(0, 19)}`);
	lines.push(`**Project**: ${snapshot.project}`);
	lines.push(`**Session**: ${snapshot.sessionId}`);
	lines.push("");

	if (snapshot.activeTask) {
		lines.push(`## Active Task`);
		lines.push(snapshot.activeTask);
		lines.push("");
	}

	if (snapshot.decisions.length > 0) {
		lines.push("## Decisions Made");
		for (const d of snapshot.decisions) {
			lines.push(`- ${d}`);
		}
		lines.push("");
	}

	if (snapshot.modifiedFiles.length > 0) {
		lines.push("## Modified Files");
		for (const f of snapshot.modifiedFiles) {
			lines.push(`- \`${f}\``);
		}
		lines.push("");
	}

	if (snapshot.notes.length > 0) {
		lines.push("## Notes");
		for (const n of snapshot.notes) {
			lines.push(`- ${n}`);
		}
		lines.push("");
	}

	if (snapshot.tokenEstimate > 0) {
		lines.push(`*Token estimate at snapshot: ~${snapshot.tokenEstimate}*`);
	}

	return lines.join("\n");
}
