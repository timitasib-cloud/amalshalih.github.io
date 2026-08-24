import { defineMiddleware } from 'astro:middleware'
import { captureServerException } from '@lib/monitoring/logger'

const LEGACY_DOMAINS = ['amalshalih.id', 'www.amalshalih.id']
const CANONICAL_HOST = 'amalshalih.or.id'

export const onRequest = defineMiddleware(async (context, next) => {
	const { hostname, pathname } = context.url

	if (LEGACY_DOMAINS.includes(hostname)) {
		return context.redirect(`https://${CANONICAL_HOST}${pathname}`, 301)
	}

	let response: Response
	try {
		response = await next()
	} catch (error) {
		// Route errors are caught by Astro's pipeline before reaching the Worker-level
		// withSentry wrap, so report them here (production only).
		if (import.meta.env.PROD) {
			captureServerException(error, { source: 'astro-middleware', path: pathname })
		}
		throw error
	}
	const headers = new Headers(response.headers)

	// Content-Security-Policy — ENFORCEMENT (production security)
	// Covers: Google Fonts, Google Analytics, Google Tag Manager, Sanity CMS, Sentry, Resend, Google Drive, social embeds, OpenPanel, Cloudflare Insights, Ahrefs, DebugBear
	// Google CSP recommendations: https://developers.google.com/tag-platform/security/guides/csp
	headers.set(
		'Content-Security-Policy',
		"default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' https://*.sentry.io https://openpanel.dev https://cdn.debugbear.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://www.google.com https://*.google.com https://analytics.ahrefs.com; " +
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
			"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; " +
			"img-src 'self' data: blob: https://cdn.sanity.io https://images.unsplash.com https://unsplash.com https://amalshalih.or.id https://www.google.co.id https://*.google.co.id https://facebook.com https://instagram.com https://youtube.com https://tiktok.com https://wa.me https://www.google.com/maps https://linktr.ee https://www.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://*.google.com https://analytics.ahrefs.com; " +
			"connect-src 'self' https://*.ingest.us.sentry.io https://api.resend.com https://www.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com https://openpanel.dev https://api.openpanel.dev https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://*.google.com https://pagead2.googlesyndication.com https://analytics.ahrefs.com; " +
			"frame-src 'self' https://www.youtube.com https://youtube.com https://facebook.com https://instagram.com https://linktr.ee https://wa.me https://www.googletagmanager.com https://*.googletagmanager.com https://www.google.com https://*.google.com; " +
			"frame-ancestors 'none'; " +
			"form-action 'self' https://api.resend.com; " +
			"base-uri 'self'; media-src 'self'; object-src 'none'; worker-src 'self';",
	)

	// Content-Security-Policy-Report-Only — monitoring (optional, for testing new policies)
	headers.set(
		'Content-Security-Policy-Report-Only',
		"default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' https://*.sentry.io https://openpanel.dev https://cdn.debugbear.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://www.google.com https://*.google.com https://analytics.ahrefs.com; " +
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
			"font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; " +
			"img-src 'self' data: blob: https://cdn.sanity.io https://images.unsplash.com https://unsplash.com https://amalshalih.or.id https://www.google.co.id https://*.google.co.id https://facebook.com https://instagram.com https://youtube.com https://tiktok.com https://wa.me https://www.google.com/maps https://linktr.ee https://www.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://*.google.com https://analytics.ahrefs.com; " +
			"connect-src 'self' https://*.ingest.us.sentry.io https://api.resend.com https://www.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com https://openpanel.dev https://api.openpanel.dev https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://*.google.com https://pagead2.googlesyndication.com https://analytics.ahrefs.com; " +
			"frame-src 'self' https://www.youtube.com https://youtube.com https://facebook.com https://instagram.com https://linktr.ee https://wa.me https://www.googletagmanager.com https://*.googletagmanager.com https://www.google.com https://*.google.com; " +
			"frame-ancestors 'none'; " +
			"form-action 'self' https://api.resend.com; " +
			"base-uri 'self'; media-src 'self'; object-src 'none'; worker-src 'self';",
	)

	headers.set('X-Content-Type-Options', 'nosniff')
	headers.set('X-Frame-Options', 'DENY')
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
	headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
})
