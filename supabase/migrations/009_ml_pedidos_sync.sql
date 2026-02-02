-- Store Mercado Livre orders fetched for sync and pre-import edits

CREATE TABLE public.mercadolivre_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id UUID NOT NULL REFERENCES public.lojistas(id) ON DELETE CASCADE,
  ml_order_id BIGINT NOT NULL,
  ml_shipment_id BIGINT,
  order_status TEXT,
  shipping_status TEXT,
  buyer_name TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  endereco TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf VARCHAR(2),
  cep VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  pacotes INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  coleta_id UUID REFERENCES public.lojista_coletas(id) ON DELETE SET NULL,
  coleta_endereco TEXT,
  coleta_latitude DECIMAL(10, 8),
  coleta_longitude DECIMAL(11, 8),
  selected BOOLEAN DEFAULT FALSE,
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mercadolivre_pedidos_unique UNIQUE (lojista_id, ml_order_id)
);

ALTER TABLE public.mercadolivre_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view own ML pedidos" ON public.mercadolivre_pedidos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can insert own ML pedidos" ON public.mercadolivre_pedidos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can update own ML pedidos" ON public.mercadolivre_pedidos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can delete own ML pedidos" ON public.mercadolivre_pedidos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE INDEX idx_ml_pedidos_lojista ON public.mercadolivre_pedidos(lojista_id);
CREATE INDEX idx_ml_pedidos_selected ON public.mercadolivre_pedidos(lojista_id, selected);

CREATE TRIGGER update_ml_pedidos_updated_at BEFORE UPDATE ON public.mercadolivre_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
