/**
 * Seed Sanity CMS dengan data awal yang sebelumnya hardcoded.
 *
 * Migrasi: mitra (Partners), testimoni (Testimonials), barkasProduk (barkas-products.json)
 * Idempoten - tipe dokumen yang sudah punya data akan dilewati.
 *
 * Jalankan: bun run scripts/seed-sanity-media.mjs
 * Butuh: SANITY_API_WRITE_TOKEN di .env
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@sanity/client'

// --- load .env sederhana ---
const envPath = resolve(process.cwd(), '.env')
try {
	for (const line of readFileSync(envPath, 'utf8').split('\n')) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
		if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
	}
} catch {}

const token = process.env.SANITY_API_WRITE_TOKEN
if (!token) {
	console.error('SANITY_API_WRITE_TOKEN tidak ditemukan di .env')
	process.exit(1)
}

const client = createClient({
	projectId: '9yj0dq9v',
	dataset: 'production',
	apiVersion: '2025-01-01',
	token,
	useCdn: false,
})

async function countDocs(type) {
	return client.fetch(`count(*[_type == $type])`, { type })
}

async function uploadImage(filePath) {
	const rel = filePath.replace(/^\//, '')
	const buffer = readFileSync(resolve(process.cwd(), 'public', rel))
	const asset = await client.assets.upload('image', buffer, {
		filename: filePath.split('/').pop(),
	})
	return { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
}

async function seedType(type, label, buildDocs) {
	const total = await countDocs(type)
	if (total > 0) {
		console.log(`LEWATI ${label}: sudah ada ${total} dokumen`)
		return 0
	}
	const docs = await buildDocs()
	if (docs.length === 0) {
		console.log(`LEWATI ${label}: tidak ada data lokal`)
		return 0
	}
	const tx = client.transaction()
	for (const doc of docs) tx.create(doc)
	await tx.commit()
	console.log(`OK ${label}: ${docs.length} dokumen dibuat`)
	return docs.length
}

// ---------- 1. MITRA ----------
const MITRA = [
	{ name: 'Kementerian Sosial RI', logo: '/partners/kemensos.png', url: 'https://kemensos.go.id' },
	{ name: 'Baznas', logo: '/partners/baznas.png', url: 'https://baznas.go.id' },
	{ name: 'Dompet Dhuafa', logo: '/partners/dompet-dhuafa.png', url: 'https://dompetdhuafa.org' },
	{ name: 'Rumah Zakat', logo: '/partners/rumah-zakat.png', url: 'https://rumahzakat.org' },
	{ name: 'Kitabisa.com', logo: '/partners/kitabisa.png', url: 'https://kitabisa.com' },
	{ name: 'Pemkab Bantul', logo: '/partners/pemkab-bantul.png', url: 'https://bantulkab.go.id' },
]

async function buildMitra() {
	const out = []
	let i = 0
	for (const m of MITRA) {
		try {
			const logo = await uploadImage(m.logo)
			out.push({ _type: 'mitra', name: m.name, logo, url: m.url, order: i++, isActive: true })
		} catch (e) {
			console.warn(`GAGAL upload logo ${m.logo}: ${e.message}`)
		}
	}
	return out
}

// ---------- 2. TESTIMONI ----------
const TESTIMONI = [
	{
		quote:
			'Alhamdulillah, berkat bantuan beasiswa dari Yayasan ASIB, anak saya bisa melanjutkan pendidikan ke perguruan tinggi. Sekarang dia sudah menjadi guru dan mengabdi di kampung halaman.',
		author: 'Ibu Siti Maimunah',
		role: 'Orang Tua Penerima Manfaat Beasiswa',
	},
	{
		quote:
			'Program santunan sembako bulanan sangat membantu kami para lansia yang sudah tidak mampu bekerja lagi. Semoga Yayasan ASIB semakin berjaya dan bisa membantu lebih banyak lagi.',
		author: 'Bapak Suharto',
		role: 'Penerima Santunan Lansia',
	},
	{
		quote:
			'Saya rutin berdonasi melalui Yayasan ASIB karena transparan dan laporan kegiatannya jelas. Alhamdulillah, donasi saya tersalurkan dengan baik untuk yang membutuhkan.',
		author: 'Ahmad Rizki Pratama',
		role: 'Donatur Tetap',
	},
	{
		quote:
			"Kegiatan wisuda Tahfidz yang diselenggarakan Yayasan ASIB sangat menginspirasi. Anak-anak tidak hanya hafal Qur'an tapi juga mendapat pendidikan karakter yang baik.",
		author: 'Ustadzah Hj. Nur Aisyah',
		role: 'Pengajar TPQ',
	},
]

function buildTestimoni() {
	return TESTIMONI.map((t, i) => ({
		_type: 'testimoni',
		...t,
		rating: 5,
		order: i,
		isActive: true,
	}))
}

// ---------- 3. BARKAS PRODUK ----------
async function buildBarkas() {
	const json = JSON.parse(
		readFileSync(resolve(process.cwd(), 'src/data/barkas-products.json'), 'utf8'),
	)
	const out = []
	let i = 0
	for (const p of json.products) {
		const images = []
		for (const imgPath of p.images || []) {
			try {
				images.push(await uploadImage(imgPath))
			} catch (e) {
				console.warn(`GAGAL upload gambar ${imgPath}: ${e.message}`)
			}
		}
		out.push({
			_type: 'barkasProduk',
			name: p.name,
			slug: { _type: 'slug', current: p.id },
			description: p.description,
			category: p.category,
			price: p.price ?? 0,
			originalPrice: p.originalPrice,
			condition: p.condition,
			status: p.status,
			donor: p.donor,
			acquiredDate: p.acquiredDate,
			tags: p.tags || [],
			images,
			order: i++,
			isActive: true,
		})
	}
	return out
}

// Patch gambar untuk barkasProduk yang sudah dibuat tanpa images
async function patchBarkasImages() {
	const json = JSON.parse(
		readFileSync(resolve(process.cwd(), 'src/data/barkas-products.json'), 'utf8'),
	)
	const existing = await client.fetch(
		'*[_type == "barkasProduk"]{ _id, "productId": slug.current, images }',
	)
	let patched = 0
	for (const doc of existing) {
		if (doc.images && doc.images.length > 0) continue
		const local = json.products.find((p) => p.id === doc.productId)
		if (!local?.images?.length) continue
		const images = []
		for (const imgPath of local.images) {
			try {
				images.push(await uploadImage(imgPath))
			} catch (e) {
				console.warn(`GAGAL upload ${imgPath}: ${e.message}`)
			}
		}
		if (images.length > 0) {
			await client.patch(doc._id).set({ images }).commit()
			patched++
			console.log(`PATCH ${doc.productId}: ${images.length} gambar`)
		}
	}
	console.log(`OK BARKAS images: ${patched} dokumen di-patch`)
}

console.log('=== SEED SANITY CMS ===')
await seedType('mitra', 'Mitra & Donatur', buildMitra)
await seedType('testimoni', 'Testimoni', buildTestimoni)
await seedType('barkasProduk', 'BARKAS Produk', buildBarkas)
await patchBarkasImages()
console.log('=== SEED SELESAI ===')
