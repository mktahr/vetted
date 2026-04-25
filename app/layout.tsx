import type { Metadata } from 'next'
import './globals.css'
import './design-system.css'

export const metadata: Metadata = {
  title: 'Vetted - Recruiting Database',
  description: 'Recruiting database and candidate management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-theme="dark" data-accent="ember">
      <body>{children}</body>
    </html>
  )
}
