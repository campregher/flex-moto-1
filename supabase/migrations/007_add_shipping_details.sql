-- Add shipment details for display (weight, volume, freight, receiver info)

ALTER TABLE public.corridas
  ADD COLUMN frete_valor DECIMAL(10, 2),
  ADD COLUMN peso_kg DECIMAL(10, 2),
  ADD COLUMN volume_cm3 DECIMAL(10, 2);

ALTER TABLE public.enderecos_entrega
  ADD COLUMN receiver_name TEXT,
  ADD COLUMN receiver_phone TEXT,
  ADD COLUMN peso_kg DECIMAL(10, 2),
  ADD COLUMN volume_cm3 DECIMAL(10, 2);
