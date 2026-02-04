'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, StatusBadge, PlatformBadge, EmptyState, LoadingSpinner } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Truck,
  Package,
  Filter,
} from 'lucide-react'

interface Entrega {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  total_pacotes: number
  created_at: string
  finalizada_em: string | null
  lojista: {
    foto_url: string | null
    user: {
      nome: string
    }
  } | null
}

const statusFilters = [
  { value: 'all', label: 'Todas' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'finalizada', label: 'Finalizadas' },
  { value: 'cancelada', label: 'Canceladas' },
]

export default function EntregasPage() {
  const { profile } = useAuthStore()
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [period, setPeriod] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [minValor, setMinValor] = useState('')
  const [maxValor, setMaxValor] = useState('')
  const supabase = createClient()

  const entregadorProfile = (profile as any) || {}

  useEffect(() => {
    if (!entregadorProfile?.id) return
    loadEntregas()
  }, [filter, period, platform, minValor, maxValor, entregadorProfile?.id])

  function getPeriodStart(value: string) {
    if (value === 'today') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d
    }
    if (value === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return d
    }
    if (value === '30d') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      return d
    }
    return null
  }

  async function loadEntregas() {
    if (!entregadorProfile?.id) {
      setEntregas([])
      setLoading(false)
      return
    }
    let query = supabase
      .from('corridas')
      .select(`
        id, plataforma, status, valor_total, total_pacotes, created_at, finalizada_em,
        lojista:lojistas(foto_url, user:users(nome))
      `)
      .eq('entregador_id', entregadorProfile.id)
      .order('created_at', { ascending: false })

    if (platform !== 'all') {
      query = query.eq('plataforma', platform)
    }

    if (filter !== 'all') {
      if (filter === 'em_andamento') {
        query = query.in('status', ['aceita', 'coletando', 'em_entrega'])
      } else {
        query = query.eq('status', filter)
      }
    }

    const start = getPeriodStart(period)
    if (start) {
      query = query.gte('created_at', start.toISOString())
    }

    const min = parseFloat(minValor.replace(',', '.'))
    if (!Number.isNaN(min)) {
      query = query.gte('valor_total', min)
    }
    const max = parseFloat(maxValor.replace(',', '.'))
    if (!Number.isNaN(max)) {
      query = query.lte('valor_total', max)
    }

    const { data } = await query.limit(50)

    if (data) {
      setEntregas(data as any)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Minhas Entregas</h1>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setFilter(sf.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === sf.value
                ? 'bg-secondary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input"
        >
          <option value="all">Todos os períodos</option>
          <option value="today">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="input"
        >
          <option value="all">Todas as plataformas</option>
          <option value="ml_flex">ML Flex</option>
          <option value="shopee_direta">Shopee Direta</option>
        </select>
        <input
          type="text"
          value={minValor}
          onChange={(e) => setMinValor(e.target.value)}
          placeholder="Valor mínimo"
          className="input"
        />
        <input
          type="text"
          value={maxValor}
          onChange={(e) => setMaxValor(e.target.value)}
          placeholder="Valor máximo"
          className="input"
        />
      </div>

      {/* Entregas List */}
      {loading ? (
        <div className="card p-8 flex justify-center">
          <LoadingSpinner size="md" className="" />
        </div>
      ) : entregas.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Truck className="w-8 h-8 text-gray-400" />}
            title="Nenhuma entrega encontrada"
            description={filter === 'all' ? 'Suas entregas aparecerão aqui' : 'Não há entregas com esse filtro'}
            action={null}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {entregas.map((entrega) => (
            <Link
              key={entrega.id}
              href={`/entregador/entregas/${entrega.id}`}
              className="card p-4 block hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={entrega.plataforma} size="sm" />
                  <StatusBadge status={entrega.status} size="sm" />
                </div>
                <p className="font-semibold text-secondary-600">
                  {formatCurrency(entrega.valor_total)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {entrega.lojista && (
                    <>
                      <Avatar
                        src={entrega.lojista?.foto_url || null}
                        name={entrega.lojista?.user?.nome || 'Lojista'}
                        size="sm"
                        className=""
                      />
                      <span className="text-sm text-gray-600">
                        {entrega.lojista?.user?.nome || '-'}
                      </span>
                    </>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    {entrega.total_pacotes}
                  </div>
                  <p>{formatDate(entrega.finalizada_em || entrega.created_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

