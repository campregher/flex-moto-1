'use client'

import type { Plataforma } from '@/lib/database.types'

interface PlatformBadgeProps {
  platform: Plataforma
  size: 'sm' | 'md' | 'lg'
}

export function PlatformBadge({ platform, size = 'md' }: PlatformBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  if (platform === 'ml_flex') {
    return (
      <span className={`inline-flex items-center rounded-lg font-medium platform-ml ${sizeClasses[size]}`}>
        Mercado Livre Flex
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center rounded-lg font-medium platform-shopee ${sizeClasses[size]}`}>
      Shopee
    </span>
  )
}
