import barkasData from '@data/barkas-products.json'
import { getBarkasProducts } from '@lib/sanity/client'
import type { SanityBarkasProduct } from '@lib/sanity/types'
import { withFallback } from '@lib/with-fallback'

export interface BarkasProduct {
	id: string
	name: string
	description: string
	category: string
	price: number
	originalPrice?: number
	condition: string
	status: string
	images: string[]
	donor?: string
	acquiredDate?: string
	tags?: string[]
}

function mapSanityProduct(p: SanityBarkasProduct): BarkasProduct {
	return {
		id: p.productId,
		name: p.name,
		description: p.description || '',
		category: p.category || 'lainnya',
		price: p.price ?? 0,
		originalPrice: p.originalPrice,
		condition: p.condition || 'used-good',
		status: p.status || 'available',
		images: (p.images || []).map((i) => i.url).filter(Boolean),
		donor: p.donor,
		acquiredDate: p.acquiredDate,
		tags: p.tags,
	}
}

/**
 * Resolve BARKAS products — Sanity-first dengan fallback ke barkas-products.json.
 * Tim media mengelola produk via Sanity (schema: barkasProduk).
 */
export async function resolveBarkasProducts(): Promise<BarkasProduct[]> {
	const sanityProducts = await withFallback(
		() => getBarkasProducts(),
		[] as SanityBarkasProduct[],
		'BARKAS products fetch',
	)
	if (sanityProducts.length > 0) {
		return sanityProducts.map(mapSanityProduct)
	}
	return barkasData.products as BarkasProduct[]
}

export const barkasCategories = barkasData.categories
export const barkasProgramInfo = barkasData.programInfo
