import EntregadorLayoutClient from './EntregadorLayoutClient'

export const dynamic = 'force-dynamic'

export default function EntregadorLayout({ children }: { children: React.ReactNode }) {
  return <EntregadorLayoutClient>{children}</EntregadorLayoutClient>
}
