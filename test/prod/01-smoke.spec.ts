import { expect, test } from '@playwright/test'

const PROD_PAGES = [
	'/',
	'/kegiatan',
	'/program',
	'/donasi',
	'/kontak',
	'/blog',
	'/faq',
	'/galeri',
	'/barkas',
	'/barkas/barkas-001',
] as const

/** Ulangi permintaan saat gangguan jaringan lokal (timeout/TLS), bukan error HTTP. */
async function apiRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
	let lastError: unknown
	for (let attempt = 1; attempt <= tries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error
			if (!/TIMED_OUT|Timeout|TLS|socket|ECONN|network/i.test(String(error))) throw error
		}
	}
	throw lastError
}

test.describe('Layer 1 — Smoke & kontrak HTTP produksi', () => {
	for (const path of PROD_PAGES) {
		test(`GET ${path} → 200`, async ({ request }) => {
			const res = await apiRetry(() => request.get(path))
			expect(res.status(), `${path} harus 200`).toBe(200)
		})
	}

	test('halaman tak dikenal → 404', async ({ request }) => {
		const res = await apiRetry(() => request.get('/halaman-ngawur-404'))
		expect(res.status()).toBe(404)
	})

	test('redirect http → https', async ({ request }) => {
		const res = await apiRetry(() => request.get('http://amalshalih.or.id/', { maxRedirects: 0 }))
		expect([301, 302, 308]).toContain(res.status())
		expect(res.headers().location).toMatch(/^https:\/\/amalshalih\.or\.id\//)
	})

	test('www.amalshalih.or.id terlayani worker', async ({ request }) => {
		const res = await apiRetry(() =>
			request.get('https://www.amalshalih.or.id/', { maxRedirects: 0 }),
		)
		expect([200, 301]).toContain(res.status())
	})

	test('header keamanan lengkap', async ({ request }) => {
		const res = await apiRetry(() => request.get('/'))
		const h = res.headers()
		expect(h['content-security-policy'], 'CSP wajib ada').toBeTruthy()
		expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
		expect(h['x-content-type-options']).toBe('nosniff')
		expect(h['x-frame-options']).toBe('DENY')
		expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
		expect(h['permissions-policy']).toContain('camera=()')
	})

	test('/api/health sehat & KV ok', async ({ request }) => {
		const res = await apiRetry(() => request.get('/api/health'))
		expect(res.status()).toBe(200)
		const body = (await res.json()) as {
			status: string
			checks: Record<string, { status: string; latency: number }>
		}
		expect(['healthy', 'degraded']).toContain(body.status)
		expect(body.checks.kv.status).toBe('ok')
	})

	test('kontak menolak payload invalid (400, tanpa email keluar)', async ({ request }) => {
		const res = await apiRetry(() =>
			request.post('/api/kontak', {
				data: { nama: '', email: 'bukan-email', pesan: '' },
			}),
		)
		expect(res.status()).toBe(400)
	})

	test('sitemap-index → sitemap anak berisi url', async ({ request }) => {
		const idx = await apiRetry(() => request.get('/sitemap-index.xml'))
		expect(idx.status()).toBe(200)
		const child = (await idx.text()).match(/<loc>([^<]+)<\/loc>/)?.[1]
		expect(child, 'sitemap index harus punya <loc>').toBeTruthy()
		const sitemap = await apiRetry(() => request.get(child as string))
		expect(sitemap.status()).toBe(200)
		const urls = ((await sitemap.text()).match(/<url>/g) ?? []).length
		expect(urls).toBeGreaterThan(0)
	})

	test('robots.txt merujuk sitemap', async ({ request }) => {
		const res = await apiRetry(() => request.get('/robots.txt'))
		expect(res.status()).toBe(200)
		expect(await res.text()).toContain('Sitemap')
	})

	test('homepage: konten Sanity dirender + JSON-LD valid', async ({ request }) => {
		const html = await (await apiRetry(() => request.get('/'))).text()
		expect(html).toContain('cdn.sanity.io/images/')
		const blocks = [
			...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
		]
		expect(blocks.length).toBeGreaterThan(0)
		for (const [, raw] of blocks) {
			expect(() => JSON.parse(raw)).not.toThrow()
		}
	})
})
