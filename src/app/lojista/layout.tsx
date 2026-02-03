import LojistaLayoutClient from './LojistaLayoutClient'

export const dynamic = 'force-dynamic'

export default function LojistaLayout({ children }: { children: React.ReactNode }) {
  return <LojistaLayoutClient>{children}</LojistaLayoutClient>
}
