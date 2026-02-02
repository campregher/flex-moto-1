import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'
import { generateCode } from '@/lib/utils'
import { calculateDeliveryPrice, calculateDistance } from '@/lib/utils/pricing'

function normalizeCoords(lat?: number | null, lng?: number | null) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export async function POST() {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: lojista } = await supabase
    .from('lojistas')
    .select('id, endereco_base, endereco_latitude, endereco_longitude, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep')
    .eq('user_id', user.id)
    .single()

  const lojistaRow = lojista as Database['public']['Tables']['lojistas']['Row'] | null
  const lojistaId = lojistaRow?.id

  if (!lojistaId) {
    return NextResponse.json({ error: 'Lojista not found' }, { status: 404 })
  }

  const { data: pedidos } = await supabase
    .from('mercadolivre_pedidos')
    .select('*')
    .eq('lojista_id', lojistaId)
    .eq('selected', true)
    .is('imported_at', null)

  const pedidosRows = (pedidos as Database['public']['Tables']['mercadolivre_pedidos']['Row'][] | null) || []

  if (pedidosRows.length === 0) {
    return NextResponse.json({ error: 'No selected orders' }, { status: 400 })
  }

  const importedIds: string[] = []

  for (const pedido of pedidosRows) {
    const pickupCoords = normalizeCoords(pedido.coleta_latitude, pedido.coleta_longitude)
    const deliveryCoords = normalizeCoords(pedido.latitude, pedido.longitude)
    const distanciaTotalKm =
      pickupCoords && deliveryCoords
        ? calculateDistance(pickupCoords.lat, pickupCoords.lng, deliveryCoords.lat, deliveryCoords.lng)
        : 0

    const totalPacotes = pedido.pacotes || 1
    const valorTotal = calculateDeliveryPrice(totalPacotes, distanciaTotalKm)

    const corridaPayload: Database['public']['Tables']['corridas']['Insert'] = {
      lojista_id: lojistaId,
      plataforma: 'ml_flex',
      status: 'aguardando',
      valor_total: valorTotal,
      valor_reservado: valorTotal,
      codigo_entrega: generateCode(6),
      total_pacotes: totalPacotes,
      distancia_total_km: distanciaTotalKm,
      endereco_coleta: pedido.coleta_endereco || lojistaRow?.endereco_base || '',
      coleta_latitude: pickupCoords?.lat || lojistaRow?.endereco_latitude || 0,
      coleta_longitude: pickupCoords?.lng || lojistaRow?.endereco_longitude || 0,
      coleta_complemento: null,
      coleta_observacoes: null,
      coleta_logradouro: lojistaRow?.endereco_logradouro || null,
      coleta_numero: lojistaRow?.endereco_numero || null,
      coleta_bairro: lojistaRow?.endereco_bairro || null,
      coleta_cidade: lojistaRow?.endereco_cidade || null,
      coleta_uf: lojistaRow?.endereco_uf || null,
      coleta_cep: lojistaRow?.endereco_cep || null,
      frete_valor: valorTotal,
      peso_kg: null,
      volume_cm3: null,
    }

    const { data: corrida, error: corridaError } = await (supabase as any)
      .from('corridas')
      .insert(corridaPayload)
      .select()
      .single()

    const corridaRow = corrida as Database['public']['Tables']['corridas']['Row'] | null

    if (corridaError || !corridaRow) {
      return NextResponse.json({ error: 'Failed to create corrida', details: corridaError }, { status: 500 })
    }

    const enderecoPayload: Database['public']['Tables']['enderecos_entrega']['Insert'] = {
      corrida_id: corridaRow.id,
      endereco: pedido.endereco || '',
      latitude: pedido.latitude || 0,
      longitude: pedido.longitude || 0,
      complemento: pedido.complemento || null,
      observacoes: pedido.observacoes || null,
        pacotes: totalPacotes,
        ordem: 0,
        codigo_confirmacao: generateCode(6),
        logradouro: null,
        numero: null,
        bairro: pedido.bairro || null,
        cidade: pedido.cidade || null,
        uf: pedido.uf || null,
        cep: pedido.cep || null,
      receiver_name: pedido.receiver_name || pedido.buyer_name || null,
      receiver_phone: pedido.receiver_phone || null,
      peso_kg: null,
      volume_cm3: null,
    }

    const { error: enderecosError } = await (supabase as any)
      .from('enderecos_entrega')
      .insert(enderecoPayload)

    if (enderecosError) {
      return NextResponse.json({ error: 'Failed to create endereco', details: enderecosError }, { status: 500 })
    }

    await (supabase as any)
      .from('mercadolivre_pedidos')
      .update({ selected: false, imported_at: new Date().toISOString() })
      .eq('id', pedido.id)

    importedIds.push(corridaRow.id)
  }

  return NextResponse.json({ ok: true, imported: importedIds.length })
}
