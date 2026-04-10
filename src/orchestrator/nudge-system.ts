/**
 * Time-aware nudge system — timed reminders that fire on prompt
 * submission. "Stop me at 11", "remind me about standup in 30m".
 * In-memory store (no SQLite dependency for simplicity).
 */

// ── Types ──

export interface Nudge {
	id: string;
	message: string;
	fireAt: number; // Unix timestamp ms
	createdAt: number;
	fired: boolean;
	dismissed: boolean;
}

export interface NudgeStore {
	nudges: Nudge[];
}

// ── Store ──

let _counter = 0;

export function createStore(): NudgeStore {
	return { nudges: [] };
}

export function addNudge(
	store: NudgeStore,
	message: string,
	fireAt: Date | number,
): Nudge {
	_counter++;
	const nudge: Nudge = {
		id: `nudge-${Date.now()}-${_counter}`,
		message,
		fireAt: typeof fireAt === "number" ? fireAt : fireAt.getTime(),
		createdAt: Date.now(),
		fired: false,
		dismissed: false,
	};
	store.nudges.push(nudge);
	return nudge;
}

export function addNudgeRelative(
	store: NudgeStore,
	message: string,
	delayMs: number,
): Nudge {
	return addNudge(store, message, Date.now() + delayMs);
}

export function dismissNudge(store: NudgeStore, id: string): boolean {
	const nudge = store.nudges.find((n) => n.id === id);
	if (!nudge) return false;
	nudge.dismissed = true;
	return true;
}

// ── Checking ──

export function checkNudges(
	store: NudgeStore,
	now: number = Date.now(),
): Nudge[] {
	const ready: Nudge[] = [];
	for (const nudge of store.nudges) {
		if (!nudge.fired && !nudge.dismissed && nudge.fireAt <= now) {
			nudge.fired = true;
			ready.push(nudge);
		}
	}
	return ready;
}

export function getPending(store: NudgeStore): Nudge[] {
	return store.nudges.filter((n) => !n.fired && !n.dismissed);
}

// ── Parsing ──

const RELATIVE_RE = /(?:in\s+)?(\d+)\s*(m|min|minutes?|h|hours?|s|seconds?)/i;
const ABSOLUTE_RE = /(?:at\s+)?(\d{1,2}):(\d{2})/;
const STOP_RE = /(?:stop|pará|para).*(?:at|a las?)\s+(\d{1,2})(?::(\d{2}))?/i;

export function parseNudgeCommand(
	input: string,
): { message: string; delayMs: number } | null {
	// "remind me in 30m to check deploy"
	const relMatch = RELATIVE_RE.exec(input);
	if (relMatch) {
		const amount = parseInt(relMatch[1]!, 10);
		const unit = relMatch[2]!.toLowerCase();
		let ms = 0;
		if (unit.startsWith("s")) ms = amount * 1000;
		else if (unit.startsWith("m")) ms = amount * 60 * 1000;
		else if (unit.startsWith("h")) ms = amount * 60 * 60 * 1000;

		const message =
			input
				.replace(RELATIVE_RE, "")
				.replace(/^(remind\s+me\s+)?/i, "")
				.replace(/^to\s+/i, "")
				.trim() || "Timer";

		return { message, delayMs: ms };
	}

	// "stop me at 11" / "pará a las 11"
	const stopMatch = STOP_RE.exec(input);
	if (stopMatch) {
		const hour = parseInt(stopMatch[1]!, 10);
		const minute = parseInt(stopMatch[2] ?? "0", 10);
		const target = new Date();
		target.setHours(hour, minute, 0, 0);
		if (target.getTime() <= Date.now()) {
			target.setDate(target.getDate() + 1); // next day
		}
		return {
			message: `Time to stop! (${hour}:${String(minute).padStart(2, "0")})`,
			delayMs: target.getTime() - Date.now(),
		};
	}

	return null;
}

// ── Formatting ──

export function formatNudge(nudge: Nudge): string {
	return `⏰ ${nudge.message}`;
}

export function formatPending(nudges: Nudge[]): string {
	if (nudges.length === 0) return "No pending nudges.";
	return nudges
		.map((n) => {
			const remaining = Math.max(0, n.fireAt - Date.now());
			const mins = Math.ceil(remaining / 60_000);
			return `  ⏳ ${n.message} (in ${mins}m)`;
		})
		.join("\n");
}
