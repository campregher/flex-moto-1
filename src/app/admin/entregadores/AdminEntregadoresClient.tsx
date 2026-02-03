'use client'

import { useEffect, useState } from 'react'

type EntregadorProfile = {
  placa: string | null
  cidade: string | null
  uf: string | null
  foto_url: string | null
  cnh_url: string | null
}

type PendingEntregador = {
  id: string
  nome: string
  email: string
  whatsapp: string
  status: string
  created_at: string | null
  entregadores: EntregadorProfile | EntregadorProfile[] | null
}

function getEntregadorProfile(entry: PendingEntregador): EntregadorProfile | null {
  if (!entry.entregadores) return null
  if (Array.isArray(entry.entregadores)) return entry.entregadores[0] || null
  return entry.entregadores
}

export default function AdminEntregadoresClient() {
  const [pending, setPending] = useState<PendingEntregador[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadPending() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/entregadores', { cache: 'no-store' })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Erro ao carregar entregadores')
      }
      const payload = await res.json()
      setPending(payload.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  async function updateStatus(userId: string, status: 'ativo' | 'bloqueado') {
    setActionLoading(userId)
    try {
      const res = await fetch('/api/admin/entregadores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Falha ao atualizar status')
      }
      setPending((prev) => prev.filter((item) => item.id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    loadPending()
  }, [])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Aprovação de Entregadores</h1>
        <button className="btn-outline" onClick={loadPending} disabled={isLoading}>
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="card p-6">Carregando entregadores pendentes...</div>
      ) : pending.length === 0 ? (
        <div className="card p-6 text-gray-600">Nenhum entregador pendente.</div>
      ) : (
        <div className="space-y-4">
          {pending.map((item) => {
            const profile = getEntregadorProfile(item)
            return (
              <div key={item.id} className="card p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{item.nome}</p>
                    <p className="text-sm text-gray-600">{item.email}</p>
                    <p className="text-sm text-gray-600">{item.whatsapp}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}
                  </div>
                </div>

                {profile && (
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">Placa:</span> {profile.placa || '-'}
                    </div>
                    <div>
                      <span className="font-medium">Cidade:</span> {profile.cidade || '-'} {profile.uf || ''}
                    </div>
                    <div>
                      <span className="font-medium">Foto:</span> {profile.foto_url ? 'Enviada' : 'Não enviada'}
                    </div>
                    <div>
                      <span className="font-medium">CNH:</span> {profile.cnh_url ? 'Enviada' : 'Não enviada'}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    className="btn-primary"
                    onClick={() => updateStatus(item.id, 'ativo')}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? 'Aprovando...' : 'Aprovar'}
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => updateStatus(item.id, 'bloqueado')}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? 'Bloqueando...' : 'Bloquear'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


