-- Mercado Livre integrations per lojista

CREATE TABLE public.mercadolivre_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id UUID NOT NULL REFERENCES public.lojistas(id) ON DELETE CASCADE,
  ml_user_id BIGINT NOT NULL,
  site_id VARCHAR(10) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lojista_id)
);

ALTER TABLE public.mercadolivre_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view own ML integration" ON public.mercadolivre_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can insert own ML integration" ON public.mercadolivre_integrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can update own ML integration" ON public.mercadolivre_integrations
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

CREATE INDEX idx_ml_integrations_lojista ON public.mercadolivre_integrations(lojista_id);

CREATE TRIGGER update_ml_integrations_updated_at BEFORE UPDATE ON public.mercadolivre_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
