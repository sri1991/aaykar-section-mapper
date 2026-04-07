import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AaykarSetu — India IT Act 1961 → 2025 Mapper',
  description: 'Instantly map any Income Tax Act 1961 section or form to its 2025 equivalent. Built for CAs and finance teams navigating the transition. By MSB Digital Labs.',
  keywords: 'Income Tax Act 2025, IT Act section mapping, TDS forms 2026, India tax compliance, CA tool, AaykarSetu',
  openGraph: {
    title: 'AaykarSetu — IT Act 1961 to 2025 Mapper',
    description: 'Free tool for CAs and finance teams. Search any old section and instantly see the new equivalent with plain-English explanations.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
