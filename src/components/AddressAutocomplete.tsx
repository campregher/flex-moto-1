'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '@/lib/google-maps'

export type AddressDetails = {
  formattedAddress: string
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  lat: number | null
  lng: number | null
}

type AddressAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onSelect: (details: AddressDetails) => void
  placeholder: string
  className: string
  id: string
  name: string
  disabled: boolean
  country: string | string[]
  autoComplete: string
  preferLegacy: boolean
  enableLiveGeocode: boolean
}

function getComponent(components: google.maps.GeocoderAddressComponent[], type: string) {
  return components.find((component) => component.types.includes(type))
}

function getPlaceComponent(
  components: google.maps.places.AddressComponent[] | undefined,
  type: string
) {
  return components?.find((component) => component.types.includes(type))
}

function parsePlace(place: google.maps.places.PlaceResult): AddressDetails {
  const components = place.address_components || []
  const street = getComponent(components, 'route')?.long_name ?? null
  const number = getComponent(components, 'street_number')?.long_name ?? null
  const neighborhood =
    getComponent(components, 'sublocality_level_1')?.long_name ||
    getComponent(components, 'sublocality')?.long_name ||
    getComponent(components, 'neighborhood')?.long_name ||
    null
  const city =
    getComponent(components, 'locality')?.long_name ||
    getComponent(components, 'administrative_area_level_2')?.long_name ||
    getComponent(components, 'administrative_area_level_3')?.long_name ||
    null
  const state =
    getComponent(components, 'administrative_area_level_1')?.short_name ||
    getComponent(components, 'administrative_area_level_1')?.long_name ||
    null
  const postalCode = getComponent(components, 'postal_code')?.long_name ?? null
  const formattedAddress =
    place.formatted_address ||
    [street, number, neighborhood, city, state, postalCode].filter(Boolean).join(', ')

  const location = place.geometry?.location
  const lat = location ? location.lat() : null
  const lng = location ? location.lng() : null

  return {
    formattedAddress,
    street,
    number,
    neighborhood,
    city,
    state,
    postalCode,
    lat,
    lng,
  }
}

function parsePlaceFromPlace(place: google.maps.places.Place): AddressDetails {
  const components = place.addressComponents || []
  const street = getPlaceComponent(components, 'route')?.longText ?? null
  const number = getPlaceComponent(components, 'street_number')?.longText ?? null
  const neighborhood =
    getPlaceComponent(components, 'sublocality_level_1')?.longText ||
    getPlaceComponent(components, 'sublocality')?.longText ||
    getPlaceComponent(components, 'neighborhood')?.longText ||
    null
  const city =
    getPlaceComponent(components, 'locality')?.longText ||
    getPlaceComponent(components, 'administrative_area_level_2')?.longText ||
    getPlaceComponent(components, 'administrative_area_level_3')?.longText ||
    null
  const state =
    getPlaceComponent(components, 'administrative_area_level_1')?.shortText ||
    getPlaceComponent(components, 'administrative_area_level_1')?.longText ||
    null
  const postalCode = getPlaceComponent(components, 'postal_code')?.longText ?? null
  const formattedAddress =
    place.formattedAddress ||
    [street, number, neighborhood, city, state, postalCode].filter(Boolean).join(', ')

  const location = place.location as google.maps.LatLng | google.maps.LatLngLiteral | undefined
  const lat = location
    ? typeof location.lat === 'function'
      ? location.lat()
      : location.lat
    : null
  const lng = location
    ? typeof location.lng === 'function'
      ? location.lng()
      : location.lng
    : null

  return {
    formattedAddress,
    street,
    number,
    neighborhood,
    city,
    state,
    postalCode,
    lat,
    lng,
  }
}

