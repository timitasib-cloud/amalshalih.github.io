import { fileURLToPath } from 'node:url'
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
		},
	},
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
		}),
	],
	test: {
		exclude: [
			'test/integration/**',
			'test/e2e/**',
			'test/lighthouse/**',
			'test/prod/**',
			'node_modules/**',
			'.opencode/**',
			'studio-amalshalih/**',
		],
	},
})
