'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { LoadingSpinner, EmptyState } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  HiOutlinePlusCircle,
  HiOutlineMinusCircle,
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlineCash,
} from 'react-icons/hi'
import toast from 'react-hot-toast'

interface Transacao {
  id: string
  tipo: string
  valor: number
  saldo_posterior: number
  descricao: string
  created_at: string
}

export default function EntregadorSaldoPage() {
  const { user, profile, setProfile } = useAuthStore()
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [valor, setValor] = useState('')
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

  const entregadorProfile = profile as any

  useEffect(() => {
    loadTransacoes()
  }, [])

  async function loadTransacoes() {
    if (!user?.id) return

    const { data } = await supabase
      .from('financeiro')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setTransacoes(data)
    }
    setLoading(false)
  }

  async function handleSaque() {
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Valor inválido')
      return
    }

    if (valorNum > (entregadorProfile?.saldo || 0)) {
      toast.error('Saldo insuficiente')
      return
    }

    setProcessing(true)
    try {
      const novoSaldo = (entregadorProfile?.saldo || 0) - valorNum

      await supabase
        .from('entregadores')
        .update({ saldo: novoSaldo })
        .eq('id', entregadorProfile.id)

      await supabase
        .from('financeiro')
        .insert({
          user_id: user!.id,
          tipo: 'saque',
          valor: -valorNum,
          saldo_anterior: entregadorProfile?.saldo || 0,
          saldo_posterior: novoSaldo,
          descricao: 'Saque de ganhos',
        })

      setProfile({ ...entregadorProfile, saldo: novoSaldo })
      toast.success('Saque solicitado com sucesso!')
      setShowWithdrawModal(false)
      setValor('')
      loadTransacoes()
    } catch (err) {
      toast.error('Erro ao processar saque')
    } finally {
      setProcessing(false)
    }
  }

  const getTransacaoIcon = (tipo: string) => {
    switch (tipo) {
      case 'corrida':
        return <HiOutlineArrowDown className="w-5 h-5 text-green-600" />
      case 'saque':
        return <HiOutlineArrowUp className="w-5 h-5 text-red-600" />
      case 'multa':
        return <HiOutlineMinusCircle className="w-5 h-5 text-red-600" />
      default:
        return <HiOutlineCash className="w-5 h-5 text-gray-600" />
    }
  }

  // Calculate earnings
  const ganhoHoje = transacoes
    .filter((t) => {
      const today = new Date()
      const transacaoDate = new Date(t.created_at)
      return (
        t.tipo === 'corrida' &&
        t.valor > 0 &&
        transacaoDate.toDateString() === today.toDateString()
      )
    })
    .reduce((acc, t) => acc + t.valor, 0)

  const ganhoSemana = transacoes
    .filter((t) => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const transacaoDate = new Date(t.created_at)
      return t.tipo === 'corrida' && t.valor > 0 && transacaoDate >= weekAgo
    })
    .reduce((acc, t) => acc + t.valor, 0)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Meus Ganhos</h1>

      {/* Balance Card */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-secondary-600 to-secondary-700 text-white">
        <p className="text-secondary-100 mb-1">Saldo disponível</p>
        <p className="text-4xl font-bold mb-4">
          {formatCurrency(entregadorProfile?.saldo || 0)}
        </p>
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="btn bg-white/20 hover:bg-white/30 text-white w-full py-3"
        >
          <HiOutlineMinusCircle className="w-5 h-5 mr-2" />
          Sacar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-gray-600">Ganho Hoje</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(ganhoHoje)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">Ganho na Semana</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(ganhoSemana)}</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Histórico</h2>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : transacoes.length === 0 ? (
          <EmptyState
            icon={<HiOutlineCash className="w-8 h-8 text-gray-400" />}
            title="Nenhuma transação"
            description="Seus ganhos aparecerão aqui"
          />
        ) : (
          <div className="divide-y">
            {transacoes.map((transacao) => (
              <div key={transacao.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {getTransacaoIcon(transacao.tipo)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{transacao.descricao}</p>
                    <p className="text-sm text-gray-500">{formatDate(transacao.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${transacao.valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {transacao.valor >= 0 ? '+' : ''}{formatCurrency(transacao.valor)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Sacar</h3>
            <div className="mb-4">
              <label className="label">Valor</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                <input
                  type="text"
                  value={valor}
                  onChange={(e) => setValor(e.target.value.replace(/[^0-9,]/g, ''))}
                  className="input pl-10"
                  placeholder="0,00"
                  autoFocus
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Disponível: {formatCurrency(entregadorProfile?.saldo || 0)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowWithdrawModal(false); setValor('') }}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaque}
                disabled={processing || !valor}
                className="btn-secondary flex-1"
              >
                {processing ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
