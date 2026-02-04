import type { Metadata, Viewport } from 'next'
import { Inter, Sora } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import AuthRecoveryRedirect from '@/components/AuthRecoveryRedirect'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const sora = Sora({ subsets: ['latin'], variable: '--font-display' })

export const metadata: Metadata = {
  title: 'Flex Moto - Entregas Urbanas',
  description: 'Entregas urbanas com motos para Mercado Livre Flex e Shopee Entrega Direta',
  manifest: '/manifest.json',
  other: {
   'mobile-web-app-capable': 'yes',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Flex Moto',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0DD9C4',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${sora.variable} font-sans`}>
        <AuthRecoveryRedirect />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0D0D0D',
              color: '#F8F5F7',
              borderRadius: '10px',
            },
            success: {
              iconTheme: {
                primary: '#0DD9C4',
                secondary: '#0D0D0D',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#0D0D0D',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
