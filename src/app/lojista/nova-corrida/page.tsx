'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { calculateDeliveryPrice, calculateRouteDistance, PRICING } from '@/lib/utils/pricing'
import { generateCode, formatCurrency } from '@/lib/utils'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { loadGoogleMaps } from '@/lib/google-maps'
import {
  HiOutlineLocationMarker,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineInformationCircle,
} from 'react-icons/hi'

interface EnderecoForm {
  endereco: string
  complemento: string
  observacoes: string
  pacotes: number
  latitude: number
  longitude: number
  ordem?: number
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
}

interface ColetaOption {
  id: string
  label: string | null
  endereco: string
  latitude: number | null
  longitude: number | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  is_default: boolean | null
}

interface CorridaForm {
  plataforma: 'ml_flex' | 'shopee_direta'
  endereco_coleta: string
  coleta_complemento: string
  coleta_observacoes: string
  coleta_latitude: number
  coleta_longitude: number
  coleta_logradouro?: string
  coleta_numero?: string
  coleta_bairro?: string
  coleta_cidade?: string
  coleta_uf?: string
  coleta_cep?: string
}

export default function NovaCorridaPage() {
  const router = useRouter()
  const { user, profile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [distanciaRota, setDistanciaRota] = useState(0)
  const [calculandoRota, setCalculandoRota] = useState(false)
  const rotaRequestRef = useRef(0)
  const geocodeTimeoutRef = useRef<number | null>(null)
  const pickupGeocodeRef = useRef<string>('')
  const deliveryGeocodeRef = useRef<Map<number, string>>(new Map())
  const [enderecos, setEnderecos] = useState<EnderecoForm[]>([
    {
      endereco: '',
      complemento: '',
      observacoes: '',
      pacotes: 1,
      latitude: 0,
      longitude: 0,
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
    }
  ])
  const [coletas, setColetas] = useState<ColetaOption[]>([])
  const [selectedColetaId, setSelectedColetaId] = useState<string>('manual')
  const supabase = createClient()

  const lojistaProfile = profile as any

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<CorridaForm>({
    defaultValues: {
      plataforma: 'ml_flex',
      endereco_coleta: lojistaProfile?.endereco_base || '',
      coleta_latitude: lojistaProfile?.endereco_latitude || 0,
      coleta_longitude: lojistaProfile?.endereco_longitude || 0,
    }
  })

  const applyColeta = (coleta: ColetaOption) => {
    setValue('endereco_coleta', coleta.endereco || '')
    setValue('coleta_latitude', coleta.latitude || 0)
    setValue('coleta_longitude', coleta.longitude || 0)
    setValue('coleta_logradouro', coleta.logradouro || '')
    setValue('coleta_numero', coleta.numero || '')
    setValue('coleta_bairro', coleta.bairro || '')
    setValue('coleta_cidade', coleta.cidade || '')
    setValue('coleta_uf', coleta.uf || '')
    setValue('coleta_cep', coleta.cep || '')
  }

  const applyProfileColeta = () => {
    if (!lojistaProfile?.endereco_base) return
    setValue('endereco_coleta', lojistaProfile.endereco_base || '')
    setValue('coleta_latitude', lojistaProfile.endereco_latitude || 0)
    setValue('coleta_longitude', lojistaProfile.endereco_longitude || 0)
    setValue('coleta_logradouro', lojistaProfile.endereco_logradouro || '')
    setValue('coleta_numero', lojistaProfile.endereco_numero || '')
    setValue('coleta_bairro', lojistaProfile.endereco_bairro || '')
    setValue('coleta_cidade', lojistaProfile.endereco_cidade || '')
    setValue('coleta_uf', lojistaProfile.endereco_uf || '')
    setValue('coleta_cep', lojistaProfile.endereco_cep || '')
  }

  useEffect(() => {
    async function loadColetas() {
      if (!lojistaProfile?.id) return
      const { data } = await supabase
        .from('lojista_coletas')
        .select('*')
        .eq('lojista_id', lojistaProfile.id)
        .order('created_at', { ascending: true })

      const list = (data || []) as ColetaOption[]
      setColetas(list)

      if (lojistaProfile?.endereco_base) {
        setSelectedColetaId('perfil')
        applyProfileColeta()
        return
      }

      const defaultColeta = list.find((item) => item.is_default) || list[0]
      if (defaultColeta) {
        setSelectedColetaId(defaultColeta.id)
        applyColeta(defaultColeta)
      }
    }

    loadColetas()
  }, [lojistaProfile?.id, supabase])

  const enderecoColeta = watch('endereco_coleta')
  const coletaLat = watch('coleta_latitude')
  const coletaLng = watch('coleta_longitude')

  useEffect(() => {
    if (!lojistaProfile) return
    if (selectedColetaId !== 'manual') return
    if (enderecoColeta && enderecoColeta.trim().length > 0) return

    const enderecoBase = lojistaProfile?.endereco_base || ''
    if (!enderecoBase) return

    setValue('endereco_coleta', enderecoBase)
    setValue('coleta_latitude', lojistaProfile?.endereco_latitude || 0)
    setValue('coleta_longitude', lojistaProfile?.endereco_longitude || 0)
    setValue('coleta_logradouro', lojistaProfile?.endereco_logradouro || '')
    setValue('coleta_numero', lojistaProfile?.endereco_numero || '')
    setValue('coleta_bairro', lojistaProfile?.endereco_bairro || '')
    setValue('coleta_cidade', lojistaProfile?.endereco_cidade || '')
    setValue('coleta_uf', lojistaProfile?.endereco_uf || '')
    setValue('coleta_cep', lojistaProfile?.endereco_cep || '')
  }, [enderecoColeta, lojistaProfile, selectedColetaId, setValue])

  const totalPacotes = enderecos.reduce((acc, e) => acc + e.pacotes, 0)

  const origemLat = coletaLat || lojistaProfile?.endereco_latitude || 0
  const origemLng = coletaLng || lojistaProfile?.endereco_longitude || 0
  const destinosComCoords = enderecos
    .filter((e) => e.latitude && e.longitude)
    .sort((a, b) => (a.ordem  0) - (b.ordem  0))
    .map((e) => ({ lat: e.latitude, lng: e.longitude }))

  useEffect(() => {
    if (geocodeTimeoutRef.current) {
      window.clearTimeout(geocodeTimeoutRef.current)
    }

    geocodeTimeoutRef.current = window.setTimeout(() => {
      // Geocode pickup if missing coords
      if (enderecoColeta && enderecoColeta.trim().length >= 5 && (!coletaLat || !coletaLng)) {
        if (pickupGeocodeRef.current !== enderecoColeta) {
          pickupGeocodeRef.current = enderecoColeta
          loadGoogleMaps()
            .then(() => {
              const geocoder = new google.maps.Geocoder()
              geocoder.geocode(
                {
                  address: enderecoColeta,
                  componentRestrictions: { country: 'BR' },
                },
                (results, status) => {
                  if (status !== 'OK' || !results || results.length === 0) return
                  const location = results[0].geometry?.location
                  if (!location) return
                  setValue('coleta_latitude', location.lat())
                  setValue('coleta_longitude', location.lng())
                }
              )
            })
            .catch(() => {
              // Ignore geocode errors; user can still select from autocomplete.
            })
        }
      }

      // Geocode delivery addresses missing coords
      enderecos.forEach((endereco, index) => {
        if (!endereco.endereco || endereco.endereco.trim().length < 5) return
        if (endereco.latitude && endereco.longitude) return
        if (deliveryGeocodeRef.current.get(index) === endereco.endereco) return

        deliveryGeocodeRef.current.set(index, endereco.endereco)
        loadGoogleMaps()
          .then(() => {
            const geocoder = new google.maps.Geocoder()
            geocoder.geocode(
              {
                address: endereco.endereco,
                componentRestrictions: { country: 'BR' },
              },
              (results, status) => {
                if (status !== 'OK' || !results || results.length === 0) return
                const location = results[0].geometry?.location
                if (!location) return
                updateEnderecoFields(index, {
                  latitude: location.lat(),
                  longitude: location.lng(),
                })
              }
            )
          })
          .catch(() => {
            // Ignore geocode errors; user can still select from autocomplete.
          })
      })
    }, 700)

    return () => {
      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current)
      }
    }
  }, [coletaLat, coletaLng, enderecoColeta, enderecos, setValue])

  useEffect(() => {
    // Cleanup de requests anteriores
    const currentRequestId = ++rotaRequestRef.current

    // Fun?o de cleanup
    const cleanup = () => {
      if (rotaRequestRef.current == currentRequestId) {
        setCalculandoRota(false)
      }
    }

    // Verifica se temos dados suficientes para calcular rota
    const temCoordsOrigem = Boolean(origemLat && origemLng)
    const temCoordsDestinos = destinosComCoords.length > 0
    const enderecosTexto = enderecos.filter((e) => e.endereco?.trim())
    const enderecosValidos = enderecosTexto.filter((e) => e.endereco!.trim().length >= 5)
    const temEnderecos = enderecosTexto.length > 0
    const temEnderecosValidos = enderecosValidos.length > 0
    const enderecoColetaValido = Boolean(enderecoColeta?.trim() && enderecoColeta.trim().length >= 5)

    // Condi?o para n?o calcular
    if (!temCoordsOrigem && !enderecoColetaValido) {
      setDistanciaRota(0)
      setCalculandoRota(false)
      return
    }

    if (temCoordsOrigem && destinosComCoords.length === 0 && !temEnderecosValidos) {
      setDistanciaRota(0)
      setCalculandoRota(false)
      return
    }

    if (!temCoordsOrigem && !temEnderecosValidos) {
      setDistanciaRota(0)
      setCalculandoRota(false)
      return
    }

    // Define origem e destino
    const usarCoords = temCoordsOrigem && temCoordsDestinos

      let origin: google.maps.LatLng | google.maps.LatLngLiteral | string
      let destination: google.maps.LatLng | google.maps.LatLngLiteral | string
    let waypoints: google.maps.DirectionsWaypoint[] = []

    if (usarCoords) {
      origin = new google.maps.LatLng(origemLat!, origemLng!)
      destination = destinosComCoords[destinosComCoords.length - 1]
      waypoints = destinosComCoords.slice(0, -1).map((dest) => ({
        location: dest,
        stopover: true,
      }))
    } else {
      // Usar endere?os como string
      const enderecosValidos = enderecos
        .map((e) => e.endereco?.trim())
        .filter((endereco) => endereco && endereco.length >= 5) as string[]

      if (enderecosValidos.length === 0) {
        setDistanciaRota(0)
        setCalculandoRota(false)
        return
      }

      origin = enderecoColeta!.trim()
      destination = enderecosValidos[enderecosValidos.length - 1]
      waypoints = enderecosValidos.slice(0, -1).map((dest) => ({
        location: dest,
        stopover: true,
      }))
    }

    // Delay para evitar chamadas excessivas
    const timer = window.setTimeout(() => {
      loadGoogleMaps()
        .then(() => {
          // Verifica se ainda  a request atual
          if (rotaRequestRef.current !== currentRequestId) return

          const directionsService = new google.maps.DirectionsService()

          directionsService.route(
            {
              origin,
              destination,
              waypoints,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: true,
              region: 'BR',
              provideRouteAlternatives: false,
            },
            (result, status) => {
              // Verifica se ainda  a request atual
              if (rotaRequestRef.current !== currentRequestId) return

              if (status === 'OK' && result?.routes?.[0]) {
                const totalMeters = result.routes[0].legs.reduce(
                  (sum, leg) => sum + (leg.distance?.value || 0),
                  0
                )
                setDistanciaRota(Math.round((totalMeters / 1000) * 10) / 10)
              } else {
                // Fallback para c?lculo aproximado
                if (temCoordsOrigem && temCoordsDestinos) {
                  const fallback = calculateRouteDistance(
                    { lat: origemLat!, lng: origemLng! },
                    destinosComCoords
                  )
                  setDistanciaRota(fallback)
                } else {
                  setDistanciaRota(0)
                }
              }
              setCalculandoRota(false)
            }
          )
        })
        .catch((error) => {
          if (rotaRequestRef.current !== currentRequestId) return

          console.error('Erro ao carregar Google Maps:', error)
          // Fallback para c?lculo aproximado
          if (temCoordsOrigem && temCoordsDestinos) {
            const fallback = calculateRouteDistance(
              { lat: origemLat!, lng: origemLng! },
              destinosComCoords
            )
            setDistanciaRota(fallback)
          } else {
            setDistanciaRota(0)
          }
          setCalculandoRota(false)
        })
    }, 500)

    // Cleanup
    return () => {
      window.clearTimeout(timer)
      if (rotaRequestRef.current == currentRequestId) {
        cleanup()
      }
    }
  }, [destinosComCoords, origemLat, origemLng, enderecos, enderecoColeta])


  const valorTotal = calculateDeliveryPrice(totalPacotes, distanciaRota)
  const saldoSuficiente = (lojistaProfile?.saldo || 0) >= valorTotal
  const distanciaCalculada = distanciaRota > 0
  const distanciaParaExibir = distanciaCalculada  distanciaRota : 0
  const valorParaExibir = distanciaCalculada  valorTotal : 0
  const debugRotaInfo = {
    origemLat,
    origemLng,
    enderecoColeta,
    destinos: enderecos.map((e) => ({
      endereco: e.endereco,
      latitude: e.latitude,
      longitude: e.longitude,
    })),
  }

  const addEndereco = () => {
    if (enderecos.length >= 10) {
      toast.error('Máximo de 10 endereços por corrida')
      return
    }
    setEnderecos([
      ...enderecos,
      {
        endereco: '',
        complemento: '',
        observacoes: '',
        pacotes: 1,
        latitude: 0,
        longitude: 0,
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        uf: '',
        cep: '',
      },
    ])
  }

  const removeEndereco = (index: number) => {
    if (enderecos.length === 1) {
      toast.error('É necessário ao menos um endereço de entrega')
      return
    }
    setEnderecos(enderecos.filter((_, i) => i !== index))
  }

  const updateEndereco = (index: number, field: keyof EnderecoForm, value: string | number) => {
    setEnderecos((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const updateEnderecoFields = (index: number, fields: Partial<EnderecoForm>) => {
    setEnderecos((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], ...fields }
      return updated
    })
  }

  const onSubmit = async (data: CorridaForm) => {
    if (!saldoSuficiente) {
      toast.error('Saldo insuficiente')
      return
    }

    if (totalPacotes > PRICING.MAX_PACKAGES_TOTAL) {
      toast.error(`Máximo de ${PRICING.MAX_PACKAGES_TOTAL} pacotes por corrida`)
      return
    }

    const enderecosVazios = enderecos.some(e => !e.endereco.trim())
    if (enderecosVazios) {
      toast.error('Preencha todos os endereços de entrega')
      return
    }

    setIsLoading(true)
    try {
      const codigoEntrega = generateCode(6)

      // Create corrida
      const { data: corrida, error: corridaError } = await supabase
        .from('corridas')
        .insert({
          lojista_id: lojistaProfile.id,
          plataforma: data.plataforma,
          valor_total: valorTotal,
          valor_reservado: valorTotal,
          codigo_entrega: codigoEntrega,
          total_pacotes: totalPacotes,
          distancia_total_km: distanciaRota,
          frete_valor: valorTotal,
          endereco_coleta: data.endereco_coleta,
          coleta_latitude: data.coleta_latitude || -23.55,
          coleta_longitude: data.coleta_longitude || -46.63,
          coleta_complemento: data.coleta_complemento,
          coleta_observacoes: data.coleta_observacoes,
          coleta_logradouro: data.coleta_logradouro || null,
          coleta_numero: data.coleta_numero || null,
          coleta_bairro: data.coleta_bairro || null,
          coleta_cidade: data.coleta_cidade || null,
          coleta_uf: data.coleta_uf || null,
          coleta_cep: data.coleta_cep || null,
          status: 'aguardando',
        })
        .select()
        .single()

      if (corridaError) throw corridaError

      // Create delivery addresses
      const enderecosData = enderecos.map((e, index) => ({
        corrida_id: corrida.id,
        endereco: e.endereco,
        latitude: e.latitude || -23.55 + (Math.random() * 0.1),
        longitude: e.longitude || -46.63 + (Math.random() * 0.1),
        complemento: e.complemento,
        observacoes: e.observacoes,
        pacotes: e.pacotes,
        ordem: index,
        codigo_confirmacao: generateCode(6),
        logradouro: e.logradouro || null,
        numero: e.numero || null,
        bairro: e.bairro || null,
        cidade: e.cidade || null,
        uf: e.uf || null,
        cep: e.cep || null,
      }))

      const { error: enderecosError } = await supabase
        .from('enderecos_entrega')
        .insert(enderecosData)

      if (enderecosError) throw enderecosError

      // Reserve balance
      const novoSaldo = lojistaProfile.saldo - valorTotal
      
      await supabase
        .from('lojistas')
        .update({ saldo: novoSaldo })
        .eq('id', lojistaProfile.id)

      await supabase
        .from('financeiro')
        .insert({
          user_id: user!.id,
          tipo: 'corrida',
          valor: -valorTotal,
          saldo_anterior: lojistaProfile.saldo,
          saldo_posterior: novoSaldo,
          descricao: `Corrida #${corrida.id.slice(0, 8)} - ${totalPacotes} pacote(s)`,
          corrida_id: corrida.id,
        })

      toast.success('Corrida criada com sucesso!')
      router.push(`/lojista/corridas/${corrida.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao criar corrida')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Nova corrida</h1>
          <p className="text-sm text-gray-600">
            Crie uma nova corrida em poucos passos. Primeiro a coleta, depois os destinos.
          </p>
        </div>
        
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <HiOutlineLocationMarker className="w-5 h-5 text-primary-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Endereco de coleta</h2>
                  <p className="text-sm text-gray-600">
                    Confirme onde o entregador vai buscar os pacotes.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {(coletas.length > 0 || lojistaProfile?.endereco_base) && (
                  <div>
                    <label className="label">Usar endereco cadastrado</label>
                    <select
                      value={selectedColetaId}
                      onChange={(e) => {
                        const id = e.target.value
                        setSelectedColetaId(id)
                        if (id === 'manual') return
                        if (id === 'perfil') {
                          applyProfileColeta()
                          return
                        }
                        const coleta = coletas.find((item) => item.id === id)
                        if (coleta) applyColeta(coleta)
                      }}
                      className="input"
                    >
                      {lojistaProfile?.endereco_base && (
                        <option value="perfil">Endereco do perfil</option>
                      )}
                      <option value="manual">Digitar manualmente</option>
                      {coletas.map((coleta) => (
                        <option key={coleta.id} value={coleta.id}>
                          {coleta.label || coleta.endereco}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="label">Buscar endereco de coleta</label>
                  <AddressAutocomplete
                    value={enderecoColeta || ''}
                    onChange={(value) => {
                      setValue('endereco_coleta', value, { shouldDirty: true, shouldValidate: true })
                      setValue('coleta_latitude', 0)
                      setValue('coleta_longitude', 0)
                    }}
                    onSelect={(details) => {
                      setValue('coleta_latitude', details.lat || 0)
                      setValue('coleta_longitude', details.lng || 0)
                      setValue('coleta_logradouro', details.street || '')
                      setValue('coleta_numero', details.number || '')
                      setValue('coleta_bairro', details.neighborhood || '')
                      setValue('coleta_cidade', details.city || '')
                      setValue('coleta_uf', details.state || '')
                      setValue('coleta_cep', details.postalCode || '')
                    }}
                    placeholder="Rua, numero, bairro, cidade"
                    className="input"
                    disabled={selectedColetaId !== 'manual'}
                  />
                  <p className="text-xs text-gray-500">
                    Digite o endereco completo. Voce pode ajustar manualmente.
                  </p>
                  {errors.endereco_coleta && (
                    <p className="text-red-500 text-sm">{errors.endereco_coleta.message}</p>
                  )}
                </div>

                <input
                  type="hidden"
                  {...register('endereco_coleta', { required: 'Endereco de coleta obrigatorio.' })}
                />
                <input type="hidden" {...register('coleta_latitude', { valueAsNumber: true })} />
                <input type="hidden" {...register('coleta_longitude', { valueAsNumber: true })} />
                <input type="hidden" {...register('coleta_logradouro')} />
                <input type="hidden" {...register('coleta_numero')} />
                <input type="hidden" {...register('coleta_bairro')} />
                <input type="hidden" {...register('coleta_cidade')} />
                <input type="hidden" {...register('coleta_uf')} />
                <input type="hidden" {...register('coleta_cep')} />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Complemento</label>
                    <input
                      type="text"
                      {...register('coleta_complemento')}
                      className="input"
                      placeholder="Apartamento, bloco, referencia"
                    />
                  </div>
                  <div>
                    <label className="label">Observacoes</label>
                    <input
                      type="text"
                      {...register('coleta_observacoes')}
                      className="input"
                      placeholder="Porteiro, referencia, horario"
                    />
                  </div>
                </div>
              </div>
            </div>

            


                    <div className="card p-6 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Enderecos de entrega</h2>
                  <p className="text-sm text-gray-600">
                    Informe os destinos. Voce pode adicionar varios enderecos.
                  </p>
                </div>
                <span className="text-sm text-gray-600">
                  {totalPacotes}/{PRICING.MAX_PACKAGES_TOTAL} pacotes
                </span>
              </div>

              <div className="space-y-4">
                {enderecos.map((endereco, index) => (
                  <div key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-gray">Entrega {index + 1}</span>
                      {enderecos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEndereco(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                          aria-label={`Remover entrega ${index + 1}`}
                        >
                          <HiOutlineTrash className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="label">Buscar endereco de entrega</label>
                      <AddressAutocomplete
                        value={endereco.endereco}
                        onChange={(value) =>
                          updateEnderecoFields(index, {
                            endereco: value,
                            latitude: 0,
                            longitude: 0,
                          })
                        }
                        onSelect={(details) => {
                          updateEnderecoFields(index, {
                            endereco: details.formattedAddress || endereco.endereco,
                            latitude: details.lat || 0,
                            longitude: details.lng || 0,
                            logradouro: details.street || '',
                            numero: details.number || '',
                            bairro: details.neighborhood || '',
                            cidade: details.city || '',
                            uf: details.state || '',
                            cep: details.postalCode || '',
                          })
                        }}
                        placeholder="Rua, numero, bairro, cidade"
                        className="input"
                        enableLiveGeocode
                        preferLegacy
                      />
                      <p className="text-xs text-gray-500">
                        Digite o endereco completo. Ajuste se precisar.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label">Complemento</label>
                        <input
                          type="text"
                          value={endereco.complemento}
                          onChange={(e) => updateEndereco(index, 'complemento', e.target.value)}
                          className="input"
                          placeholder="Apto, casa, bloco"
                        />
                      </div>
                      <div>
                        <label className="label">Pacotes</label>
                        <input
                          type="number"
                          value={endereco.pacotes}
                          onChange={(e) => updateEndereco(index, 'pacotes', parseInt(e.target.value) || 1)}
                          min={1}
                          max={PRICING.MAX_PACKAGES_PER_ADDRESS}
                          className="input"
                          placeholder="Quantidade"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label">Observacoes (opcional)</label>
                      <input
                        type="text"
                        value={endereco.observacoes}
                        onChange={(e) => updateEndereco(index, 'observacoes', e.target.value)}
                        className="input"
                        placeholder="Ex: deixar na portaria"
                      />
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addEndereco} className="btn-outline w-full">
                  <HiOutlinePlus className="w-5 h-5 mr-2" />
                  Adicionar endereco
                </button>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Resumo</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de pacotes</span>
                  <span className="font-medium">{totalPacotes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Distancia estimada {calculandoRota  '(calculando...)' : ''}
                  </span>
                  <span className="font-medium">{distanciaParaExibir.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor por pacote</span>
                  <span className="font-medium">{formatCurrency(PRICING.MIN_VALUE_PER_PACKAGE)}</span>
                </div>
                {distanciaParaExibir > PRICING.BASE_DISTANCE_KM && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Adicional por km extra</span>
                    <span className="font-medium">
                      +{formatCurrency(
                        (distanciaParaExibir - PRICING.BASE_DISTANCE_KM) * PRICING.EXTRA_KM_RATE
                      )}
                    </span>
                  </div>
                )}
                <hr />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-primary-600">{formatCurrency(valorParaExibir)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Seu saldo</span>
                  <span className={`font-medium ${saldoSuficiente  'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(lojistaProfile?.saldo || 0)}
                  </span>
                </div>
              </div>
              <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer">Debug da rota</summary>
                <pre className="mt-2 whitespace-pre-wrap">
{JSON.stringify(debugRotaInfo, null, 2)}
                </pre>
              </details>

              {!saldoSuficiente && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 flex items-start gap-2">
                  <HiOutlineInformationCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Saldo insuficiente</p>
                    <p className="text-sm">Deposite mais creditos para continuar.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              
              <button
                type="submit"
                disabled={isLoading || !saldoSuficiente || !distanciaCalculada}
                className="btn-primary flex-1 py-3"
              >
                {isLoading  'Criando...' : 'Confirmar corrida'}
              </button>
            </div>

      </form>
    </div>
  )

}
