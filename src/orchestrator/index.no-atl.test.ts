import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('index.ts static ATL regression guard', () => {
	it('does not contain legacy ATL implementation strings', () => {
		const source = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8')
		expect(source).not.toContain('ATL_AGENT_MAP')
		expect(source).not.toContain('https://github.com/Gentleman-Programming/agent-teams-lite.git')
		// We specifically care that the runtime setup path no longer references the
		// archived repo or its clone/setup logic. Migration helpers may still keep
		// ATL strings elsewhere in the codebase for opt-in legacy migration.
		expect(source).not.toContain("git clone --depth 1")
	})
})
