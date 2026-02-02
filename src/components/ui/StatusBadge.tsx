'use client'

import type { CorridaStatus, UserStatus } from '@/lib/database.types'

interface StatusBadgeProps {
  status: CorridaStatus | UserStatus | string
  size?: 'sm' | 'md'
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Corrida statuses
  aguardando: { label: 'Aguardando', className: 'badge-warning' },
  aceita: { label: 'Aceita', className: 'badge-info' },
  coletando: { label: 'Coletando', className: 'badge-info' },
  em_entrega: { label: 'Em Entrega', className: 'badge-info' },
  finalizada: { label: 'Finalizada', className: 'badge-success' },
  cancelada: { label: 'Cancelada', className: 'badge-danger' },
  
  // User statuses
  pendente: { label: 'Pendente', className: 'badge-warning' },
  ativo: { label: 'Ativo', className: 'badge-success' },
  bloqueado: { label: 'Bloqueado', className: 'badge-danger' },
  
  // Endereco statuses
  entregue: { label: 'Entregue', className: 'badge-success' },
  problema: { label: 'Problema', className: 'badge-danger' },
  
  // Online status
  online: { label: 'Online', className: 'badge-success' },
  offline: { label: 'Offline', className: 'badge-gray' },
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'badge-gray' }
  
  return (
    <span className={`${config.className} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : ''}`}>
      {config.label}
    </span>
  )
}
