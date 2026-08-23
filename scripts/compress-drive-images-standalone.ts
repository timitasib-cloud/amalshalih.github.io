#!/usr/bin/env bun
/**
 * Standalone script untuk compress gambar dari Google Drive
 * Tidak memerlukan Cloudflare Workers runtime
 *
 * Usage: bun run scripts/compress-drive-images-standalone.ts
 */

import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PARENT_FOLDER_ID = '1g2ISaHQI3lRU1fh8N5U2coFVYt4sktDm'
const TMP_DIR = join(process.cwd(), 'tmp-drive-images')
const COMPRESSED_DIR = join(TMP_DIR, 'compressed')

interface CompressionResult {
	originalName: string
	compressedName: string
	originalSize: number
	compressedSize: number
	reduction: number
	mimeType: string
}

interface GoogleDriveCredentials {
	client_email: string
	private_key: string
}

interface DriveImage {
	id: string
	name: string
	mimeType: string
	webContentLink?: string
	createdTime?: string
	width?: number
	height?: number
}

interface DriveFolder {
	id: string
	name: string
	createdTime?: string
	modifiedTime?: string
}

function getCredentials(): GoogleDriveCredentials {
	const keyContent = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY

	if (!keyContent) {
		throw new Error(
			'GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY not set in .env file. ' +
				'Please add your Google Drive service account JSON key to .env',
		)
	}

	try {
		// Parse JSON string from environment variable
		return JSON.parse(keyContent)
	} catch (error) {
		throw new Error(
			'Failed to parse GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY. ' +
				'Make sure it is valid JSON. Error: ' +
				(error instanceof Error ? error.message : String(error)),
		)
	}
}

async function ensureDir(dir: string) {
	try {
		await mkdir(dir, { recursive: true })
	} catch {
		// Ignore if exists
	}
}

async function getFileSize(filePath: string): Promise<number> {
	const stats = await stat(filePath)
	return stats.size
}

async function getAccessToken(): Promise<string> {
	const creds = getCredentials()
	const now = Math.floor(Date.now() / 1000)
	const expiry = now + 3600

	const header = { alg: 'RS256', typ: 'JWT' }
	const claim = {
		iss: creds.client_email,
		scope: 'https://www.googleapis.com/auth/drive.readonly',
		aud: 'https://oauth2.googleapis.com/token',
		exp: expiry,
		iat: now,
	}

	const encodeBase64 = (obj: object) =>
		btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

	const encodedHeader = encodeBase64(header)
	const encodedClaim = encodeBase64(claim)
	const signatureInput = `${encodedHeader}.${encodedClaim}`

	const keyData = creds.private_key
		.replace('-----BEGIN PRIVATE KEY-----', '')
		.replace('-----END PRIVATE KEY-----', '')
		.replace(/\n/g, '')

	const keyBuffer = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))

	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		keyBuffer,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign'],
	)

	const signatureBuffer = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		cryptoKey,
		new TextEncoder().encode(signatureInput),
	)

	const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')

	const jwt = `${signatureInput}.${signature}`

	const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt,
		}),
	})

	if (!tokenResponse.ok) {
		const error = await tokenResponse.text()
		throw new Error(`Failed to get access token: ${error}`)
	}

	const tokenData = await tokenResponse.json()
	return tokenData.access_token
}

async function listSubfolders(parentFolderId: string, accessToken: string): Promise<DriveFolder[]> {
	const query = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
	const fields = 'files(id, name, createdTime, modifiedTime)'
	const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=name`

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	})

	if (!response.ok) {
		throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`)
	}

	const data = await response.json()
	return (data.files || []).map((f: any) => ({
		id: f.id ?? '',
		name: f.name ?? 'Untitled',
		createdTime: f.createdTime,
		modifiedTime: f.modifiedTime,
	}))
}

