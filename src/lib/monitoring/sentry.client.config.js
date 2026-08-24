import * as Sentry from '@sentry/astro'

// Only initialize Sentry in production builds, not in dev/preview
if (import.meta.env.PROD) {
	Sentry.init({
		dsn: 'https://e99692c45d83afc7713330e193ea5a9a@o4511465723396096.ingest.us.sentry.io/4511465782509568',
		sendDefaultPii: false,
		environment: 'production',
		integrations: [
			// send console.log, console.warn, and console.error calls as logs to Sentry
			Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
		],
		// Enable logs to be sent to Sentry
		enableLogs: true,
		beforeSend(event) {
			// Buang TypeError push-on-undefined yang berasal dari loader gtag
			// first-party Google Tag Gateway (/vfq0/*) — third-party, bukan kode
			// aplikasi. Frame klien mentah bisa memuat frame tambahan di luar
			// /vfq0/, jadi cukup SATU frame cocok + pesan spesifik.
			const values = event.exception?.values ?? []
			const fromTagGateway = values.some(
				(v) =>
					/Cannot read properties of undefined \(reading 'push'\)/.test(v.value ?? '') &&
					(v.stacktrace?.frames ?? []).some((f) => (f.filename ?? '').includes('/vfq0/')),
			)
			if (fromTagGateway) return null
			if ((event.culprit ?? '').includes('/vfq0/')) return null
			return event
		},
	})
}
