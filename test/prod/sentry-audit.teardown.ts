import { readFileSync } from 'node:fs'

const ORG_SLUG = 'yayasan-amal-shalih-insan-bant'
const DASHBOARD = `https://yayasan-amal-shalih-insan-bant.sentry.io/issues/?project=amalshalih`

function readToken(): string {
	if (process.env.SENTRY_READ_TOKEN) return process.env.SENTRY_READ_TOKEN
	const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
	const match = env.match(/^SENTRY_READ_TOKEN=(.+)$/m)
	if (!match) throw new Error('SENTRY_READ_TOKEN tidak ditemukan di .env maupun environment')
	return match[1].trim()
}

interface SentryIssue {
	shortId: string
	level: string
	title: string
	lastSeen: string
	count: string
	permalink: string
}

export default async function sentryAuditTeardown(): Promise<void> {
	const startIso = readFileSync(new URL('./run-start.txt', import.meta.url), 'utf8').trim()
	// 90s skew: events already in flight when the run started should not be blamed on us.
	const cutoff = new Date(new Date(startIso).getTime() - 90_000)

	let issues: SentryIssue[] = []
	try {
		const res = await fetch(
			`https://sentry.io/api/0/organizations/${ORG_SLUG}/issues/?query=&sort=date&limit=100`,
			{ headers: { Authorization: `Bearer ${readToken()}` } },
		)
		if (!res.ok) throw new Error(`Sentry API ${res.status}: ${await res.text()}`)
		issues = (await res.json()) as SentryIssue[]
	} catch (error) {
		console.warn(
			`[Layer 3] ⚠️  Audit Sentry dilewati: ${error instanceof Error ? error.message : error}`,
		)
		return
	}

	const fresh = issues.filter((i) => new Date(i.lastSeen) >= cutoff)
	const freshErrors = fresh.filter((i) => i.level === 'error' || i.level === 'fatal')

	console.log('\n╔══ Layer 3 — Audit Sentry (post-run) ══╗')
	console.log(`║ Window : ${startIso} → now`)
	console.log(`║ Issue total terakhir 100: ${issues.length}`)
	console.log(`║ Baru sejak run dimulai : ${fresh.length}`)
	for (const i of fresh) {
		console.log(`║   [${i.level}] ${i.shortId} ${i.title.slice(0, 70)} (${i.count}x)`)
	}
	if (freshErrors.length > 0) {
		throw new Error(
			`Layer 3 GAGAL: ${freshErrors.length} issue error BARU muncul selama testing live.\n` +
				freshErrors.map((i) => `  - ${i.shortId}: ${i.title}`).join('\n') +
				`\n  Dashboard: ${DASHBOARD}`,
		)
	}
	console.log('║ Hasil  : ✅ nol issue error baru — crawl tidak menimbulkan jejak di Sentry')
	console.log(`║ Dashboard: ${DASHBOARD}`)
	console.log('╚═══════════════════════════════════════╝')
}
