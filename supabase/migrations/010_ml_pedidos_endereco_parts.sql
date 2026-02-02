-- Add address parts to Mercado Livre synced orders

ALTER TABLE public.mercadolivre_pedidos
  ADD COLUMN IF NOT EXISTS logradouro TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT;