function normalizeCountries(country: string | string[]) {
  if (!country) return undefined
  return Array.isArray(country)
    ? country.map((code) => code.toUpperCase())
    : [country.toUpperCase()]
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  id,
  name,
  disabled,
  country = 'br',
  autoComplete = 'street-address',
  preferLegacy = false,
  enableLiveGeocode = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const placeContainerRef = useRef<HTMLDivElement | null>(null)
  const placeElementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null)
  const onChangeRef = useRef(onChange)
  const onSelectRef = useRef(onSelect)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const lastSelectedRef = useRef<AddressDetails | null>(null)
  const lastValueRef = useRef<string>('')
  const geocodeTimeoutRef = useRef<number | null>(null)
  const lastGeocodeValueRef = useRef<string>('')
  const [usePlaceElement, setUsePlaceElement] = useState(false)
  const normalizedCountries = normalizeCountries(country)

  useEffect(() => {
    onChangeRef.current = onChange
    onSelectRef.current = onSelect
  }, [onChange, onSelect])

  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) {
        window.clearTimeout(geocodeTimeoutRef.current)
      }
    }
  }, [])

  const scheduleLiveGeocode = (rawValue: string) => {
    if (!enableLiveGeocode || !rawValue.trim()) return
    const value = rawValue.trim()
    if (value.length < 5) return

    if (
      lastSelectedRef.current?.formattedAddress &&
      lastSelectedRef.current?.formattedAddress === value
    ) {
      return
    }

    if (geocodeTimeoutRef.current) {
      window.clearTimeout(geocodeTimeoutRef.current)
    }

    geocodeTimeoutRef.current = window.setTimeout(() => {
      if (!geocoderRef.current) return
      if (lastGeocodeValueRef.current === value) return
      lastGeocodeValueRef.current = value

        geocoderRef.current.geocode(
          {
            address: value,
            componentRestrictions: normalizedCountries ? { country: normalizedCountries[0] } : undefined,
          },
          (results, status) => {
          if (status !== 'OK' || !results || results.length === 0) return
          const details = parsePlace(results[0])
          if (details.formattedAddress) {
            onChangeRef.current(details.formattedAddress)
            lastValueRef.current = details.formattedAddress
          } else {
            lastValueRef.current = value
          }
          lastSelectedRef.current = details
          onSelectRef.current(details)
        }
      )
    }, 700)
  }

  useEffect(() => {
    let listener: google.maps.MapsEventListener | null = null
    let active = true
    let placeSelectHandler: ((event: any) => void) | null = null
    let placeInputHandler: ((event: Event) => void) | null = null
    let placeBlurHandler: ((event: Event) => void) | null = null
    let internalInput: HTMLInputElement | null = null
    let internalInputHandler: ((event: Event) => void) | null = null

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return

    loadGoogleMaps()
      .then(async () => {
        if (!active) return

        try {
          await google.maps.importLibrary('places')
        } catch {
          // If importLibrary fails, fall back to legacy autocomplete.
        }

        if (!geocoderRef.current) {
          geocoderRef.current = new google.maps.Geocoder()
        }

        if (
          !preferLegacy &&
          !placeElementRef.current &&
          containerRef.current &&
          google.maps.places.PlaceAutocompleteElement
        ) {
          const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({})

          if (normalizedCountries) {
            ;(placeAutocomplete as any).includedRegionCodes = normalizedCountries
          }

          if (id) placeAutocomplete.id = id
          if (name) placeAutocomplete.name = name
          if (className) placeAutocomplete.className = className
          if (placeholder) placeAutocomplete.setAttribute('placeholder', placeholder)
          if (value) {
            ;(placeAutocomplete as any).value = value
            placeAutocomplete.setAttribute('value', value)
          }
          placeAutocomplete.style.display = 'block'
          placeAutocomplete.style.width = '100%'
          placeAutocomplete.style.backgroundColor = '#ffffff'
          placeAutocomplete.style.color = '#111827'
          placeAutocomplete.style.border = '1px solid #d1d5db'
          placeAutocomplete.style.borderRadius = '0.5rem'
          placeAutocomplete.style.padding = '0.625rem 1rem'
          ;(placeAutocomplete.style as any).colorScheme = 'light'

          placeInputHandler = () => {
            const currentValue = (placeAutocomplete as any).value || ''
            lastValueRef.current = currentValue
            onChangeRef.current(currentValue)
            scheduleLiveGeocode(currentValue)
          }

          placeBlurHandler = () => {
            const currentValue = (placeAutocomplete as any).value || ''
            if (!currentValue || !onSelectRef.current) return

            if (
              lastSelectedRef.current?.formattedAddress &&
              lastSelectedRef.current?.formattedAddress === currentValue
            ) {
              return
            }

            if (!geocoderRef.current) return
            geocoderRef.current.geocode(
              {
                address: currentValue,
                componentRestrictions: normalizedCountries ? { country: normalizedCountries[0] } : undefined,
              },
              (results, status) => {
                if (status !== 'OK' || !results || results.length === 0) return
                const details = parsePlace(results[0])
                if (details.formattedAddress) {
                  onChangeRef.current(details.formattedAddress)
                  lastValueRef.current = details.formattedAddress
                } else {
                  lastValueRef.current = currentValue
                }
                lastSelectedRef.current = details
                onSelectRef.current(details)
              }
            )
          }

          placeSelectHandler = async (event: any) => {
            const placePrediction = event.placePrediction
            if (!placePrediction) return
            const place = placePrediction.toPlace()
            await place.fetchFields({
              fields: ['formattedAddress', 'addressComponents', 'location'],
            })

            const details = parsePlaceFromPlace(place)
            lastSelectedRef.current = details
            lastValueRef.current = details.formattedAddress || ''
            if (details.formattedAddress) {
              onChangeRef.current(details.formattedAddress)
            }
            onSelectRef.current(details)
          }

          placeAutocomplete.addEventListener('gmp-select', placeSelectHandler as EventListener)
          placeAutocomplete.addEventListener('input', placeInputHandler as EventListener)
          placeAutocomplete.addEventListener('change', placeInputHandler as EventListener)
          placeAutocomplete.addEventListener('blur', placeBlurHandler as EventListener)
          placeAutocomplete.addEventListener('focusout', placeBlurHandler as EventListener)

          // Try to bind directly to the internal input for live typing updates.
          window.setTimeout(() => {
            const shadowRoot = (placeAutocomplete as any).shadowRoot as ShadowRoot | undefined
            internalInput = shadowRoot?.querySelector('input') || null
            if (internalInput) {
              internalInputHandler = () => {
                const currentValue = internalInput?.value || ''
                lastValueRef.current = currentValue
                onChangeRef.current(currentValue)
                scheduleLiveGeocode(currentValue)
              }
              internalInput.addEventListener('input', internalInputHandler)
            }
          }, 0)

          placeContainerRef.current?.replaceChildren(placeAutocomplete)
          placeElementRef.current = placeAutocomplete
          setUsePlaceElement(true)
          return
        }

        if (!inputRef.current) return

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: normalizedCountries ? { country: normalizedCountries[0] } : undefined,
          fields: ['address_components', 'formatted_address', 'geometry'],
        })

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place) return

          const details = parsePlace(place)
          lastSelectedRef.current = details
          lastValueRef.current = details.formattedAddress || inputRef.current?.value || ''
          if (details.formattedAddress) {
            onChangeRef.current(details.formattedAddress)
          }
          onSelectRef.current(details)
        })
      })
      .catch(() => {
        // Keep input usable even if Google fails to load.
      })

    return () => {
      active = false
      if (listener) listener.remove()
      if (placeElementRef.current && placeSelectHandler) {
        placeElementRef.current.removeEventListener('gmp-select', placeSelectHandler as EventListener)
      }
      if (placeElementRef.current && placeInputHandler) {
        placeElementRef.current.removeEventListener('input', placeInputHandler as EventListener)
        placeElementRef.current.removeEventListener('change', placeInputHandler as EventListener)
      }
      if (placeElementRef.current && placeBlurHandler) {
        placeElementRef.current.removeEventListener('blur', placeBlurHandler as EventListener)
        placeElementRef.current.removeEventListener('focusout', placeBlurHandler as EventListener)
      }
      if (internalInput && internalInputHandler) {
        internalInput.removeEventListener('input', internalInputHandler)
      }
    }
  }, [className, country, enableLiveGeocode, id, name, placeholder, preferLegacy, value])

  const handleBlur = async () => {
    if (usePlaceElement && !preferLegacy) return
    const inputEl = inputRef.current
    if (!inputEl) return
    const value = inputEl.value.trim() || ''
    if (!value || !onSelectRef.current) return

    // If user already selected the same address from suggestions, skip.
    if (lastSelectedRef.current?.formattedAddress && lastValueRef.current === value) {
      return
    }

    if (!geocoderRef.current) return
    geocoderRef.current.geocode(
      {
        address: value,
        componentRestrictions: normalizedCountries ? { country: normalizedCountries[0] } : undefined,
      },
      (results, status) => {
        if (status !== 'OK' || !results || results.length === 0) return
        const details = parsePlace(results[0])
        if (details.formattedAddress) {
          onChangeRef.current(details.formattedAddress)
          lastValueRef.current = details.formattedAddress
        } else {
          lastValueRef.current = value
        }
        lastSelectedRef.current = details
        onSelectRef.current(details)
      }
    )
  }

  return (
    <div ref={containerRef}>
      <div ref={placeContainerRef} />
      {!usePlaceElement && (
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            scheduleLiveGeocode(event.target.value)
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          autoComplete={autoComplete}
        />
      )}
    </div>
  )
}
