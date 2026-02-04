'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, PlatformBadge, EmptyState, LoadingSpinner } from '@/components/ui'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { PRICING } from '@/lib/utils/pricing'
import toast from 'react-hot-toast'
import { useLocationStore } from '@/stores/location-store'
import {
  MapPin,
  Truck,
  Package,
  Clock,
} from 'lucide-react'

interface CorridaDisponivel {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  valor_total: number
  total_pacotes: number
  distancia_total_km: number
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

export default function CorridasDisponiveisPage() {
  const { profile, setProfile } = useAuthStore()
  const { startTracking, stopTracking, currentLocation } = useLocationStore()
  const router = useRouter()
  const [corridas, setCorridas] = useState<CorridaDisponivel[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  const entregadorProfile = profile as any

  useEffect(() => {
    loadCorridas()

    // Real-time subscription
        const channel = supabase
          .channel('corridas-rt')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'corridas' },
          (payload: any) => {
            const newStatus = payload.new?.status
            const oldStatus = payload.old?.status

            if (payload.eventType === 'INSERT' && newStatus === 'aguardando') {
              const createdId = payload.new?.id
              if (createdId) {
                loadCorridaById(createdId)
              }
              return
            }

            if (payload.eventType === 'UPDATE') {
              // Saiu de aguardando (aceita/cancelada)
              if (oldStatus === 'aguardando' && newStatus !== 'aguardando') {
                setCorridas((prev) => prev.filter((c) => c.id !== payload.new.id))
                return
              }

              // Update enquanto aguardando
              if (newStatus === 'aguardando') {
                const updated = payload.new
                if (updated?.id) {
                  setCorridas((prev) => {
                    const exists = prev.find((c) => c.id === updated.id)
                    if (exists) {
                      return prev.map((c) => (c.id === updated.id ? { ...c, ...(updated as any) } : c))
                    }
                    return [updated as any, ...prev]
                  })
                }
                return
              }
            }

            if (payload.eventType === 'DELETE' && oldStatus === 'aguardando') {
              setCorridas((prev) => prev.filter((c) => c.id !== payload.old.id))
              return
            }
          }
        )
        .on('broadcast', { event: 'corrida-aceita' }, (payload: any) => {
          const id = payload?.payload?.id
          if (id) {
            setCorridas((prev) => prev.filter((c) => c.id !== id))
          }
        })
        .on('broadcast', { event: 'corrida-cancelada' }, (payload: any) => {
          const id = payload?.payload?.id
          if (id) {
            setCorridas((prev) => prev.filter((c) => c.id !== id))
          }
        })
        .subscribe()
      channelRef.current = channel

      return () => {
        supabase.removeChannel(channel)
        channelRef.current = null
      }
    }, [])

  async function loadCorridas() {
    const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, entregador_id, valor_total, total_pacotes, distancia_total_km, 
        endereco_coleta, created_at,
        lojista:lojistas(foto_url, avaliacao_media, user:users(nome))
      `)
      .eq('status', 'aguardando')
      .is('entregador_id', null)
      .order('created_at', { ascending: false })

    if (data) {
      setCorridas(data as any)
    }
    setLoading(false)
  }

  async function loadCorridaById(corridaId: string) {
    const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, status, entregador_id, valor_total, total_pacotes, distancia_total_km, 
        endereco_coleta, created_at,
        lojista:lojistas(foto_url, avaliacao_media, user:users(nome))
      `)
      .eq('id', corridaId)
      .single()

