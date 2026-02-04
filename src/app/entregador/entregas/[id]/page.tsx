'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { useLocationStore } from '@/stores/location-store'
import { Avatar, Rating, StatusBadge, PlatformBadge, LoadingSpinner } from '@/components/ui'
import { Map } from '@/components/Map'
import { formatCurrency, formatDate, calculateRouteDistance } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  MapPin,
  Phone,
  Package,
  ArrowLeft,
  Check,
  X,
  Map as MapIcon,
} from 'lucide-react'

interface Corrida {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  valor_reservado: number | null
  frete_valor: number | null
  peso_kg: number | null
  volume_cm3: number | null
  total_pacotes: number
  codigo_entrega: string
  endereco_coleta: string
  coleta_latitude: number
  coleta_longitude: number
  coleta_complemento: string | null
  coleta_observacoes: string | null
  created_at: string
  lojista: {
    id: string
    foto_url: string | null
    avaliacao_media: number
    user: {
      id: string
      nome: string
      whatsapp: string
    }
  }
  enderecos: {
    id: string
    endereco: string
    latitude: number
    longitude: number
    complemento: string | null
    observacoes: string | null
    receiver_name: string | null
    receiver_phone: string | null
    peso_kg: number | null
    volume_cm3: number | null
    pacotes: number
    ordem: number
    status: string
    codigo_confirmacao: string
  }[]
}

