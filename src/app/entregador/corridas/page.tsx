'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, PlatformBadge, EmptyState, LoadingSpinner } from '@/components/ui'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { PRICING } from '@/lib/utils/pricing'
import toast from 'react-hot-toast'
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
  const { profile } = useAuthStore()
  const [corridas, setCorridas] = useState<CorridaDisponivel[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const supabase = createClient()

  const entregadorProfile = profile as any

  useEffect(() => {
    loadCorridas()

    // Real-time subscription
    const channel = supabase
      .channel('corridas-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corridas' },
        () => {
          loadCorridas()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadCorridas() {
    const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, valor_total, total_pacotes, distancia_total_km, 
        endereco_coleta, created_at,
        lojista:lojistas(foto_url, avaliacao_media, user:users(nome))
      `)
      .eq('status', 'aguardando')
      .order('created_at', { ascending: false })

    if (data) {
      setCorridas(data as any)
    }
    setLoading(false)
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
    try {
      const { data: corridaRow } = await supabase
        .from('corridas')
        .select('id, lojista_id, valor_total, valor_reservado, status')
        .eq('id', corridaId)
        .single()

      const corrida = corridaRow as { id: string; lojista_id: string; valor_total: number; valor_reservado: number | null; status: string } | null
      if (!corrida || corrida.status !== 'aguardando') {
        toast.error('Corrida já foi aceita ou não está disponível')
        return
      }

      if (corrida.valor_reservado === null) {
        toast.error('Corrida sem reserva de saldo. Contate o suporte.')
        return
      }

      const { error } = await supabase
        .from('corridas')
        .update({
          entregador_id: entregadorProfile.id,
          status: 'aceita',
          aceita_em: new Date().toISOString(),
        })
        .eq('id', corridaId)
        .eq('status', 'aguardando') // Ensure still available

      if (error) {
        if (error.message.includes('no rows')) {
          toast.error('Corrida j? foi aceita por outro entregador')
        } else {
          throw error
        }
        return
      }

      toast.success('Corrida aceita!')
      loadCorridas()
    } catch (err) {
      toast.error('Erro ao aceitar corrida')
    } finally {
      setAccepting(null)
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
              <Link href="/entregador" className="btn-secondary">
                Ir para o Dashboard
              </Link>
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
        <span className="badge-success">
          {corridas.length} disponível{corridas.length !== 1 ? 's' : ''}
        </span>
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