    if (data && data.status === 'aguardando' && data.entregador_id == null) {
      setCorridas((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev
        return [data as any, ...prev]
      })
    }
  }

    async function aceitarCorrida(corridaId: string) {
      if (!entregadorProfile.online) {
        toast.error('Você precisa estar online para aceitar corridas')
        return
      }

    // Check active corridas limit
    const { count } = await supabase
      .from('corridas')
      .select('*', { count: 'exact', head: true })
      .eq('entregador_id', entregadorProfile.id)
      .in('status', ['aceita', 'coletando', 'em_entrega'])

    if ((count || 0) >= PRICING.MAX_SIMULTANEOUS_ROUTES) {
      toast.error(`Você j? tem ${PRICING.MAX_SIMULTANEOUS_ROUTES} rotas ativas`)
      return
    }

      setAccepting(corridaId)
      // Otimista: remove imediatamente da lista local
      setCorridas((prev) => prev.filter((c) => c.id !== corridaId))
      try {
        console.log('[aceitarCorrida] start', { corridaId, entregadorId: entregadorProfile.id })
        const { data, error } = await supabase
          .rpc('aceitar_corrida_entregador', { p_corrida_id: corridaId })

        if (error) {
          console.error('[aceitarCorrida] update error', error)
          throw error
        }

      const updated = data as { id: string; status: string; valor_reservado: number | null } | null
      if (!updated) {
        toast.error('Corrida já foi aceita ou não está disponível')
        return
      }

      if (updated.valor_reservado === null) {
        toast.error('Corrida sem reserva de saldo. Contate o suporte.')
        return
      }

        console.log('[aceitarCorrida] update success', updated)
        toast.success('Corrida aceita!')
        // Broadcast imediato para outros entregadores
          channelRef.current?.send({
            type: 'broadcast',
            event: 'corrida-aceita',
            payload: { id: corridaId },
          })
        router.push(`/entregador/entregas/${corridaId}`)
      } catch (err) {
        // Recarrega para reverter remoção otimista em caso de erro
        loadCorridas()
        toast.error('Erro ao aceitar corrida')
      } finally {
        setAccepting(null)
      }
    }

  async function toggleOnline() {
    if (!entregadorProfile?.id) return
    try {
      const newOnlineStatus = !entregadorProfile.online
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
    }
  }

  if (!entregadorProfile.online) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Corridas Disponíveis</h1>
        <div className="card p-8">
          <EmptyState
            icon={<MapPin className="w-8 h-8 text-gray-400" />}
            title="Você está offline"
            description="Fique online para ver e aceitar corridas disponíveis"
            action={
              <button onClick={toggleOnline} className="btn-secondary">
                {entregadorProfile.online ? 'Você está online' : 'Ficar online'}
              </button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Corridas Disponíveis</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleOnline}
            className={`btn ${entregadorProfile.online ? 'bg-green-600 text-white' : 'btn-secondary'}`}
          >
            {entregadorProfile.online ? 'Online' : 'Ficar online'}
          </button>
          <span className="badge-success">
            {corridas.length} disponível{corridas.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 flex justify-center">
          <LoadingSpinner size="md" className="" />
        </div>
      ) : corridas.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Truck className="w-8 h-8 text-gray-400" />}
            title="Nenhuma corrida disponível"
            description="Novas corridas aparecerão aqui automaticamente"
            action={null}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {corridas.map((corrida) => (
            <div key={corrida.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={corrida.lojista?.foto_url || null}
                    name={corrida.lojista?.user?.nome || 'Lojista'}
                    size="lg"
                    className=""
                  />
                  <div>
                    <p className="font-medium text-gray-900">{corrida.lojista?.user?.nome || '-'}</p>
                    <PlatformBadge platform={corrida.plataforma} size="sm" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-secondary-600">
                    {formatCurrency(corrida.valor_total)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="text-sm truncate">{corrida.endereco_coleta}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    {Number.isFinite(corrida.distancia_total_km)
                      ? `${corrida.distancia_total_km.toFixed(1)} km`
                      : 'Distância indisponível'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {timeAgo(corrida.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  href={`/entregador/corridas/${corrida.id}`}
                  className="btn-outline flex-1"
                >
                  Ver Detalhes
                </Link>
                <button
                  onClick={() => aceitarCorrida(corrida.id)}
                  disabled={accepting === corrida.id}
                  className="btn-secondary flex-1"
                >
                  {accepting === corrida.id ? 'Aceitando...' : 'Aceitar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
