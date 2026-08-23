import { defineField, defineType } from 'sanity'

export const mitraType = defineType({
	name: 'mitra',
	title: 'Mitra & Donatur',
	type: 'document',
	fields: [
		defineField({
			name: 'name',
			title: 'Nama Mitra',
			type: 'string',
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: 'logo',
			title: 'Logo',
			type: 'image',
			description: 'Logo mitra (disarankan PNG transparan, rasio persegi)',
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: 'url',
			title: 'Website Mitra',
			type: 'url',
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
			title: 'name',
			subtitle: 'url',
			media: 'logo',
		},
	},
})
