import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createClient()
    
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session) {
      // Get user type to redirect properly
      const { data: userData } = await supabase
        .from('users')
        .select('tipo')
        .eq('id', session.user.id)
        .single()

      const userRow = userData as { tipo: Database['public']['Enums']['user_type'] } | null

      if (userRow) {
        const redirectPath = userRow.tipo === 'lojista' ? '/lojista' : '/entregador'
        return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
      }
    }
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
