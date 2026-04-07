import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — AaykarSetu',
  description: 'Privacy Policy for AaykarSetu by MSB Digital Labs.',
}

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--surface-2)',
      fontFamily: 'var(--font-body), sans-serif',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ color: 'var(--ink-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
            ← Back to AaykarSetu
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display), serif',
          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
          color: 'var(--ink)',
          marginBottom: '0.5rem',
        }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
          Last updated: April 7, 2026 · MSB Digital Labs
        </p>

        <Section title="Overview">
          AaykarSetu is a compliance workbench for Indian CAs, finance teams, and SMEs. We take your
          privacy seriously and collect only what is needed to operate the service.
        </Section>

        <Section title="Information We Collect">
          <b>Account information</b> — When you sign in with Google OAuth or a magic link, we receive
          your email address and (for Google) your display name and profile photo. This is stored in
          our Supabase-hosted database to identify your account.
          <br /><br />
          <b>Usage data</b> — We use Vercel Analytics, a privacy-friendly analytics tool, to understand
          aggregate usage patterns (page views, tab usage). No personally identifiable information is
          sent to Vercel Analytics.
          <br /><br />
          <b>Documents you upload</b> — Files uploaded to the Document Scanner are processed in-memory
          in your browser using OCR. They are never stored on our servers.
          <br /><br />
          <b>AI assistant queries</b> — Text you send to AaykarMitra is forwarded to third-party AI
          APIs (Google Gemini, Groq, Cohere) to generate answers. Do not include personal financial
          data or PAN/Aadhaar numbers in your queries.
        </Section>

        <Section title="How We Use Your Information">
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>To authenticate you and maintain your session</li>
            <li>To operate the section mapper, forms mapper, and AI assistant</li>
            <li>To understand aggregate usage and improve the product</li>
            <li>We do not sell your data to any third party</li>
            <li>We do not use your data for advertising</li>
          </ul>
        </Section>

        <Section title="Data Storage & Security">
          Your account data is stored in a Supabase-hosted PostgreSQL database with Row Level Security
          (RLS) enabled — only you can read your own profile. Data is hosted on servers in the EU
          (Supabase default region). We use HTTPS for all data in transit.
        </Section>

        <Section title="Third-Party Services">
          We use the following third-party services:
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2, marginTop: '0.5rem' }}>
            <li><b>Supabase</b> — authentication and database (supabase.com)</li>
            <li><b>Google OAuth</b> — sign-in via your Google account (google.com)</li>
            <li><b>Vercel</b> — hosting and privacy-friendly analytics (vercel.com)</li>
            <li><b>Google Gemini, Groq, Cohere</b> — AI inference for AaykarMitra queries</li>
          </ul>
          Each of these services has its own privacy policy. Your use of sign-in with Google is
          governed by Google&rsquo;s Privacy Policy.
        </Section>

        <Section title="Data Retention">
          Your account profile is retained for as long as you have an account. You can request deletion
          at any time by emailing us. On deletion, your profile row is permanently removed from our
          database.
        </Section>

        <Section title="Your Rights">
          You have the right to access, correct, or delete your personal data. To exercise any of
          these rights, contact us at the email below. Residents of the EU/EEA may also lodge a
          complaint with their local data protection authority.
        </Section>

        <Section title="Cookies">
          We use a single session cookie set by Supabase to maintain your authentication state. We do
          not use tracking cookies or third-party advertising cookies.
        </Section>

        <Section title="Changes to This Policy">
          We may update this policy as the product evolves. Material changes will be communicated via
          the app. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.
        </Section>

        <Section title="Contact">
          For privacy-related questions, email us at{' '}
          <a href="mailto:privacy@msbdigitallabs.com" style={{ color: 'var(--teal)' }}>
            privacy@msbdigitallabs.com
          </a>
          .
        </Section>
      </main>

      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '20px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: 'var(--ink-faint)',
        background: 'var(--surface)',
      }}>
        © 2026 MSB Digital Labs · AaykarSetu
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-display), serif',
        fontSize: '1.15rem',
        color: 'var(--ink)',
        marginBottom: '0.5rem',
        paddingBottom: '0.375rem',
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      <p style={{ color: 'var(--ink-muted)', lineHeight: 1.7, fontSize: '0.9rem', margin: 0 }}>
        {children}
      </p>
    </section>
  )
}
