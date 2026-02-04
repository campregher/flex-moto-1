'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, Rating, StatusBadge, PlatformBadge, EmptyState, LoadingSpinner } from '@/components/ui'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { formatCurrency, timeAgo } from '@/lib/utils'
import {
  PlusCircle,
  Truck,
  DollarSign,
  ClipboardCheck,
  Star,
  ArrowRight,
} from 'lucide-react'

interface CorridaAtiva {
  id: string
  entregador_id?: string | null
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  total_pacotes: number
  created_at: string
  entregador: {
    foto_url: string | null
    avaliacao_media: number
    tipo_veiculo?: string | null
    placa?: string | null
    user: {
      nome: string
    }
  }
}

interface ColetaOption {
  id: string
  label: string | null
  endereco: string
  is_default: boolean | null
  latitude: number | null
  longitude: number | null
}

interface MlPedido {
  id: string
  ml_order_id: number
  ml_shipment_id: number | null
  order_status: string | null
  shipping_status: string | null
  buyer_name: string | null
  receiver_name: string | null
  receiver_phone: string | null
  endereco: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  latitude: number | null
  longitude: number | null
  pacotes: number
  observacoes: string | null
  coleta_id: string | null
  coleta_endereco: string | null
  coleta_latitude: number | null
  coleta_longitude: number | null
  selected: boolean | null
  distancia_km: number | null
  frete_estimado: number | null
}

