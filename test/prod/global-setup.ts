import { writeFileSync } from 'node:fs'

export default function globalSetup(): void {
	writeFileSync(new URL('./run-start.txt', import.meta.url), new Date().toISOString())
}
