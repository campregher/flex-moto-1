'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, StatusBadge, PlatformBadge, EmptyState, LoadingSpinner } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  HiOutlineTruck,
  HiOutlineCube,
  HiOutlineFilter,
} from 'react-icons/hi'

interface Corrida {
  id: string
  plataforma: 'ml_flex' | 'shopee_direta'
  status: string
  valor_total: number
  total_pacotes: number
  created_at: string
  finalizada_em: string | null
  entregador?: {
    foto_url: string | null
    user: {
      nome: string
    }
  } | null
}

const statusFilters = [
  { value: 'all', label: 'Todas' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'finalizada', label: 'Finalizadas' },
  { value: 'cancelada', label: 'Canceladas' },
]

export default function CorridasPage() {
  const { profile } = useAuthStore()
  const [corridas, setCorridas] = useState<Corrida[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  const lojistaProfile = profile as any

  useEffect(() => {
    loadCorridas()
  }, [filter])

  async function loadCorridas() {
    let query = supabase
      .from('corridas')
      .select(`
        id, plataforma, status, valor_total, total_pacotes, created_at, finalizada_em,
        entregador:entregadores(foto_url, user:users(nome))
      `)
      .eq('lojista_id', lojistaProfile?.id)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      if (filter === 'em_andamento') {
        query = query.in('status', ['aceita', 'coletando', 'em_entrega'])
      } else {
        query = query.eq('status', filter)
      }
    }

    const { data } = await query.limit(50)

    if (data) {
      setCorridas(data as any)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Minhas Corridas</h1>
        <Link href="/lojista/nova-corrida" className="btn-primary">
          Nova Corrida
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <HiOutlineFilter className="w-5 h-5 text-gray-400 flex-shrink-0" />
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setFilter(sf.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === sf.value
              ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Corridas List */}
      {loading ? (
        <div className="card p-8 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : corridas.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<HiOutlineTruck className="w-8 h-8 text-gray-400" />}
            title="Nenhuma corrida encontrada"
            description={filter === 'all' ? 'Suas corridas aparecerão aqui' : 'Não há corridas com esse filtro'}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {corridas.map((corrida) => (
            <Link
              key={corrida.id}
              href={`/lojista/corridas/${corrida.id}`}
              className="card p-4 block hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={corrida.plataforma} size="sm" />
                  <StatusBadge status={corrida.status} size="sm" />
                </div>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(corrida.valor_total)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {corrida.entregador ? (
                    <>
                      <Avatar
                        src={corrida.entregador.foto_url}
                        name={corrida.entregador.user?.nome || ''}
                        size="sm"
                      />
                      <span className="text-sm text-gray-600">
                        {corrida.entregador.user?.nome || '-'}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Aguardando entregador</span>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <HiOutlineCube className="w-4 h-4" />
                    {corrida.total_pacotes}
                  </div>
                  <p>{formatDate(corrida.finalizada_em || corrida.created_at)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

