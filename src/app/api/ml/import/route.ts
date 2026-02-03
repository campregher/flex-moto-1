import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'
import { generateCode } from '@/lib/utils'
import { calculateDeliveryPrice, calculateDistance } from '@/lib/utils/pricing'

type MlOrder = {
  id: number
  paid_amount: number
  total_amount: number
  shipping: { id: number }
  order_items: { quantity: number }[]
  buyer: {
    first_name: string
    last_name: string
    nickname: string
  }
}

type MlShipment = {
  id: number
  mode: string
  logistic_type: string
  shipping_option: { cost: number }
  shipping_items: { quantity: number; dimensions: string }[]
  receiver_address: {
    address_line: string
    street_name: string
    street_number: string
    zip_code: string
    city: { name: string }
    state: { id: string; name: string }
    neighborhood: { name: string }
    latitude: number | string
    longitude: number | string
    comment: string
    receiver_name: string
    receiver_phone: string
  }
}

function parseDimensions(dimensions: string) {
  if (!dimensions) return { volumeCm3: null, weightKg: null }
  const [dimsPart, weightPart] = dimensions.split(',')
  const dims = dimsPart.split('x').map((v) => parseFloat(v.replace(',', '.')))
  if (!dims || dims.length < 3 || dims.some((v) => Number.isNaN(v))) {
    return { volumeCm3: null, weightKg: null }
  }
  const volumeCm3 = dims[0] * dims[1] * dims[2]
  const weightG = weightPart ? parseFloat(weightPart.replace(',', '.')) : NaN
  const weightKg = Number.isNaN(weightG) ? null : weightG / 1000
  return { volumeCm3, weightKg }
}

function parseNumber(value: string | number | null) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return value
  const normalized = value.replace(',', '.')
  const num = Number(normalized)
  return Number.isNaN(num) ? null : num
}

function normalizeUf(stateId: string, stateName: string) {
  if (stateId) {
    const match = stateId.match(/^[A-Z]{2}-([A-Z]{2})$/)
    if (match) return match[1]
    if (stateId.length === 2) return stateId
  }
  if (stateName && stateName.length === 2) return stateName
  return null
}

