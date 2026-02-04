'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, LoadingPage } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import {
  Home,
  PlusCircle,
  ClipboardList,
  DollarSign,
  User,
  LogOut,
  Bell,
  Menu,
  X,
} from 'lucide-react'

const navigation = [
  { name: 'Início', href: '/lojista', icon: Home },
  { name: 'Nova Corrida', href: '/lojista/nova-corrida', icon: PlusCircle },
  { name: 'Minhas Corridas', href: '/lojista/corridas', icon: ClipboardList },
  { name: 'Saldo', href: '/lojista/saldo', icon: DollarSign },
  { name: 'Perfil', href: '/lojista/perfil', icon: User },
]

export default function LojistaLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const { user, profile, setUser, setProfile, logout } = useAuthStore()
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

      if (!userData || userData.tipo !== 'lojista') {
        router.push('/login')
        return
      }

      setUser(userData)

      const { data: lojistaData } = await supabase
        .from('lojistas')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (lojistaData) {
        setProfile(lojistaData)
      }

      setLoading(false)
    }

    loadUser()
  }, [router, setUser, setProfile, supabase])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function subscribeProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      channel = supabase
        .channel(`lojista-profile-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lojistas', filter: `user_id=eq.${session.user.id}` },
          (payload: any) => {
            if (payload.new) {
              setProfile(payload.new)
            }
          }
        )
        .subscribe()
    }

    subscribeProfile()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [setProfile, supabase])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function subscribeFinanceiro() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      channel = supabase
        .channel(`lojista-financeiro-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'financeiro', filter: `user_id=eq.${session.user.id}` },
          (payload: any) => {
            if (payload.new && typeof payload.new.saldo_posterior === 'number') {
              setProfile((current: any) => ({ ...(current || {}), saldo: payload.new.saldo_posterior }))
            }
          }
        )
        .subscribe()
    }

    subscribeFinanceiro()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [setProfile, supabase])

  useEffect(() => {
    async function loadUnread() {
      if (!user?.id) return
      const { count } = await supabase
        .from('notificacoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('lida', false)

      setUnreadNotifications(count || 0)
    }

    loadUnread()
  }, [supabase, user?.id])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    router.push('/login')
  }

  if (loading) {
    return <LoadingPage />
  }

  const lojistaProfile = (profile as any) || {}

  return (
    <div className="min-h-screen">
      {/* Mobile menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}>
        <div
          className={`fixed inset-0 bg-black/60 transition-opacity ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-[#0D0D0D] text-white shadow-xl transition-transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <span className="text-xl font-bold text-white font-display">Flex Moto</span>
            <button onClick={() => setMobileMenuOpen(false)}>
              <X className="w-6 h-6" />
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
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-300 hover:bg-white/10 w-full"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-[#0D0D0D] text-white border-r border-white/10">
          <div className="flex items-center h-16 px-6 border-b border-white/10">
            <span className="text-xl font-bold text-white font-display">Flex Moto</span>
          </div>
          
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <Avatar src={lojistaProfile.foto_url || null} name={user?.nome || ''} size="lg" className="" />
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{user?.nome || ''}</p>
                <p className="text-sm text-[#0DD9C4] font-semibold">
                  {formatCurrency(lojistaProfile.saldo || 0)}
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
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-300 hover:bg-white/10 w-full"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 bg-white/80 backdrop-blur border-b border-gray-200/70 lg:px-8">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1 lg:hidden text-center">
            <span className="text-lg font-bold text-[#0D0D0D] font-display">Flex Moto</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/lojista/notificacoes"
              className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <Bell className="w-6 h-6" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </Link>
            <div className="lg:hidden">
              <Avatar src={lojistaProfile.foto_url || null} name={user?.nome || ''} size="sm" className="" />
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




