-- Enums
CREATE TYPE user_type AS ENUM ('lojista', 'entregador');
CREATE TYPE user_status AS ENUM ('pendente', 'ativo', 'bloqueado');
CREATE TYPE corrida_status AS ENUM ('aguardando', 'aceita', 'coletando', 'em_entrega', 'finalizada', 'cancelada');
CREATE TYPE plataforma AS ENUM ('ml_flex', 'shopee_direta');
CREATE TYPE tipo_financeiro AS ENUM ('deposito', 'saque', 'corrida', 'multa', 'estorno');
CREATE TYPE endereco_status AS ENUM ('pendente', 'entregue', 'problema');

-- Users (extends auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    whatsapp VARCHAR(20) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    tipo user_type NOT NULL,
    status user_status DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entregadores
CREATE TABLE entregadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    foto_url TEXT,
    cnh_url TEXT,
    tipo_veiculo VARCHAR(50) DEFAULT 'moto',
    placa VARCHAR(10) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    uf VARCHAR(2) NOT NULL,
    online BOOLEAN DEFAULT FALSE,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    avaliacao_media DECIMAL(3, 2) DEFAULT 5.00,
    total_avaliacoes INTEGER DEFAULT 0,
    saldo DECIMAL(10, 2) DEFAULT 0.00,
    total_entregas INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lojistas
CREATE TABLE lojistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    cnpj VARCHAR(18),
    foto_url TEXT,
    endereco_base TEXT,
    endereco_latitude DECIMAL(10, 8),
    endereco_longitude DECIMAL(11, 8),
    saldo DECIMAL(10, 2) DEFAULT 0.00,
    avaliacao_media DECIMAL(3, 2) DEFAULT 5.00,
    total_avaliacoes INTEGER DEFAULT 0,
    total_corridas INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Corridas
CREATE TABLE corridas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lojista_id UUID NOT NULL REFERENCES lojistas(id),
    entregador_id UUID REFERENCES entregadores(id),
    plataforma plataforma NOT NULL,
    status corrida_status DEFAULT 'aguardando',
    valor_total DECIMAL(10, 2) NOT NULL,
    valor_reservado DECIMAL(10, 2) DEFAULT 0.00,
    codigo_entrega VARCHAR(6) NOT NULL,
    total_pacotes INTEGER NOT NULL CHECK (total_pacotes > 0 AND total_pacotes <= 50),
    distancia_total_km DECIMAL(10, 2) NOT NULL,
    endereco_coleta TEXT NOT NULL,
    coleta_latitude DECIMAL(10, 8) NOT NULL,
    coleta_longitude DECIMAL(11, 8) NOT NULL,
    coleta_complemento TEXT,
    coleta_observacoes TEXT,
    aceita_em TIMESTAMPTZ,
    coletada_em TIMESTAMPTZ,
    finalizada_em TIMESTAMPTZ,
    cancelada_em TIMESTAMPTZ,
    motivo_cancelamento TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Endereços de entrega (destinos)
CREATE TABLE enderecos_entrega (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corrida_id UUID NOT NULL REFERENCES corridas(id) ON DELETE CASCADE,
    endereco TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    complemento TEXT,
    observacoes TEXT,
    pacotes INTEGER DEFAULT 1 CHECK (pacotes > 0 AND pacotes <= 50),
    ordem INTEGER DEFAULT 0,
    status endereco_status DEFAULT 'pendente',
    entregue_em TIMESTAMPTZ,
    codigo_confirmacao VARCHAR(6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financeiro
CREATE TABLE financeiro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tipo tipo_financeiro NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    saldo_anterior DECIMAL(10, 2) NOT NULL,
    saldo_posterior DECIMAL(10, 2) NOT NULL,
    descricao TEXT NOT NULL,
    corrida_id UUID REFERENCES corridas(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Avaliações
CREATE TABLE avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    corrida_id UUID NOT NULL REFERENCES corridas(id),
    avaliador_id UUID NOT NULL REFERENCES users(id),
    avaliado_id UUID NOT NULL REFERENCES users(id),
    nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(corrida_id, avaliador_id)
);

-- Notificações
CREATE TABLE notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_entregadores_online ON entregadores(online) WHERE online = TRUE;
CREATE INDEX idx_entregadores_location ON entregadores(latitude, longitude) WHERE online = TRUE;
CREATE INDEX idx_corridas_status ON corridas(status);
CREATE INDEX idx_corridas_lojista ON corridas(lojista_id);
CREATE INDEX idx_corridas_entregador ON corridas(entregador_id);
CREATE INDEX idx_financeiro_user ON financeiro(user_id);
CREATE INDEX idx_notificacoes_user ON notificacoes(user_id, lida);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entregadores_updated_at BEFORE UPDATE ON entregadores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lojistas_updated_at BEFORE UPDATE ON lojistas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_corridas_updated_at BEFORE UPDATE ON corridas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL,
    lon1 DECIMAL,
    lat2 DECIMAL,
    lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 6371; -- Earth radius in km
    dLat DECIMAL;
    dLon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dLat := RADIANS(lat2 - lat1);
    dLon := RADIANS(lon2 - lon1);
    a := SIN(dLat/2) * SIN(dLat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dLon/2) * SIN(dLon/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    RETURN R * c;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby online drivers
CREATE OR REPLACE FUNCTION find_nearby_entregadores(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_radius_km DECIMAL DEFAULT 10
) RETURNS TABLE (
    id UUID,
    user_id UUID,
    nome VARCHAR,
    foto_url TEXT,
    avaliacao_media DECIMAL,
    distancia_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.user_id,
        u.nome,
        e.foto_url,
        e.avaliacao_media,
        calculate_distance(p_latitude, p_longitude, e.latitude, e.longitude) as distancia_km
    FROM entregadores e
    JOIN users u ON e.user_id = u.id
    WHERE e.online = TRUE
      AND e.latitude IS NOT NULL
      AND e.longitude IS NOT NULL
      AND u.status = 'ativo'
      AND calculate_distance(p_latitude, p_longitude, e.latitude, e.longitude) <= p_radius_km
    ORDER BY distancia_km ASC;
END;
$$ LANGUAGE plpgsql;
