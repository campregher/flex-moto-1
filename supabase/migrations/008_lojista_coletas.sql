-- Multiple pickup addresses for lojista (up to 4 enforced by app)

CREATE TABLE public.lojista_coletas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id UUID NOT NULL REFERENCES public.lojistas(id) ON DELETE CASCADE,
  label VARCHAR(60),
  endereco TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  logradouro VARCHAR(255),
  numero VARCHAR(50),
  bairro VARCHAR(120),
  cidade VARCHAR(120),
  uf VARCHAR(2),
  cep VARCHAR(20),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lojista_coletas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view own coletas" ON public.lojista_coletas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can insert own coletas" ON public.lojista_coletas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "Lojistas can update own coletas" ON public.lojista_coletas
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

CREATE POLICY "Lojistas can delete own coletas" ON public.lojista_coletas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lojistas l
      WHERE l.id = lojista_id AND l.user_id = auth.uid()
    )
  );

CREATE INDEX idx_lojista_coletas_lojista ON public.lojista_coletas(lojista_id);

CREATE TRIGGER update_lojista_coletas_updated_at BEFORE UPDATE ON public.lojista_coletas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
