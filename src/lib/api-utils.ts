/**
 * API utility helpers
 */
import { captureServerException, describeError, logError } from '@lib/monitoring/logger'

export function apiErrorResponse(error: unknown, context: string): Response {
	console.error(`[API /${context}] Error:`, error)
	// Fire-and-forget: the 5xx response must never wait on monitoring.
	captureServerException(error, { source: 'api', context })
	logError('api.request_failed', { context, error_message: describeError(error) })
	const message = error instanceof Error ? error.message : String(error)
	return new Response(JSON.stringify({ error: message }), {
		status: 500,
		headers: { 'Content-Type': 'application/json' },
	})
}
