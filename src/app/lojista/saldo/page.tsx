'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { LoadingSpinner, EmptyState } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  PlusCircle,
  MinusCircle,
  ArrowDown,
  ArrowUp,
  Banknote,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Transacao {
  id: string
  tipo: string
  valor: number
  saldo_posterior: number
  descricao: string
  created_at: string
}

export default function SaldoPage() {
  const { user, profile, setProfile } = useAuthStore()
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(true)
  const [tipoFilter, setTipoFilter] = useState('all')
  const [period, setPeriod] = useState('all')
  const [minValor, setMinValor] = useState('')
  const [maxValor, setMaxValor] = useState('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [valor, setValor] = useState('')
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

  const lojistaProfile = profile as any

  useEffect(() => {
    loadTransacoes()
  }, [tipoFilter, period])

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

  async function loadTransacoes() {
    if (!user?.id) return

    let query = supabase
      .from('financeiro')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (tipoFilter !== 'all') {
      query = query.eq('tipo', tipoFilter)
    }

    const start = getPeriodStart(period)
    if (start) {
      query = query.gte('created_at', start.toISOString())
    }

    const { data } = await query

    if (data) {
      setTransacoes(data)
    }
    setLoading(false)
  }

  async function handleDeposito() {
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Valor inválido')
      return
    }

    setProcessing(true)
    try {
      const novoSaldo = (lojistaProfile.saldo || 0) + valorNum

      await supabase
        .from('lojistas')
        .update({ saldo: novoSaldo })
        .eq('id', lojistaProfile.id)

      await supabase
        .from('financeiro')
        .insert({
          user_id: user!.id,
          tipo: 'deposito',
          valor: valorNum,
          saldo_anterior: lojistaProfile.saldo || 0,
          saldo_posterior: novoSaldo,
          descricao: 'Depósito de créditos',
        })

      setProfile({ ...lojistaProfile, saldo: novoSaldo })
      toast.success('Depósito realizado com sucesso!')
      setShowDepositModal(false)
      setValor('')
      loadTransacoes()
    } catch (err) {
      toast.error('Erro ao processar depósito')
    } finally {
      setProcessing(false)
    }
  }

  async function handleSaque() {
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error('Valor inválido')
      return
    }

    if (valorNum > (lojistaProfile.saldo || 0)) {
      toast.error('Saldo insuficiente')
      return
    }

    setProcessing(true)
    try {
      const novoSaldo = (lojistaProfile.saldo || 0) - valorNum

      await supabase
        .from('lojistas')
        .update({ saldo: novoSaldo })
        .eq('id', lojistaProfile.id)

      await supabase
        .from('financeiro')
        .insert({
          user_id: user!.id,
          tipo: 'saque',
          valor: -valorNum,
          saldo_anterior: lojistaProfile.saldo || 0,
          saldo_posterior: novoSaldo,
          descricao: 'Saque de créditos',
        })

      setProfile({ ...lojistaProfile, saldo: novoSaldo })
      toast.success('Saque realizado com sucesso!')
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
      case 'deposito':
        return <ArrowDown className="w-5 h-5 text-green-600" />
      case 'saque':
        return <ArrowUp className="w-5 h-5 text-red-600" />
      case 'corrida':
        return <Banknote className="w-5 h-5 text-blue-600" />
      case 'multa':
        return <MinusCircle className="w-5 h-5 text-red-600" />
      case 'estorno':
        return <PlusCircle className="w-5 h-5 text-green-600" />
      default:
        return <Banknote className="w-5 h-5 text-gray-600" />
    }
  }

  const min = parseFloat(minValor.replace(',', '.'))
  const max = parseFloat(maxValor.replace(',', '.'))
  const transacoesFiltradas = transacoes.filter((t) => {
    const abs = Math.abs(t.valor || 0)
    if (!Number.isNaN(min) && abs < min) return false
    if (!Number.isNaN(max) && abs > max) return false
    return true
  })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Saldo</h1>

      {/* Balance Card */}
      <div className="card p-6 mb-6 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
        <p className="text-primary-100 mb-1">Saldo disponível</p>
        <p className="text-4xl font-bold mb-4">
          {formatCurrency(lojistaProfile.saldo || 0)}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex-1 btn bg-white/20 hover:bg-white/30 text-white py-3"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Depositar
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex-1 btn bg-white/20 hover:bg-white/30 text-white py-3"
          >
            <MinusCircle className="w-5 h-5 mr-2" />
            Sacar
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Histórico</h2>
        </div>

        <div className="p-4 border-b grid grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="input"
          >
            <option value="all">Todos os tipos</option>
            <option value="corrida">Corrida</option>
            <option value="deposito">Dep?sito</option>
            <option value="saque">Saque</option>
            <option value="estorno">Estorno</option>
            <option value="multa">Multa</option>
            <option value="taxa">Taxa</option>
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input"
          >
            <option value="all">Todos os per?odos</option>
            <option value="today">Hoje</option>
            <option value="7d">?ltimos 7 dias</option>
            <option value="30d">?ltimos 30 dias</option>
          </select>
          <input
            type="text"
            value={minValor}
            onChange={(e) => setMinValor(e.target.value)}
            placeholder="Valor m?nimo"
            className="input"
          />
          <input
            type="text"
            value={maxValor}
            onChange={(e) => setMaxValor(e.target.value)}
            placeholder="Valor m?ximo"
            className="input"
          />
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner size="md" className="" />
          </div>
        ) : transacoesFiltradas.length === 0 ? (
          <EmptyState
            icon={<Banknote className="w-8 h-8 text-gray-400" />}
            title="Nenhuma transação"
            description="Suas transações aparecerão aqui"
            action={null}
          />
        ) : (
          <div className="divide-y">
            {transacoesFiltradas.map((transacao) => (
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
                  <p className="text-sm text-gray-500">
                    Saldo: {formatCurrency(transacao.saldo_posterior)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Depositar</h3>
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
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDepositModal(false); setValor('') }}
                className="btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeposito}
                disabled={processing || !valor}
                className="btn-primary flex-1"
              >
                {processing ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                Disponível: {formatCurrency(lojistaProfile.saldo || 0)}
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
                className="btn-primary flex-1"
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