export default function EntregaDetalhePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, profile, setProfile } = useAuthStore()
  const { currentLocation } = useLocationStore()
  const [corrida, setCorrida] = useState<Corrida | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCodeInput, setShowCodeInput] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [comentario, setComentario] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelDetails, setCancelDetails] = useState('')
  const supabase = createClient()
  const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''
  const TRANSACTION_FEE = 2
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
      .channel(`corrida-entregador-${corridaId}`)
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
        *,
        lojista:lojistas(
          id, user_id, foto_url, avaliacao_media,
          user:users(id, nome, whatsapp)
        ),
        enderecos:enderecos_entrega(*)
      `)
      .eq('id', id)
      .single()

    if (data) {
      if (data.lojista && !data.lojista.user && data.lojista.user_id) {
        const { data: userRow } = await supabase
          .from('users_public')
          .select('id, nome')
          .eq('id', data.lojista.user_id)
          .single()
        if (userRow) {
          data.lojista.user = { ...data.lojista.user, ...userRow }
        }
      }
      if (statusRef.current && statusRef.current !== data.status) {
        if (data.status === 'coletando') {
          toast('Status atualizado: coletando', { icon: '📦' })
        }
        if (data.status === 'em_entrega') {
          toast('Status atualizado: em entrega', { icon: '🚚' })
        }
        if (data.status === 'cancelada') {
          toast('Corrida cancelada pelo lojista', { icon: '⚠️' })
          router.push('/entregador')
        }
        if (data.status === 'finalizada') {
          toast('Corrida finalizada', { icon: '✅' })
        }
      }
      statusRef.current = data.status
      setCorrida(data as any)
    }
    setLoading(false)
  }

  async function iniciarColeta() {
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('iniciar_coleta_entregador', { p_corrida_id: corrida!.id })
      if (error) throw error

      toast.success('Indo para coleta!')
      if (corridaId) {
        loadCorrida(corridaId)
      }
    } catch (err) {
      toast.error('Erro ao atualizar status')
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmarColeta() {
    if (codeInput.toUpperCase() !== corrida!.codigo_entrega) {
      toast.error('Código incorreto')
      return
    }

    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('confirmar_coleta_entregador', {
        p_corrida_id: corrida!.id,
        p_codigo: codeInput.toUpperCase(),
      })
      if (error) throw error

      toast.success('Coleta confirmada!')
      setShowCodeInput(null)
      setCodeInput('')
      if (corridaId) {
        loadCorrida(corridaId)
      }
    } catch (err) {
      toast.error('Erro ao confirmar coleta')
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmarEntrega(enderecoId: string, codigo: string) {
    if (codeInput.toUpperCase() !== codigo) {
      toast.error('Código incorreto')
      return
    }

    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('confirmar_entrega_entregador', {
        p_corrida_id: corrida!.id,
        p_endereco_id: enderecoId,
        p_codigo: codeInput.toUpperCase(),
      })
      if (error) throw error

      const { data: remaining } = await supabase
        .from('enderecos_entrega')
        .select('id')
        .eq('corrida_id', corrida!.id)
        .eq('status', 'pendente')

      if (!remaining || remaining.length === 0) {
        toast.success('Corrida finalizada!')
        setShowRating(true)
      } else {
        toast.success('Entrega confirmada!')
      }

      setShowCodeInput(null)
      setCodeInput('')
      if (corridaId) {
        loadCorrida(corridaId)
      }
    } catch (err) {
      toast.error('Erro ao confirmar entrega')
    } finally {
      setActionLoading(false)
    }
  }

  async function cancelarCorrida() {
    if (!corrida || !['aceita', 'coletando'].includes(corrida.status)) return
    if (!cancelReason) {
      toast.error('Selecione um motivo para o cancelamento')
      return
    }

    setActionLoading(true)
    try {
      const motivo = `${cancelReason}${cancelDetails ? `: ${cancelDetails}` : ''}`
      const { error } = await supabase.rpc('cancelar_corrida_entregador', {
        p_corrida_id: corrida.id,
        p_motivo: motivo,
      })

      if (error) throw error

      toast.success('Corrida cancelada')
      setShowCancelModal(false)
      setCancelReason('')
      setCancelDetails('')
      router.push('/entregador')
    } catch (err) {
      toast.error('Erro ao cancelar')
    } finally {
      setActionLoading(false)
    }
  }

  async function submitRating() {
    if (!corrida) return
    if (!corrida.lojista?.user?.id) {
      toast.error('Dados do lojista indisponíveis para avaliar')
      return
    }

    try {
      await supabase.from('avaliacoes').insert({
        corrida_id: corrida.id,
        avaliador_id: user!.id,
        avaliado_id: corrida.lojista.user.id,
        nota: rating,
        comentario: comentario || null,
      })

      toast.success('Avaliação enviada!')
      setShowRating(false)
      router.push('/entregador')
    } catch (err) {
      toast.error('Erro ao enviar avaliação')
    }
  }

  function openNavigation(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/api=1&destination=${lat},${lng}&travelmode=driving`
    window.open(url, '_blank')
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
        <Link href="/entregador" className="btn-secondary mt-4">
          Voltar
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
    ...corrida.enderecos
      .filter((e) => !(Math.abs(e.latitude) < 0.0001 && Math.abs(e.longitude) < 0.0001))
      .map((e, i) => ({
        position: { lat: e.latitude, lng: e.longitude },
        title: `Entrega ${i + 1}`,
        icon: 'delivery' as const,
      })),
  ]
  const mapCenter = mapMarkers[0]?.position ?? { lat: 0, lng: 0 }

  const nextDelivery = corrida.enderecos.find((e) => e.status === 'pendente')
  const rotaDestinos = corrida.enderecos
    .filter((e) => !(Math.abs(e.latitude) < 0.0001 && Math.abs(e.longitude) < 0.0001))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((e) => ({ lat: e.latitude, lng: e.longitude }))
  const rotaTemCoords =
    !(Math.abs(corrida.coleta_latitude) < 0.0001 && Math.abs(corrida.coleta_longitude) < 0.0001) &&
    rotaDestinos.length > 0
  const distanciaRotaKm = calculateRouteDistance(
    { lat: corrida.coleta_latitude, lng: corrida.coleta_longitude },
    rotaDestinos
  )

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/entregador"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </Link>

      <div className="space-y-6">
        {/* Header */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PlatformBadge platform={corrida.plataforma} size="md" />
                <StatusBadge status={corrida.status} size="md" />
              </div>
              <p className="text-2xl font-bold text-secondary-600">
                {formatCurrency(corrida.valor_total)}
              </p>
              {(corrida.frete_valor || corrida.peso_kg || corrida.volume_cm3) && (
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  {corrida.frete_valor !== null && corrida.frete_valor !== undefined && (
                    <p>Frete: {formatCurrency(corrida.frete_valor)}</p>
                  )}
                  {corrida.peso_kg !== null && corrida.peso_kg !== undefined && (
                    <p>Peso: {corrida.peso_kg.toFixed(2)} kg</p>
                  )}
                  {corrida.volume_cm3 !== null && corrida.volume_cm3 !== undefined && (
                    <p>Volume: {corrida.volume_cm3.toFixed(0)} cm³</p>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="card overflow-hidden">
          <Map
            markers={mapMarkers}
            center={mapCenter}
            zoom={12}
            driverLocation={currentLocation}
            onMapLoad={() => {}}
            showRoute
            className="h-[250px]"
          />
        </div>

        {/* Lojista */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Lojista</h3>
          <div className="flex items-center justify-between">
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
            <a
              href={`https://wa.me/55${corrida.lojista?.user?.whatsapp || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Addresses */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Rota</h3>
          
          <div className="space-y-4">
            {/* Pickup */}
            <div className={`p-4 rounded-xl ${corrida.status === 'coletando' ? 'bg-primary-50 border-2 border-primary-500' : 'bg-gray-50'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-primary-600 font-medium">Coleta</p>
                    <p className="font-medium text-gray-900">{corrida.endereco_coleta}</p>
                    {corrida.coleta_complemento && (
                      <p className="text-sm text-gray-600">{corrida.coleta_complemento}</p>
                    )}
                    {corrida.coleta_observacoes && (
                      <p className="text-sm text-gray-500 mt-1">{corrida.coleta_observacoes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Código: <span className="font-mono font-bold">{corrida.codigo_entrega}</span>
                    </p>
                  </div>
                </div>
                {(corrida.status === 'aceita' || corrida.status === 'coletando') && (
                  <button
                    onClick={() => openNavigation(corrida.coleta_latitude, corrida.coleta_longitude)}
                    className="btn-ghost text-primary-600"
                  >
                    <MapIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Deliveries */}
            {corrida.enderecos.map((endereco, index) => (
              <div
                key={endereco.id}
                className={`p-4 rounded-xl ${
                  endereco.status === 'pendente' &&
                  corrida.status === 'em_entrega' &&
                  !!nextDelivery &&
                  endereco.id === nextDelivery.id
                    ? 'bg-secondary-50 border-2 border-secondary-500'
                    : endereco.status === 'entregue'
                    ? 'bg-green-50'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      endereco.status === 'entregue' ? 'bg-green-100' : 'bg-gray-200'
                    }`}>
                      {endereco.status === 'entregue' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Entrega {index + 1} • {endereco.pacotes} pacote{endereco.pacotes > 1 ? 's' : ''}
                      </p>
                      <p className="font-medium text-gray-900">{endereco.endereco}</p>
                      {endereco.receiver_name && (
                        <p className="text-sm text-gray-700">
                          Recebedor: {endereco.receiver_name}
                        </p>
                      )}
                      {endereco.receiver_phone && (
                        <p className="text-sm text-gray-700">
                          Telefone: {endereco.receiver_phone}
                        </p>
                      )}
                      {(endereco.peso_kg || endereco.volume_cm3) && (
                        <p className="text-sm text-gray-600">
                          {endereco.peso_kg ? `Peso ${endereco.peso_kg.toFixed(2)} kg` : ''}
                          {endereco.peso_kg && endereco.volume_cm3 ? ' • ' : ''}
                          {endereco.volume_cm3 ? `Volume ${endereco.volume_cm3.toFixed(0)} cm³` : ''}
                        </p>
                      )}
                      {endereco.complemento && (
                        <p className="text-sm text-gray-600">{endereco.complemento}</p>
                      )}
                      {endereco.observacoes && (
                        <p className="text-sm text-gray-500 mt-1">{endereco.observacoes}</p>
                      )}
                      {endereco.status === 'pendente' && (
                        <p className="text-xs text-gray-400 mt-2">
                          Código: <span className="font-mono font-bold">{endereco.codigo_confirmacao}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {endereco.status === 'pendente' && corrida.status === 'em_entrega' && (
                    <button
                      onClick={() => openNavigation(endereco.latitude, endereco.longitude)}
                      className="btn-ghost text-secondary-600"
                    >
                      <MapIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {corrida.status === 'aceita' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Distância estimada da rota</span>
                <span className="font-semibold text-gray-900">
                  {rotaTemCoords ? `${distanciaRotaKm.toFixed(1)} km` : 'Indisponível'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-gray-600">Valor da corrida</span>
                <span className="font-semibold text-secondary-600">
                  {formatCurrency(corrida.valor_total)}
                </span>
              </div>
            </div>
            <button
              onClick={() => openNavigation(corrida.coleta_latitude, corrida.coleta_longitude)}
              className="btn-secondary w-full flex items-center justify-center gap-2 shadow-sm"
            >
              <MapIcon className="w-5 h-5" />
              Abrir GPS
            </button>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                className="btn-outline flex-1"
              >
              Cancelar
              </button>
              <button onClick={iniciarColeta} disabled={actionLoading} className="btn-secondary flex-1">
                Ir para Coleta
              </button>
            </div>
          </div>
        )}

        {corrida.status === 'coletando' && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Distância estimada da rota</span>
                <span className="font-semibold text-gray-900">
                  {rotaTemCoords ? `${distanciaRotaKm.toFixed(1)} km` : 'Indisponível'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-gray-600">Valor da corrida</span>
                <span className="font-semibold text-secondary-600">
                  {formatCurrency(corrida.valor_total)}
                </span>
              </div>
            </div>
            <button
              onClick={() => openNavigation(corrida.coleta_latitude, corrida.coleta_longitude)}
              className="btn-primary w-full flex items-center justify-center gap-2 shadow-sm"
            >
              <MapIcon className="w-5 h-5" />
              Abrir GPS
            </button>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowCodeInput('coleta')}
                disabled={actionLoading}
                className="btn-secondary flex-1"
              >
                Confirmar Coleta
              </button>
            </div>
          </div>
        )}

        {corrida.status === 'em_entrega' && nextDelivery && (
          <button
            onClick={() => setShowCodeInput(nextDelivery.id)}
            disabled={actionLoading}
            className="btn-secondary w-full py-3"
          >
            Confirmar Entrega {corrida.enderecos.findIndex((e) => e.id === nextDelivery.id) + 1}
          </button>
        )}
      </div>

      {/* Code Input Modal */}
      {showCodeInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {showCodeInput === 'coleta' ? 'Código de Coleta' : 'Código de Entrega'}
            </h3>
            {showCodeInput === 'coleta' && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Distância estimada da rota</span>
                  <span className="font-semibold text-gray-900">{distanciaRotaKm.toFixed(1)} km</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-gray-600">Valor da corrida</span>
                  <span className="font-semibold text-secondary-600">
                    {formatCurrency(corrida.valor_total)}
                  </span>
                </div>
              </div>
            )}
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              className="input text-center text-2xl font-mono tracking-widest mb-4"
              placeholder="XXXXXX"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCodeInput(null); setCodeInput('') }}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (showCodeInput === 'coleta') {
                    confirmarColeta()
                  } else {
                    const endereco = corrida!.enderecos.find((e) => e.id === showCodeInput)
                    if (endereco) {
                      confirmarEntrega(showCodeInput, endereco.codigo_confirmacao)
                    }
                  }
                }}
                disabled={actionLoading || codeInput.length !== 6}
                className="btn-secondary flex-1"
              >
                {actionLoading ? 'Verificando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Avalie o Lojista
            </h3>
            
            <div className="flex justify-center mb-4">
              <Avatar
                src={corrida.lojista?.foto_url || null}
                name={corrida.lojista?.user?.nome || 'Lojista'}
                size="xl"
                className=""
              />
            </div>
            <p className="text-center font-medium text-gray-900 mb-4">
              {corrida.lojista?.user?.nome || '-'}
            </p>

            <div className="flex justify-center mb-4">
              <Rating value={rating} size="lg" max={5} showValue={false} onChange={setRating} />
            </div>

            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="input mb-4"
              placeholder="Comentário (opcional)"
              rows={3}
            />

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/entregador')}
                className="btn-outline flex-1"
              >
                Pular
              </button>
              <button onClick={submitRating} className="btn-secondary flex-1">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Cancelar corrida</h3>
            <p className="text-sm text-gray-600 mb-4">
              Informe o motivo do cancelamento.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="input mb-4"
            >
              <option value="">Selecione</option>
              <option value="cliente_ausente">Cliente ausente</option>
              <option value="endereco_invalido">Endereço inválido</option>
              <option value="sem_contato">Sem contato com o cliente</option>
              <option value="problema_veiculo">Problema com a moto</option>
              <option value="problema_rota">Problema na rota</option>
              <option value="outro">Outro</option>
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-2">Detalhes (opcional)</label>
            <textarea
              value={cancelDetails}
              onChange={(e) => setCancelDetails(e.target.value)}
              className="input mb-4"
              rows={3}
              placeholder="Descreva rapidamente o motivo"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelReason('')
                  setCancelDetails('')
                }}
                className="btn-outline flex-1"
              >
                Voltar
              </button>
              <button
                onClick={cancelarCorrida}
                disabled={actionLoading || !cancelReason}
                className="btn-secondary flex-1"
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