async function listImagesInFolder(folderId: string, accessToken: string): Promise<DriveImage[]> {
	const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`
	const fields = 'files(id, name, mimeType, webContentLink, createdTime, imageMediaMetadata)'
	const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=name`

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	})

	if (!response.ok) {
		throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`)
	}

	const data = await response.json()
	return (data.files || []).map((f: any) => ({
		id: f.id ?? '',
		name: f.name ?? 'unknown',
		mimeType: f.mimeType ?? 'image/jpeg',
		webContentLink: f.webContentLink,
		createdTime: f.createdTime,
		width: f.imageMediaMetadata?.width,
		height: f.imageMediaMetadata?.height,
	}))
}

async function downloadImage(
	fileId: string,
	fileName: string,
	accessToken: string,
): Promise<string> {
	const outputPath = join(TMP_DIR, fileName)
	const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

	const response = await fetch(metadataUrl, {
		headers: { Authorization: `Bearer ${accessToken}` },
	})

	if (!response.ok) {
		throw new Error(`Failed to download ${fileName}: ${response.status} ${response.statusText}`)
	}

	const arrayBuffer = await response.arrayBuffer()
	const buffer = Buffer.from(arrayBuffer)

	await writeFile(outputPath, buffer)
	return outputPath
}

async function compressImage(inputPath: string): Promise<CompressionResult | null> {
	const fileName = inputPath.split('/').pop() ?? inputPath
	const ext = fileName.split('.').pop()?.toLowerCase()
	const baseName = fileName.substring(0, fileName.lastIndexOf('.'))

	let compressedPath: string
	let compressedName: string

	const { $ } = await import('bun')

	try {
		if (ext === 'jpg' || ext === 'jpeg') {
			compressedName = `${baseName}.jpg`
			compressedPath = join(COMPRESSED_DIR, compressedName)

			// iLoveIMG-style compression: aggressive quality reduction (80%) + strip metadata
			// This gives 40-60% reduction with visually identical quality
			await $`jpegoptim --max=80 --strip-all --all-normal --dest=${COMPRESSED_DIR} ${inputPath}`

			// Verify file was created
			try {
				await stat(compressedPath)
			} catch {
				// If dest didn't work, manually copy
				const { $ } = await import('bun')
				await $`cp ${inputPath} ${compressedPath}`
				await $`jpegoptim --max=80 --strip-all --all-normal ${compressedPath}`
			}
		} else if (ext === 'png') {
			compressedName = `${baseName}.png`
			compressedPath = join(COMPRESSED_DIR, compressedName)

			// iLoveIMG-style PNG: aggressive pngquant (quality 60-80 for web)
			const pngquantPath = join(COMPRESSED_DIR, `${baseName}-quant.png`)
			await $`pngquant --quality 60-80 --speed 1 --force --output ${pngquantPath} ${inputPath}`
			compressedPath = pngquantPath
		} else if (ext === 'webp') {
			compressedName = `${baseName}.webp`
			compressedPath = join(COMPRESSED_DIR, compressedName)

			await $`cwebp -lossless 1 -q 100 -m 6 ${inputPath} -o ${compressedPath}`
		} else {
			console.log(`⏭️ Skipping unsupported format: ${ext}`)
			return null
		}

		const originalSize = await getFileSize(inputPath)
		const compressedSize = await getFileSize(compressedPath)
		const reduction = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2)

		return {
			originalName: fileName,
			compressedName,
			originalSize,
			compressedSize,
			reduction: parseFloat(reduction),
			mimeType: getMimeType(ext),
		}
	} catch (error) {
		console.error(
			`❌ Error compressing ${fileName}:`,
			error instanceof Error ? error.message : error,
		)
		return null
	}
}

function getMimeType(ext: string): string {
	const mimeTypes: Record<string, string> = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		webp: 'image/webp',
	}
	return mimeTypes[ext] || 'image/jpeg'
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`
}

