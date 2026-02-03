'use client'

import { useAuthStore } from '@/stores/auth-store'
import { Avatar, Rating, StatusBadge } from '@/components/ui'
import { formatCPF, formatPhone, formatCurrency } from '@/lib/utils'
import {
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineIdentification,
  HiOutlineLocationMarker,
  HiOutlineTruck,
} from 'react-icons/hi'

export default function EntregadorPerfilPage() {
  const { user, profile } = useAuthStore()
  const entregadorProfile = (profile as any) || {}

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meu Perfil</h1>

      {/* Profile Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <Avatar src={entregadorProfile?.foto_url || null} name={user?.nome || ''} size="xl" className="" />
            {entregadorProfile?.online && (
              <span className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.nome || ''}</h2>
            <div className="flex items-center gap-2">
              <p className="text-gray-500">Entregador</p>
              <StatusBadge status={user?.status || 'pendente'} size="sm" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Rating
                value={entregadorProfile?.avaliacao_media || 5}
                size="sm"
                max={5}
                showValue={false}
                onChange={() => {}}
              />
              <span className="text-sm text-gray-500">
                ({entregadorProfile?.total_avaliacoes || 0} avaliações)
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineMail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{user?.email || ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlinePhone className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">WhatsApp</p>
              <p className="font-medium text-gray-900">{formatPhone(user?.whatsapp || '')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineIdentification className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">CPF</p>
              <p className="font-medium text-gray-900">{formatCPF(user?.cpf || '')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Veículo</h3>
        <div className="grid gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineTruck className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Tipo</p>
              <p className="font-medium text-gray-900 capitalize">{entregadorProfile?.tipo_veiculo}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-5 h-5 flex items-center justify-center text-gray-400 font-bold text-xs">
              PL
            </div>
            <div>
              <p className="text-sm text-gray-500">Placa</p>
              <p className="font-medium text-gray-900 font-mono">{entregadorProfile?.placa}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <HiOutlineLocationMarker className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Cidade</p>
              <p className="font-medium text-gray-900">
                {entregadorProfile?.cidade} - {entregadorProfile?.uf}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Estatísticas</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-600">{entregadorProfile?.total_entregas || 0}</p>
            <p className="text-sm text-gray-500">Entregas</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-600">
              {entregadorProfile?.avaliacao_media?.toFixed?.(1) || '5.0'}
            </p>
            <p className="text-sm text-gray-500">Avaliação</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-secondary-600">
              {formatCurrency(entregadorProfile?.saldo || 0)}
            </p>
            <p className="text-sm text-gray-500">Saldo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
