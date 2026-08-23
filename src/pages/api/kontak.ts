import { env } from 'cloudflare:workers'
import { getResendApiKey } from '@lib/config'
import { describeError, logError, logInfo, logWarn } from '@lib/monitoring/logger'
import type { APIRoute } from 'astro'
import { z } from 'zod'

const RESEND_API = 'https://api.resend.com/emails'
const RATE_LIMIT_WINDOW = 5 * 60 * 1000
const KV_PREFIX = 'kontak:ip:'

const kontakSchema = z.object({
	nama: z.string().trim().min(1, 'Nama harus diisi.'),
	telepon: z.string().trim().optional().default(''),
	email: z.email({ error: 'Format email tidak valid.' }).trim(),
	subjek: z.string().trim().optional().default('lainnya'),
	pesan: z
		.string()
		.trim()
		.min(1, 'Pesan harus diisi.')
		.max(5000, 'Pesan terlalu panjang (maks. 5.000 karakter).'),
	_website: z.string().trim().optional().default(''),
})

type FormData = z.infer<typeof kontakSchema>

const ROUTING: Record<string, { name: string; to: string }> = {
	donasi: { name: 'Konfirmasi Donasi', to: 'donasi@amalshalih.or.id' },
	program: { name: 'Informasi Program', to: 'info@amalshalih.or.id' },
	kerjasama: { name: 'Kerja Sama', to: 'humas@amalshalih.or.id' },
	pendaftaran: { name: 'Pendaftaran Santri', to: 'info@amalshalih.or.id' },
	kritik: { name: 'Kritik & Saran', to: 'info@amalshalih.or.id' },
	lainnya: { name: 'Lainnya', to: 'info@amalshalih.or.id' },
}

function sanitize(input: string): string {
	return input
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
}

function buildNotificationHtml(data: FormData): string {
	const routing = ROUTING[data.subjek] || ROUTING.lainnya
	return `
		<!DOCTYPE html>
		<html>
		<head><meta charset="utf-8"></head>
		<body style="font-family: system-ui, sans-serif; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: linear-gradient(135deg, #166534, #14532d); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
				<h1 style="margin: 0; font-size: 20px;">Pesan Baru dari Website</h1>
				<p style="margin: 4px 0 0; opacity: 0.9;">${routing.name} — ${sanitize(data.nama)}</p>
			</div>
			<div style="background: #fafaf9; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e7e5e4;">
				<table style="width: 100%; border-collapse: collapse;">
					<tr>
						<td style="padding: 8px 0; font-weight: 600; color: #166534; width: 100px; vertical-align: top;">Nama</td>
						<td style="padding: 8px 0;">${sanitize(data.nama)}</td>
					</tr>
					${
						data.telepon
							? `
					<tr>
						<td style="padding: 8px 0; font-weight: 600; color: #166534; vertical-align: top;">Telepon</td>
						<td style="padding: 8px 0;"><a href="tel:${sanitize(data.telepon)}" style="color: #166534;">${sanitize(data.telepon)}</a></td>
					</tr>`
							: ''
					}
					<tr>
						<td style="padding: 8px 0; font-weight: 600; color: #166534; vertical-align: top;">Email</td>
						<td style="padding: 8px 0;"><a href="mailto:${sanitize(data.email)}" style="color: #166534;">${sanitize(data.email)}</a></td>
					</tr>
					<tr>
						<td style="padding: 8px 0; font-weight: 600; color: #166534; vertical-align: top;">Subjek</td>
						<td style="padding: 8px 0;">${routing.name}</td>
					</tr>
					<tr>
						<td style="padding: 8px 0; font-weight: 600; color: #166534; vertical-align: top;">Pesan</td>
						<td style="padding: 8px 0; white-space: pre-wrap;">${sanitize(data.pesan)}</td>
					</tr>
				</table>
			</div>
			<p style="font-size: 12px; color: #a8a29e; text-align: center; margin-top: 16px;">
				Dikirim dari formulir kontak — amalshalih.or.id
			</p>
		</body>
		</html>
	`
}

function buildAutoReplyHtml(data: FormData): string {
	return `
		<!DOCTYPE html>
		<html>
		<head><meta charset="utf-8"></head>
		<body style="font-family: system-ui, sans-serif; color: #1c1917; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: linear-gradient(135deg, #166534, #14532d); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
				<h1 style="margin: 0; font-size: 20px;">Terima Kasih Telah Menghubungi Kami</h1>
			</div>
			<div style="background: #fafaf9; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e7e5e4;">
				<p>Assalamu'alaikum warahmatullahi wabarakatuh,</p>
				<p><strong>${sanitize(data.nama)}</strong>, terima kasih telah menghubungi <strong>Yayasan Amal Shalih Insan Bantul</strong>.</p>
				<p>Pesan Anda telah kami terima dan akan segera kami proses. Tim kami akan merespons dalam waktu 1×24 jam.</p>

				<div style="background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
					<h3 style="margin: 0 0 8px; font-size: 14px; color: #92400e;">Salinan Pesan Anda</h3>
					<p style="margin: 4px 0; font-size: 14px;"><strong>Subjek:</strong> ${ROUTING[data.subjek]?.name || 'Lainnya'}</p>
					<p style="margin: 4px 0; font-size: 14px; white-space: pre-wrap;">${sanitize(data.pesan)}</p>
				</div>

				<p>Wassalamu'alaikum warahmatullahi wabarakatuh,</p>
				<p style="font-weight: 600; color: #166534;">Tim Yayasan Amal Shalih Insan Bantul</p>
			</div>
			<p style="font-size: 12px; color: #a8a29e; text-align: center; margin-top: 16px;">
				Yayasan Amal Shalih Insan Bantul — amalshalih.or.id
			</p>
		</body>
		</html>
	`
}

