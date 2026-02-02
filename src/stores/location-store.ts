import { create } from 'zustand'

interface LocationState {
  currentLocation: {
    lat: number
    lng: number
  } | null
  watchId: number | null
  isTracking: boolean
  error: string | null
  
  setCurrentLocation: (location: { lat: number; lng: number } | null) => void
  startTracking: () => void
  stopTracking: () => void
  setError: (error: string | null) => void
}

export const useLocationStore = create<LocationState>((set, get) => ({
  currentLocation: null,
  watchId: null,
  isTracking: false,
  error: null,
  
  setCurrentLocation: (location) => set({ currentLocation: location }),
  
  startTracking: () => {
    if (!navigator.geolocation) {
      set({ error: 'Geolocalização não suportada neste navegador' })
      return
    }
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        set({
          currentLocation: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          error: null,
        })
      },
      (error) => {
        let errorMessage = 'Erro ao obter localização'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível'
            break
          case error.TIMEOUT:
            errorMessage = 'Tempo esgotado ao obter localização'
            break
        }
        set({ error: errorMessage })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )
    
    set({ watchId, isTracking: true })
  },
  
  stopTracking: () => {
    const { watchId } = get()
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
    }
    set({ watchId: null, isTracking: false })
  },
  
  setError: (error) => set({ error }),
}))
