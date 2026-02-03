'use client'

import { ReactNode } from 'react'
import { HiOutlineInbox } from 'react-icons/hi'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || <HiOutlineInbox className="w-8 h-8 text-gray-400" />}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}
