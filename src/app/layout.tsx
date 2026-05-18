import type { Metadata, Viewport } from 'next'
import './globals.css'
import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar'

export const metadata: Metadata = {
  title: 'BabyWatch',
  description: 'Browser-based baby monitor — stream live video and audio from any phone',
  appleWebApp: {
    capable: true,
    title: 'BabyWatch',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // viewportFit: cover ensures content reaches the notch/home-indicator edges
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="h-full overflow-hidden bg-background">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
