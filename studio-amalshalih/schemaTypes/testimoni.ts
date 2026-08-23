import { defineField, defineType } from 'sanity'

export const testimoniType = defineType({
	name: 'testimoni',
	title: 'Testimoni',
	type: 'document',
	fields: [
		defineField({
			name: 'quote',
			title: 'Isi Testimoni',
			type: 'text',
			rows: 4,
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: 'author',
			title: 'Nama',
			type: 'string',
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: 'role',
			title: 'Peran / Keterangan',
			type: 'string',
			description: 'Contoh: Orang Tua Penerima Manfaat Beasiswa',
		}),
		defineField({
			name: 'photo',
			title: 'Foto (opsional)',
			type: 'image',
		}),
		defineField({
			name: 'rating',
			title: 'Rating Bintang',
			type: 'number',
			initialValue: 5,
			validation: (rule) => rule.min(1).max(5),
		}),
		defineField({
			name: 'order',
			title: 'Urutan Tampil',
			type: 'number',
			initialValue: 0,
		}),
		defineField({
			name: 'isActive',
			title: 'Aktif',
			type: 'boolean',
			initialValue: true,
		}),
	],
	preview: {
		select: {
			title: 'author',
			subtitle: 'role',
			media: 'photo',
		},
	},
})
