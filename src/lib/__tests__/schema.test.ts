import { describe, expect, it } from 'vitest'
import { articleSchema, breadcrumbSchema } from '../schema'

describe('articleSchema', () => {
	const base = {
		title: 'Judul Artikel',
		description: 'Deskripsi artikel',
		date: new Date('2025-06-01'),
		canonicalUrl: 'https://amalshalih.or.id/blog/artikel',
		siteName: 'Yayasan Amal Shalih Insan Bantul',
		siteUrl: 'https://amalshalih.or.id',
	}

	it('returns valid schema.org Article', () => {
		const result = articleSchema(base)
		expect(result['@context']).toBe('https://schema.org')
		expect(result['@type']).toBe('Article')
	})

	it('includes headline and description', () => {
		const result = articleSchema(base)
		expect(result.headline).toBe('Judul Artikel')
		expect(result.description).toBe('Deskripsi artikel')
	})

	it('includes ISO date strings', () => {
		const result = articleSchema(base)
		expect(result.datePublished).toBe('2025-06-01T00:00:00.000Z')
		expect(result.dateModified).toBe('2025-06-01T00:00:00.000Z')
	})

	it('includes Organization author and publisher', () => {
		const result = articleSchema(base)
		expect(result.author).toEqual({
			'@type': 'Organization',
			name: 'Yayasan Amal Shalih Insan Bantul',
			url: 'https://amalshalih.or.id',
		})
	})

	it('includes publisher with logo', () => {
		const result = articleSchema(base)
		expect(result.publisher['@type']).toBe('Organization')
		expect(result.publisher.logo['@type']).toBe('ImageObject')
		expect(result.publisher.logo.url).toContain('/logo-yayasan.webp')
	})

	it('includes image when provided', () => {
		const result = articleSchema({ ...base, image: 'https://example.com/img.jpg' })
		expect(result.image).toBeDefined()
		expect(result.image?.url).toBe('https://example.com/img.jpg')
	})

	it('omits image key when not provided', () => {
		const result = articleSchema(base)
		expect(result.image).toBeUndefined()
	})

	it('includes category and keywords when category provided', () => {
		const result = articleSchema({ ...base, category: 'Berita' })
		expect(result.articleSection).toBe('Berita')
		expect(result.keywords).toContain('Berita')
	})

	it('omits category fields when category not provided', () => {
		const result = articleSchema(base)
		expect(result.articleSection).toBeUndefined()
		expect(result.keywords).toBeUndefined()
	})

	it('includes mainEntityOfPage', () => {
		const result = articleSchema(base)
		expect(result.mainEntityOfPage).toEqual({
			'@type': 'WebPage',
			'@id': 'https://amalshalih.or.id/blog/artikel',
		})
	})
})

describe('breadcrumbSchema', () => {
	const siteUrl = 'https://amalshalih.or.id'

	it('returns valid schema.org BreadcrumbList', () => {
		const result = breadcrumbSchema([{ name: 'Home', url: '/' }], siteUrl)
		expect(result['@context']).toBe('https://schema.org')
		expect(result['@type']).toBe('BreadcrumbList')
	})

	it('generates numbered list items starting at 1', () => {
		const items = [
			{ name: 'Home', url: '/' },
			{ name: 'Blog', url: '/blog' },
		]
		const result = breadcrumbSchema(items, siteUrl)
		expect(result.itemListElement).toHaveLength(2)
		expect(result.itemListElement[0].position).toBe(1)
		expect(result.itemListElement[1].position).toBe(2)
	})

	it('resolves relative URLs to absolute', () => {
		const result = breadcrumbSchema([{ name: 'Blog', url: '/blog' }], siteUrl)
		expect(result.itemListElement[0].item).toBe('https://amalshalih.or.id/blog')
	})

	it('keeps absolute URLs as-is', () => {
		const result = breadcrumbSchema([{ name: 'External', url: 'https://other.com/page' }], siteUrl)
		expect(result.itemListElement[0].item).toBe('https://other.com/page')
	})

	it('handles items without URL', () => {
		const result = breadcrumbSchema([{ name: 'Current Page' }], siteUrl)
		expect(result.itemListElement[0].item).toBeUndefined()
		expect(result.itemListElement[0].name).toBe('Current Page')
	})
})
