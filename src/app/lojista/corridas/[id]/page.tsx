'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, Rating, StatusBadge, PlatformBadge, LoadingSpinner } from '@/components/ui'
import { Map } from '@/components/Map'
import { formatCurrency, formatDate, timeAgo, calculateRouteDistance } from '@/lib/utils'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { loadGoogleMaps } from '@/lib/google-maps'
import { calculateDeliveryPrice } from '@/lib/utils/pricing'
import toast from 'react-hot-toast'
import {
  HiOutlineLocationMarker,
  HiOutlinePhone,
  HiOutlineCube,
  HiOutlineClock,
  HiOutlineArrowLeft,
  HiOutlineCheck,
  HiOutlineX,
} from 'react-icons/hi'

interface Corrida {
  id: string
  lojista_id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  valor_reservado: number | null
  frete_valor: number | null
  peso_kg: number | null
  volume_cm3: number | null
  total_pacotes: number
  distancia_total_km: number
  codigo_entrega: string
  endereco_coleta: string
  coleta_latitude: number
  coleta_longitude: number
  coleta_complemento: string | null
  coleta_observacoes: string | null
  created_at: string
  aceita_em: string | null
  coletada_em: string | null
  finalizada_em: string | null
  entregador: {
    id: string
    foto_url: string | null
    avaliacao_media: number
    latitude: number | null
    longitude: number | null
    user: {
      id: string
      nome: string
      whatsapp: string
    }
  } | null
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

export default function CorridaDetalhePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [corrida, setCorrida] = useState<Corrida | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editColeta, setEditColeta] = useState({
    endereco: '',
    latitude: 0,
    longitude: 0,
    complemento: '',
    observacoes: '',
  })
  const [editEnderecos, setEditEnderecos] = useState<Corrida['enderecos']>([])
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(5)
  const [comentario, setComentario] = useState('')
  const suppressReloadRef = useRef(false)
  const statusRef = useRef<string | null>(null)
  const supabase = createClient()
  const corridaId = params?.id

  useEffect(() => {
    if (!corridaId) return
    loadCorrida(corridaId)

    // Real-time subscription
    const channel = supabase
      .channel(`corrida-${corridaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'corridas', filter: `id=eq.${corridaId}` },
       () => {
          if (!suppressReloadRef.current) {
            loadCorrida(corridaId)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'entregadores' },
       () => {
          if (!suppressReloadRef.current) {
            loadCorrida(corridaId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [corridaId, supabase])

  async function loadCorrida(id: string) {
    const { data } = await supabase
      .from('corridas')
      .select(`
        *,
        entregador:entregadores(
          id, foto_url, avaliacao_media, latitude, longitude,
          user:users(id, nome, whatsapp)
        ),
        enderecos:enderecos_entrega(*)
      `)
      .eq('id', id)
      .single()

    if (data) {
      if (statusRef.current && statusRef.current !== data.status) {
        if (data.status === 'aceita') toast('Corrida aceita por entregador', { icon: '✅' })
        if (data.status === 'coletando') toast('Entregador a caminho da coleta', { icon: '📦' })
        if (data.status === 'em_entrega') toast('Pedido em entrega', { icon: '🚚' })
        if (data.status === 'finalizada') toast('Corrida finalizada', { icon: '🎉' })
        if (data.status === 'cancelada') toast('Corrida cancelada', { icon: '⚠️' })
      }
      statusRef.current = data.status
      setCorrida(data as any)
      
      // Show rating modal if corrida just finished
      if (data.status === 'finalizada' && data.entregador && user?.id) {
        const { data: existingRating } = await supabase
          .from('avaliacoes')
          .select('id')
          .eq('corrida_id', data.id)
          .eq('avaliador_id', user.id)
          .single()

        if (!existingRating) {
          setShowRating(true)
        }
      }
    }
    setLoading(false)
  }

  async function cancelarCorrida() {
    if (!corrida || corrida.status !== 'aguardando') return

    try {
      const reservado = corrida.valor_reservado || 0
      if (reservado > 0) {
        const { data: lojistaRow } = await supabase
          .from('lojistas')
          .select('id, saldo, user_id')
          .eq('id', corrida.lojista_id)
          .single()

        const lojista = lojistaRow as { id: string; saldo: number; user_id: string } | null
        if (lojista) {
          const novoSaldoLojista = (lojista.saldo || 0) + reservado
          await supabase
            .from('lojistas')
            .update({ saldo: novoSaldoLojista })
            .eq('id', lojista.id)

          await supabase.from('financeiro').insert({
            user_id: lojista.user_id,
            tipo: 'estorno',
            valor: reservado,
            saldo_anterior: lojista.saldo || 0,
            saldo_posterior: novoSaldoLojista,
            descricao: `Estorno corrida #${corrida.id.slice(0, 8)}`,
            corrida_id: corrida.id,
          })
        }
      }

      await supabase
        .from('corridas')
        .update({
          status: 'cancelada',
          cancelada_em: new Date().toISOString(),
          motivo_cancelamento: 'Cancelado pelo lojista',
          valor_reservado: null,
        })
        .eq('id', corrida.id)

      toast.success('Corrida cancelada')
      router.push('/lojista/corridas')
    } catch (err) {
      toast.error('Erro ao cancelar corrida')
    }
  }

  function iniciarEdicao() {
    if (!corrida || corrida.status !== 'aguardando') return
    setEditColeta({
      endereco: corrida.endereco_coleta || '',
      latitude: corrida.coleta_latitude || 0,
      longitude: corrida.coleta_longitude || 0,
      complemento: corrida.coleta_complemento || '',
      observacoes: corrida.coleta_observacoes || '',
    })
    setEditEnderecos(
      corrida.enderecos.map((endereco) => ({
        ...endereco,
        complemento: endereco.complemento || '',
        observacoes: endereco.observacoes || '',
        pacotes: endereco.pacotes || 1,
      }))
    )
    setEditing(true)
  }

  async function salvarEdicao() {
    if (!corrida || corrida.status !== 'aguardando') return
    if (!editColeta.endereco.trim()) {
      toast.error('Informe o endereco de coleta')
      return
    }
    if (editEnderecos.some((e) => !e.endereco.trim())) {
      toast.error('Informe todos os enderecos de entrega')
      return
    }

    console.debug('[editar-corrida] payload', {
      corridaId: corrida.id,
      status: corrida.status,
      coleta: editColeta,
      enderecos: editEnderecos.map((e) => ({
        id: e.id,
        endereco: e.endereco,
        latitude: e.latitude,
        longitude: e.longitude,
        complemento: e.complemento,
        observacoes: e.observacoes,
        pacotes: e.pacotes,
      })),
    })

    setSavingEdit(true)
    suppressReloadRef.current = true
    try {
      const totalPacotesEdit = editEnderecos.reduce((acc, item) => acc + (item.pacotes || 0), 0)
      let distanciaKm = 0

      try {
        await loadGoogleMaps()
        const directionsService = new google.maps.DirectionsService()
        const destinosCoords = editEnderecos
          .filter((e) => e.latitude && e.longitude)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((e) => ({ lat: e.latitude, lng: e.longitude }))

        const usarCoords =
          Boolean(editColeta.latitude && editColeta.longitude) && destinosCoords.length > 0
        const usarEnderecos = !usarCoords && editEnderecos.some((e) => e.endereco.trim())

        if (usarCoords || usarEnderecos) {
          const origin = usarCoords
            ? new google.maps.LatLng(editColeta.latitude, editColeta.longitude)
            : editColeta.endereco.trim()
          const enderecosValidos = editEnderecos
            .map((e) => e.endereco.trim())
            .filter(Boolean) as string[]
          const destination = usarCoords
            ? destinosCoords[destinosCoords.length - 1]
            : enderecosValidos[enderecosValidos.length - 1]
          const waypoints = usarCoords
            ? destinosCoords.slice(0, -1).map((dest) => ({ location: dest, stopover: true }))
            : enderecosValidos.slice(0, -1).map((dest) => ({ location: dest, stopover: true }))

          const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
            directionsService.route(
              {
                origin,
                destination,
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true,
                region: 'BR',
                provideRouteAlternatives: false,
              },
             (res, status) => {
                if (status === 'OK' && res && res.routes.length) {
                  resolve(res)
                } else {
                  resolve(null)
                }
              }
            )
          })

          if (result && result.routes.length) {
             const totalMeters = result.routes[0].legs.reduce(
              (sum, leg) => sum + (leg.distance?.value || 0),
               0
             )
            distanciaKm = Math.round((totalMeters / 1000) * 10) / 10
          }
        }
      } catch {
        // fall back below
      }

      if (!distanciaKm) {
        const fallbackDestinos = editEnderecos
          .filter((e) => e.latitude && e.longitude)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((e) => ({ lat: e.latitude, lng: e.longitude }))
        if (editColeta.latitude && editColeta.longitude && fallbackDestinos.length > 0) {
          distanciaKm = calculateRouteDistance(
            { lat: editColeta.latitude, lng: editColeta.longitude },
            fallbackDestinos
          )
        }
      }

      const valorTotalEdit = calculateDeliveryPrice(totalPacotesEdit, distanciaKm)

      const { error: coletaError, data: coletaData } = await supabase
        .from('corridas')
        .update({
          endereco_coleta: editColeta.endereco,
          coleta_latitude: editColeta.latitude || 0,
          coleta_longitude: editColeta.longitude || 0,
          coleta_complemento: editColeta.complemento || null,
          coleta_observacoes: editColeta.observacoes || null,
          distancia_total_km: distanciaKm,
          valor_total: valorTotalEdit,
          valor_reservado: valorTotalEdit,
          frete_valor: valorTotalEdit,
          total_pacotes: totalPacotesEdit,
        })
        .eq('id', corrida.id)
        .select()
        .single()

      if (coletaError) throw coletaError
      console.debug('[editar-corrida] corrida atualizada', coletaData)

      for (const endereco of editEnderecos) {
        const { error: enderecoError } = await supabase
          .from('enderecos_entrega')
          .update({
            endereco: endereco.endereco,
            latitude: endereco.latitude || 0,
            longitude: endereco.longitude || 0,
            complemento: endereco.complemento || null,
            observacoes: endereco.observacoes || null,
            pacotes: endereco.pacotes || 1,
          })
          .eq('id', endereco.id)

        if (enderecoError) throw enderecoError
        console.debug('[editar-corrida] endereco atualizado', endereco.id)
      }

      setCorrida((prev) =>
        prev
          ? {
              ...prev,
              endereco_coleta: editColeta.endereco,
              coleta_latitude: editColeta.latitude || 0,
              coleta_longitude: editColeta.longitude || 0,
              coleta_complemento: editColeta.complemento || null,
              coleta_observacoes: editColeta.observacoes || null,
              distancia_total_km: distanciaKm,
              valor_total: valorTotalEdit,
              valor_reservado: valorTotalEdit,
              frete_valor: valorTotalEdit,
              total_pacotes: totalPacotesEdit,
              enderecos: editEnderecos.map((item) => ({
                ...item,
                complemento: item.complemento || null,
                observacoes: item.observacoes || null,
                pacotes: item.pacotes || 1,
              })),
            }
          : prev
      )
      toast.success('Corrida atualizada')
      setEditing(false)
      if (corridaId) {
        await loadCorrida(corridaId)
      }
    } catch (err) {
      toast.error('Erro ao atualizar corrida')
    } finally {
      setSavingEdit(false)
      suppressReloadRef.current = false
    }
  }

  async function submitRating() {
    if (!corrida?.entregador) return
    const entregadorUserId = corrida.entregador.user?.id
    if (!user?.id || !entregadorUserId) return

    try {
      await supabase.from('avaliacoes').insert({
        corrida_id: corrida.id,
        avaliador_id: user.id,
        avaliado_id: entregadorUserId,
        nota: rating,
        comentario: comentario || null,
      })

      // Update entregador average rating
      const { data: ratings } = await supabase
        .from('avaliacoes')
        .select('nota')
        .eq('avaliado_id', entregadorUserId)

      if (ratings) {
        const avgRating =
          ratings.reduce((acc: number, r: { nota: number }) => acc + r.nota, 0) /
          ratings.length
        await supabase
          .from('entregadores')
          .update({
            avaliacao_media: avgRating,
            total_avaliacoes: ratings.length,
          })
          .eq('user_id', entregadorUserId)
      }

      toast.success('Avaliação enviada!')
      setShowRating(false)
    } catch (err) {
      toast.error('Erro ao enviar avaliação')
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
        <Link href="/lojista/corridas" className="btn-primary mt-4">
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

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/lojista/corridas"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <HiOutlineArrowLeft className="w-5 h-5" />
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
              <p className="text-2xl font-bold text-gray-900">
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
              <p className="text-sm text-gray-500">Código</p>
              <p className="text-xl font-mono font-bold text-primary-600">
                {corrida.codigo_entrega}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <HiOutlineCube className="w-4 h-4" />
              {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <HiOutlineClock className="w-4 h-4" />
              {formatDate(corrida.created_at)}
            </span>
          </div>
        </div>

        {/* Map */}
        <div className="card overflow-hidden">
          <Map
            markers={mapMarkers}
            center={mapCenter}
            zoom={12}
            driverLocation={
              corrida.entregador?.latitude && corrida.entregador?.longitude
                ? { lat: corrida.entregador.latitude, lng: corrida.entregador.longitude }
                : null
            }
            onMapLoad={() => {}}
            showRoute
            className="h-[300px]"
          />
        </div>

        {/* Entregador */}
        {corrida.entregador ? (
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Entregador</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  src={corrida.entregador.foto_url}
                  name={corrida.entregador.user?.nome || ''}
                  size="lg"
                  className=""
                />
                <div>
                  <p className="font-medium text-gray-900">{corrida.entregador.user?.nome || '-'}</p>
                  <Rating
                    value={corrida.entregador.avaliacao_media}
                    size="sm"
                    max={5}
                    showValue={false}
                    onChange={() => {}}
                  />
                </div>
              </div>
              <a
                href={`https://wa.me/55${corrida.entregador.user?.whatsapp || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline flex items-center gap-2"
              >
                <HiOutlinePhone className="w-5 h-5" />
                WhatsApp
              </a>
            </div>
          </div>
        ) : corrida.status === 'aguardando' ? (
          <div className="card p-6 text-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Buscando entregador...</p>
            </div>
          </div>
        ) : null}

        {/* Addresses */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Endereços</h3>
            {corrida.status === 'aguardando' && !editing && (
              <button onClick={iniciarEdicao} className="btn-outline text-sm">
                Editar corrida
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {/* Pickup */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <HiOutlineLocationMarker className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Coleta</p>
                {editing ? (
                  <div className="space-y-2">
                    <AddressAutocomplete
                      value={editColeta.endereco}
                      onChange={(value) =>
                        setEditColeta((prev) => ({
                          ...prev,
                          endereco: value,
                          latitude: 0,
                          longitude: 0,
                        }))
                      }
                      onSelect={(details) =>
                        setEditColeta((prev) => ({
                          ...prev,
                          endereco: details.formattedAddress || prev.endereco,
                          latitude: details.lat || 0,
                          longitude: details.lng || 0,
                        }))
                      }
                      placeholder="Rua, numero, bairro, cidade"
                      className="input"
                      id="edit_coleta_endereco"
                      name="edit_coleta_endereco"
                      disabled={false}
                      country="br"
                      autoComplete="street-address"
                      preferLegacy
                      enableLiveGeocode={false}
                    />
                    <input
                      type="text"
                      value={editColeta.complemento}
                      onChange={(e) =>
                        setEditColeta((prev) => ({ ...prev, complemento: e.target.value }))
                      }
                      className="input"
                      placeholder="Complemento"
                    />
                    <input
                      type="text"
                      value={editColeta.observacoes}
                      onChange={(e) =>
                        setEditColeta((prev) => ({ ...prev, observacoes: e.target.value }))
                      }
                      className="input"
                      placeholder="Observações"
                    />
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-gray-900">{corrida.endereco_coleta}</p>
                    {corrida.coleta_complemento && (
                      <p className="text-sm text-gray-600">{corrida.coleta_complemento}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Deliveries */}
            {(editing ? editEnderecos : corrida.enderecos).map((endereco, index) => (
              <div key={endereco.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  endereco.status === 'entregue' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {endereco.status === 'entregue' ? (
                    <HiOutlineCheck className="w-4 h-4 text-green-600" />
                  ) : (
                    <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Entrega {index + 1} • {endereco.pacotes} pacote{endereco.pacotes > 1 ? 's' : ''}
                    </p>
                    <StatusBadge status={endereco.status} size="sm" />
                  </div>
                  {editing ? (
                    <div className="space-y-2">
                      <AddressAutocomplete
                        value={endereco.endereco}
                        onChange={(value) =>
                          setEditEnderecos((prev) =>
                            prev.map((item) =>
                              item.id === endereco.id
                                ? { ...item, endereco: value, latitude: 0, longitude: 0 }
                                : item
                            )
                          )
                        }
                        onSelect={(details) =>
                          setEditEnderecos((prev) =>
                            prev.map((item) =>
                              item.id === endereco.id
                                ? {
                                    ...item,
                                    endereco: details.formattedAddress || item.endereco,
                                    latitude: details.lat || 0,
                                    longitude: details.lng || 0,
                                  }
                                : item
                            )
                          )
                        }
                        placeholder="Rua, numero, bairro, cidade"
                        className="input"
                        id={`endereco_${endereco.id}`}
                        name={`endereco_${endereco.id}`}
                        disabled={false}
                        country="br"
                        autoComplete="street-address"
                        preferLegacy
                        enableLiveGeocode={false}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={endereco.complemento || ''}
                          onChange={(e) =>
                            setEditEnderecos((prev) =>
                              prev.map((item) =>
                                item.id === endereco.id
                                  ? { ...item, complemento: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="input"
                          placeholder="Complemento"
                        />
                        <input
                          type="number"
                          min={1}
                          value={endereco.pacotes || 1}
                          onChange={(e) =>
                            setEditEnderecos((prev) =>
                              prev.map((item) =>
                                item.id === endereco.id
                                  ? { ...item, pacotes: Number(e.target.value) || 1 }
                                  : item
                              )
                            )
                          }
                          className="input"
                          placeholder="Pacotes"
                        />
                      </div>
                      <input
                        type="text"
                        value={endereco.observacoes || ''}
                        onChange={(e) =>
                          setEditEnderecos((prev) =>
                            prev.map((item) =>
                                item.id === endereco.id
                                  ? { ...item, observacoes: e.target.value }
                                  : item
                            )
                          )
                        }
                        className="input"
                        placeholder="Observações"
                      />
                    </div>
                  ) : (
                    <>
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
                          {endereco.peso_kg && endereco.volume_cm3 ? '  ' : ''}
                          {endereco.volume_cm3 ? `Volume ${endereco.volume_cm3.toFixed(0)} cm` : ''}
                        </p>
                      )}
                      {endereco.complemento && (
                        <p className="text-sm text-gray-600">{endereco.complemento}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Cdigo: {endereco.codigo_confirmacao}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* Actions */}
        {corrida.status === 'aguardando' && (
          <div className="flex flex-col gap-3">
            {editing ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="btn-outline flex-1"
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEdicao}
                  className="btn-primary flex-1"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            ) : (
              <button
                onClick={cancelarCorrida}
                className="btn-danger w-full py-3"
              >
                <HiOutlineX className="w-5 h-5 mr-2" />
                Cancelar Corrida
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {showRating && corrida.entregador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Avalie o Entregador
            </h3>
            
            <div className="flex justify-center mb-4">
              <Avatar
                src={corrida.entregador.foto_url}
                name={corrida.entregador.user?.nome || ''}
                size="xl"
                className=""
              />
            </div>
            <p className="text-center font-medium text-gray-900 mb-4">
              {corrida.entregador.user?.nome || '-'}
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
                onClick={() => setShowRating(false)}
                className="btn-outline flex-1"
              >
                Pular
              </button>
              <button onClick={submitRating} className="btn-primary flex-1">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
