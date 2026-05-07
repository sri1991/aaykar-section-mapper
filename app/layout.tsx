import type { Metadata } from 'next'
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

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
    <html lang="en" data-theme="saffron" className={`${interTight.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
