import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'

type MlOrderSearch = {
  results?: MlOrder[]
}

type MlOrder = {
  id: number
  status?: string
  shipping?: { id?: number }
  buyer?: {
    first_name?: string
    last_name?: string
    nickname?: string
  }
  order_items?: { quantity: number }[]
}

type MlShipment = {
  id: number
  status?: string
  receiver_address?: {
    address_line?: string
    street_name?: string
    street_number?: string
    zip_code?: string
    city?: { name?: string }
    state?: { id?: string; name?: string }
    neighborhood?: { name?: string }
    latitude?: number | string
    longitude?: number | string
    comment?: string
    receiver_name?: string
    receiver_phone?: string
  }
  shipping_items?: { quantity: number }[]
}

function parseNumber(value?: string | number | null) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number') return value
  const normalized = value.replace(',', '.')
  const num = Number(normalized)
  return Number.isNaN(num) ? null : num
}

function normalizeUf(stateId?: string, stateName?: string) {
  if (stateId) {
    const match = stateId.match(/^[A-Z]{2}-([A-Z]{2})$/)
    if (match) return match[1]
    if (stateId.length === 2) return stateId
  }
  if (stateName && stateName.length === 2) return stateName
  return null
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: lojista } = await supabase
    .from('lojistas')
    .select('id, endereco_base, endereco_latitude, endereco_longitude')
    .eq('user_id', user.id)
    .single()

  if (!lojista) {
    return NextResponse.json({ error: 'Lojista not found' }, { status: 404 })
  }

  const { data: integration } = await supabase
    .from('mercadolivre_integrations')
    .select('access_token, ml_user_id')
    .eq('lojista_id', lojista.id)
    .single()

  if (!integration?.access_token || !integration?.ml_user_id) {
    return NextResponse.json({ error: 'Mercado Livre not connected' }, { status: 400 })
  }

  const token = integration.access_token
  const sellerId = integration.ml_user_id

  const now = new Date()
  const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const fromIso = fromDate.toISOString()

  const searchUrl = new URL('https://api.mercadolibre.com/orders/search')
  searchUrl.searchParams.set('seller', String(sellerId))
  searchUrl.searchParams.set('order.status', 'paid')
  searchUrl.searchParams.set('sort', 'date_desc')
  searchUrl.searchParams.set('order.date_created.from', fromIso)
  searchUrl.searchParams.set('limit', '50')

  const orderRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}))
    return NextResponse.json({ error: 'Order search failed', details: err }, { status: 400 })
  }

  const orderSearch = (await orderRes.json()) as MlOrderSearch
  const orders = orderSearch.results || []

  const allowedShipmentStatuses = new Set(['pending', 'handling', 'ready_to_ship'])

  const orderIds = orders.map((o) => o.id)
  const { data: existingRows } = await supabase
    .from('mercadolivre_pedidos')
    .select('ml_order_id, endereco, logradouro, numero, complemento, bairro, cidade, uf, cep, latitude, longitude, receiver_name, receiver_phone, pacotes, observacoes, coleta_id, coleta_endereco, coleta_latitude, coleta_longitude, selected, imported_at')
    .eq('lojista_id', lojista.id)
    .in('ml_order_id', orderIds)

  const existingMap = new Map<number, any>()
  for (const row of existingRows || []) {
    existingMap.set(row.ml_order_id, row)
  }

  const { data: defaultColeta } = await supabase
    .from('lojista_coletas')
    .select('id, endereco, latitude, longitude')
    .eq('lojista_id', lojista.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const rows = []
  for (const order of orders) {
    const shipmentId = order.shipping?.id
    if (!shipmentId) continue

    const shipmentRes = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!shipmentRes.ok) continue
    const shipment = (await shipmentRes.json()) as MlShipment

    if (shipment.status && !allowedShipmentStatuses.has(shipment.status)) {
      continue
    }

    const receiver = shipment.receiver_address || {}
    const buyerName =
      [order.buyer?.first_name, order.buyer?.last_name].filter(Boolean).join(' ') ||
      order.buyer?.nickname ||
      null

    const totalPacotes =
      shipment.shipping_items?.reduce((acc, item) => acc + (item.quantity || 0), 0) ||
      order.order_items?.reduce((acc, item) => acc + (item.quantity || 0), 0) ||
      1

    const enderecoEntrega =
      receiver.address_line ||
      [receiver.street_name, receiver.street_number].filter(Boolean).join(' ') ||
      ''

    const existing = existingMap.get(order.id)
    const useColeta = existing?.coleta_id ? existing : defaultColeta

    rows.push({
      lojista_id: lojista.id,
      ml_order_id: order.id,
      ml_shipment_id: shipmentId,
      order_status: order.status || null,
      shipping_status: shipment.status || null,
      buyer_name: buyerName,
      receiver_name: existing?.receiver_name || receiver.receiver_name || buyerName,
      receiver_phone: existing?.receiver_phone || receiver.receiver_phone || null,
      endereco: existing?.endereco || enderecoEntrega,
      logradouro: existing?.logradouro || receiver.street_name || null,
      numero: existing?.numero || (receiver.street_number ? String(receiver.street_number) : null),
      complemento: existing?.complemento || receiver.comment || null,
      bairro: existing?.bairro || receiver.neighborhood?.name || null,
      cidade: existing?.cidade || receiver.city?.name || null,
      uf: existing?.uf || normalizeUf(receiver.state?.id, receiver.state?.name),
      cep: existing?.cep || receiver.zip_code || null,
      latitude: existing?.latitude ?? parseNumber(receiver.latitude),
      longitude: existing?.longitude ?? parseNumber(receiver.longitude),
      pacotes: existing?.pacotes || totalPacotes,
      observacoes: existing?.observacoes || null,
      coleta_id: existing?.coleta_id || (defaultColeta ? defaultColeta.id : null),
      coleta_endereco: existing?.coleta_endereco || (defaultColeta ? defaultColeta.endereco : null),
      coleta_latitude: existing?.coleta_latitude ?? (defaultColeta?.latitude ?? null),
      coleta_longitude: existing?.coleta_longitude ?? (defaultColeta?.longitude ?? null),
      selected: existing?.selected ?? false,
      imported_at: existing?.imported_at ?? null,
    })
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('mercadolivre_pedidos')
      .upsert(rows, { onConflict: 'lojista_id,ml_order_id' })

    if (error) {
      return NextResponse.json({ error: 'Sync failed', details: error }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, count: rows.length })
}
