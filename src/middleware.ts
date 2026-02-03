import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/cadastro', '/auth/callback']

// Routes specific to each user type
const lojistaRoutes = ['/lojista']
const entregadorRoutes = ['/entregador']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createMiddlewareClient<Database>({ req: request, res: response })
  const pathname = request.nextUrl.pathname

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith('/auth/'))) {
    return response
  }

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // Redirect to login if not authenticated
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Get user type from database
  const { data: user } = await supabase
    .from('users')
    .select('tipo, status, is_admin')
    .eq('id', session.user.id)
    .single()

  const userRow = user as {
    tipo: Database['public']['Enums']['user_type']
    status: Database['public']['Enums']['user_status'] | null
    is_admin: boolean | null
  } | null

  if (!userRow) {
    // User not found in database, redirect to complete registration
    return NextResponse.redirect(new URL('/cadastro', request.url))
  }

  // Check if user is blocked
  if (userRow.status === 'bloqueado') {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/loginerror=blocked', request.url))
  }

  // Check route access based on user type
  const isLojistaRoute = lojistaRoutes.some(route => pathname.startsWith(route))
  const isEntregadorRoute = entregadorRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = pathname.startsWith('/admin')

  if (isAdminRoute && !userRow.is_admin) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (isLojistaRoute && userRow.tipo !== 'lojista') {
    // Entregador trying to access lojista routes
    return NextResponse.redirect(new URL('/entregador', request.url))
  }

  if (isEntregadorRoute && userRow.tipo !== 'entregador') {
    // Lojista trying to access entregador routes
    return NextResponse.redirect(new URL('/lojista', request.url))
  }

  // Check if entregador is pending validation
  if (userRow.tipo === 'entregador' && userRow.status === 'pendente') {
    // Allow access to profile page to check status
    if (!pathname.startsWith('/entregador/perfil') && !pathname.startsWith('/entregador/aguardando')) {
      return NextResponse.redirect(new URL('/entregador/aguardando', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
   '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
