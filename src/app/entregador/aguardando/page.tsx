'use client'

import Link from 'next/link'
import { HiOutlineClock, HiOutlineDocumentText, HiOutlinePhone } from 'react-icons/hi'

export default function AguardandoAprovacaoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-600 via-secondary-700 to-secondary-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineClock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Cadastro em Análise
          </h1>
          <p className="text-secondary-100">
            Estamos verificando seus documentos
          </p>
        </div>

        <div className="card p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-yellow-50 rounded-xl">
              <HiOutlineDocumentText className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-gray-900">Verificação de Documentos</h3>
                <p className="text-sm text-gray-600">
                  Estamos analisando sua CNH e foto para garantir a segurança de todos.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-2">O que acontece agora?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-secondary-500 rounded-full"></span>
                  Nossa equipe vai verificar seus dados
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-secondary-500 rounded-full"></span>
                  Você receberá uma notificação quando aprovado
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-secondary-500 rounded-full"></span>
                  O processo leva até 24 horas úteis
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 text-center mb-4">
              Tem alguma dúvida?
            </p>
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline w-full flex items-center justify-center gap-2"
            >
              <HiOutlinePhone className="w-5 h-5" />
              Falar com Suporte
            </a>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-white/80 hover:text-white text-sm">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