interface ResendError {
	message?: string
	error?: string
}

async function sendResendEmail(
	apiKey: string,
	to: string,
	subject: string,
	html: string,
	replyTo?: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const body: Record<string, unknown> = {
			from: 'Yayasan ASIB <info@amalshalih.or.id>',
			to: [to],
			subject,
			html,
		}
		if (replyTo) body.reply_to = replyTo

		const response = await fetch(RESEND_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		const result = (await response.json()) as ResendError

		if (!response.ok) {
			console.error('[Resend] Failed:', result)
			// Handled rejection (user gets a friendly error) — log, don't raise an issue.
			logWarn('email.send_failed', {
				provider: 'resend',
				status_code: response.status,
			})
			return { success: false, error: result.message || result.error || 'Resend API error' }
		}

		logInfo('email.sent', { provider: 'resend' })
		return { success: true }
	} catch (error: unknown) {
		console.error('[Resend] Error:', error)
		logError('email.send_exception', {
			provider: 'resend',
			error_message: describeError(error),
		})
		const message = error instanceof Error ? error.message : 'Unknown error'
		return { success: false, error: message }
	}
}

function getClientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip') ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'127.0.0.1'
	)
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const apiKey = getResendApiKey()

		let raw: Record<string, string>
		const contentType = request.headers.get('content-type') || ''

		if (contentType.includes('application/json')) {
			raw = await request.json()
		} else {
			const formData = await request.formData()
			raw = {}
			for (const [key, value] of formData.entries()) {
				if (typeof value === 'string') raw[key] = value
			}
		}

		const parsed = kontakSchema.safeParse(raw)
		if (!parsed.success) {
			return new Response(
				JSON.stringify({
					success: false,
					errors: parsed.error.issues.map((e) => e.message),
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'X-Content-Type-Options': 'nosniff',
						'X-Frame-Options': 'DENY',
					},
				},
			)
		}

		const data = parsed.data

		// Honeypot: bot-filled hidden field — silently accept but don't process
		if (data._website) {
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		// CSRF Protection: Validate Origin/Referer header
		const allowedOrigins = [
			'https://amalshalih.id',
			'https://www.amalshalih.id',
			'https://amalshalih.or.id',
			'https://www.amalshalih.or.id',
			'https://www.asib.workers.dev',
			'http://localhost:4321',
		]
		const origin = request.headers.get('origin') || request.headers.get('referer')
		if (origin) {
			const originUrl = new URL(origin)
			const originHost = `${originUrl.protocol}//${originUrl.host}`
			if (!allowedOrigins.includes(originHost)) {
				console.error('[CSRF] Blocked request from:', originHost)
				return new Response(JSON.stringify({ success: false, error: 'Unauthorized origin' }), {
					status: 403,
					headers: {
						'Content-Type': 'application/json',
						'X-Content-Type-Options': 'nosniff',
						'X-Frame-Options': 'DENY',
					},
				})
			}
		}

		const clientIp = getClientIp(request)
		const kv = env.SESSION
		const kvKey = `${KV_PREFIX}${clientIp}`
		const lastSubmission = await kv.get(kvKey)

		if (lastSubmission) {
			const elapsed = Date.now() - parseInt(lastSubmission, 10)
			if (elapsed < RATE_LIMIT_WINDOW) {
				const remaining = Math.ceil((RATE_LIMIT_WINDOW - elapsed) / 1000 / 60)
				return new Response(
					JSON.stringify({
						success: false,
						errors: [`Silakan tunggu ${remaining} menit sebelum mengirim lagi.`],
					}),
					{ status: 429, headers: { 'Content-Type': 'application/json' } },
				)
			}
		}

		await kv.put(kvKey, Date.now().toString(), { expirationTtl: 600 })

		const routing = ROUTING[data.subjek] || ROUTING.lainnya

		const notifResult = await sendResendEmail(
			apiKey,
			routing.to,
			`[Kontak Website] ${routing.name} — ${data.nama}`,
			buildNotificationHtml(data),
			data.email,
		)

		if (!notifResult.success) {
			console.error('[API /kontak] Notification failed:', notifResult.error)
		}

		const autoReplyResult = await sendResendEmail(
			apiKey,
			data.email,
			'Terima Kasih — Pesan Anda Telah Kami Terima',
			buildAutoReplyHtml(data),
		)

		if (!autoReplyResult.success) {
			console.error('[API /kontak] Auto-reply failed:', autoReplyResult.error)
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
			},
		})
	} catch (error) {
		console.error('[API /kontak] Error:', error)
		return new Response(
			JSON.stringify({ success: false, errors: ['Terjadi kesalahan. Silakan coba lagi.'] }),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'X-Content-Type-Options': 'nosniff',
					'X-Frame-Options': 'DENY',
				},
			},
		)
	}
}
