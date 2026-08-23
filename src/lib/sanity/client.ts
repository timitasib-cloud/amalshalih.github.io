import { sanityClient } from 'sanity:client'
import { cachedFetch, sanityCacheKey } from '@lib/kv-cache'
import { describeError, logError } from '@lib/monitoring/logger'
import {
	bankDonasiQuery,
	barkasProductListQuery,
	blogPostItemQuery,
	blogPostListQuery,
	faqListQuery,
	kegiatanItemQuery,
	kegiatanListQuery,
	mitraListQuery,
	pengurusQuery,
	programListQuery,
	siteSettingsQuery,
	testimoniListQuery,
} from './queries'
import type {
	SanityBankDonasi,
	SanityBarkasProduct,
	SanityBlogPost,
	SanityFaq,
	SanityKegiatan,
	SanityMitra,
	SanityPengurus,
	SanityProgram,
	SanitySiteSettings,
	SanityTestimoni,
} from './types'

/**
 * Sanity failures degrade gracefully (fallback data is returned), so they are
 * logged as structured events instead of reported as exceptions — a CMS outage
 * should not flood the issues stream.
 */
function reportSanityFailure(operation: string, error: unknown): void {
	console.error(`[Sanity] ${operation} failed:`, error)
	logError('sanity.fetch_failed', { operation, error_message: describeError(error) })
}

export async function getKegiatanList(): Promise<SanityKegiatan[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(kegiatanListQuery),
			fetcher: () => sanityClient.fetch(kegiatanListQuery),
		})
	} catch (error) {
		reportSanityFailure('getKegiatanList', error)
		return []
	}
}

export async function getKegiatanItem(slug: string): Promise<SanityKegiatan | null> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(kegiatanItemQuery, { slug }),
			fetcher: () => sanityClient.fetch(kegiatanItemQuery, { slug }),
		})
	} catch (error) {
		reportSanityFailure('getKegiatanItem', error)
		return null
	}
}

export async function getProgramList(): Promise<SanityProgram[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(programListQuery),
			fetcher: () => sanityClient.fetch(programListQuery),
		})
	} catch (error) {
		reportSanityFailure('getProgramList', error)
		return []
	}
}

export async function getBankDonasi(): Promise<SanityBankDonasi[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(bankDonasiQuery),
			fetcher: () => sanityClient.fetch(bankDonasiQuery),
		})
	} catch (error) {
		reportSanityFailure('getBankDonasi', error)
		return []
	}
}

export async function getPengurus(): Promise<SanityPengurus[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(pengurusQuery),
			fetcher: () => sanityClient.fetch(pengurusQuery),
		})
	} catch (error) {
		reportSanityFailure('getPengurus', error)
		return []
	}
}

export async function getMitraList(): Promise<SanityMitra[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(mitraListQuery),
			fetcher: () => sanityClient.fetch(mitraListQuery),
		})
	} catch (error) {
		reportSanityFailure('getMitraList', error)
		return []
	}
}

export async function getTestimoniList(): Promise<SanityTestimoni[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(testimoniListQuery),
			fetcher: () => sanityClient.fetch(testimoniListQuery),
		})
	} catch (error) {
		reportSanityFailure('getTestimoniList', error)
		return []
	}
}

export async function getBarkasProducts(): Promise<SanityBarkasProduct[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(barkasProductListQuery),
			fetcher: () => sanityClient.fetch(barkasProductListQuery),
		})
	} catch (error) {
		reportSanityFailure('getBarkasProducts', error)
		return []
	}
}

export async function getSiteSettings(): Promise<SanitySiteSettings | null> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(siteSettingsQuery),
			fetcher: () => sanityClient.fetch(siteSettingsQuery),
		})
	} catch (error) {
		reportSanityFailure('getSiteSettings', error)
		return null
	}
}

export async function getFaqList(): Promise<SanityFaq[] | null> {
	try {
		const faqs = await sanityClient.fetch<SanityFaq[]>(faqListQuery)
		return faqs || []
	} catch (error) {
		reportSanityFailure('getFaqList', error)
		return []
	}
}

export async function getBlogPostList(): Promise<SanityBlogPost[]> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(blogPostListQuery),
			fetcher: () => sanityClient.fetch(blogPostListQuery),
		})
	} catch (error) {
		reportSanityFailure('getBlogPostList', error)
		return []
	}
}

export async function getBlogPost(slug: string): Promise<SanityBlogPost | null> {
	try {
		return await cachedFetch({
			key: sanityCacheKey(blogPostItemQuery, { slug }),
			fetcher: () => sanityClient.fetch(blogPostItemQuery, { slug }),
		})
	} catch (error) {
		reportSanityFailure('getBlogPost', error)
		return null
	}
}
