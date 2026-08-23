import { bankDonasiType } from './bankDonasi'
import { barkasProdukType } from './barkasProduk'
import { blockContentType } from './blockContent'
import { blogPostType } from './blogPost'
import { faqType } from './faq'
import { kegiatanType } from './kegiatan'
import { mitraType } from './mitra'
import { pengurusType } from './pengurus'
import { programType } from './program'
import { siteSettingsType } from './siteSettings'
import { testimoniType } from './testimoni'

export const schemaTypes = [
	// Existing schemas
	kegiatanType,
	programType,
	bankDonasiType,
	pengurusType,
	siteSettingsType,
	blockContentType,
	// Add FAQ schema
	faqType,
	// Blog post schema
	blogPostType,
	// Media & publikasi managed content
	mitraType,
	testimoniType,
	barkasProdukType,
]
