'use client'

import Image from 'next/image'
import { getInitials } from '@/lib/utils'

interface AvatarProps {
  src: string | null
  name: string
  size: 'sm' | 'md' | 'lg' | 'xl'
  className: string
  priority?: boolean
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

function normalizeStorageUrl(url: string) {
  if (!url) return url
  if (url.includes('/storage/v1/object/public/')) return url
  if (url.includes('/storage/v1/object/sign/')) {
    const cleaned = url.split('?')[0]
    return cleaned.replace('/storage/v1/object/sign/', '/storage/v1/object/public/')
  }
  if (url.includes('/storage/v1/object/fotos/')) {
    return url.replace('/storage/v1/object/fotos/', '/storage/v1/object/public/fotos/')
  }
  return url
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size]
  const normalizedSrc = src ? normalizeStorageUrl(src) : null
  const sizesMap = {
    sm: '32px',
    md: '40px',
    lg: '56px',
    xl: '80px',
  }
  const sizes = sizesMap[size] || '40px'
  const priority = size === 'xl'

  if (normalizedSrc) {
    return (
      <div className={`relative rounded-full overflow-hidden ${sizeClass} ${className}`}>
        <Image
          src={normalizedSrc}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium ${sizeClass} ${className}`}
    >
      {getInitials(name)}
    </div>
  )
}