function normalizeCoords(lat: number | null, lng: number | null) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const orderId = body.orderId as string | undefined
  const coletaId = body.coletaId as string | undefined
  if (!orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const { data: lojista } = await supabase
    .from('lojistas')
    .select('id, endereco_base, endereco_latitude, endereco_longitude, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep')
    .eq('user_id', user.id)
    .single()

  const lojistaRow = lojista as Database['public']['Tables']['lojistas']['Row'] | null
  const lojistaId = lojistaRow?.id ?? null

  if (!lojistaId) {
    return NextResponse.json({ error: 'Lojista not found' }, { status: 404 })
  }
  const lojistaData = lojistaRow as Database['public']['Tables']['lojistas']['Row']

  let coleta = null as null | {
    id: string
    endereco: string
    latitude: number | null
    longitude: number | null
    logradouro: string | null
    numero: string | null
    bairro: string | null
    cidade: string | null
    uf: string | null
    cep: string | null
  }

  if (coletaId) {
    const { data: coletaData } = await supabase
      .from('lojista_coletas')
      .select('id, endereco, latitude, longitude, logradouro, numero, bairro, cidade, uf, cep')
      .eq('lojista_id', lojistaId)
      .eq('id', coletaId)
      .maybeSingle()

    if (!coletaData) {
      return NextResponse.json({ error: 'Pickup address not found' }, { status: 400 })
    }

    coleta = coletaData
  } else {
    const { data: coletaDefault } = await supabase
      .from('lojista_coletas')
      .select('id, endereco, latitude, longitude, logradouro, numero, bairro, cidade, uf, cep')
      .eq('lojista_id', lojistaId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    coleta = coletaDefault || null
  }

  const { data: integration } = await supabase
    .from('mercadolivre_integrations')
    .select('access_token')
    .eq('lojista_id', lojistaId)
    .single()

  const integrationRow = integration as { access_token: string | null } | null
  const token = integrationRow?.access_token ?? null

  if (!token) {
    return NextResponse.json({ error: 'Mercado Livre not connected' }, { status: 400 })
  }

  const orderRes = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Order fetch failed', details: err }, { status: 400 })
  }

  const order = (await orderRes.json()) as MlOrder
  const shipmentId = order.shipping.id
  if (!shipmentId) {
    return NextResponse.json({ error: 'Order has no shipment' }, { status: 400 })
  }

  const shipmentRes = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!shipmentRes.ok) {
    const err = await shipmentRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Shipment fetch failed', details: err }, { status: 400 })
  }

  const shipment = (await shipmentRes.json()) as MlShipment
  const receiver = shipment.receiver_address || {}
  const buyerName = [order.buyer.first_name, order.buyer.last_name].filter(Boolean).join(' ') || order.buyer.nickname || null

  const totalPacotes =
    shipment.shipping_items.reduce((acc, item) => acc + (item.quantity || 0), 0) ||
    order.order_items.reduce((acc, item) => acc + (item.quantity || 0), 0) ||
    1

  const { volumeCm3, weightKg } = parseDimensions(shipment.shipping_items?.[0]?.dimensions || '')

  const coletaRow = coleta as {
    id: string
    endereco: string
    latitude: number | null
    longitude: number | null
    logradouro: string | null
    numero: string | null
    bairro: string | null
    cidade: string | null
    uf: string | null
    cep: string | null
  } | null

  const pickupCoords = normalizeCoords(
    parseNumber(coletaRow?.latitude ?? lojistaData.endereco_latitude),
    parseNumber(coletaRow?.longitude ?? lojistaData.endereco_longitude)
  )
  const deliveryCoords = normalizeCoords(
    parseNumber(receiver.latitude),
    parseNumber(receiver.longitude)
  )

  const distanciaTotalKm =
    pickupCoords && deliveryCoords
      ? calculateDistance(pickupCoords.lat, pickupCoords.lng, deliveryCoords.lat, deliveryCoords.lng)
      : 0

  const valorTotal = calculateDeliveryPrice(totalPacotes, distanciaTotalKm)
  const freteValor = valorTotal

  const enderecoEntrega =
    receiver.address_line ||
    [receiver.street_name, receiver.street_number].filter(Boolean).join(' ') ||
    ''

  const enderecoEntregaCompleto = [
    enderecoEntrega,
    receiver.neighborhood.name,
    receiver.city.name,
    receiver.state.id || receiver.state.name,
    receiver.zip_code,
  ]
    .filter(Boolean)
    .join(' - ')

  const corridaPayload = {
    lojista_id: lojistaId,
    plataforma: 'ml_flex',
    status: 'aguardando',
    valor_total: valorTotal,
    valor_reservado: null,
    codigo_entrega: generateCode(6),
    total_pacotes: totalPacotes,
    distancia_total_km: distanciaTotalKm,
    endereco_coleta: coletaRow?.endereco || lojistaData.endereco_base || '',
    coleta_latitude: pickupCoords?.lat ?? 0,
    coleta_longitude: pickupCoords?.lng ?? 0,
    coleta_complemento: null,
    coleta_observacoes: null,
    coleta_logradouro: coletaRow?.logradouro || lojistaData.endereco_logradouro || null,
    coleta_numero: coletaRow?.numero || lojistaData.endereco_numero || null,
    coleta_bairro: coletaRow?.bairro || lojistaData.endereco_bairro || null,
    coleta_cidade: coletaRow?.cidade || lojistaData.endereco_cidade || null,
    coleta_uf: coletaRow?.uf || lojistaData.endereco_uf || null,
    coleta_cep: coletaRow?.cep || lojistaData.endereco_cep || null,
    frete_valor: freteValor,
    peso_kg: weightKg,
    volume_cm3: volumeCm3,
  } as Database['public']['Tables']['corridas']['Insert']

  const { data: corrida, error: corridaError } = await (supabase as any)
    .from('corridas')
    .insert(corridaPayload)
    .select()
    .single()

  const corridaRow = corrida as Database['public']['Tables']['corridas']['Row'] | null

  if (corridaError || !corridaRow) {
    return NextResponse.json({ error: 'Failed to create corrida', details: corridaError }, { status: 500 })
  }

  const enderecoPayload = {
    corrida_id: corridaRow.id,
    endereco: enderecoEntregaCompleto || enderecoEntrega || '',
    latitude: parseNumber(receiver.latitude) || 0,
    longitude: parseNumber(receiver.longitude) || 0,
    complemento: receiver.comment || null,
    observacoes: null,
    pacotes: totalPacotes,
    ordem: 0,
    codigo_confirmacao: generateCode(6),
    logradouro: receiver.street_name || null,
    numero: receiver.street_number || null,
    bairro: receiver.neighborhood.name || null,
    cidade: receiver.city.name || null,
    uf: normalizeUf(receiver.state.id, receiver.state.name),
    cep: receiver.zip_code || null,
    receiver_name: receiver.receiver_name || buyerName,
    receiver_phone: receiver.receiver_phone || null,
    peso_kg: weightKg,
    volume_cm3: volumeCm3,
  } as Database['public']['Tables']['enderecos_entrega']['Insert']

  const { error: enderecosError } = await (supabase as any)
    .from('enderecos_entrega')
    .insert(enderecoPayload)

  if (enderecosError) {
    return NextResponse.json(
      {
        error: 'Failed to create endereco',
        details: {
          message: enderecosError.message,
          code: enderecosError.code,
          details: enderecosError.details,
          hint: enderecosError.hint,
        },
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, corrida_id: corridaRow.id })
}
