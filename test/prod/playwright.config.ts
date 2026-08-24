import { defineConfig } from '@playwright/test'

/**
 * Live production test suite for https://amalshalih.or.id
 *
 * Layers:
 *  - 01-smoke.spec.ts    HTTP contract checks (no browser)
 *  - 02-browser.spec.ts  Real Chromium, zero-tolerance error collectors
 *  - sentry-audit        globalSetup/globalTeardown query Sentry API
 *                        to prove the crawl left zero new issues behind.
 */
export default defineConfig({
	testDir: '.',
	timeout: 90_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	workers: 4,
	// retries=1 hanya menelan flakiness infrastruktur (net::ERR_TIMED_OUT saat
	// navigasi). Collector zero-tolerance tetap berjalan di tiap attempt, jadi
	// error aplikasi nyata tetap menggagalkan test di kedua percobaan.
	retries: 2,
	globalSetup: './global-setup.ts',
	globalTeardown: './sentry-audit.teardown.ts',
	reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
	outputDir: './artifacts',
	use: {
		baseURL: 'https://amalshalih.or.id',
		channel: 'chrome',
		headless: true,
		navigationTimeout: 60_000,
		launchOptions: {
			args: ['--disable-quic'],
		},
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
})
