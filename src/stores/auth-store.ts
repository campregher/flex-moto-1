import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tables, UserType } from '@/lib/database.types'

type User = Tables<'users'>
type Entregador = Tables<'entregadores'>
type Lojista = Tables<'lojistas'>

interface AuthState {
  user: User | null
  profile: Entregador | Lojista | null
  isLoading: boolean
  isAuthenticated: boolean
  
  setUser: (user: User | null) => void
  setProfile: (profile: Entregador | Lojista | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      isLoading: true,
      isAuthenticated: false,
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
        isLoading: false 
      }),
      
      setProfile: (profile) => set({ profile }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      logout: () => set({ 
        user: null, 
        profile: null, 
        isAuthenticated: false,
        isLoading: false 
      }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
)

// Helper functions
export function isEntregador(profile: Entregador | Lojista | null): profile is Entregador {
  return profile !== null && 'placa' in profile
}

export function isLojista(profile: Entregador | Lojista | null): profile is Lojista {
  return profile !== null && 'cnpj' in profile
}

export function getUserType(user: User | null): UserType | null {
  return user?.tipo ?? null
}
