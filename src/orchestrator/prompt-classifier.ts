/**
 * UserPromptSubmit classifier — auto-classify user messages into
 * categories (decision, incident, win, architecture, project) and
 * route to appropriate memory storage (engram).
 *
 * Lightweight keyword + pattern based classifier that runs on every
 * user message via a UserPromptSubmit hook.
 */

// ── Types ──

export type MessageCategory =
	| "decision"
	| "incident"
	| "win"
	| "architecture"
	| "project"
	| "question"
	| "task"
	| "uncategorized";

export interface ClassifiedMessage {
	category: MessageCategory;
	confidence: number; // 0.0-1.0
	text: string;
	keywords: string[];
	shouldPersist: boolean;
}

// ── Patterns ──

interface CategoryPattern {
	category: MessageCategory;
	keywords: string[];
	patterns: RegExp[];
	weight: number;
	persist: boolean;
}

const CATEGORY_PATTERNS: CategoryPattern[] = [
	{
		category: "decision",
		keywords: [
			"decided",
			"decision",
			"chose",
			"chosen",
			"picked",
			"selected",
			"go with",
			"went with",
			"switch to",
			"migrate",
			"elegimos",
			"decidimos",
			"optamos",
		],
		patterns: [
			/\b(we|I) (decided|chose|picked|selected)\b/i,
			/\blet'?s (go with|use|switch)\b/i,
			/\bdecisi[oó]n:/i,
		],
		weight: 1.0,
		persist: true,
	},
	{
		category: "incident",
		keywords: [
			"bug",
			"broken",
			"crash",
			"error",
			"failure",
			"incident",
			"outage",
			"down",
			"fix",
			"hotfix",
			"rollback",
			"revert",
			"se rompi[oó]",
			"fall[oó]",
			"cay[oó]",
		],
		patterns: [
			/\b(bug|crash|error|incident|outage)\b/i,
			/\b(fix|hotfix|rollback|revert)\b/i,
			/se (rompi|cay|fall)/i,
		],
		weight: 0.9,
		persist: true,
	},
	{
		category: "win",
		keywords: [
			"shipped",
			"deployed",
			"launched",
			"released",
			"completed",
			"done",
			"finished",
			"merged",
			"success",
			"genial",
			"perfecto",
			"listo",
			"funciona",
		],
		patterns: [
			/\b(shipped|deployed|launched|released|merged)\b/i,
			/\bcompleted?\b/i,
			/\b(genial|perfecto|excelente)!+\b/i,
		],
		weight: 0.7,
		persist: true,
	},
	{
		category: "architecture",
		keywords: [
			"architecture",
			"pattern",
			"design",
			"refactor",
			"abstraction",
			"hexagonal",
			"clean",
			"solid",
			"microservice",
			"monolith",
			"arquitectura",
			"patr[oó]n",
			"dise[nñ]o",
		],
		patterns: [
			/\b(architecture|design pattern|clean arch|hexagonal)\b/i,
			/\b(SOLID|DRY|KISS|YAGNI)\b/,
			/arquitectura/i,
		],
		weight: 0.8,
		persist: true,
	},
	{
		category: "project",
		keywords: [
			"sprint",
			"milestone",
			"deadline",
			"roadmap",
			"backlog",
			"priority",
			"scope",
			"stakeholder",
			"release",
			"version",
		],
		patterns: [/\b(sprint|milestone|deadline|roadmap)\b/i, /\bv\d+\.\d+/],
		weight: 0.6,
		persist: true,
	},
	{
		category: "question",
		keywords: ["how", "what", "why", "when", "where", "which", "can"],
		patterns: [/\?\s*$/, /^(how|what|why|when|where|which|can)\b/i],
		weight: 0.3,
		persist: false,
	},
	{
		category: "task",
		keywords: [
			"todo",
			"task",
			"implement",
			"add",
			"create",
			"update",
			"remove",
			"delete",
			"fix",
		],
		patterns: [
			/\b(implement|add|create|update|remove|delete)\s+\w/i,
			/^(feat|fix|refactor|test|docs):/i,
		],
		weight: 0.5,
		persist: false,
	},
];

// ── Classifier ──

export function classifyMessage(text: string): ClassifiedMessage {
	const lower = text.toLowerCase();
	let bestCategory: MessageCategory = "uncategorized";
	let bestScore = 0;
	let matchedKeywords: string[] = [];

	for (const cat of CATEGORY_PATTERNS) {
		let score = 0;
		const matched: string[] = [];

		// Keyword matching
		for (const kw of cat.keywords) {
			if (lower.includes(kw.toLowerCase())) {
				score += 0.3;
				matched.push(kw);
			}
		}

		// Pattern matching
		for (const pattern of cat.patterns) {
			if (pattern.test(text)) {
				score += 0.5;
			}
		}

		// Apply weight
		score *= cat.weight;

		if (score > bestScore) {
			bestScore = score;
			bestCategory = cat.category;
			matchedKeywords = matched;
		}
	}

	const confidence = Math.min(1.0, bestScore);
	const catConfig = CATEGORY_PATTERNS.find((c) => c.category === bestCategory);

	return {
		category: bestCategory,
		confidence: Math.round(confidence * 100) / 100,
		text,
		keywords: matchedKeywords,
		shouldPersist: catConfig?.persist ?? false,
	};
}

export function shouldAutoSave(classified: ClassifiedMessage): boolean {
	return classified.shouldPersist && classified.confidence >= 0.4;
}
