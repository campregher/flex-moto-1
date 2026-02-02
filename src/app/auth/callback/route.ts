import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

      if (userData) {
        const redirectPath = userData.tipo === 'lojista' ? '/lojista' : '/entregador'
        return NextResponse.redirect(new URL(redirectPath, requestUrl.origin))
      }
    }
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
