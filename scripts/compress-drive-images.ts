#!/usr/bin/env bun

/**
 * Script untuk download, compress, dan upload gambar dari Google Drive
 *
 * Usage:
 *   bun run scripts/compress-drive-images.ts
 *
 * Output:
 *   - Download gambar ke ./tmp-drive-images/
 *   - Compress dengan lossless compression
 *   - Generate report kompresi
 *   - Siap untuk re-upload ke Google Drive
 */

import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'
import { getAccessToken, listImagesInFolder, listSubfolders } from '../src/lib/google-drive'

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

async function ensureDir(dir: string) {
	try {
		await mkdir(dir, { recursive: true })
	} catch (_error) {
		// Ignore if exists
	}
}

async function getFileSize(filePath: string): Promise<number> {
	const stats = await stat(filePath)
	return stats.size
}

async function downloadImage(
	fileId: string,
	fileName: string,
	accessToken: string,
): Promise<string> {
	const outputPath = join(TMP_DIR, fileName)

	// Get file metadata to get download URL
	const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

	const response = await fetch(metadataUrl, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
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

	try {
		if (ext === 'jpg' || ext === 'jpeg') {
			compressedName = `${baseName}.jpg`
			compressedPath = join(COMPRESSED_DIR, compressedName)

			// JPEGoptim: lossless compression (strip metadata, optimize Huffman tables)
			// --strip-all: Remove all metadata (EXIF, etc.)
			// --all-normal: Normalize all files
			// -f: Force overwrite
			await $`jpegoptim --strip-all --all-normal -f ${inputPath} --dest=${COMPRESSED_DIR}`
		} else if (ext === 'png') {
			compressedName = `${baseName}.png`
			compressedPath = join(COMPRESSED_DIR, compressedName)

			// OptiPNG: lossless PNG optimization
			// -o7: Maximum optimization level
			// -strip all: Strip metadata
			// -quiet: Quiet mode
			await $`optipng -o7 -strip all -quiet -out ${compressedPath} ${inputPath}`

			// Further compress with pngquant (lossy but high quality)
			// --quality 65-100: Maintain quality between 65-100
			// --speed 1: Best compression (slowest)
			const pngquantPath = compressedPath.replace('.png', '-quant.png')
			await $`pngquant --quality 65-100 --speed 1 --force --output ${pngquantPath} ${compressedPath}`

			// Use pngquant version if smaller
			const optipngSize = await getFileSize(compressedPath)
			const pngquantSize = await getFileSize(pngquantPath)

			if (pngquantSize < optipngSize) {
				await unlink(compressedPath)
				await $`mv ${pngquantPath} ${compressedPath}`
				compressedName = `${baseName}.png`
			} else {
				await unlink(pngquantPath)
			}
		} else if (ext === 'webp') {
			compressedName = `${baseName}.webp`
			compressedPath = join(COMPRESSED_DIR, compressedName)

			// Convert to WebP with lossless compression
			// -lossless 1: Lossless compression
			// -q 100: Maximum quality
			// -m 6: Maximum compression method (slowest but best)
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

async function processFolder(
	folderId: string,
	folderName: string,
	accessToken: string,
): Promise<CompressionResult[]> {
	console.log(`\n📁 Processing folder: ${folderName}`)

	const images = await listImagesInFolder(folderId)

	if (images.length === 0) {
		console.log(`  ⏭️ No images found`)
		return []
	}

	console.log(`  📸 Found ${images.length} images`)

	const results: CompressionResult[] = []

	for (const image of images) {
		try {
			// Download
			console.log(`  ⬇️  Downloading: ${image.name}`)
			const downloadedPath = await downloadImage(image.id, image.name, accessToken)
			const originalSize = await getFileSize(downloadedPath)

			// Compress
			console.log(`  🗜️  Compressing: ${image.name}`)
			const result = await compressImage(downloadedPath)

			if (result) {
				console.log(`  ✅ ${result.originalName} → ${result.compressedName}`)
				console.log(
					`     ${formatBytes(originalSize)} → ${formatBytes(result.compressedSize)} (${result.reduction}% saved)`,
				)
				results.push(result)
			}

			// Cleanup original downloaded file
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

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`
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

1. Review compressed images in \`./tmp-drive-images/compressed/\`
2. Upload compressed images to Google Drive (replace originals or create new folder)
3. Update Google Drive folder references if needed

## Upload Instructions

### Option A: Replace Originals (Recommended)
\`\`\`bash
# Upload compressed images to same folder
# This will replace the originals
\`\`\`

### Option B: Create New Folder
\`\`\`bash
# Create new folder "Galeri Compressed" in Google Drive
# Upload all compressed images there
# Update PARENT_FOLDER_ID in src/data/galleries.ts
\`\`\`

---

*Generated by compress-drive-images.ts script*
`

	await writeFile(reportPath, report)
	console.log(`\n📄 Report saved to: ${reportPath}`)

	// Also print summary
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

	// Create directories
	await ensureDir(TMP_DIR)
	await ensureDir(COMPRESSED_DIR)

	// Get access token
	console.log('🔑 Getting Google Drive access token...')
	const accessToken = await getAccessToken()

	// List all subfolders
	console.log('📁 Fetching folders from Google Drive...')
	const folders = await listSubfolders(PARENT_FOLDER_ID)

	if (folders.length === 0) {
		console.log('❌ No folders found in Google Drive')
		return
	}

	console.log(`📁 Found ${folders.length} folders\n`)

	const allResults: CompressionResult[] = []

	// Process each folder
	for (const folder of folders) {
		const results = await processFolder(folder.id, folder.name, accessToken)
		allResults.push(...results)
	}

	// Generate report
	if (allResults.length > 0) {
		await generateReport(allResults)
	} else {
		console.log('\n⚠️ No images were compressed')
	}

	console.log('\n✅ Compression complete!')
	console.log(`📁 Compressed images saved to: ${COMPRESSED_DIR}`)
}

main().catch(console.error)
