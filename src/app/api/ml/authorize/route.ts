import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'
import crypto from 'crypto'

const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('tipo')
    .eq('id', user.id)
    .single()

  const userTipo = (profile as { tipo: Database['public']['Enums']['user_type'] } | null)?.tipo

  if (userTipo !== 'lojista') {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL))
  }

  const clientId = process.env.ML_CLIENT_ID
  const redirectUri = process.env.ML_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Missing ML env vars' }, { status: 500 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const res = NextResponse.redirect(
    `${ML_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
  )

  res.cookies.set('ml_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
    path: '/',
  })

  return res
}
