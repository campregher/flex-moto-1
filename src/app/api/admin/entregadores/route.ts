import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = (profile as { is_admin: boolean | null } | null)?.is_admin

  if (error || !isAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase }
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const { data, error: listError } = await supabaseAdmin
    .from('users')
    .select('id, nome, email, whatsapp, status, created_at, entregadores(placa, cidade, uf, foto_url, cnh_url)')
    .eq('tipo', 'entregador')
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  const userId = body?.userId as string | undefined
  const status = body?.status as string | undefined

  if (!userId || !status || !['ativo', 'bloqueado'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ status })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
