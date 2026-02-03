'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { EmptyState, LoadingSpinner } from '@/components/ui'
import { timeAgo } from '@/lib/utils'
import { HiOutlineBell } from 'react-icons/hi'

type Notificacao = {
  id: string
  titulo: string
  mensagem: string
  tipo: string
  lida: boolean | null
  dados: any
  created_at: string | null
}

const tipoBadge: Record<string, { label: string; className: string }> = {
  cadastro: { label: 'Cadastro', className: 'bg-blue-100 text-blue-700' },
  corrida: { label: 'Corrida', className: 'bg-green-100 text-green-700' },
  sistema: { label: 'Sistema', className: 'bg-gray-100 text-gray-700' },
}

export default function LojistaNotificacoesPage() {
  const { user } = useAuthStore()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])

  useEffect(() => {
    async function loadNotificacoes() {
      if (!user?.id) return
      setLoading(true)
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotificacoes((data || []) as Notificacao[])
      setLoading(false)
    }

    loadNotificacoes()
  }, [supabase, user?.id])

  const markAsRead = async (id: string) => {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotificacoes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, lida: true } : item))
    )
  }

  const markAllAsRead = async () => {
    if (!user?.id) return
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('user_id', user.id)
      .eq('lida', false)

    setNotificacoes((prev) => prev.map((item) => ({ ...item, lida: true })))
  }

  const unreadCount = notificacoes.filter((item) => !item.lida).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificacoes</h1>
          <p className="text-sm text-gray-600">Acompanhe as atualizacoes da sua conta.</p>
        </div>
        <button
          type="button"
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Marcar todas como lidas
        </button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : notificacoes.length === 0 ? (
        <EmptyState
          icon={<HiOutlineBell className="w-8 h-8 text-gray-400" />}
          title="Nenhuma notificacao"
          description="Quando houver novidades, elas aparecerao aqui."
        />
      ) : (
        <div className="space-y-3">
          {notificacoes.map((item) => {
            const badge =
              tipoBadge[item.tipo] || { label: item.tipo || 'Info', className: 'bg-gray-100 text-gray-700' }
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-4 ${
                  item.lida ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      {!item.lida && (
                        <span className="text-xs text-blue-600 font-semibold">Novo</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
                    <p className="text-sm text-gray-600">{item.mensagem}</p>
                    {item.created_at && (
                      <p className="text-xs text-gray-400">{timeAgo(item.created_at)}</p>
                    )}
                  </div>
                  {!item.lida && (
                    <button
                      type="button"
                      onClick={() => markAsRead(item.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Marcar como lida
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

