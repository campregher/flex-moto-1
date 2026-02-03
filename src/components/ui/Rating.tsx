'use client'

import { HiStar } from 'react-icons/hi'

interface RatingProps {
  value: number
  max: number
  size: 'sm' | 'md' | 'lg'
  showValue: boolean
  onChange: (value: number) => void
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function Rating({ value, max = 5, size = 'md', showValue = true, onChange }: RatingProps) {
  const sizeClass = sizeClasses[size]
  const interactive = typeof onChange === 'function'

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1
        const filled = starValue <= Math.round(value)
        
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(starValue)}
            disabled={!interactive}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          >
            <HiStar
              className={`${sizeClass} ${
                filled ? 'text-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        )
      })}
      {showValue && (
        <span className="ml-1 text-sm text-gray-600">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  )
}

