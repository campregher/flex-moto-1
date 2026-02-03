'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthRecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash || ''
    if (!hash.includes('type=recovery')) return
    router.replace(`/reset-senha${hash}`)
  }, [router])

  return null
}
