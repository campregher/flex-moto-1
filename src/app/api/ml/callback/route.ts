import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'

const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token'
const ML_ME_URL = 'https://api.mercadolibre.com/users/me'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const storedState = cookies().get('ml_oauth_state')?.value ?? null

    if (!code || !state) {
      return NextResponse.redirect(new URL('/lojista?ml=missing-code', process.env.NEXT_PUBLIC_APP_URL))
    }

    if (!storedState || state !== storedState) {
      return NextResponse.redirect(new URL('/lojista?ml=state-mismatch', process.env.NEXT_PUBLIC_APP_URL))
    }

    cookies().delete('ml_oauth_state')

    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))
    }

    const clientId = process.env.ML_CLIENT_ID
    const clientSecret = process.env.ML_CLIENT_SECRET
    const redirectUri = process.env.ML_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(new URL('/lojista?ml=missing-env', process.env.NEXT_PUBLIC_APP_URL))
    }

    const tokenRes = await fetch(ML_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const details = await tokenRes.text().catch(() => '')
      console.error('ML token error:', tokenRes.status, details)
      return NextResponse.redirect(new URL('/lojista?ml=token-error', process.env.NEXT_PUBLIC_APP_URL))
    }

    const tokenJson = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      user_id: number
    }

    const meRes = await fetch(ML_ME_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })

    if (!meRes.ok) {
      const details = await meRes.text().catch(() => '')
      console.error('ML me error:', meRes.status, details)
      return NextResponse.redirect(new URL('/lojista?ml=me-error', process.env.NEXT_PUBLIC_APP_URL))
    }

    const meJson = await meRes.json() as { site_id: string }

    const { data: lojista } = await supabase
      .from('lojistas')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!lojista) {
      return NextResponse.redirect(new URL('/lojista?ml=missing-lojista', process.env.NEXT_PUBLIC_APP_URL))
    }

    const lojistaId = (lojista as { id: string } | null)?.id ?? null

    if (!lojistaId) {
      return NextResponse.redirect(new URL('/lojista?ml=missing-lojista', process.env.NEXT_PUBLIC_APP_URL))
    }

    const expiresAt = new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()

    const upsertPayload = {
      lojista_id: lojistaId,
      ml_user_id: tokenJson.user_id,
      site_id: meJson.site_id,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: expiresAt,
    } as Database['public']['Tables']['mercadolivre_integrations']['Insert']

    const { error: upsertError } = await (supabase as any)
      .from('mercadolivre_integrations')
      .upsert(upsertPayload, { onConflict: 'lojista_id' })

    if (upsertError) {
      console.error('ML save error:', upsertError)
      const reason = encodeURIComponent(
        upsertError.details || upsertError.message || upsertError.code || 'unknown'
      )
      return NextResponse.redirect(
        new URL(`/lojista?ml=save-error&reason=${reason}`, process.env.NEXT_PUBLIC_APP_URL)
      )
    }

    return NextResponse.redirect(new URL('/lojista?ml=connected', process.env.NEXT_PUBLIC_APP_URL))
  } catch (err) {
    console.error('ML callback error:', err)
    return NextResponse.redirect(new URL('/lojista?ml=callback-error', process.env.NEXT_PUBLIC_APP_URL))
  }
}
