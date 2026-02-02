-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE lojistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE corridas ENABLE ROW LEVEL SECURITY;
ALTER TABLE enderecos_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Entregadores policies
CREATE POLICY "Entregadores can view own profile" ON entregadores
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Entregadores can update own profile" ON entregadores
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for entregadores" ON entregadores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Lojistas can view entregadores" ON entregadores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'lojista'
        )
    );

-- Lojistas policies
CREATE POLICY "Lojistas can view own profile" ON lojistas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Lojistas can update own profile" ON lojistas
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for lojistas" ON lojistas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Entregadores can view lojistas" ON lojistas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'entregador'
        )
    );

-- Corridas policies
CREATE POLICY "Lojistas can view own corridas" ON corridas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lojistas WHERE id = lojista_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Entregadores can view available and own corridas" ON corridas
    FOR SELECT USING (
        (status = 'aguardando' AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'entregador'
        ))
        OR
        EXISTS (
            SELECT 1 FROM entregadores WHERE id = entregador_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Lojistas can create corridas" ON corridas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM lojistas WHERE id = lojista_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Lojistas can update own corridas" ON corridas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM lojistas WHERE id = lojista_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Entregadores can update accepted corridas" ON corridas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM entregadores WHERE id = entregador_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Entregadores can accept corridas" ON corridas
    FOR UPDATE USING (
        status = 'aguardando'
        AND entregador_id IS NULL
        AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND tipo = 'entregador'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM entregadores WHERE user_id = auth.uid() AND id = entregador_id
        )
    );

-- Endereços de entrega policies
CREATE POLICY "View enderecos for own corridas" ON enderecos_entrega
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM corridas c
            JOIN lojistas l ON c.lojista_id = l.id
            WHERE c.id = corrida_id AND l.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM corridas c
            JOIN entregadores e ON c.entregador_id = e.id
            WHERE c.id = corrida_id AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "Create enderecos for own corridas" ON enderecos_entrega
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM corridas c
            JOIN lojistas l ON c.lojista_id = l.id
            WHERE c.id = corrida_id AND l.user_id = auth.uid()
        )
    );

CREATE POLICY "Update enderecos for assigned corridas" ON enderecos_entrega
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM corridas c
            JOIN entregadores e ON c.entregador_id = e.id
            WHERE c.id = corrida_id AND e.user_id = auth.uid()
        )
    );

-- Financeiro policies
CREATE POLICY "Users can view own financeiro" ON financeiro
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert financeiro" ON financeiro
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Avaliações policies
CREATE POLICY "Users can view avaliacoes for own corridas" ON avaliacoes
    FOR SELECT USING (auth.uid() = avaliador_id OR auth.uid() = avaliado_id);

CREATE POLICY "Users can create avaliacoes" ON avaliacoes
    FOR INSERT WITH CHECK (auth.uid() = avaliador_id);

-- Notificações policies
CREATE POLICY "Users can view own notificacoes" ON notificacoes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notificacoes" ON notificacoes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notificacoes" ON notificacoes
    FOR INSERT WITH CHECK (auth.role() = 'service_role');
