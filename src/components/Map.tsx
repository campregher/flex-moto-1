'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps'

interface MapProps {
  center?: { lat: number; lng: number }
  zoom?: number
  markers?: {
    position: { lat: number; lng: number }
    title?: string
    icon?: 'pickup' | 'delivery' | 'driver'
  }[]
  driverLocation?: { lat: number; lng: number } | null
  showRoute?: boolean
  onMapLoad?: (map: google.maps.Map) => void
  className?: string
}

const markerIcons = {
  pickup: '📍',
  delivery: '📦',
  driver: '🏍️',
}

export function Map({
  center = { lat: -23.5505, lng: -46.6333 }, // São Paulo default
  zoom = 13,
  markers = [],
  driverLocation,
  showRoute = false,
  onMapLoad,
  className = '',
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const markersRef = useRef<google.maps.Marker[]>([])
  const driverMarkerRef = useRef<google.maps.Marker | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (mapRef.current && !map) {
        const newMap = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        })
        setMap(newMap)
        setIsLoaded(true)
        onMapLoad?.(newMap)
      }
    })
  }, [])

  // Update markers
  useEffect(() => {
    if (!map || !isLoaded) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    // Add new markers
    markers.forEach((markerData) => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map,
        title: markerData.title,
        label: {
          text: markerIcons[markerData.icon || 'delivery'],
          fontSize: '24px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
      })
      markersRef.current.push(marker)
    })

    // Fit bounds to show all markers
    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      markers.forEach((m) => bounds.extend(m.position))
      if (driverLocation) bounds.extend(driverLocation)
      map.fitBounds(bounds, 50)
    }
  }, [map, markers, isLoaded])

  // Update driver location marker
  useEffect(() => {
    if (!map || !isLoaded) return

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null)
    }

    if (driverLocation) {
      driverMarkerRef.current = new google.maps.Marker({
        position: driverLocation,
        map,
        label: {
          text: '🏍️',
          fontSize: '28px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
        zIndex: 999,
      })
    }
  }, [map, driverLocation, isLoaded])

  // Show route
  useEffect(() => {
    if (!map || !isLoaded || !showRoute || markers.length < 2) return

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
    }

    const directionsService = new google.maps.DirectionsService()
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    })
    directionsRendererRef.current = directionsRenderer

    const origin = markers[0].position
    const destination = markers[markers.length - 1].position
    const waypoints = markers.slice(1, -1).map((m) => ({
      location: m.position,
      stopover: true,
    }))

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result)
        }
      }
    )
  }, [map, markers, showRoute, isLoaded])

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full min-h-[300px] rounded-xl" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  )
}
