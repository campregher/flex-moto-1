'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { User, Mail, Phone, Lock, IdCard, Image, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AddressAutocomplete, type AddressDetails } from '@/components/AddressAutocomplete'
import { validateCPF, validateCNPJ, validateWhatsApp, validatePlaca } from '@/lib/utils/validators'
import type { Database, UserType } from '@/lib/database.types'

const baseSchema = z.object({
  email: z.string().email('Email inválido'),
  whatsapp: z.string().refine(validateWhatsApp, 'WhatsApp inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
  tipo: z.enum(['lojista', 'entregador'] as const),
  tipo_pessoa: z.enum(['pf', 'pj'] as const),
})

const pfSchema = baseSchema.extend({
  tipo_pessoa: z.literal('pf'),
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cpf: z.string().refine(validateCPF, 'CPF inválido'),
})

const pjSchema = baseSchema.extend({
  tipo_pessoa: z.literal('pj'),
  razao_social: z.string().min(3, 'Razão social obrigatória'),
  cnpj: z.string().refine(validateCNPJ, 'CNPJ inválido'),
})

const lojistaPfSchema = pfSchema.extend({
  tipo: z.literal('lojista'),
  endereco_base: z.string().optional(),
})

const lojistaPjSchema = pjSchema.extend({
  tipo: z.literal('lojista'),
  endereco_base: z.string().optional(),
})

const entregadorPfSchema = pfSchema.extend({
  tipo: z.literal('entregador'),
  placa: z.string().refine(validatePlaca, 'Placa inválida'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  uf: z.string().length(2, 'UF deve ter 2 caracteres'),
})

const entregadorPjSchema = pjSchema.extend({
  tipo: z.literal('entregador'),
  placa: z.string().refine(validatePlaca, 'Placa inválida'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  uf: z.string().length(2, 'UF deve ter 2 caracteres'),
})

const cadastroSchema = z.union([
  lojistaPfSchema,
  lojistaPjSchema,
  entregadorPfSchema,
  entregadorPjSchema,
])
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  })

type CadastroForm = z.infer<typeof cadastroSchema>

const estadosBrasileiros = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export default function CadastroClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [fotoRosto, setFotoRosto] = useState<File | null>(null)
  const [fotoCNH, setFotoCNH] = useState<File | null>(null)
  const [enderecoBaseCoords, setEnderecoBaseCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  })
  const [enderecoBaseDetails, setEnderecoBaseDetails] = useState<AddressDetails | null>(null)
  const supabase = createClient()

  const tipoInicial = (searchParams?.get('tipo') as UserType | null) ?? null

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    control,
    formState: { errors },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      tipo: tipoInicial === 'entregador' || tipoInicial === 'lojista' ? tipoInicial : 'lojista',
      tipo_pessoa: 'pf',
    },
  })

  const tipoUsuario = watch('tipo')
  const tipoPessoa = watch('tipo_pessoa')
  const cpfFieldError = 'cpf' in errors ? errors.cpf : undefined
  const cnpjError = 'cnpj' in errors ? errors.cnpj : undefined
  const placaError = 'placa' in errors ? errors.placa : undefined
  const cidadeError = 'cidade' in errors ? errors.cidade : undefined
  const ufError = 'uf' in errors ? errors.uf : undefined
  const nomeError = 'nome' in errors ? errors.nome : undefined
  const razaoError = 'razao_social' in errors ? errors.razao_social : undefined

  useEffect(() => {
    if (tipoInicial && (tipoInicial === 'lojista' || tipoInicial === 'entregador')) {
      setValue('tipo', tipoInicial)
    }
  }, [tipoInicial, setValue])

  useEffect(() => {
    // Garante que o cadastro não reutilize uma sessão antiga
    supabase.auth.signOut()
  }, [supabase])

  const onSubmit = async (data: CadastroForm) => {
    setIsLoading(true)
    try {
      // 1. Create auth user
      const whatsappClean = data.whatsapp.replace(/\D/g, '')

      const { data: whatsappInUse, error: whatsappError } = await supabase
        .rpc('whatsapp_em_uso', { p_whatsapp: whatsappClean })

      if (whatsappError) {
        toast.error('Erro ao validar WhatsApp')
        return
      }

      if (whatsappInUse) {
        toast.error('Este WhatsApp já está cadastrado')
        return
      }

      if (data.tipo_pessoa === 'pf') {
        const cpfClean = data.cpf.replace(/\D/g, '')
        const { data: cpfInUse, error: cpfError } = await supabase
          .rpc('cpf_em_uso', { p_cpf: cpfClean })
        if (cpfError) {
          toast.error('Erro ao validar CPF')
          return
        }
        if (cpfInUse) {
          toast.error('Este CPF já está cadastrado')
          return
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            nome: data.tipo_pessoa === 'pj' ? data.razao_social : data.nome,
            tipo: data.tipo,
            tipo_pessoa: data.tipo_pessoa,
          },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered') || authError.code === 'user_already_exists') {
          toast.error('Este email já está cadastrado. Redirecionando para login...')
          router.push(`/login?email=${encodeURIComponent(data.email)}&error=exists`)
        } else {
          toast.error(authError.message)
        }
        return
      }

      if (!authData.user) {
        toast.error('Erro ao criar usuário')
        return
      }

      if (!authData.session) {
        toast.success('Conta criada! Confirme o e-mail para continuar.')
        router.push('/loginpending=1')
        return
      }

      // 2. Create user profile
      const userPayload = {
        id: authData.user.id,
        nome: data.tipo_pessoa === 'pj' ? data.razao_social : data.nome,
        razao_social: data.tipo_pessoa === 'pj' ? data.razao_social : null,
        email: data.email,
        whatsapp: whatsappClean,
        cpf: data.tipo_pessoa === 'pf' ? data.cpf.replace(/\D/g, '') : null,
        tipo: data.tipo,
        tipo_pessoa: data.tipo_pessoa,
        status: data.tipo === 'entregador' ? 'pendente' : 'ativo',
      } as Database['public']['Tables']['users']['Insert']

      const { error: userError } = await (supabase as any)
        .from('users')
        .insert(userPayload)

      if (userError) {
        toast.error('Erro ao criar perfil')
        return
      }

      // 3. Create specific profile (lojista or entregador)
      if (data.tipo === 'lojista') {
        const lojistaPayload = {
          user_id: authData.user.id,
          cnpj: data.tipo_pessoa === 'pj' ? data.cnpj.replace(/\D/g, '') : null,
          endereco_base: data.endereco_base || null,
          endereco_latitude: enderecoBaseCoords.lat,
          endereco_longitude: enderecoBaseCoords.lng,
          endereco_logradouro: enderecoBaseDetails?.street || null,
          endereco_numero: enderecoBaseDetails?.number || null,
          endereco_bairro: enderecoBaseDetails?.neighborhood || null,
          endereco_cidade: enderecoBaseDetails?.city || null,
          endereco_uf: enderecoBaseDetails?.state || null,
          endereco_cep: enderecoBaseDetails?.postalCode || null,
          saldo: 0,
        } as Database['public']['Tables']['lojistas']['Insert']

        const { error: lojistaError } = await (supabase as any)
          .from('lojistas')
          .insert(lojistaPayload)

        if (lojistaError) {
          toast.error('Erro ao criar perfil de lojista')
          return
        }
      } else {
        // Upload photos for entregador
        let fotoUrl = null
        let cnhUrl = null

        if (fotoRosto) {
          const { data: fotoData, error: fotoError } = await supabase.storage
            .from('fotos')
            .upload(`entregadores/${authData.user.id}/rosto.jpg`, fotoRosto)

          if (!fotoError && fotoData) {
            const { data: urlData } = supabase.storage
              .from('fotos')
              .getPublicUrl(fotoData.path)
            fotoUrl = urlData.publicUrl
          }
        }

        if (fotoCNH) {
          const { data: cnhData, error: cnhError } = await supabase.storage
            .from('fotos')
            .upload(`entregadores/${authData.user.id}/cnh.jpg`, fotoCNH)

          if (!cnhError && cnhData) {
            const { data: urlData } = supabase.storage
              .from('fotos')
              .getPublicUrl(cnhData.path)
            cnhUrl = urlData.publicUrl
          }
        }

        const entregadorPayload = {
          user_id: authData.user.id,
          foto_url: fotoUrl,
          cnh_url: cnhUrl,
          tipo_veiculo: 'moto',
          placa: data.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          cidade: data.cidade,
          uf: data.uf.toUpperCase(),
          saldo: 0,
        } as Database['public']['Tables']['entregadores']['Insert']

        const { error: entregadorError } = await (supabase as any)
          .from('entregadores')
          .insert(entregadorPayload)

        if (entregadorError) {
          toast.error('Erro ao criar perfil de entregador')
          return
        }
      }

      toast.success('Cadastro realizado com sucesso!')
      
      if (data.tipo === 'entregador') {
        router.push('/entregador/aguardando')
      } else {
        router.push('/lojista')
      }
    } catch (err) {
      toast.error('Erro ao realizar cadastro')
    } finally {
      setIsLoading(false)
    }
  }

  const onInvalid = () => {
    toast.error('Revise os campos obrigatórios antes de continuar')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-white">Flex Entregas</h1>
          </Link>
          <p className="text-primary-200 mt-2">Crie sua conta</p>
        </div>

        <div className="card p-8">
          {/* Tipo de usuário */}
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 mb-3">Tipo de conta</p>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2 flex gap-2">
              <button
                type="button"
                onClick={() => setValue('tipo', 'lojista')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all ${
                  tipoUsuario === 'lojista'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-transparent text-gray-700 hover:bg-white'
                }`}
              >
                Sou Lojista
              </button>
              <button
                type="button"
                onClick={() => setValue('tipo', 'entregador')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all ${
                  tipoUsuario === 'entregador'
                    ? 'bg-secondary-600 text-white shadow-sm'
                    : 'bg-transparent text-gray-700 hover:bg-white'
                }`}
              >
                Sou Entregador
              </button>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-sm font-medium text-gray-700 mb-3">Tipo de pessoa</p>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2 flex gap-2">
              <button
                type="button"
                onClick={() => setValue('tipo_pessoa', 'pf')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all ${
                  tipoPessoa === 'pf'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-transparent text-gray-700 hover:bg-white'
                }`}
              >
                Pessoa Física
              </button>
              <button
                type="button"
                onClick={() => setValue('tipo_pessoa', 'pj')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all ${
                  tipoPessoa === 'pj'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-transparent text-gray-700 hover:bg-white'
                }`}
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5" noValidate>
            <input type="hidden" {...register('tipo')} />

            {/* Step 1: Dados básicos */}
            {step === 1 && (
              <>
                  {tipoPessoa === 'pf' ? (
                    <div>
                      <label className="label">Nome completo</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          {...register('nome')}
                          className="input pl-10"
                          placeholder="Seu nome completo"
                        />
                      </div>
                      {nomeError && (
                        <p className="text-red-500 text-sm mt-1">{nomeError.message}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="label">Razão social</label>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          {...register('razao_social')}
                          className="input pl-10"
                          placeholder="Razão social da empresa"
                        />
                      </div>
                      {razaoError && (
                        <p className="text-red-500 text-sm mt-1">{razaoError.message}</p>
                      )}
                    </div>
                  )}

                {tipoPessoa === 'pf' && (
                  <div>
                    <label className="label">CPF</label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        {...register('cpf')}
                        className="input pl-10"
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                    </div>
                    {cpfFieldError && (
                      <p className="text-red-500 text-sm mt-1">{cpfFieldError.message}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      {...register('email')}
                      className="input pl-10"
                      placeholder="seu@email.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      {...register('whatsapp')}
                      className="input pl-10"
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </div>
                  {errors.whatsapp && (
                    <p className="text-red-500 text-sm mt-1">{errors.whatsapp.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      {...register('password')}
                      className="input pl-10"
                      placeholder="********"
                    />
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="password"
                      {...register('confirmPassword')}
                      className="input pl-10"
                      placeholder="********"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const step1Fields = [
                      'email',
                      'whatsapp',
                      'password',
                      'confirmPassword',
                    ] as const
                    const step1Valid = await trigger(step1Fields as any)
                    if (tipoPessoa === 'pf') {
                      const nomeValid = await trigger('nome')
                      const cpfValid = await trigger('cpf')
                      if (!nomeValid || !cpfValid) {
                        toast.error('Preencha nome e CPF corretamente')
                        return
                      }
                    } else {
                      const razaoValid = await trigger('razao_social')
                      const cnpjValid = await trigger('cnpj')
                      if (!razaoValid || !cnpjValid) {
                        toast.error('Preencha razão social e CNPJ corretamente')
                        return
                      }
                    }
                    if (!step1Valid) {
                      toast.error('Preencha corretamente os campos para continuar')
                      return
                    }
                    setStep(2)
                  }}
                  className="btn-primary w-full py-3"
                >
                  Continuar
                </button>
              </>
            )}

            {/* Step 2: Dados específicos */}
            {step === 2 && (
              <>
                {tipoUsuario === 'lojista' ? (
                  <>
                    {tipoPessoa === 'pj' && (
                      <div>
                        <label className="label">CNPJ</label>
                        <div className="relative">
                          <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="text"
                            {...register('cnpj')}
                            className="input pl-10"
                            placeholder="00.000.000/0000-00"
                            maxLength={18}
                          />
                        </div>
                        {tipoUsuario === 'lojista' && cnpjError && (
                          <p className="text-red-500 text-sm mt-1">{cnpjError.message}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="label">Endereço Base (opcional)</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <Controller
                          control={control}
                          name="endereco_base"
                          render={({ field }) => (
                            <AddressAutocomplete
                              value={field.value || ''}
                              onChange={field.onChange}
                              onSelect={(details) => {
                                setEnderecoBaseCoords({
                                  lat: details.lat ?? null,
                                  lng: details.lng ?? null,
                                })
                                setEnderecoBaseDetails(details)
                              }}
                              placeholder="Endereço principal para coletas"
                              className="input pl-10"
                              id="endereco_base"
                              name="endereco_base"
                              disabled={false}
                              country="br"
                              autoComplete="street-address"
                              preferLegacy={false}
                              enableLiveGeocode={false}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label">Placa da Moto</label>
                      <input
                        type="text"
                        {...register('placa')}
                        className="input uppercase"
                        placeholder="ABC1D23 ou ABC1234"
                        maxLength={7}
                      />
                      {placaError && (
                        <p className="text-red-500 text-sm mt-1">{placaError.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Cidade</label>
                        <input
                          type="text"
                          {...register('cidade')}
                          className="input"
                          placeholder="Sua cidade"
                        />
                        {cidadeError && (
                          <p className="text-red-500 text-sm mt-1">{cidadeError.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="label">UF</label>
                        <select {...register('uf')} className="input">
                          <option value="">Selecione</option>
                          {estadosBrasileiros.map((uf) => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                        {ufError && (
                          <p className="text-red-500 text-sm mt-1">{ufError.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="label">Foto do Rosto</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setFotoRosto(e.target.files?.[0] || null)}
                          className="hidden"
                          id="foto-rosto"
                        />
                        <label
                          htmlFor="foto-rosto"
                          className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-500 transition-colors"
                        >
                          <Image className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600">
                            {fotoRosto ? fotoRosto.name : 'Selecionar foto'}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="label">Foto da CNH</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setFotoCNH(e.target.files?.[0] || null)}
                          className="hidden"
                          id="foto-cnh"
                        />
                        <label
                          htmlFor="foto-cnh"
                          className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-500 transition-colors"
                        >
                          <Image className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600">
                            {fotoCNH ? fotoCNH.name : 'Selecionar foto'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-outline flex-1 py-3"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`flex-1 py-3 ${tipoUsuario === 'lojista' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Cadastrando...
                      </span>
                    ) : (
                      'Cadastrar'
                    )}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              já tem uma conta{' '}
              <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}




