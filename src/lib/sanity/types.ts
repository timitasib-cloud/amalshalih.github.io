export interface SanityKegiatan {
	_id: string
	title: string
	slug: string
	date: string
	category: 'pendidikan' | 'keagamaan' | 'sosial' | 'berita'
	excerpt?: string
	imageUrl?: string
	imageAlt?: string
	body?: unknown
}

export interface SanityProgram {
	_id: string
	title: string
	slug?: string
	category: 'pendidikan' | 'keagamaan' | 'sosial'
	icon?: string
	shortDesc?: string
	imageUrl?: string
	imageAlt?: string
	badge?: string
	cardVariant?: 'default' | 'overflow'
	stats?: { number: string; label: string }[]
}

export interface SanityBankDonasi {
	_id: string
	bankName: string
	accountNumber: string
	accountName: string
	logoUrl?: string
}

export interface SanityPengurus {
	_id: string
	name: string
	position: string
	description?: string
	photoUrl?: string
	photoAlt?: string
}

export interface SanityBlogPost {
	_id: string
	title: string
	slug: string
	date: string
	category?: string
	author?: string
	excerpt?: string
	imageUrl?: string
	imageAlt?: string
	body?: unknown
}

export interface SanitySiteSettings {
	siteName?: string
	shortName?: string
	description?: string
	footerCopyright?: string
	aboutContent?: unknown
	visi?: string
	misi?: string[]
	address?: {
		street?: string
		village?: string
		district?: string
		city?: string
		province?: string
		postalCode?: string
	}
	phone?: string
	whatsapp?: string
	email?: string
	emails?: {
		info?: string
		donasi?: string
		admin?: string
		humas?: string
		gmail?: string
	}
	operatingHours?: string
	operatingHoursDetail?: {
		weekdays?: string
		saturday?: string
		sunday?: string
	}
	qrisImageUrl?: string
	mapsUrl?: string
	linktree?: string
	socialMedia?: {
		facebook?: string
		instagram?: string
		youtube?: string
		tiktok?: string
	}
	legal?: {
		foundedDate?: string
		sk?: string
		nib?: string
		npwp?: string
		kbli?: string
	}
	tagline?: string
	heroTitle?: string
	heroDescription?: string
	heroCtaText?: string
	heroCtaLink?: string
	stats?: {
		number: string
		label: string
	}[]
	breadcrumbLabels?: {
		beranda?: string
		tentang?: string
		program?: string
		kegiatan?: string
		donasi?: string
		kontak?: string
		blog?: string
		galeri?: string
		faq?: string
	}
	emptyStateTexts?: {
		gallery?: string
		kegiatan?: string
		blog?: string
	}
	galleryCategoryGradients?: {
		category: string
		gradient: string
	}[]
	galleryCategoryIcons?: {
		category: string
		icon: string
	}[]
	kategoriLabels?: {
		pendidikan?: string
		keagamaan?: string
		sosial?: string
		umum?: string
	}
	navItems?: {
		label: string
		href: string
	}[]
	ctaButton?: {
		text: string
		href: string
		isEnabled?: boolean
	}
	notFoundTitle?: string
	notFoundDescription?: string
}

export type SanityFaq = {
	_id: string
	category: 'tentang-yayasan' | 'donasi' | 'umum'
	items: {
		tanya: string
		jawab: unknown
		order: number
	}[]
	order: number
	isActive: boolean
}

export interface SanityMitra {
	_id: string
	name: string
	logoUrl?: string
	url?: string
}

export interface SanityTestimoni {
	_id: string
	quote: string
	author: string
	role?: string
	photoUrl?: string
	rating?: number
}

export interface SanityBarkasProduct {
	_id: string
	productId: string
	name: string
	description?: string
	category?: string
	price?: number
	originalPrice?: number
	condition?: string
	status?: string
	images?: { url: string }[]
	donor?: string
	acquiredDate?: string
	tags?: string[]
}
