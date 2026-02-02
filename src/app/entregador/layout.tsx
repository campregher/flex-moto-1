'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useLocationStore } from '@/stores/location-store'
import { Avatar, LoadingPage } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import {
  HiOutlineHome,
  HiOutlineLocationMarker,
  HiOutlineClipboardList,
  HiOutlineCurrencyDollar,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineBell,
  HiOutlineMenu,
  HiOutlineX,
} from 'react-icons/hi'

const navigation = [
  { name: 'Início', href: '/entregador', icon: HiOutlineHome },
  { name: 'Corridas Disponíveis', href: '/entregador/corridas', icon: HiOutlineLocationMarker },
  { name: 'Minhas Entregas', href: '/entregador/entregas', icon: HiOutlineClipboardList },
  { name: 'Saldo', href: '/entregador/saldo', icon: HiOutlineCurrencyDollar },
  { name: 'Perfil', href: '/entregador/perfil', icon: HiOutlineUser },
]

export default function EntregadorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { user, profile, setUser, setProfile, logout } = useAuthStore()
  const { startTracking, stopTracking } = useLocationStore()
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!userData || userData.tipo !== 'entregador') {
        router.push('/login')
        return
      }

      setUser(userData)

      const { data: entregadorData } = await supabase
        .from('entregadores')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (entregadorData) {
        setProfile(entregadorData)
        
        // Start location tracking if online
        if (entregadorData.online) {
          startTracking()
        }
      }

      setLoading(false)
    }

    loadUser()

    return () => {
      stopTracking()
    }
  }, [router, setUser, setProfile, supabase, startTracking, stopTracking])

  const handleLogout = async () => {
    stopTracking()
    await supabase.auth.signOut()
    logout()
    router.push('/login')
  }

  if (loading) {
    return <LoadingPage />
  }

  const entregadorProfile = profile as any

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`fixed inset-0 bg-gray-900/50 transition-opacity ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-white shadow-xl transition-transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <span className="text-xl font-bold text-secondary-600">Flex Entregas</span>
            <button onClick={() => setMobileMenuOpen(false)}>
              <HiOutlineX className="w-6 h-6" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-secondary-50 text-secondary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full"
            >
              <HiOutlineLogout className="w-5 h-5" />
              Sair
            </button>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r">
          <div className="flex items-center h-16 px-6 border-b">
            <span className="text-xl font-bold text-secondary-600">Flex Entregas</span>
          </div>
          
          <div className="p-4 border-b">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="relative">
                <Avatar src={entregadorProfile?.foto_url} name={user?.nome || ''} size="lg" />
                {entregadorProfile?.online && (
                  <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full pulse-online"></span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{user?.nome}</p>
                <p className="text-sm text-secondary-600 font-semibold">
                  {formatCurrency(entregadorProfile?.saldo || 0)}
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-secondary-50 text-secondary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full"
            >
              <HiOutlineLogout className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 bg-white border-b lg:px-8">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden"
          >
            <HiOutlineMenu className="w-6 h-6" />
          </button>
          
          <div className="flex-1 lg:hidden text-center">
            <span className="text-lg font-bold text-secondary-600">Flex</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/entregador/notificacoes"
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <HiOutlineBell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </Link>
            <div className="lg:hidden">
              <Avatar src={entregadorProfile?.foto_url} name={user?.nome || ''} size="sm" />
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
