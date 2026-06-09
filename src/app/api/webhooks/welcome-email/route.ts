import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const WELCOME_HTML = (name: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; background: #fafafa; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #0ea5e9; font-size: 24px; margin: 0;">Finanzas AR</h1>
    </div>
    <h2 style="color: #1e293b; font-size: 20px; margin-bottom: 16px;">Bienvenido${name ? ` ${name.split(' ')[0]}` : ''}</h2>
    <p style="color: #475569; font-size: 15px; line-height: 1.6;">
      Tu cuenta fue creada exitosamente. Ya podes empezar a gestionar tus finanzas personales en Argentina.
    </p>
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; margin: 24px 0;">
      <p style="color: #0369a1; font-size: 13px; margin: 0 0 8px;"><strong>Primeros pasos</strong></p>
      <p style="color: #0369a1; font-size: 13px; margin: 0;">
        1. Crea tus cuentas (banco, efectivo, crypto o tarjeta de credito)<br>
        2. Registra tus gastos e ingresos<br>
        3. Explora el Dashboard para ver estadisticas y tendencias
      </p>
    </div>
    <p style="color: #475569; font-size: 15px; line-height: 1.6;">
      Tambien podes vincular el <strong>Bot de Telegram</strong> para registrar gastos por texto desde el chat.
    </p>
    <div style="text-align: center; margin-top: 32px;">
      <a href="https://finanzas-ar-app.vercel.app"
         style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Ir a Finanzas AR
      </a>
    </div>
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">
      Si no creaste esta cuenta, ignora este correo.
    </p>
  </div>
</body>
</html>`

export async function GET() {
  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS)
  return NextResponse.json({
    status: 'ok',
    smtp_configured: smtpConfigured,
    supabase_configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}

export async function POST(request: NextRequest) {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (!smtpUser || !smtpPass) {
    console.error('[welcome-email] SMTP_USER or SMTP_PASS not set')
    return NextResponse.json({ error: 'SMTP not configured' }, { status: 500 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const profileId: string | undefined = body?.record?.id
  if (!profileId) {
    return NextResponse.json({ error: 'Missing record.id in webhook payload' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let email: string | undefined
  try {
    const { data: authUser, error } = await adminClient.auth.admin.getUserById(profileId)
    if (error) {
      console.error('[welcome-email] getUserById error:', error)
      return NextResponse.json({ error: 'Failed to fetch user from auth', detail: error.message }, { status: 500 })
    }
    email = authUser?.user?.email
  } catch (err: any) {
    console.error('[welcome-email] getUserById exception:', err)
    return NextResponse.json({ error: 'Failed to fetch user from auth', detail: err.message }, { status: 500 })
  }

  if (!email) {
    return NextResponse.json({ skipped: 'No email found for profile', profileId }, { status: 200 })
  }

  const fullName = body.record.full_name || email.split('@')[0]

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  })

  const from = process.env.SMTP_FROM || `Finanzas AR <${smtpUser}>`

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Bienvenido a Finanzas AR',
      html: WELCOME_HTML(fullName),
    })
    return NextResponse.json({ ok: true, id: info.messageId })
  } catch (err: any) {
    console.error('[welcome-email] SMTP send error:', err)
    return NextResponse.json({
      error: 'Failed to send email',
      detail: err.message || String(err),
    }, { status: 502 })
  }
}
