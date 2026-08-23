/**
 * KV-based caching layer with stale-while-revalidate pattern
 * Uses LIKES namespace for cache storage
 */

import { env } from 'cloudflare:workers'
import { describeError, logError, logInfo, logWarn } from '@lib/monitoring/logger'

interface CachedValue<T> {
	data: T
	cachedAt: number
}

/**
 * Simple hash function for cache keys
 */
function hashKey(str: string): string {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(36)
}

/**
 * Get value from KV cache
 */
export async function kvGet<T>(key: string): Promise<T | null> {
	try {
		const value = await env.LIKES.get(key)
		if (!value) return null
		return JSON.parse(value) as T
	} catch (error) {
		console.error('[KV Cache] Get error:', error)
		return null
	}
}

/**
 * Set value in KV cache with TTL
 */
export async function kvSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	try {
		await env.LIKES.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds })
	} catch (error) {
		console.error('[KV Cache] Set error:', error)
	}
}

/**
 * Stale-while-revalidate cache fetch
 * - Returns cached value if fresh (within freshTtl)
 * - Returns stale value and revalidates in background if within staleTtl
 * - Fetches fresh if no cache or expired
 */
export async function cachedFetch<T>(options: {
	key: string
	fetcher: () => Promise<T>
	freshTtl?: number
	staleTtl?: number
}): Promise<T> {
	const { key, fetcher, freshTtl = 300, staleTtl = 3600 } = options

	try {
		const cached = await kvGet<CachedValue<T>>(key)

		if (cached) {
			const age = Date.now() - cached.cachedAt
			const ageSeconds = age / 1000

			// Fresh - return immediately
			if (ageSeconds < freshTtl) {
				return cached.data
			}

			// Stale but within staleTtl - return stale and revalidate in background
			if (ageSeconds < staleTtl) {
				logInfo('cache.stale_served', {
					cache: key.split(':')[0],
					age_seconds: Math.round(ageSeconds),
				})
				// Fire-and-forget revalidation
				fetcher()
					.then((fresh) => {
						kvSet(key, { data: fresh, cachedAt: Date.now() }, staleTtl).catch((err) => {
							console.error(`[KV Cache] Background set failed for key ${key}:`, err)
							logWarn('cache.background_set_failed', {
								cache: key.split(':')[0],
								error_message: describeError(err),
							})
						})
					})
					.catch((err) => {
						console.error(`[KV Cache] Background revalidation failed for key ${key}:`, err)
						logWarn('cache.revalidation_failed', {
							cache: key.split(':')[0],
							error_message: describeError(err),
						})
					})

				return cached.data
			}
		}

		// No cache or expired - fetch fresh
		const fresh = await fetcher()
		await kvSet(key, { data: fresh, cachedAt: Date.now() }, staleTtl)
		return fresh
	} catch (error) {
		console.error('[KV Cache] Fetch error:', error)
		// Fallback to direct fetch if cache fails
		logError('cache.fetch_fallback', {
			cache: key.split(':')[0],
			error_message: describeError(error),
		})
		return fetcher()
	}
}

/**
 * Generate cache key for Sanity queries
 */
export function sanityCacheKey(query: string, params?: Record<string, unknown>): string {
	const paramStr = params ? JSON.stringify(params) : ''
	return `sanity:${hashKey(query + paramStr)}`
}

/**
 * Generate cache key for Google Drive queries
 */
export function driveCacheKey(endpoint: string): string {
	return `gdrive:${hashKey(endpoint)}`
}
