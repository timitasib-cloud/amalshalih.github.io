import { defineField, defineType } from 'sanity'

export const barkasProdukType = defineType({
	name: 'barkasProduk',
	title: 'BARKAS — Produk',
	type: 'document',
	groups: [
		{ name: 'umum', title: 'Umum', default: true },
		{ name: 'harga', title: 'Harga & Kondisi' },
		{ name: 'media', title: 'Foto & Tag' },
	],
	fields: [
		defineField({
			name: 'name',
			title: 'Nama Produk',
			type: 'string',
			group: 'umum',
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: 'slug',
			title: 'ID Produk (slug)',
			type: 'slug',
			description: 'Dipakai sebagai URL, contoh: barkas-001',
			group: 'umum',
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: 'description',
			title: 'Deskripsi',
			type: 'text',
			rows: 4,
			group: 'umum',
		}),
		defineField({
			name: 'category',
			title: 'Kategori',
			type: 'string',
			group: 'umum',
			options: {
				list: [
					{ title: 'Furniture', value: 'furniture' },
					{ title: 'Elektronik', value: 'elektronik' },
					{ title: 'Buku & Alat Tulis', value: 'buku' },
					{ title: 'Pakaian', value: 'pakaian' },
					{ title: 'Kendaraan', value: 'kendaraan' },
					{ title: 'Lainnya', value: 'lainnya' },
				],
			},
		}),
		defineField({
			name: 'price',
			title: 'Harga (Rp)',
			type: 'number',
			group: 'harga',
			validation: (rule) => rule.min(0),
		}),
		defineField({
			name: 'originalPrice',
			title: 'Harga Baru / Perkiraan Nilai (Rp)',
			type: 'number',
			group: 'harga',
		}),
		defineField({
			name: 'condition',
			title: 'Kondisi',
			type: 'string',
			group: 'harga',
			options: {
				list: [
					{ title: 'Seperti Baru', value: 'used-excellent' },
					{ title: 'Kondisi Baik', value: 'used-good' },
					{ title: 'Layak Pakai', value: 'used-fair' },
				],
			},
		}),
		defineField({
			name: 'status',
			title: 'Status Ketersediaan',
			type: 'string',
			group: 'harga',
			initialValue: 'available',
			options: {
				list: [
					{ title: 'Tersedia', value: 'available' },
					{ title: 'Dipesan', value: 'reserved' },
					{ title: 'Terjual', value: 'sold' },
				],
			},
		}),
		defineField({
			name: 'images',
			title: 'Foto Produk',
			type: 'array',
			of: [{ type: 'image' }],
			group: 'media',
		}),
		defineField({
			name: 'donor',
			title: 'Donatur (atas nama)',
			type: 'string',
			group: 'umum',
		}),
		defineField({
			name: 'acquiredDate',
			title: 'Tanggal Diterima',
			type: 'date',
			group: 'umum',
		}),
		defineField({
			name: 'tags',
			title: 'Tag',
			type: 'array',
			of: [{ type: 'string' }],
			options: { layout: 'tags' },
			group: 'media',
		}),
		defineField({
			name: 'order',
			title: 'Urutan Tampil',
			type: 'number',
			initialValue: 0,
			group: 'umum',
		}),
		defineField({
			name: 'isActive',
			title: 'Aktif',
			type: 'boolean',
			initialValue: true,
			group: 'umum',
		}),
	],
	preview: {
		select: {
			title: 'name',
			subtitle: 'status',
			media: 'images.0',
		},
	},
})
