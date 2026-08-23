/**
 * Server-side Sentry structured logging helpers.
 *
 * Dynamic imports keep this module safe everywhere:
 * - unit tests never need the Sentry runtime
 * - monitoring failures can never break request handling
 */

type LogLevel = 'info' | 'warn' | 'error'

export type LogAttributes = Record<string, string | number | boolean>

async function captureLog(
	level: LogLevel,
	message: string,
	attributes?: LogAttributes,
): Promise<void> {
	try {
		const Sentry = await import('@sentry/cloudflare')
		Sentry.logger[level](message, attributes)
	} catch {
		// Monitoring must never break request handling.
	}
}

/** Informational event (e.g. degraded-mode behavior that recovered). */
export function logInfo(message: string, attributes?: LogAttributes): void {
	void captureLog('info', message, attributes)
}

/** Something suspicious but handled (e.g. third-party API rejected a request). */
export function logWarn(message: string, attributes?: LogAttributes): void {
	void captureLog('warn', message, attributes)
}

/** Handled failure worth alerting on (e.g. data source unreachable). */
export function logError(message: string, attributes?: LogAttributes): void {
	void captureLog('error', message, attributes)
}

/**
 * Flat, searchable summary of an unknown thrown value.
 * Attributes must be primitives, so errors are stringified and truncated.
 */
export function describeError(error: unknown): string {
	const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
	return text.slice(0, 200)
}

/** Report an exception to Sentry (fire-and-forget, production-safe). */
export function captureServerException(error: unknown, tags?: Record<string, string>): void {
	import('@sentry/cloudflare')
		.then((Sentry) => {
			Sentry.captureException(error, tags ? { tags } : undefined)
		})
		.catch(() => {
			// Monitoring must never break request handling.
		})
}
