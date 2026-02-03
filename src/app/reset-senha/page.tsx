import { Suspense } from 'react'
import ResetSenhaClient from './ResetSenhaClient'

export const dynamic = 'force-dynamic'

export default function ResetSenhaPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center text-white">
          Carregando...
        </div>
      )}
    >
      <ResetSenhaClient />
    </Suspense>
  )
}
