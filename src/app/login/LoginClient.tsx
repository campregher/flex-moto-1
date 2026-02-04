'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const stepOneSchema = z.object({
  login: z.string().min(5, 'Informe email ou WhatsApp'),
})

const stepTwoSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

type StepOneForm = z.infer<typeof stepOneSchema>
type StepTwoForm = z.infer<typeof stepTwoSchema>

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  const prefillEmail = searchParams?.get('email') ?? ''
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(prefillEmail || null)
  const supabase = createClient()

  const redirect = searchParams?.get('redirect') ?? null
  const error = searchParams?.get('error') ?? null

  const {
    register: registerStepOne,
    handleSubmit: handleStepOne,
    formState: { errors: errorsStepOne },
  } = useForm<StepOneForm>({
    resolver: zodResolver(stepOneSchema),
  })

  const {
    register: registerStepTwo,
    handleSubmit: handleStepTwo,
    formState: { errors: errorsStepTwo },
  } = useForm<StepTwoForm>({
    resolver: zodResolver(stepTwoSchema),
  })

  const onSubmitStepOne = async (data: StepOneForm) => {
    setIsLoading(true)
    try {
      const value = data.login.trim()
      if (value.includes('@')) {
        setResolvedEmail(value.toLowerCase())
        setStep(2)
        return
      }

      const whatsapp = value.replace(/\D/g, '')
      if (whatsapp.length < 10) {
        toast.error('WhatsApp inválido')
        return
      }

      const { data: emailData, error } = await supabase.rpc('email_por_whatsapp', {
        p_whatsapp: whatsapp,
      })
      if (error || !emailData) {
        toast.error('WhatsApp não encontrado')
        return
      }

      setResolvedEmail(emailData)
      setStep(2)
    } catch (err) {
      toast.error('Erro ao localizar conta')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmitStepTwo = async (data: StepTwoForm) => {
    setIsLoading(true)
    try {
      if (!resolvedEmail) {
        toast.error('Informe email ou WhatsApp')
        setStep(1)
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: data.password,
      })

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          toast.error('Email ou senha incorretos')
        } else {
          toast.error(authError.message)
        }
        return
      }

      if (authData.user) {
        // Get user type to redirect properly
        const { data: userData } = await supabase
          .from('users')
          .select('tipo')
          .eq('id', authData.user.id)
          .single()

        if (userData) {
          const redirectPath =
            redirect ||
            (userData.tipo === 'admin'
              ? '/admin'
              : userData.tipo === 'lojista'
              ? '/lojista'
              : '/entregador')
          router.push(redirectPath)
          router.refresh()
        }
      }
    } catch (err) {
      toast.error('Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">Flex Entregas</h1>
          </Link>
          <p className="text-primary-200 mt-2">Entre na sua conta</p>
        </div>

        <div className="card p-8">
          {error === 'blocked' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              Sua conta foi bloqueada. Entre em contato com o suporte.
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStepOne(onSubmitStepOne)} className="space-y-5">
              <div>
                <label className="label">Email ou WhatsApp</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    {...registerStepOne('login')}
                    className="input pl-10"
                    defaultValue={prefillEmail}
                    placeholder="seu@email.com ou (00) 00000-0000"
                  />
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                </div>
                {errorsStepOne.login && (
                  <p className="text-red-500 text-sm mt-1">{errorsStepOne.login.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Continuando...
                  </span>
                ) : (
                  'Continuar'
                )}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStepTwo(onSubmitStepTwo)} className="space-y-5">
              <div className="text-sm text-gray-600">
                Entrando como <span className="font-medium text-gray-900">{resolvedEmail}</span>
              </div>

              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...registerStepTwo('password')}
                    className="input pl-10 pr-10"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errorsStepTwo.password && (
                  <p className="text-red-500 text-sm mt-1">{errorsStepTwo.password.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setResolvedEmail(null)
                  }}
                  className="btn-outline flex-1 py-3"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex-1 py-3"
                >
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Não tem uma conta{' '}
              <Link href="/cadastro" className="text-primary-600 hover:text-primary-700 font-medium">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}




