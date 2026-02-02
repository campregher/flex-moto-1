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

  if (!lojista) {
    return NextResponse.json({ error: 'Lojista not found' }, { status: 404 })
  }

  const { data: pedidos } = await supabase
    .from('mercadolivre_pedidos')
    .select('*')
    .eq('lojista_id', lojista.id)
    .eq('selected', true)
    .is('imported_at', null)

  if (!pedidos || pedidos.length === 0) {
    return NextResponse.json({ error: 'No selected orders' }, { status: 400 })
  }

  const importedIds: string[] = []

  for (const pedido of pedidos) {
    const pickupCoords = normalizeCoords(pedido.coleta_latitude, pedido.coleta_longitude)
    const deliveryCoords = normalizeCoords(pedido.latitude, pedido.longitude)
    const distanciaTotalKm =
      pickupCoords && deliveryCoords
        ? calculateDistance(pickupCoords.lat, pickupCoords.lng, deliveryCoords.lat, deliveryCoords.lng)
        : 0

    const totalPacotes = pedido.pacotes || 1
    const valorTotal = calculateDeliveryPrice(totalPacotes, distanciaTotalKm)

    const { data: corrida, error: corridaError } = await supabase
      .from('corridas')
      .insert({
        lojista_id: lojista.id,
        plataforma: 'ml_flex',
        status: 'aguardando',
        valor_total: valorTotal,
        valor_reservado: valorTotal,
        codigo_entrega: generateCode(6),
        total_pacotes: totalPacotes,
        distancia_total_km: distanciaTotalKm,
        endereco_coleta: pedido.coleta_endereco || lojista.endereco_base || '',
        coleta_latitude: pickupCoords?.lat || lojista.endereco_latitude || 0,
        coleta_longitude: pickupCoords?.lng || lojista.endereco_longitude || 0,
        coleta_complemento: null,
        coleta_observacoes: null,
        coleta_logradouro: lojista.endereco_logradouro || null,
        coleta_numero: lojista.endereco_numero || null,
        coleta_bairro: lojista.endereco_bairro || null,
        coleta_cidade: lojista.endereco_cidade || null,
        coleta_uf: lojista.endereco_uf || null,
        coleta_cep: lojista.endereco_cep || null,
        frete_valor: valorTotal,
        peso_kg: null,
        volume_cm3: null,
      })
      .select()
      .single()

    if (corridaError || !corrida) {
      return NextResponse.json({ error: 'Failed to create corrida', details: corridaError }, { status: 500 })
    }

    const { error: enderecosError } = await supabase
      .from('enderecos_entrega')
      .insert({
        corrida_id: corrida.id,
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
      })

    if (enderecosError) {
      return NextResponse.json({ error: 'Failed to create endereco', details: enderecosError }, { status: 500 })
    }

    await supabase
      .from('mercadolivre_pedidos')
      .update({ selected: false, imported_at: new Date().toISOString() })
      .eq('id', pedido.id)

    importedIds.push(corrida.id)
  }

  return NextResponse.json({ ok: true, imported: importedIds.length })
}
