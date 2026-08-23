/**
 * Global error handler for client-side errors
 * Captures uncaught errors and sends to Sentry
 */

import { showErrorToast } from './toast-utils'

interface ErrorHandlerOptions {
	showUserMessage?: boolean
	logToConsole?: boolean
	sendToSentry?: boolean
	context?: Record<string, unknown>
}

const defaultOptions: ErrorHandlerOptions = {
	showUserMessage: true,
	logToConsole: import.meta.env.DEV,
	sendToSentry: !import.meta.env.DEV,
	context: {},
}

/**
 * Handle uncaught errors globally
 */
export function handleError(
	error: Error | unknown,
	options: ErrorHandlerOptions = defaultOptions,
): void {
	const opts = { ...defaultOptions, ...options }

	// Log to console in development
	if (opts.logToConsole) {
		console.error('[Global Error Handler]:', error)
		if (opts.context && Object.keys(opts.context).length > 0) {
			console.error('[Context]:', opts.context)
		}
	}

	// Send to Sentry in production (lazy import — only loaded when error occurs)
	if (opts.sendToSentry && typeof window !== 'undefined') {
		import('@sentry/astro')
			.then((Sentry) => {
				Sentry.captureException(error, {
					extra: opts.context,
					tags: {
						source: 'client',
						type: error instanceof Error ? error.name : 'UnknownError',
					},
				})

				// Structured log alongside the issue — searchable, with primitive
				// attributes only (Sentry log attributes do not support objects).
				const attrs: Record<string, string | number | boolean> = {
					error_type: error instanceof Error ? error.name : 'UnknownError',
				}
				for (const [key, value] of Object.entries(opts.context ?? {})) {
					if (
						typeof value === 'string' ||
						typeof value === 'number' ||
						typeof value === 'boolean'
					) {
						attrs[key] = value
					}
				}
				Sentry.logger.error('client.error_captured', attrs)
			})
			.catch(() => {
				// Sentry not available — silently ignore
			})
	}

	// Show user-friendly message
	if (opts.showUserMessage && typeof window !== 'undefined') {
		const userMessage =
			error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.'

		// Don't show technical errors to users in production
		const safeMessage = import.meta.env.PROD
			? 'Terjadi kesalahan. Tim kami telah diberitahu.'
			: userMessage

		showErrorToast(safeMessage)
	}
}

/**
 * Setup global error listeners
 */
export function initGlobalErrorHandling(): void {
	if (typeof window === 'undefined') return

	// Uncaught errors
	window.addEventListener('error', (event) => {
		event.preventDefault()
		handleError(event.error || event.message, {
			context: {
				url: window.location.href,
				userAgent: navigator.userAgent,
			},
		})
	})

	// Unhandled promise rejections
	window.addEventListener('unhandledrejection', (event) => {
		event.preventDefault()
		handleError(event.reason || new Error('Unhandled promise rejection'), {
			context: {
				type: 'unhandledrejection',
				url: window.location.href,
			},
		})
	})

	console.log('[Global Error Handling] Initialized')
}

/**
 * Async error wrapper for API calls
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T>,
	errorMessage: string = 'Operasi gagal diselesaikan',
): Promise<T | null> {
	try {
		return await fn()
	} catch (error) {
		handleError(error, {
			context: {
				operation: errorMessage,
			},
		})
		return null
	}
}
