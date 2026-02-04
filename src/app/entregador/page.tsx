'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useLocationStore } from '@/stores/location-store'
import { Avatar, Rating, StatusBadge, PlatformBadge, EmptyState, LoadingSpinner } from '@/components/ui'
import { formatCurrency, timeAgo } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  MapPin,
  Truck,
  DollarSign,
  ClipboardCheck,
  Star,
  ArrowRight,
  Route,
  Package,
  Clock,
} from 'lucide-react'

interface CorridaAtiva {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  total_pacotes: number
  distancia_total_km?: number | null
  endereco_coleta: string
  created_at: string
  lojista: {
    foto_url: string | null
    avaliacao_media: number
    user: {
      nome: string
    }
  }
}

export default function EntregadorDashboard() {
  const { user, profile, setProfile, setUser } = useAuthStore()
  const { currentLocation, startTracking, stopTracking, isTracking } = useLocationStore()
  const [corridasAtivas, setCorridasAtivas] = useState<CorridaAtiva[]>([])
  const [corridasDisponiveis, setCorridasDisponiveis] = useState<CorridaAtiva[]>([])
  const [stats, setStats] = useState({
    totalEntregas: 0,
    entregasHoje: 0,
    ganhoMes: 0,
  })
  const [loading, setLoading] = useState(true)
  const [togglingOnline, setTogglingOnline] = useState(false)
  const corridasChannelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  const entregadorProfile = (profile as any) || {}

  useEffect(() => {
    refreshUserStatus()
    loadData()
    
    // Set up realtime subscription for corridas availability and assignment changes
    const channel = supabase
      .channel('corridas-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corridas' },
        (payload: any) => {
          const newStatus = payload.new?.status
          const oldStatus = payload.old?.status
          const entregadorId = entregadorProfile.id
          const touchesEntregador =
            (payload.new?.entregador_id && payload.new.entregador_id === entregadorId) ||
            (payload.old?.entregador_id && payload.old.entregador_id === entregadorId)

          if (payload.eventType === 'INSERT' && newStatus === 'aguardando') {
            toast('Nova corrida disponível!', { icon: '🚀' })
            const createdId = payload.new?.id
            if (createdId) {
              loadCorridaDisponivelById(createdId)
            }
          }

          if (payload.eventType === 'UPDATE') {
            // Saiu de aguardando (aceita/cancelada)
            if (oldStatus === 'aguardando' && newStatus !== 'aguardando') {
              setCorridasDisponiveis((prev) => prev.filter((corrida) => corrida.id !== payload.new.id))
            }

            // Voltou para aguardando ou update enquanto aguardando
            if (newStatus === 'aguardando') {
              const updated = payload.new
              if (updated?.id) {
                setCorridasDisponiveis((prev) => {
                  const exists = prev.find((c) => c.id === updated.id)
                  if (exists) {
                    return prev.map((c) => (c.id === updated.id ? { ...c, ...(updated as any) } : c))
                  }
                  return [updated as any, ...prev].slice(0, 5)
                })
              }
            }
          }

          if (payload.eventType === 'DELETE' && oldStatus === 'aguardando') {
            setCorridasDisponiveis((prev) => prev.filter((corrida) => corrida.id !== payload.old.id))
          }

          if (touchesEntregador) {
            loadCorridasAtivas()
            loadStats()
          }
        }
      )
      .on('broadcast', { event: 'corrida-aceita' }, (payload: any) => {
        const id = payload?.payload?.id
        if (id) {
          setCorridasDisponiveis((prev) => prev.filter((c) => c.id !== id))
        }
      })
      .on('broadcast', { event: 'corrida-cancelada' }, (payload: any) => {
        const id = payload?.payload?.id
        if (id) {
          setCorridasDisponiveis((prev) => prev.filter((c) => c.id !== id))
        }
      })
      .subscribe()
    corridasChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      corridasChannelRef.current = null
    }
  }, [entregadorProfile.id])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        refreshUserStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  async function refreshUserStatus() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (userData) {
      setUser(userData)
    }
  }

  async function loadData() {
    if (!entregadorProfile.id) return

    await Promise.all([
      loadCorridasAtivas(),
      loadCorridasDisponiveis(),
      loadStats(),
    ])
    
    setLoading(false)
  }

  async function loadCorridasAtivas() {
    const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, status, valor_total, total_pacotes, endereco_coleta, created_at,
        lojista:lojistas(foto_url, avaliacao_media, user:users(nome))
      `)
      .eq('entregador_id', entregadorProfile.id)
      .in('status', ['aceita', 'coletando', 'em_entrega'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setCorridasAtivas(data as any)
    }
  }

  async function loadCorridasDisponiveis() {
      const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, status, entregador_id, valor_total, total_pacotes, distancia_total_km, endereco_coleta, created_at,
        lojista:lojistas(foto_url, avaliacao_media, user:users(nome))
      `)
      .eq('status', 'aguardando')
      .is('entregador_id', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setCorridasDisponiveis(data as any)
    }
  }

  async function loadCorridaDisponivelById(corridaId: string) {
    const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, status, entregador_id, valor_total, total_pacotes, distancia_total_km, endereco_coleta, created_at,
        lojista:lojistas(foto_url, avaliacao_media, user:users(nome))
      `)
      .eq('id', corridaId)
      .single()

    if (data && data.status === 'aguardando' && data.entregador_id == null) {
      setCorridasDisponiveis((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [data as any, ...prev].slice(0, 5)
      })
    }
  }

  async function loadStats() {
    if (!user?.id) return
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

    const { count: totalEntregas } = await supabase
      .from('corridas')
      .select('*', { count: 'exact', head: true })
      .eq('entregador_id', entregadorProfile.id)
      .eq('status', 'finalizada')

    const { count: entregasHoje } = await supabase
      .from('corridas')
      .select('*', { count: 'exact', head: true })
      .eq('entregador_id', entregadorProfile.id)
      .eq('status', 'finalizada')
      .gte('finalizada_em', hoje.toISOString())

    const { data: ganhoData } = await supabase
      .from('financeiro')
      .select('valor')
      .eq('user_id', user.id)
      .eq('tipo', 'corrida')
      .gte('created_at', inicioMes.toISOString())

    const ganhoRows = (ganhoData as { valor: number }[] | null) || []
    const ganhoMes = ganhoRows.reduce((acc, item) => acc + item.valor, 0)

    setStats({
      totalEntregas: totalEntregas || 0,
      entregasHoje: entregasHoje || 0,
      ganhoMes,
    })
  }

  async function toggleOnline() {
    setTogglingOnline(true)
    try {
      const newOnlineStatus = !entregadorProfile.online

      // Update location if going online
      let updateData: any = { online: newOnlineStatus }
      
      if (newOnlineStatus && currentLocation) {
        updateData.latitude = currentLocation.lat
        updateData.longitude = currentLocation.lng
      }

      const { error } = await supabase
        .from('entregadores')
        .update(updateData)
        .eq('id', entregadorProfile.id)

      if (error) throw error

      if (newOnlineStatus) {
        startTracking()
        toast.success('Você está online!')
      } else {
        stopTracking()
        toast('Você está offline', { icon: '❌' })
      }

      setProfile({ ...entregadorProfile, ...updateData })
    } catch (err) {
      toast.error('Erro ao atualizar status')
    } finally {
      setTogglingOnline(false)
    }
  }

  // Update location in database when it changes
  useEffect(() => {
    if (entregadorProfile.online && currentLocation) {
      supabase
        .from('entregadores')
        .update({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        })
        .eq('id', entregadorProfile.id)
    }
  }, [currentLocation, entregadorProfile.online, entregadorProfile.id])

  return (
    <div className="space-y-6">
      {/* Welcome & Online Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {(user?.nome || '').split(' ')[0]}!
          </h1>
          <p className="text-gray-600">
            {entregadorProfile.online
              ? 'Você está disponível para corridas'
              : 'Fique online para receber corridas'}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={togglingOnline || user?.status === 'pendente'}
          className={`relative px-6 py-3 rounded-full font-medium transition-all ${
            entregadorProfile.online ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } ${user?.status === 'pendente' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {entregadorProfile.online && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-pulse"></span>
          )}
          <span className={entregadorProfile.online ? 'ml-2' : ''}>
            {togglingOnline ? 'Aguarde...' : entregadorProfile.online ? 'Online' : 'Offline'}
          </span>
        </button>
      </div>

      {user?.status === 'pendente' && (
        <div className="card p-4 bg-yellow-50 border-yellow-200">
          <p className="text-yellow-800">
            Seu cadastro está em análise. Você poderá aceitar corridas após a aprovação.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Saldo</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(entregadorProfile.saldo || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Entregas Hoje</p>
              <p className="text-lg font-bold text-gray-900">{stats.entregasHoje}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Entregas</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalEntregas}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avaliação</p>
              <p className="text-lg font-bold text-gray-900">
                {Number.isFinite(entregadorProfile.avaliacao_media)
                  ? entregadorProfile.avaliacao_media.toFixed(1)
                  : '5.0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Deliveries */}
      {corridasAtivas.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Entregas em Andamento</h2>
          </div>
          <div className="divide-y">
            {corridasAtivas.map((corrida) => (
              <Link
                key={corrida.id}
                href={`/entregador/entregas/${corrida.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    src={corrida.lojista?.foto_url || null}
                    name={corrida.lojista?.user?.nome || 'Lojista'}
                    size="md"
                    className=""
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={corrida.plataforma} size="sm" />
                      <StatusBadge status={corrida.status} size="sm" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1 truncate max-w-[200px]">
                      {corrida.endereco_coleta}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(corrida.valor_total)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Available Corridas */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Corridas Disponíveis</h2>
          <Link href="/entregador/corridas" className="text-secondary-600 hover:text-secondary-700 text-sm font-medium flex items-center gap-1">
            Ver todas
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner size="md" className="" />
          </div>
        ) : !entregadorProfile.online ? (
          <EmptyState
            icon={<MapPin className="w-8 h-8 text-gray-400" />}
            title="Você está offline"
            description="Fique online para ver corridas disponíveis"
            action={null}
          />
        ) : corridasDisponiveis.length === 0 ? (
          <EmptyState
            icon={<Truck className="w-8 h-8 text-gray-400" />}
            title="Nenhuma corrida disponível"
            description="Novas corridas aparecerão aqui"
            action={null}
          />
        ) : (
          <div className="divide-y">
            {corridasDisponiveis.map((corrida) => (
              <Link
                key={corrida.id}
                href={`/entregador/corridas/${corrida.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    src={corrida.lojista?.foto_url || null}
                    name={corrida.lojista?.user?.nome || 'Lojista'}
                    size="md"
                    className=""
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={corrida.plataforma} size="sm" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1 whitespace-normal break-words">
                      {corrida.endereco_coleta}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Route className="w-4 h-4" />
                        {Number.isFinite(corrida.distancia_total_km ?? Number.NaN)
                          ? `${(corrida.distancia_total_km ?? 0).toFixed(1)} km`
                          : 'KM indisponível'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {timeAgo(corrida.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-secondary-600">
                    {formatCurrency(corrida.valor_total)}
                  </p>
                  <p className="text-sm text-gray-500">Ver detalhes</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

