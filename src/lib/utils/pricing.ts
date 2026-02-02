// Pricing constants
export const PRICING = {
  MIN_VALUE_PER_PACKAGE: 10.00, // R$10,00 mínimo por pacote
  BASE_DISTANCE_KM: 20, // Até 20km é valor base
  EXTRA_KM_RATE: 1.00, // R$1,00 por km excedente
  CANCELLATION_FEE: 5.00, // Multa por cancelamento por atraso do lojista
  MAX_PACKAGES_PER_ADDRESS: 50,
  MAX_PACKAGES_TOTAL: 50,
  MAX_PACKAGE_SIZE_CM: 40,
  MAX_SIMULTANEOUS_ROUTES: 3,
  WAIT_TIME_MINUTES: 5, // Tempo de espera antes de poder cancelar
}

// Calculate delivery price
export function calculateDeliveryPrice(
  totalPackages: number,
  totalDistanceKm: number
): number {
  // Base value per package
  let baseValue = totalPackages * PRICING.MIN_VALUE_PER_PACKAGE

  // Add extra km charge if distance exceeds base
  if (totalDistanceKm > PRICING.BASE_DISTANCE_KM) {
    const extraKm = totalDistanceKm - PRICING.BASE_DISTANCE_KM
    baseValue += extraKm * PRICING.EXTRA_KM_RATE
  }

  return Math.round(baseValue * 100) / 100 // Round to 2 decimal places
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Calculate total distance for a route with multiple destinations
export function calculateRouteDistance(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[]
): number {
  if (destinations.length === 0) return 0

  let totalDistance = 0
  let currentPoint = origin

  // Calculate distance from origin to first destination, then between each destination
  for (const dest of destinations) {
    totalDistance += calculateDistance(
      currentPoint.lat,
      currentPoint.lng,
      dest.lat,
      dest.lng
    )
    currentPoint = dest
  }

  return Math.round(totalDistance * 100) / 100
}

// Validate if order is within limits
export function validateOrder(
  totalPackages: number,
  addresses: { packages: number }[]
): { valid: boolean; error?: string } {
  // Check total packages
  if (totalPackages > PRICING.MAX_PACKAGES_TOTAL) {
    return {
      valid: false,
      error: `Limite máximo de ${PRICING.MAX_PACKAGES_TOTAL} pacotes por corrida`
    }
  }

  // Check packages per address
  for (let i = 0; i < addresses.length; i++) {
    if (addresses[i].packages > PRICING.MAX_PACKAGES_PER_ADDRESS) {
      return {
        valid: false,
        error: `Endereço ${i + 1}: Limite máximo de ${PRICING.MAX_PACKAGES_PER_ADDRESS} pacotes por endereço`
      }
    }
  }

  return { valid: true }
}