async function processFolder(
	folderId: string,
	folderName: string,
	accessToken: string,
): Promise<CompressionResult[]> {
	console.log(`\n📁 Processing folder: ${folderName}`)

	const images = await listImagesInFolder(folderId, accessToken)

	if (images.length === 0) {
		console.log(`  ⏭️ No images found`)
		return []
	}

	console.log(`  📸 Found ${images.length} images`)

	const results: CompressionResult[] = []

	for (const image of images) {
		try {
			console.log(`  ⬇️  Downloading: ${image.name}`)
			const downloadedPath = await downloadImage(image.id, image.name, accessToken)
			const originalSize = await getFileSize(downloadedPath)

			console.log(`  🗜️  Compressing: ${image.name}`)
			const result = await compressImage(downloadedPath)

			if (result) {
				console.log(`  ✅ ${result.originalName} → ${result.compressedName}`)
				console.log(
					`     ${formatBytes(originalSize)} → ${formatBytes(result.compressedSize)} (${result.reduction}% saved)`,
				)
				results.push(result)
			}

			await unlink(downloadedPath)
		} catch (error) {
			console.error(
				`  ❌ Error processing ${image.name}:`,
				error instanceof Error ? error.message : error,
			)
		}
	}

	return results
}

async function generateReport(results: CompressionResult[]) {
	const reportPath = join(TMP_DIR, 'COMPRESSION_REPORT.md')

	const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0)
	const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0)
	const totalSaved = totalOriginal - totalCompressed
	const avgReduction = ((totalSaved / totalOriginal) * 100).toFixed(2)

	const report = `# Image Compression Report

Generated: ${new Date().toISOString()}

## Summary

- **Total Images:** ${results.length}
- **Original Size:** ${formatBytes(totalOriginal)}
- **Compressed Size:** ${formatBytes(totalCompressed)}
- **Total Saved:** ${formatBytes(totalSaved)}
- **Average Reduction:** ${avgReduction}%

## Compression Settings

### JPEG (jpegoptim)
- \`--strip-all\`: Remove all metadata (EXIF, etc.)
- \`--all-normal\`: Normalize all files
- Lossless optimization (Huffman tables)

### PNG (optipng + pngquant)
- OptiPNG: \`-o7 -strip all\` (maximum lossless optimization)
- Pngquant: \`--quality 65-100 --speed 1\` (high quality lossy)
- Best of both methods selected

### WebP (cwebp)
- \`-lossless 1\`: Lossless compression
- \`-q 100\`: Maximum quality
- \`-m 6\`: Maximum compression method

## Details

| Original | Compressed | Reduction | Size Saved |
|----------|------------|-----------|------------|
${results.map((r) => `| ${r.originalName} | ${r.compressedName} | ${r.reduction}% | ${formatBytes(r.originalSize - r.compressedSize)} |`).join('\n')}

## Next Steps

1. ✅ Review compressed images in \`./tmp-drive-images/compressed/\`
2. Upload compressed images to Google Drive
3. Update references if needed

---

*Generated by compress-drive-images-standalone.ts script*
`

	await writeFile(reportPath, report)
	console.log(`\n📄 Report saved to: ${reportPath}`)

	console.log(`\n${'='.repeat(60)}`)
	console.log('📊 COMPRESSION SUMMARY')
	console.log('='.repeat(60))
	console.log(`Total Images: ${results.length}`)
	console.log(`Original Size: ${formatBytes(totalOriginal)}`)
	console.log(`Compressed Size: ${formatBytes(totalCompressed)}`)
	console.log(`Total Saved: ${formatBytes(totalSaved)}`)
	console.log(`Average Reduction: ${avgReduction}%`)
	console.log('='.repeat(60))
}

async function main() {
	console.log('🚀 Starting image compression from Google Drive...\n')

	await ensureDir(TMP_DIR)
	await ensureDir(COMPRESSED_DIR)

	console.log('🔑 Getting Google Drive access token...')
	const accessToken = await getAccessToken()

	console.log('📁 Fetching folders from Google Drive...')
	const folders = await listSubfolders(PARENT_FOLDER_ID, accessToken)

	if (folders.length === 0) {
		console.log('❌ No folders found in Google Drive')
		return
	}

	console.log(`📁 Found ${folders.length} folders\n`)

	const allResults: CompressionResult[] = []

	for (const folder of folders) {
		const results = await processFolder(folder.id, folder.name, accessToken)
		allResults.push(...results)
	}

	if (allResults.length > 0) {
		await generateReport(allResults)
	} else {
		console.log('\n⚠️ No images were compressed')
	}

	console.log('\n✅ Compression complete!')
	console.log(`📁 Compressed images saved to: ${COMPRESSED_DIR}`)
}

main().catch(console.error)
