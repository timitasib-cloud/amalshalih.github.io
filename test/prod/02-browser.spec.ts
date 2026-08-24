import { expect, type Page, test } from '@playwright/test'

const CRAWL_PATHS = [
	'/',
	'/kegiatan',
	'/program',
	'/donasi',
	'/blog',
	'/faq',
	'/galeri',
	'/barkas',
	'/barkas/barkas-001',
] as const

interface Issue {
	kind: string
	detail: string
}

/**
 * Navigasi tahan-gangguan: jaringan lokal sesekali drop 30–120 detik.
 * Ulangi hanya saat timeout jaringan; error lain langsung dilempar.
 */
async function resilientGoto(
	page: Page,
	url: string,
	waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'load',
	tries = 3,
): Promise<ReturnType<Page['goto']>> {
	let lastError: unknown
	for (let attempt = 1; attempt <= tries; attempt++) {
		try {
			return await page.goto(url, { waitUntil, timeout: 20_000 })
		} catch (error) {
			lastError = error
			if (
				!/ERR_TIMED_OUT|ERR_ABORTED|Timeout|TLS|ERR_NETWORK|ERR_CONNECTION|crashed/i.test(
					String(error),
				)
			)
				throw error
			if (attempt < tries) await page.waitForTimeout(8_000)
		}
	}
	throw lastError
}

/** Zero-tolerance collectors: pageerror, console.error/warning, requestfailed, HTTP >= 400. */
function attachCollectors(page: Page): Issue[] {
	const issues: Issue[] = []
	page.on('pageerror', (err) =>
		issues.push({ kind: 'pageerror', detail: String(err).slice(0, 300) }),
	)
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			issues.push({ kind: 'console.error', detail: msg.text().slice(0, 300) })
		} else if (msg.type() === 'warning') {
			issues.push({ kind: 'console.warning', detail: msg.text().slice(0, 300) })
		}
	})
	page.on('requestfailed', (req) => {
		const err = req.failure()?.errorText ?? '?'
		// net::ERR_ABORTED pada beacon same-origin (GA4 first-party) = pembatalan
		// navigasi oleh browser, bukan kegagalan aplikasi.
		if (err === 'net::ERR_ABORTED' && req.url().startsWith('https://amalshalih.or.id/')) return
		issues.push({
			kind: 'requestfailed',
			detail: `${req.method()} ${req.url()} :: ${err}`,
		})
	})
	page.on('response', (res) => {
		if (res.status() >= 400)
			issues.push({ kind: 'http>=400', detail: `${res.status()} ${res.url()}` })
	})
	return issues
}

test.describe('Layer 2 — Browser zero-tolerance', () => {
	for (const path of CRAWL_PATHS) {
		test(`render bersih ${path}`, async ({ page }) => {
			const issues = attachCollectors(page)
			// domcontentloaded cukup: collector sudah terpasang sebelum goto, dan
			// event 'load' bisa tertahan beacon pihak ketiga (openpanel/gtag).
			await resilientGoto(page, path, 'domcontentloaded')
			// Best-effort: biarkan jaringan tenang, tapi jangan gagalkan test bila
			// ada resource yang tak pernah idle (CDN lambat, beacon panjang).
			await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
			await page.waitForTimeout(2_000)
			expect(
				issues,
				`Ditemukan masalah di ${path}:\n${issues.map((i) => `[${i.kind}] ${i.detail}`).join('\n')}`,
			).toEqual([])
		})
	}

	test('envelope Sentry terkirim dari browser', async ({ page }) => {
		let envelopes = 0
		page.on('request', (req) => {
			if (/ingest\.us\.sentry\.io\//.test(req.url()) && req.method() === 'POST') envelopes++
		})
		await resilientGoto(page, '/')
		// Session + structured logs di-flush dalam beberapa detik pertama.
		await page.waitForTimeout(8_000)
		expect(envelopes, 'Tidak ada envelope POST ke ingest Sentry').toBeGreaterThanOrEqual(1)
	})

	test('tombol suka galeri bekerja end-to-end (KV nyata)', async ({ page }) => {
		let likeStatus = 0
		let postResult: { count?: number; liked?: boolean } | null = null
		page.on('response', async (res) => {
			if (!res.url().includes('/api/gallery-like')) return
			if (res.request().method() !== 'POST') return
			likeStatus = res.status()
			try {
				postResult = (await res.json()) as { count?: number; liked?: boolean }
			} catch {
				postResult = null
			}
		})
		// Listing /galeri tidak memuat tombol suka — buka item galeri pertama.
		await resilientGoto(page, '/galeri')
		const detailHref = await page.locator('a[href^="/galeri/"]').first().getAttribute('href')
		if (!detailHref) throw new Error('minimal satu item galeri harus ada')
		const button = page
			.locator('[data-like-container]')
			.filter({ has: page.locator('[data-like-button]') })
			.first()
			.locator('[data-like-button]')
		await resilientGoto(page, detailHref)
		await expect(button).toBeVisible()

		await button.click()
		await expect
			.poll(() => likeStatus, { timeout: 20_000, intervals: [500, 1_000, 2_000] })
			.toBe(200)
		await expect
			.poll(() => (postResult ? postResult.count : null), { timeout: 10_000 })
			.not.toBeNull()

		// UI harus mencerminkan hasil server (arah like/unlike tidak dipaksakan —
		// fingerprint IP+UA stabil membuat klik bersifat toggle antar-run).
		const result = postResult as unknown as { count: number; liked: boolean }
		const parseCount = (t: string | null) => Number((t ?? '').replace(/[^\d]/g, '')) || 0
		const countEl = button.locator(
			'xpath=ancestor::div[@data-like-container]//span[@data-like-count]',
		)
		await expect
			.poll(async () => parseCount(await countEl.textContent()), { timeout: 15_000 })
			.toBe(result.count)
		await expect(button).toHaveAttribute('data-liked', String(result.liked))
	})

	test('form kontak ter-render lengkap & validasi klien aktif', async ({ page }) => {
		await resilientGoto(page, '/kontak')
		await expect(page.locator('#nama')).toBeVisible()
		await expect(page.locator('#email')).toBeVisible()
		await expect(page.locator('#pesan')).toBeVisible()

		let kontakPosted = false
		page.on('request', (req) => {
			if (req.url().includes('/api/kontak') && req.method() === 'POST') kontakPosted = true
		})
		await page.locator('#nama').fill('Tes Otomatis')
		await page.locator('#email').fill('email-invalid')
		await page.locator('#pesan').fill('Uji validasi tanpa pengiriman.')
		await page.getByRole('button', { name: /kirim/i }).click()
		await page.waitForTimeout(1_500)
		expect(
			kontakPosted,
			'Form dengan email invalid tidak boleh mencapai server (validasi HTML5 harus menahan)',
		).toBe(false)
	})

	test('SEO dasar halaman kunci', async ({ page }) => {
		for (const path of ['/', '/barkas/barkas-001']) {
			await resilientGoto(page, path, 'domcontentloaded')
			await expect(page).toHaveTitle(/— Yayasan ASIB$|BARKAS/i)
			const desc = await page.locator('meta[name="description"]').getAttribute('content')
			expect(desc?.length ?? 0).toBeGreaterThan(50)
			const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
			expect(canonical, `canonical ${path}`).toMatch(/^https:\/\/amalshalih\.or\.id/)
		}
	})
})
