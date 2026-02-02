-- Add structured address fields for coleta and entrega

ALTER TABLE lojistas
  ADD COLUMN endereco_logradouro VARCHAR(255),
  ADD COLUMN endereco_numero VARCHAR(50),
  ADD COLUMN endereco_bairro VARCHAR(120),
  ADD COLUMN endereco_cidade VARCHAR(120),
  ADD COLUMN endereco_uf VARCHAR(2),
  ADD COLUMN endereco_cep VARCHAR(20);

ALTER TABLE corridas
  ADD COLUMN coleta_logradouro VARCHAR(255),
  ADD COLUMN coleta_numero VARCHAR(50),
  ADD COLUMN coleta_bairro VARCHAR(120),
  ADD COLUMN coleta_cidade VARCHAR(120),
  ADD COLUMN coleta_uf VARCHAR(2),
  ADD COLUMN coleta_cep VARCHAR(20);

ALTER TABLE enderecos_entrega
  ADD COLUMN logradouro VARCHAR(255),
  ADD COLUMN numero VARCHAR(50),
  ADD COLUMN bairro VARCHAR(120),
  ADD COLUMN cidade VARCHAR(120),
  ADD COLUMN uf VARCHAR(2),
  ADD COLUMN cep VARCHAR(20);
