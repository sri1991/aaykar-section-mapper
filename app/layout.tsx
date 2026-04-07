import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
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
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
