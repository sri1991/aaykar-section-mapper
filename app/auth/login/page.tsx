'use client'

import { use, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = use(searchParams)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(params.error ?? null)

  const supabase = createClient()
  const next = params.next ?? '/'

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Logo / wordmark */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <span
            style={{
              background: 'var(--teal)',
              color: '#fff',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          >
            A
          </span>
          <span
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.5rem',
              color: 'var(--ink)',
            }}
          >
            AaykarSetu
          </span>
        </div>
        <p
          style={{
            color: 'var(--ink-muted)',
            fontSize: '0.875rem',
            margin: 0,
          }}
        >
          IT Act 1961 → 2025 Compliance Workbench
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {sent ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.4rem',
                color: 'var(--ink)',
                margin: '0 0 0.75rem',
              }}
            >
              Check your email
            </h2>
            <p
              style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', margin: 0 }}
            >
              We sent a magic link to{' '}
              <strong style={{ color: 'var(--ink)' }}>{email}</strong>. Click the
              link in the email to sign in.
            </p>
            <button
              onClick={() => setSent(false)}
              style={{
                marginTop: '1.5rem',
                background: 'none',
                border: 'none',
                color: 'var(--teal)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textDecoration: 'underline',
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h1
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.5rem',
                color: 'var(--ink)',
                margin: '0 0 0.375rem',
              }}
            >
              Sign in
            </h1>
            <p
              style={{
                color: 'var(--ink-muted)',
                fontSize: '0.875rem',
                margin: '0 0 2rem',
              }}
            >
              Access your saved mappings and AI assistant history.
            </p>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'var(--surface)',
                border: '1.5px solid var(--border-strong)',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'var(--ink)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                margin: '1.5rem 0',
              }}
            >
              <div
                style={{ flex: 1, height: '1px', background: 'var(--border)' }}
              />
              <span style={{ color: 'var(--ink-faint)', fontSize: '0.8rem' }}>
                or
              </span>
              <div
                style={{ flex: 1, height: '1px', background: 'var(--border)' }}
              />
            </div>

            {/* Magic link form */}
            <form
              onSubmit={handleMagicLink}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: 'var(--ink-muted)',
                    marginBottom: '0.375rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    color: 'var(--ink)',
                    background: 'var(--surface)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'var(--teal)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !email.trim() ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>

            {error && (
              <p
                style={{
                  marginTop: '1rem',
                  padding: '0.625rem 0.875rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '0.85rem',
                  margin: '1rem 0 0',
                }}
              >
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <p
        style={{
          marginTop: '2rem',
          color: 'var(--ink-faint)',
          fontSize: '0.8rem',
          textAlign: 'center',
        }}
      >
        By signing in you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