export default function LojistaDashboard() {
  const searchParams = useSearchParams()
  const { user, profile, setProfile } = useAuthStore()
  const [corridasAtivas, setCorridasAtivas] = useState<CorridaAtiva[]>([])
  const [mlIntegration, setMlIntegration] = useState<{ site_id: string; ml_user_id: number } | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [coletas, setColetas] = useState<ColetaOption[]>([])
  const [selectedColetaId, setSelectedColetaId] = useState<string>('manual')
  const [mlPedidos, setMlPedidos] = useState<MlPedido[]>([])
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null)
  const [editPedido, setEditPedido] = useState<MlPedido | null>(null)
  const [stats, setStats] = useState({
    totalCorridas: 0,
    corridasHoje: 0,
    gastoMes: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const lojistaProfile = (profile as any) || {}

  const formatMlAddress = (pedido: MlPedido) => {
    if (pedido.endereco?.trim()) return pedido.endereco
    const linha1 = [pedido.logradouro, pedido.numero].filter(Boolean).join(', ')
    const linha2 = [pedido.bairro, pedido.cidade, pedido.uf, pedido.cep].filter(Boolean).join(' - ')
    return [linha1, linha2].filter(Boolean).join(' | ') || 'Endereço não informado'
  }

  async function loadCorridasAtivas() {
    if (!lojistaProfile.id) return
    const { data: corridas } = await supabase
      .from('corridas')
        .select(`
          id,
          entregador_id,
          plataforma,
          status,
          valor_total,
          total_pacotes,
          created_at,
          entregador:entregadores(
            foto_url,
            avaliacao_media,
            tipo_veiculo,
            placa,
            user:users(nome)
          )
        `)
      .eq('lojista_id', lojistaProfile.id)
      .in('status', ['aguardando', 'aceita', 'coletando', 'em_entrega'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (corridas) {
      const rows = corridas as CorridaAtiva[]
      const missing = rows.filter((item) => item.entregador_id && !item.entregador)
      if (missing.length > 0) {
        const ids = missing.map((item) => item.entregador_id).filter(Boolean) as string[]
          const { data: entregadores } = await supabase
            .from('entregadores')
            .select('id, foto_url, avaliacao_media, tipo_veiculo, placa, user:users(nome)')
            .in('id', ids)
        const map = new Map((entregadores || []).map((e: any) => [e.id, e]))
        setCorridasAtivas(rows.map((item) => ({
          ...item,
          entregador: item.entregador || map.get(item.entregador_id || '') || null,
        })) as any)
      } else {
        setCorridasAtivas(rows as any)
      }
    }
  }

  async function loadStats() {
    if (!lojistaProfile.id) return
    if (!user?.id) return

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

    const { count: totalCorridas } = await supabase
      .from('corridas')
      .select('*', { count: 'exact', head: true })
      .eq('lojista_id', lojistaProfile.id)
      .eq('status', 'finalizada')

    const { count: corridasHoje } = await supabase
      .from('corridas')
      .select('*', { count: 'exact', head: true })
      .eq('lojista_id', lojistaProfile.id)
      .eq('status', 'finalizada')
      .gte('finalizada_em', hoje.toISOString())

    const { data: gastoData } = await supabase
      .from('corridas')
      .select('valor_total')
      .eq('lojista_id', lojistaProfile.id)
      .eq('status', 'finalizada')
      .gte('finalizada_em', inicioMes.toISOString())

    const gastoRows = (gastoData as { valor_total: number }[] | null) || []
    const gastoMes = gastoRows.reduce((acc, item) => acc + (item.valor_total || 0), 0)

    setStats({
      totalCorridas: totalCorridas || 0,
      corridasHoje: corridasHoje || 0,
      gastoMes,
    })
  }

  useEffect(() => {
    async function loadData() {
      if (!lojistaProfile.id) return
      if (!user?.id) return

      await loadCorridasAtivas()

      await loadStats()

      const { data: mlData } = await supabase
        .from('mercadolivre_integrations')
        .select('site_id, ml_user_id')
        .eq('lojista_id', lojistaProfile.id)
        .maybeSingle()

      setMlIntegration(mlData ? { site_id: mlData.site_id, ml_user_id: mlData.ml_user_id } : null)

      const { data: coletaData } = await supabase
        .from('lojista_coletas')
        .select('id, label, endereco, is_default')
        .eq('lojista_id', lojistaProfile.id)
        .order('created_at', { ascending: true })

      const list = (coletaData || []) as ColetaOption[]
      setColetas(list)
      const defaultColeta = list.find((item) => item.is_default) || list[0]
      setSelectedColetaId(defaultColeta ? defaultColeta.id : 'manual')

      const { data: pedidosData } = await supabase
        .from('mercadolivre_pedidos')
        .select('*')
        .eq('lojista_id', lojistaProfile.id)
        .is('imported_at', null)
        .order('created_at', { ascending: false })

      setMlPedidos((pedidosData || []) as MlPedido[])

      setLoading(false)
    }

    loadData()
  }, [lojistaProfile.id, user?.id, supabase])

  useEffect(() => {
    if (!lojistaProfile.id) return

    const channel = supabase
      .channel(`corridas-lojista-${lojistaProfile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'corridas' },
        (payload: any) => {
          const newRow = payload.new
          const oldRow = payload.old
          const lojistaId = newRow?.lojista_id || oldRow?.lojista_id
          if (lojistaId !== lojistaProfile.id) return
          loadCorridasAtivas()
          loadStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [lojistaProfile.id, supabase])

  const mlStatus = searchParams?.get('ml') ?? null

  const handleSync = async () => {
    setSyncLoading(true)
    setImportMessage(null)
    try {
      const res = await fetch('/api/ml/sync', { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const details = payload.details.message || payload.details.error || ''
        throw new Error(`${payload.error || 'Erro ao sincronizar'} ${details}`.trim())
      }

      const { data: pedidosData } = await supabase
        .from('mercadolivre_pedidos')
        .select('*')
        .eq('lojista_id', lojistaProfile.id)
        .is('imported_at', null)
        .order('created_at', { ascending: false })

      setMlPedidos((pedidosData || []) as MlPedido[])
      const count = typeof payload.count === 'number' ? payload.count : null
      if (count === 0) {
        setImportMessage('Nenhum pedido novo encontrado. Verifique status do envio e período.')
      } else if (count !== null) {
        setImportMessage(`Pedidos sincronizados: ${count}.`)
      } else {
        setImportMessage('Pedidos sincronizados com sucesso!')
      }
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Erro ao sincronizar pedidos')
    } finally {
      setSyncLoading(false)
    }
  }

  const toggleSelect = async (pedidoId: string, selected: boolean) => {
    setMlPedidos((prev) =>
      prev.map((pedido) =>
        pedido.id === pedidoId ? { ...pedido, selected } : pedido
      )
    )
    await supabase
      .from('mercadolivre_pedidos')
      .update({ selected })
      .eq('id', pedidoId)
  }

  const startEdit = (pedido: MlPedido) => {
    setEditingPedidoId(pedido.id)
    setEditPedido({ ...pedido })
  }

  const cancelEdit = () => {
    setEditingPedidoId(null)
    setEditPedido(null)
  }

  const saveEdit = async () => {
    if (!editPedido) return
    const coletaSelecionada = editPedido.coleta_id
      ? coletas.find((item) => item.id === editPedido.coleta_id)
      : null
    const enderecoNormalizado =
      editPedido.endereco ||
      [editPedido.logradouro, editPedido.numero, editPedido.bairro, editPedido.cidade, editPedido.uf, editPedido.cep]
        .filter(Boolean)
        .join(', ') ||
      null

    const updates = {
      receiver_name: editPedido.receiver_name || null,
      receiver_phone: editPedido.receiver_phone || null,
      endereco: enderecoNormalizado,
      logradouro: editPedido.logradouro || null,
      numero: editPedido.numero || null,
      complemento: editPedido.complemento || null,
      bairro: editPedido.bairro || null,
      cidade: editPedido.cidade || null,
      uf: editPedido.uf || null,
      cep: editPedido.cep || null,
      latitude: editPedido.latitude || null,
      longitude: editPedido.longitude || null,
      pacotes: Math.max(1, editPedido.pacotes || 1),
      observacoes: editPedido.observacoes || null,
      coleta_id: editPedido.coleta_id || null,
      coleta_endereco: coletaSelecionada?.endereco ?? null,
      coleta_latitude: coletaSelecionada?.latitude ?? null,
      coleta_longitude: coletaSelecionada?.longitude ?? null,
    }

    const { error } = await supabase
      .from('mercadolivre_pedidos')
      .update(updates)
      .eq('id', editPedido.id)

    if (!error) {
      setMlPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === editPedido.id ? ({ ...pedido, ...updates } as MlPedido) : pedido
        )
      )
      setImportMessage('Pedido atualizado.')
      cancelEdit()
    } else {
      setImportMessage('Erro ao atualizar pedido.')
    }
  }

  const importSelected = async () => {
    setImportLoading(true)
    setImportMessage(null)
    try {
      const res = await fetch('/api/ml/import-selected', { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const details = payload.details.message || payload.details.code || ''
        throw new Error(`${payload.error || 'Erro ao importar'} ${details}`.trim())
      }

      if (typeof payload.saldo_posterior === 'number') {
        setProfile({ ...lojistaProfile, saldo: payload.saldo_posterior })
      }

      const { data: pedidosData } = await supabase
        .from('mercadolivre_pedidos')
        .select('*')
        .eq('lojista_id', lojistaProfile.id)
        .is('imported_at', null)
        .order('created_at', { ascending: false })

      setMlPedidos((pedidosData || []) as MlPedido[])
      await loadCorridasAtivas()
      setImportMessage('Pedidos importados com sucesso!')
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Erro ao importar pedidos')
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {(user?.nome || '').split(' ')[0] || ''}!
          </h1>
          <p className="text-gray-600">Gerencie suas entregas</p>
        </div>
        <Link href="/lojista/nova-corrida" className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
          <PlusCircle className="w-5 h-5 mr-2" />
          Nova Corrida
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Gasto no mês</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(stats.gastoMes)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Corridas Hoje</p>
              <p className="text-lg font-bold text-gray-900">{stats.corridasHoje}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de Corridas</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalCorridas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avaliação</p>
              <p className="text-lg font-bold text-gray-900">
                {(lojistaProfile.avaliacao_media || 5.0).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {mlStatus === 'connected' && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-green-800">
          Integração com Mercado Livre conectada com sucesso.
        </div>
      )}
      {mlStatus && mlStatus !== 'connected' && (
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 text-yellow-800">
          Não foi possível conectar ao Mercado Livre. Tente novamente.
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/lojista/saldo"
          className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Depositar Saldo</p>
            <p className="text-sm text-gray-600">Adicionar créditos</p>
          </div>
        </Link>

        <Link
          href="/lojista/corridas"
          className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Histórico</p>
            <p className="text-sm text-gray-600">Ver todas as corridas</p>
          </div>
        </Link>
      </div>

      {/* Mercado Livre Integration */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mercado Livre (Flex)</h2>
              <p className="text-sm text-gray-600">
                {mlIntegration
                  ? `Conectado • ${user?.nome || 'Usuário'}`
                  : 'Não conectado'}
              </p>
            </div>
            <a href="/api/ml/authorize" className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
              {mlIntegration ? 'Reconectar' : 'Conectar'}
            </a>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={!mlIntegration || syncLoading}
                className="inline-flex items-center justify-center bg-green-600 text-white hover:bg-green-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncLoading ? 'Sincronizando...' : 'Sincronizar pedidos ML'}
              </button>
              <button
                type="button"
                onClick={importSelected}
                disabled={!mlPedidos.some((pedido) => pedido.selected) || importLoading}
                className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importLoading ? 'Importando...' : 'Importar selecionados'}
              </button>
            </div>
            {importMessage && (
              <p className="text-sm text-gray-600">{importMessage}</p>
            )}
          </div>

          {mlPedidos.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum pedido sincronizado ainda.</p>
          ) : (
            <div className="space-y-3">
              {mlPedidos.map((pedido) => {
                const distanciaKm = Number(pedido.distancia_km)
                const freteEstimado = Number(pedido.frete_estimado)
                const canSelect = Number.isFinite(distanciaKm) && Number.isFinite(freteEstimado)
                return (
                <div key={pedido.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={Boolean(pedido.selected)}
                          onChange={(e) => toggleSelect(pedido.id, e.target.checked)}
                          disabled={!canSelect}
                        />
                        Pedido #{pedido.ml_order_id}
                        {pedido.shipping_status && (
                          <span className="text-xs text-gray-500">({pedido.shipping_status})</span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => startEdit(pedido)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="text-sm text-gray-600">
                      Entrega: {formatMlAddress(pedido)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {canSelect ? (
                        <>
                          {distanciaKm.toFixed(1)} km · {formatCurrency(freteEstimado)}
                        </>
                      ) : (
                        'Frete indisponível: faltam coordenadas'
                      )}
                    </div>
                    {(pedido.logradouro ||
                      pedido.numero ||
                      pedido.bairro ||
                      pedido.cidade ||
                      pedido.uf ||
                      pedido.cep) && (
                      <div className="text-xs text-gray-500">
                        {[pedido.logradouro, pedido.numero, pedido.bairro, pedido.cidade, pedido.uf, pedido.cep]
                          .filter(Boolean)
                          .join(' - ')}
                      </div>
                    )}

                    {editingPedidoId === pedido.id && editPedido && (
                      <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
                        <div>
                          <label className="text-xs text-gray-600">Endereço de coleta</label>
                          <select
                            value={editPedido.coleta_id || 'perfil'}
                            onChange={(e) =>
                              setEditPedido({
                                ...editPedido,
                                coleta_id: e.target.value === 'perfil' ? null : e.target.value,
                              })
                            }
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                          >
                            <option value="perfil">Endereço do perfil</option>
                            {coletas.map((coleta) => (
                              <option key={coleta.id} value={coleta.id}>
                                {coleta.label || coleta.endereco}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-gray-600">Endereço de entrega</label>
                          <AddressAutocomplete
                            value={editPedido.endereco || ''}
                            onChange={(value) => setEditPedido({ ...editPedido, endereco: value })}
                            onSelect={(details) =>
                              setEditPedido({
                                ...editPedido,
                                endereco: details.formattedAddress || editPedido.endereco,
                                logradouro: details.street || editPedido.logradouro,
                                numero: details.number || editPedido.numero,
                                bairro: details.neighborhood || editPedido.bairro,
                                cidade: details.city || editPedido.cidade,
                                uf: details.state || editPedido.uf,
                                cep: details.postalCode || editPedido.cep,
                                latitude: details.lat ?? editPedido.latitude,
                                longitude: details.lng ?? editPedido.longitude,
                              })
                            }
                            placeholder="Rua, Número, bairro, cidade"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            id="edit_pedido_endereco"
                            name="edit_pedido_endereco"
                            disabled={false}
                            country="br"
                            autoComplete="street-address"
                            preferLegacy={false}
                            enableLiveGeocode={false}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={editPedido.logradouro || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, logradouro: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Logradouro"
                          />
                          <input
                            value={editPedido.numero || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, numero: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Número"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={editPedido.complemento || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, complemento: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Complemento"
                          />
                          <input
                            value={editPedido.bairro || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, bairro: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Bairro"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={editPedido.cidade || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, cidade: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Cidade"
                          />
                          <input
                            value={editPedido.uf || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, uf: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="UF"
                          />
                          <input
                            value={editPedido.cep || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, cep: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="CEP"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={editPedido.receiver_name || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, receiver_name: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Nome do destinatrio"
                          />
                          <input
                            value={editPedido.receiver_phone || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, receiver_phone: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Telefone do destinatrio"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={1}
                            value={editPedido.pacotes || 1}
                            onChange={(e) => setEditPedido({ ...editPedido, pacotes: Number(e.target.value) || 1 })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Qtd. pacotes"
                          />
                          <input
                            value={editPedido.observacoes || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, observacoes: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Observações"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 text-xs font-semibold rounded-lg"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center justify-center bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-2 text-xs font-semibold rounded-lg"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      {/* Active Corridas */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Corridas Ativas</h2>
          <Link href="/lojista/corridas" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
            Ver todas
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner size="md" className="" />
          </div>
        ) : corridasAtivas.length === 0 ? (
          <div className="p-8 text-center">
            <Truck className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhuma corrida ativa</h3>
            <p className="text-gray-600 mb-4">Solicite uma nova corrida para começar</p>
            <Link href="/lojista/nova-corrida" className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
              <PlusCircle className="w-5 h-5 mr-2" />
              Nova Corrida
            </Link>
          </div>
        ) : (
            <div className="divide-y divide-gray-200">
              {corridasAtivas.map((corrida) => (
                <Link
                  key={corrida.id}
                  href={`/lojista/corridas/${corrida.id}`}
                  className="flex items-start justify-between gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {corrida.entregador && corrida.entregador.user ? (
                      <Avatar
                        src={corrida.entregador.foto_url || null}
                        name={corrida.entregador.user.nome || 'Entregador'}
                        size="lg"
                        className=""
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Truck className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${corrida.plataforma === 'ml_flex' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}`}>
                          {corrida.plataforma === 'ml_flex' ? 'ML Flex' : 'Shopee'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          corrida.status === 'aguardando' ? 'bg-gray-100 text-gray-800' :
                          corrida.status === 'aceita' ? 'bg-blue-100 text-blue-800' :
                          corrida.status === 'coletando' ? 'bg-yellow-100 text-yellow-800' :
                          corrida.status === 'em_entrega' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {corrida.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mt-2 truncate">
                        {corrida.entregador?.user?.nome || 'Entregador não definido'}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                        <span>
                          {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>{timeAgo(corrida.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-2">
                        <span className="px-2 py-1 rounded-md bg-gray-100">
                          {corrida.entregador?.tipo_veiculo ? `Moto: ${corrida.entregador.tipo_veiculo}` : 'Moto não informada'}
                        </span>
                        <span className="px-2 py-1 rounded-md bg-gray-100 font-mono">
                          {corrida.entregador?.placa ? `Placa ${corrida.entregador.placa}` : 'Placa não informada'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(corrida.valor_total)}
                    </p>
                    {corrida.entregador?.avaliacao_media !== undefined && corrida.entregador?.avaliacao_media !== null && (
                      <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-400">★</span>
                      <span className="text-sm text-gray-600">{corrida.entregador.avaliacao_media.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



