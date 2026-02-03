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
  HiOutlinePlusCircle,
  HiOutlineTruck,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardCheck,
  HiOutlineStar,
  HiOutlineArrowRight,
} from 'react-icons/hi'

interface CorridaAtiva {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  total_pacotes: number
  created_at: string
  entregador?: {
    foto_url: string | null
    avaliacao_media: number
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
  latitude?: number | null
  longitude?: number | null
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
}

export default function LojistaDashboard() {
  const searchParams = useSearchParams()
  const { user, profile } = useAuthStore()
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

  const lojistaProfile = profile as any

  const formatMlAddress = (pedido: MlPedido) => {
    if (pedido.endereco?.trim()) return pedido.endereco
    const linha1 = [pedido.logradouro, pedido.numero].filter(Boolean).join(', ')
    const linha2 = [pedido.bairro, pedido.cidade, pedido.uf, pedido.cep].filter(Boolean).join(' - ')
    return [linha1, linha2].filter(Boolean).join(' | ') || 'Endereço não informado'
  }

  useEffect(() => {
    async function loadData() {
      if (!lojistaProfile?.id) return

      const { data: corridas } = await supabase
        .from('corridas')
        .select(`
          id,
          plataforma,
          status,
          valor_total,
          total_pacotes,
          created_at,
          entregador:entregadores(
            foto_url,
            avaliacao_media,
            user:users(nome)
          )
        `)
        .eq('lojista_id', lojistaProfile.id)
        .in('status', ['aguardando', 'aceita', 'coletando', 'em_entrega'])
        .order('created_at', { ascending: false })
        .limit(5)

      if (corridas) {
        setCorridasAtivas(corridas as any)
      }

      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

      const { count: totalCorridas } = await supabase
        .from('corridas')
        .select('*', { count: 'exact', head: true })
        .eq('lojista_id', lojistaProfile.id)

      const { count: corridasHoje } = await supabase
        .from('corridas')
        .select('*', { count: 'exact', head: true })
        .eq('lojista_id', lojistaProfile.id)
        .gte('created_at', hoje.toISOString())

      const { data: gastoData } = await supabase
        .from('financeiro')
        .select('valor')
        .eq('user_id', user?.id)
        .eq('tipo', 'corrida')
        .gte('created_at', inicioMes.toISOString())

      const gastoRows = (gastoData as { valor: number }[] | null) || []
      const gastoMes = gastoRows.reduce((acc, item) => acc + Math.abs(item.valor), 0)

      setStats({
        totalCorridas: totalCorridas || 0,
        corridasHoje: corridasHoje || 0,
        gastoMes,
      })

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
  }, [lojistaProfile?.id, user?.id, supabase])

  const mlStatus = searchParams?.get('ml') ?? null

  const handleSync = async () => {
    setSyncLoading(true)
    setImportMessage(null)
    try {
      const res = await fetch('/api/ml/sync', { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        const details = payload?.details?.message || payload?.details?.error || ''
        throw new Error(`${payload?.error || 'Erro ao sincronizar'} ${details}`.trim())
      }

      const { data: pedidosData } = await supabase
        .from('mercadolivre_pedidos')
        .select('*')
        .eq('lojista_id', lojistaProfile?.id)
        .is('imported_at', null)
        .order('created_at', { ascending: false })

      setMlPedidos((pedidosData || []) as MlPedido[])
      setImportMessage('Pedidos sincronizados com sucesso!')
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
      coleta_endereco: coletaSelecionada?.endereco || null,
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
        const details = payload?.details?.message || payload?.details?.code || ''
        throw new Error(`${payload?.error || 'Erro ao importar'} ${details}`.trim())
      }

      const { data: pedidosData } = await supabase
        .from('mercadolivre_pedidos')
        .select('*')
        .eq('lojista_id', lojistaProfile?.id)
        .is('imported_at', null)
        .order('created_at', { ascending: false })

      setMlPedidos((pedidosData || []) as MlPedido[])
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
            OlÃƒÂ¡, {user?.nome?.split(' ')[0] || ''}!
          </h1>
          <p className="text-gray-600">Gerencie suas entregas</p>
        </div>
        <Link href="/lojista/nova-corrida" className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
          <HiOutlinePlusCircle className="w-5 h-5 mr-2" />
          Nova Corrida
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Saldo</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(lojistaProfile?.saldo || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <HiOutlineTruck className="w-5 h-5 text-green-600" />
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
              <HiOutlineClipboardCheck className="w-5 h-5 text-purple-600" />
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
              <HiOutlineStar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">AvaliaÃƒÂ§ÃƒÂ£o</p>
              <p className="text-lg font-bold text-gray-900">
                {(lojistaProfile?.avaliacao_media || 5.0).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {mlStatus === 'connected' && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-green-800">
          IntegraÃƒÂ§ÃƒÂ£o com Mercado Livre conectada com sucesso.
        </div>
      )}
      {mlStatus && mlStatus !== 'connected' && (
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 text-yellow-800">
          NÃƒÂ£o foi possÃƒÂ­vel conectar ao Mercado Livre. Tente novamente.
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/lojista/saldo"
          className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <HiOutlineCurrencyDollar className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Depositar Saldo</p>
            <p className="text-sm text-gray-600">Adicionar crÃƒÂ©ditos</p>
          </div>
        </Link>

        <Link
          href="/lojista/corridas"
          className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex items-center gap-3"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <HiOutlineClipboardCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">HistÃƒ³rico</p>
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
                  ? `Conectado Â• ${mlIntegration.site_id} Â• Usuário ${mlIntegration.ml_user_id}`
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
              {mlPedidos.map((pedido) => (
                <div key={pedido.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={Boolean(pedido.selected)}
                          onChange={(e) => toggleSelect(pedido.id, e.target.checked)}
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
                            placeholder="Nome do destinat?rio"
                          />
                          <input
                            value={editPedido.receiver_phone || ''}
                            onChange={(e) => setEditPedido({ ...editPedido, receiver_phone: e.target.value })}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Telefone do destinat?rio"
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
              ))}
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
            <HiOutlineArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : corridasAtivas.length === 0 ? (
          <div className="p-8 text-center">
            <HiOutlineTruck className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhuma corrida ativa</h3>
            <p className="text-gray-600 mb-4">Solicite uma nova corrida para comeÃƒÂ§ar</p>
            <Link href="/lojista/nova-corrida" className="inline-flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
              <HiOutlinePlusCircle className="w-5 h-5 mr-2" />
              Nova Corrida
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {corridasAtivas.map((corrida) => (
              <Link
                key={corrida.id}
                href={`/lojista/corridas/${corrida.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {corrida.entregador ? (
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                      {corrida.entregador?.user?.nome?.charAt(0) || 'E'}
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <HiOutlineTruck className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
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
                    <p className="text-sm text-gray-600 mt-1">
                      {corrida.total_pacotes} pacote{corrida.total_pacotes > 1 ? 's' : ''} âÂ€Â¢ {timeAgo(corrida.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(corrida.valor_total)}
                  </p>
                  {corrida.entregador && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-400">âÂ˜Â…</span>
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



