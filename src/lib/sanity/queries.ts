// GROQ queries for fetching ASIB content from Sanity

export const faqListQuery = `*[_type == "faq" && isActive == true] | order(order asc) {
  _id,
  category,
  items[] {
    tanya,
    jawab,
    order
  },
  order
}`

export const kegiatanListQuery = `*[_type == "kegiatan"] | order(date desc) {
  _id,
  title,
  "slug": slug.current,
  date,
  category,
  excerpt,
  "imageUrl": image.asset->url,
  "imageAlt": image.alt
}`

export const kegiatanItemQuery = `*[_type == "kegiatan" && slug.current == $slug][0] {
  _id,
  title,
  "slug": slug.current,
  date,
  category,
  excerpt,
  "imageUrl": image.asset->url,
  "imageAlt": image.alt,
  body
}`

export const programListQuery = `*[_type == "program"] | order(order asc) {
  _id,
  title,
  "slug": slug.current,
  category,
  icon,
  shortDesc,
  badge,
  cardVariant,
  stats[]{ number, label },
  "imageUrl": image.asset->url,
  "imageAlt": image.alt
}`

export const bankDonasiQuery = `*[_type == "bankDonasi" && isActive == true] | order(order asc) {
  _id,
  bankName,
  accountNumber,
  accountName,
  "logoUrl": logo.asset->url
}`

export const pengurusQuery = `*[_type == "pengurus"] | order(order asc) {
  _id,
  name,
  position,
  description,
  "photoUrl": photo.asset->url,
  "photoAlt": photo.alt
}`

export const blogPostListQuery = `*[_type == "blogPost" && defined(slug.current)] | order(date desc) {
  _id,
  title,
  "slug": slug.current,
  date,
  category,
  author,
  excerpt,
  "imageUrl": image.asset->url,
  "imageAlt": image.alt
}`

export const blogPostItemQuery = `*[_type == "blogPost" && slug.current == $slug][0] {
  _id,
  title,
  "slug": slug.current,
  date,
  category,
  author,
  excerpt,
  "imageUrl": image.asset->url,
  "imageAlt": image.alt,
  body
}`

export const siteSettingsQuery = `*[_type == "siteSettings"][0] {
  siteName,
  shortName,
  description,
  footerCopyright,
  aboutContent,
  visi,
  misi,
  address,
  phone,
  whatsapp,
  email,
  emails,
  operatingHours,
  operatingHoursDetail,
  legal,
  "qrisImageUrl": qrisImage.asset->url,
  mapsUrl,
  linktree,
  socialMedia,
  tagline,
  heroTitle,
  heroDescription,
  heroCtaText,
  heroCtaLink,
  stats[]{ number, label },
  breadcrumbLabels,
  emptyStateTexts,
  galleryCategoryGradients[]{ category, gradient },
  galleryCategoryIcons[]{ category, icon },
  kategoriLabels,
  navItems[]{ label, href },
  notFoundTitle,
  notFoundDescription
}`

// Mitra & donatur (partners)
export const mitraListQuery = `*[_type == "mitra" && isActive == true] | order(order asc) {
  _id,
  name,
  "logoUrl": logo.asset->url,
  url
}`

// Testimoni
export const testimoniListQuery = `*[_type == "testimoni" && isActive == true] | order(order asc) {
  _id,
  quote,
  author,
  role,
  "photoUrl": photo.asset->url,
  rating
}`

// Produk BARKAS (barang bekas layak pakai)
export const barkasProductListQuery = `*[_type == "barkasProduk" && isActive == true] | order(order asc) {
  _id,
  "productId": slug.current,
  name,
  description,
  category,
  price,
  originalPrice,
  condition,
  status,
  images[]{ "url": asset->url },
  donor,
  acquiredDate,
  tags
}`
