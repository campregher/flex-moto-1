import { create } from 'zustand'
import type { Tables, CorridaStatus, Plataforma } from '@/lib/database.types'

type Corrida = Tables<'corridas'>
type EnderecoEntrega = Tables<'enderecos_entrega'>

interface CorridaWithDetails extends Corrida {
  enderecos?: EnderecoEntrega[]
  lojista?: {
    user_id: string
    foto_url: string | null
    avaliacao_media: number
    user: {
      nome: string
      whatsapp: string
    }
  }
  entregador?: {
    user_id: string
    foto_url: string | null
    avaliacao_media: number
    latitude: number | null
    longitude: number | null
    user: {
      nome: string
      whatsapp: string
    }
  }
}

interface NewCorridaForm {
  plataforma: Plataforma
  endereco_coleta: string
  coleta_latitude: number
  coleta_longitude: number
  coleta_complemento: string
  coleta_observacoes: string
  enderecos: {
    endereco: string
    latitude: number
    longitude: number
    complemento: string
    observacoes: string
    pacotes: number
  }[]
}

interface CorridaState {
  corridasDisponiveis: CorridaWithDetails[]
  corridasAtivas: CorridaWithDetails[]
  corridaAtual: CorridaWithDetails | null
  newCorridaForm: NewCorridaForm
  
  setCorridasDisponiveis: (corridas: CorridaWithDetails[]) => void
  setCorridasAtivas: (corridas: CorridaWithDetails[]) => void
  setCorridaAtual: (corrida: CorridaWithDetails | null) => void
  updateCorridaForm: (data: Partial<NewCorridaForm>) => void
  addEnderecoToForm: () => void
  removeEnderecoFromForm: (index: number) => void
  updateEnderecoInForm: (index: number, data: Partial<NewCorridaForm['enderecos'][0]>) => void
  resetForm: () => void
}

const initialForm: NewCorridaForm = {
  plataforma: 'ml_flex',
  endereco_coleta: '',
  coleta_latitude: 0,
  coleta_longitude: 0,
  coleta_complemento: '',
  coleta_observacoes: '',
  enderecos: [
    {
      endereco: '',
      latitude: 0,
      longitude: 0,
      complemento: '',
      observacoes: '',
      pacotes: 1,
    }
  ]
}

export const useCorridaStore = create<CorridaState>((set) => ({
  corridasDisponiveis: [],
  corridasAtivas: [],
  corridaAtual: null,
  newCorridaForm: initialForm,
  
  setCorridasDisponiveis: (corridas) => set({ corridasDisponiveis: corridas }),
  
  setCorridasAtivas: (corridas) => set({ corridasAtivas: corridas }),
  
  setCorridaAtual: (corrida) => set({ corridaAtual: corrida }),
  
  updateCorridaForm: (data) => set((state) => ({
    newCorridaForm: { ...state.newCorridaForm, ...data }
  })),
  
  addEnderecoToForm: () => set((state) => ({
    newCorridaForm: {
      ...state.newCorridaForm,
      enderecos: [
        ...state.newCorridaForm.enderecos,
        {
          endereco: '',
          latitude: 0,
          longitude: 0,
          complemento: '',
          observacoes: '',
          pacotes: 1,
        }
      ]
    }
  })),
  
  removeEnderecoFromForm: (index) => set((state) => ({
    newCorridaForm: {
      ...state.newCorridaForm,
      enderecos: state.newCorridaForm.enderecos.filter((_, i) => i !== index)
    }
  })),
  
  updateEnderecoInForm: (index, data) => set((state) => ({
    newCorridaForm: {
      ...state.newCorridaForm,
      enderecos: state.newCorridaForm.enderecos.map((endereco, i) =>
        i === index  { ...endereco, ...data } : endereco
      )
    }
  })),
  
  resetForm: () => set({ newCorridaForm: initialForm })
}))
