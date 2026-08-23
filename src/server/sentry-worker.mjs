// Worker entry dengan Sentry untuk Cloudflare Workers.
//
// @sentry/astro hanya membungkus worker otomatis pada @astrojs/cloudflare v12
// (id virtual "astrojs-ssr-virtual-entry" tidak ada lagi di adapter v13/Astro 6),
// jadi pembungkusan dilakukan manual mengikuti pola resmi Sentry:
// https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/
//
// File ini dipakai sebagai "main" di wrangler.jsonc dan dibundle adapter
// bersama aplikasi Astro, jadi cukup mengimpor entrypoint sumber adapter.
// DSN dll dibaca dari vars Worker di wrangler.jsonc oleh getFinalOptions()
// (@sentry/cloudflare).

import handler from '@astrojs/cloudflare/entrypoints/server'
import * as Sentry from '@sentry/cloudflare'

export default Sentry.withSentry(
	(env) => ({
		tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE ?? '1.0'),
		enableLogs: true,
	}),
	handler,
)
