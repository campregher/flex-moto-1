'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, PlatformBadge, Rating, LoadingSpinner } from '@/components/ui'
import { Map } from '@/components/Map'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  MapPin,
  Package,
  Clock,
  Check,
} from 'lucide-react'

interface CorridaDetalhe {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  total_pacotes: number
  distancia_total_km: number
  endereco_coleta: string
  coleta_latitude: number
  coleta_longitude: number
  created_at: string
  lojista: {
    id: string
    user_id: string
    foto_url: string | null
    avaliacao_media: number
    user: {
      nome: string
    } | null
  } | null
  enderecos: {
    id: string
    endereco: string
    latitude: number
    longitude: number
    pacotes: number
    status: string
  }[]
}

export default function CorridaDisponivelDetalhePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuthStore()
  const [corrida, setCorrida] = useState<CorridaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const supabase = createClient()
  const statusRef = useRef<string | null>(null)

  const entregadorProfile = profile as any
  const corridaId = params?.id

  useEffect(() => {
    if (!corridaId) return
    loadCorrida(corridaId)
  }, [corridaId])

  useEffect(() => {
    if (!corridaId) return
    const channel = supabase
      .channel(`corrida-disponivel-${corridaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'corridas', filter: `id=eq.${corridaId}` },
        () => {
          loadCorrida(corridaId)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'enderecos_entrega', filter: `corrida_id=eq.${corridaId}` },
        () => {
          loadCorrida(corridaId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [corridaId])

  async function loadCorrida(id: string) {
    const { data } = await supabase
      .from('corridas')
      .select(`
        id, plataforma, status, valor_total, total_pacotes, distancia_total_km,
        endereco_coleta, coleta_latitude, coleta_longitude, created_at,
        lojista:lojistas(
          id, user_id, foto_url, avaliacao_media,
          user:users(nome)
        ),
        enderecos:enderecos_entrega(id, endereco, latitude, longitude, pacotes, status)
      `)
      .eq('id', id)
      .single()

    if (data) {
      if (data.lojista && !data.lojista.user && data.lojista.user_id) {
        const { data: userRow } = await supabase
          .from('users_public')
          .select('nome')
          .eq('id', data.lojista.user_id)
          .single()
        if (userRow) {
          data.lojista.user = { nome: userRow.nome }
        }
      }
      if (statusRef.current && statusRef.current !== data.status) {
        if (data.status !== 'aguardando') {
          toast('Essa corrida não está mais disponível.', { icon: '??' })
        }
      }
      statusRef.current = data.status
      setCorrida(data as any)
    }
    setLoading(false)
  }

  async function aceitarCorrida() {
    if (!corridaId) return
    if (!entregadorProfile.online) {
      toast.error('Você precisa estar online para aceitar corridas')
      return
    }

    setAccepting(true)
    try {
      const { data, error } = await supabase
        .rpc('aceitar_corrida_entregador', { p_corrida_id: corridaId })

      if (error) {
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

      toast.success('Corrida aceita!')
      router.push(`/entregador/entregas/${corridaId}`)
    } catch (err) {
      toast.error('Erro ao aceitar corrida')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" className="" />
      </div>
    )
  }

  if (!corrida) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Corrida não encontrada</p>
        <Link href="/entregador/corridas" className="btn-secondary mt-4">
          Voltar
        </Link>
      </div>
    )
  }

  if (corrida.status !== 'aguardando') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Essa corrida não está mais disponível.</p>
        <Link href="/entregador/corridas" className="btn-secondary mt-4">
          Ver outras corridas
        </Link>
      </div>
    )
  }

  const mapMarkers = [
    {
      position: { lat: corrida.coleta_latitude, lng: corrida.coleta_longitude },
      title: 'Coleta',
      icon: 'pickup' as const,
    },
    ...corrida.enderecos.map((e, i) => ({
      position: { lat: e.latitude, lng: e.longitude },
      title: `Entrega ${i + 1}`,
      icon: 'delivery' as const,
      })),
  ]
  const mapCenter = mapMarkers[0]?.position ?? { lat: 0, lng: 0 }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/entregador/corridas"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </Link>

      <div className="space-y-6">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <PlatformBadge platform={corrida.plataforma} size="md" />
              <p className="text-2xl font-bold text-secondary-600 mt-2">
                {formatCurrency(corrida.valor_total)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Criada em {formatDate(corrida.created_at)}
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div className="flex items-center gap-1 justify-end">
                <Package className="w-4 h-4" />
                {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-1 justify-end mt-1">
                <Clock className="w-4 h-4" />
                {Number.isFinite(corrida.distancia_total_km)
                  ? `${corrida.distancia_total_km.toFixed(1)} km`
                  : 'Distância indisponível'}
              </div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <Map
            markers={mapMarkers}
            center={mapCenter}
            zoom={12}
            driverLocation={null}
            onMapLoad={() => {}}
            showRoute
            className="h-[250px]"
          />
        </div>

        {corrida.lojista && (
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Lojista</h3>
            <div className="flex items-center gap-4">
              <Avatar
                src={corrida.lojista?.foto_url || null}
                name={corrida.lojista?.user?.nome || 'Lojista'}
                size="lg"
                className=""
              />
              <div>
                <p className="font-medium text-gray-900">{corrida.lojista?.user?.nome || '-'}</p>
                <Rating
                  value={corrida.lojista.avaliacao_media}
                  size="sm"
                  max={5}
                  showValue={false}
                  onChange={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Endereços</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-primary-600 font-medium">Coleta</p>
                <p className="text-gray-900">{corrida.endereco_coleta}</p>
              </div>
            </div>

            {corrida.enderecos.map((e, i) => (
              <div key={e.id} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    Entrega {i + 1} • {e.pacotes} pacote{e.pacotes > 1 ? 's' : ''}
                  </p>
                  <p className="text-gray-900">{e.endereco}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={aceitarCorrida}
          disabled={accepting || !entregadorProfile.online}
          className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          {accepting ? 'Aceitando...' : 'Aceitar Corrida'}
        </button>
      </div>
    </div>
  )
}



