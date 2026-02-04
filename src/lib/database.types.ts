export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
        users: {
          Row: {
            id: string
            nome: string
            email: string
            whatsapp: string
            cpf: string | null
            tipo: Database['public']['Enums']['user_type']
            tipo_pessoa: Database['public']['Enums']['user_person_type']
            razao_social: string | null
            status: Database['public']['Enums']['user_status'] | null
            created_at: string | null
            updated_at: string | null
            is_admin: boolean | null
          }
          Insert: {
            id: string
            nome: string
            email: string
            whatsapp: string
            cpf: string | null
            tipo: Database['public']['Enums']['user_type']
            tipo_pessoa: Database['public']['Enums']['user_person_type']
            razao_social: string | null
            status: Database['public']['Enums']['user_status'] | null
            created_at: string | null
            updated_at: string | null
            is_admin: boolean | null
          }
          Update: {
            id: string
            nome: string
            email: string
            whatsapp: string
            cpf: string | null
            tipo: Database['public']['Enums']['user_type']
            tipo_pessoa: Database['public']['Enums']['user_person_type']
            razao_social: string | null
            status: Database['public']['Enums']['user_status'] | null
            created_at: string | null
            updated_at: string | null
            is_admin: boolean | null
          }
        Relationships: []
      }
      entregadores: {
        Row: {
          id: string
          user_id: string
          foto_url: string | null
          cnh_url: string | null
          tipo_veiculo: string | null
          placa: string
          cidade: string
          uf: string
          online: boolean | null
          latitude: number | null
          longitude: number | null
          avaliacao_media: number | null
          total_avaliacoes: number | null
          saldo: number | null
          total_entregas: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          user_id: string
          foto_url: string | null
          cnh_url: string | null
          tipo_veiculo: string | null
          placa: string
          cidade: string
          uf: string
          online: boolean | null
          latitude: number | null
          longitude: number | null
          avaliacao_media: number | null
          total_avaliacoes: number | null
          saldo: number | null
          total_entregas: number | null
          created_at: string | null
          updated_at: string | null
        }
        Update: {
          id: string
          user_id: string
          foto_url: string | null
          cnh_url: string | null
          tipo_veiculo: string | null
          placa: string
          cidade: string
          uf: string
          online: boolean | null
          latitude: number | null
          longitude: number | null
          avaliacao_media: number | null
          total_avaliacoes: number | null
          saldo: number | null
          total_entregas: number | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      lojistas: {
        Row: {
          id: string
          user_id: string
          cnpj: string | null
          foto_url: string | null
          endereco_base: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_uf: string | null
          endereco_cep: string | null
          saldo: number | null
          avaliacao_media: number | null
          total_avaliacoes: number | null
          total_corridas: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          user_id: string
          cnpj: string | null
          foto_url: string | null
          endereco_base: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_uf: string | null
          endereco_cep: string | null
          saldo: number | null
          avaliacao_media: number | null
          total_avaliacoes: number | null
          total_corridas: number | null
          created_at: string | null
          updated_at: string | null
        }
        Update: {
          id: string
          user_id: string
          cnpj: string | null
          foto_url: string | null
          endereco_base: string | null
          endereco_latitude: number | null
          endereco_longitude: number | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_uf: string | null
          endereco_cep: string | null
          saldo: number | null
          avaliacao_media: number | null
          total_avaliacoes: number | null
          total_corridas: number | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      corridas: {
        Row: {
          id: string
          lojista_id: string
          entregador_id: string | null
          plataforma: Database['public']['Enums']['plataforma']
          status: Database['public']['Enums']['corrida_status'] | null
          valor_total: number
          valor_reservado: number | null
          codigo_entrega: string
          total_pacotes: number
          distancia_total_km: number
          endereco_coleta: string
          coleta_latitude: number
          coleta_longitude: number
          coleta_complemento: string | null
          coleta_observacoes: string | null
          coleta_logradouro: string | null
          coleta_numero: string | null
          coleta_bairro: string | null
          coleta_cidade: string | null
          coleta_uf: string | null
          coleta_cep: string | null
          frete_valor: number | null
          peso_kg: number | null
          volume_cm3: number | null
          aceita_em: string | null
          coletada_em: string | null
          finalizada_em: string | null
          cancelada_em: string | null
          motivo_cancelamento: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          lojista_id: string
          entregador_id: string | null
          plataforma: Database['public']['Enums']['plataforma']
          status: Database['public']['Enums']['corrida_status'] | null
          valor_total: number
          valor_reservado: number | null
          codigo_entrega: string
          total_pacotes: number
          distancia_total_km: number
          endereco_coleta: string
          coleta_latitude: number
          coleta_longitude: number
          coleta_complemento: string | null
          coleta_observacoes: string | null
          coleta_logradouro: string | null
          coleta_numero: string | null
          coleta_bairro: string | null
          coleta_cidade: string | null
          coleta_uf: string | null
          coleta_cep: string | null
          frete_valor: number | null
          peso_kg: number | null
          volume_cm3: number | null
          aceita_em: string | null
          coletada_em: string | null
          finalizada_em: string | null
          cancelada_em: string | null
          motivo_cancelamento: string | null
          created_at: string | null
          updated_at: string | null
        }
        Update: {
          id: string
          lojista_id: string
          entregador_id: string | null
          plataforma: Database['public']['Enums']['plataforma']
          status: Database['public']['Enums']['corrida_status'] | null
          valor_total: number
          valor_reservado: number | null
          codigo_entrega: string
          total_pacotes: number
          distancia_total_km: number
          endereco_coleta: string
          coleta_latitude: number
          coleta_longitude: number
          coleta_complemento: string | null
          coleta_observacoes: string | null
          coleta_logradouro: string | null
          coleta_numero: string | null
          coleta_bairro: string | null
          coleta_cidade: string | null
          coleta_uf: string | null
          coleta_cep: string | null
          frete_valor: number | null
          peso_kg: number | null
          volume_cm3: number | null
          aceita_em: string | null
          coletada_em: string | null
          finalizada_em: string | null
          cancelada_em: string | null
          motivo_cancelamento: string | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      enderecos_entrega: {
        Row: {
          id: string
          corrida_id: string
          endereco: string
          latitude: number
          longitude: number
          complemento: string | null
          observacoes: string | null
          pacotes: number | null
          ordem: number | null
          status: Database['public']['Enums']['endereco_status'] | null
          entregue_em: string | null
          codigo_confirmacao: string
          created_at: string | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          receiver_name: string | null
          receiver_phone: string | null
          peso_kg: number | null
          volume_cm3: number | null
        }
        Insert: {
          id: string
          corrida_id: string
          endereco: string
          latitude: number
          longitude: number
          complemento: string | null
          observacoes: string | null
          pacotes: number | null
          ordem: number | null
          status: Database['public']['Enums']['endereco_status'] | null
          entregue_em: string | null
          codigo_confirmacao: string
          created_at: string | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          receiver_name: string | null
          receiver_phone: string | null
          peso_kg: number | null
          volume_cm3: number | null
        }
        Update: {
          id: string
          corrida_id: string
          endereco: string
          latitude: number
          longitude: number
          complemento: string | null
          observacoes: string | null
          pacotes: number | null
          ordem: number | null
          status: Database['public']['Enums']['endereco_status'] | null
          entregue_em: string | null
          codigo_confirmacao: string
          created_at: string | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          receiver_name: string | null
          receiver_phone: string | null
          peso_kg: number | null
          volume_cm3: number | null
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          id: string
          user_id: string
          tipo: Database['public']['Enums']['tipo_financeiro']
          valor: number
          saldo_anterior: number
          saldo_posterior: number
          descricao: string
          corrida_id: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          user_id: string
          tipo: Database['public']['Enums']['tipo_financeiro']
          valor: number
          saldo_anterior: number
          saldo_posterior: number
          descricao: string
          corrida_id: string | null
          created_at: string | null
        }
        Update: {
          id: string
          user_id: string
          tipo: Database['public']['Enums']['tipo_financeiro']
          valor: number
          saldo_anterior: number
          saldo_posterior: number
          descricao: string
          corrida_id: string | null
          created_at: string | null
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          id: string
          corrida_id: string
          avaliador_id: string
          avaliado_id: string
          nota: number
          comentario: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          corrida_id: string
          avaliador_id: string
          avaliado_id: string
          nota: number
          comentario: string | null
          created_at: string | null
        }
        Update: {
          id: string
          corrida_id: string
          avaliador_id: string
          avaliado_id: string
          nota: number
          comentario: string | null
          created_at: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          id: string
          user_id: string
          titulo: string
          mensagem: string
          tipo: string
          lida: boolean | null
          dados: Json | null
          created_at: string | null
        }
        Insert: {
          id: string
          user_id: string
          titulo: string
          mensagem: string
          tipo: string
          lida: boolean | null
          dados: Json | null
          created_at: string | null
        }
        Update: {
          id: string
          user_id: string
          titulo: string
          mensagem: string
          tipo: string
          lida: boolean | null
          dados: Json | null
          created_at: string | null
        }
        Relationships: []
      }
      mercadolivre_integrations: {
        Row: {
          id: string
          lojista_id: string
          ml_user_id: number
          site_id: string
          access_token: string
          refresh_token: string | null
          expires_at: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          lojista_id: string
          ml_user_id: number
          site_id: string
          access_token: string
          refresh_token: string | null
          expires_at: string
          created_at: string | null
          updated_at: string | null
        }
        Update: {
          id: string
          lojista_id: string
          ml_user_id: number
          site_id: string
          access_token: string
          refresh_token: string | null
          expires_at: string
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      lojista_coletas: {
        Row: {
          id: string
          lojista_id: string
          label: string | null
          endereco: string
          latitude: number | null
          longitude: number | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          is_default: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          lojista_id: string
          label: string | null
          endereco: string
          latitude: number | null
          longitude: number | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          is_default: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Update: {
          id: string
          lojista_id: string
          label: string | null
          endereco: string
          latitude: number | null
          longitude: number | null
          logradouro: string | null
          numero: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          is_default: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      mercadolivre_pedidos: {
        Row: {
          id: string
          lojista_id: string
          corrida_id: string | null
          import_status: string | null
          ml_retries: number | null
          ml_order_id: number
          ml_shipment_id: number | null
          order_status: string | null
          shipping_status: string | null
          buyer_name: string | null
          receiver_name: string | null
          receiver_phone: string | null
          endereco: string | null
          logradouro: string | null
          numero: string | null
          complemento: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          latitude: number | null
          longitude: number | null
          pacotes: number
          observacoes: string | null
          coleta_id: string | null
          coleta_endereco: string | null
          coleta_latitude: number | null
          coleta_longitude: number | null
          selected: boolean | null
          imported_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          lojista_id: string
          corrida_id: string | null
          import_status: string | null
          ml_retries: number | null
          ml_order_id: number
          ml_shipment_id: number | null
          order_status: string | null
          shipping_status: string | null
          buyer_name: string | null
          receiver_name: string | null
          receiver_phone: string | null
          endereco: string | null
          logradouro: string | null
          numero: string | null
          complemento: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          latitude: number | null
          longitude: number | null
          pacotes: number
          observacoes: string | null
          coleta_id: string | null
          coleta_endereco: string | null
          coleta_latitude: number | null
          coleta_longitude: number | null
          selected: boolean | null
          imported_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Update: {
          id: string
          lojista_id: string
          corrida_id: string | null
          import_status: string | null
          ml_retries: number | null
          ml_order_id: number
          ml_shipment_id: number | null
          order_status: string | null
          shipping_status: string | null
          buyer_name: string | null
          receiver_name: string | null
          receiver_phone: string | null
          endereco: string | null
          logradouro: string | null
          numero: string | null
          complemento: string | null
          bairro: string | null
          cidade: string | null
          uf: string | null
          cep: string | null
          latitude: number | null
          longitude: number | null
          pacotes: number
          observacoes: string | null
          coleta_id: string | null
          coleta_endereco: string | null
          coleta_latitude: number | null
          coleta_longitude: number | null
          selected: boolean | null
          imported_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Enums: {
      user_type: 'lojista' | 'entregador' | 'admin'
      user_person_type: 'pf' | 'pj'
      user_status: 'pendente' | 'ativo' | 'bloqueado'
      corrida_status: 'aguardando' | 'aceita' | 'coletando' | 'em_entrega' | 'finalizada' | 'cancelada'
      plataforma: 'ml_flex' | 'shopee_direta'
      tipo_financeiro: 'deposito' | 'saque' | 'corrida' | 'multa' | 'estorno'
      endereco_status: 'pendente' | 'entregue' | 'problema'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

export type UserType = Enums<'user_type'>
export type UserPersonType = Enums<'user_person_type'>
export type UserStatus = Enums<'user_status'>
export type CorridaStatus = Enums<'corrida_status'>
export type Plataforma = Enums<'plataforma'>
export type TipoFinanceiro = Enums<'tipo_financeiro'>
export type EnderecoStatus = Enums<'endereco_status'>
