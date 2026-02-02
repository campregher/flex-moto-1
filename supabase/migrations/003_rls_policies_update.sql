-- Tighten UPDATE policies with WITH CHECK so users can only write their own rows
ALTER POLICY "Users can update own profile" ON users
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER POLICY "Entregadores can update own profile" ON entregadores
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Lojistas can update own profile" ON lojistas
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Lojistas can update own corridas" ON corridas
  USING (
    EXISTS (
      SELECT 1 FROM lojistas WHERE id = lojista_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lojistas WHERE id = lojista_id AND user_id = auth.uid()
    )
  );

ALTER POLICY "Entregadores can update accepted corridas" ON corridas
  USING (
    EXISTS (
      SELECT 1 FROM entregadores WHERE id = entregador_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entregadores WHERE id = entregador_id AND user_id = auth.uid()
    )
  );

ALTER POLICY "Update enderecos for assigned corridas" ON enderecos_entrega
  USING (
    EXISTS (
      SELECT 1 FROM corridas c
      JOIN entregadores e ON c.entregador_id = e.id
      WHERE c.id = corrida_id AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM corridas c
      JOIN entregadores e ON c.entregador_id = e.id
      WHERE c.id = corrida_id AND e.user_id = auth.uid()
    )
  );

ALTER POLICY "Users can update own notificacoes" ON notificacoes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
