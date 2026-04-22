import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

// Strict CSP — adjust if you add new third-party origins
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' blob: ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''} https://va.vercel-scripts.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https://lh3.googleusercontent.com;
  connect-src 'self'
    ${process.env.NODE_ENV === 'development' ? 'http://localhost:* ws://localhost:*' : ''}
    ${supabaseUrl}
    https://*.supabase.co
    https://generativelanguage.googleapis.com
    https://api.groq.com
    https://api.cohere.com
    https://api.anthropic.com
    https://va.vercel-scripts.com;
  worker-src 'self' blob:;
  frame-src https://accounts.google.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s+/g, ' ').trim()

const securityHeaders = [
  { key: 'Content-Security-Policy',         value: ContentSecurityPolicy },
  { key: 'X-Frame-Options',                 value: 'DENY' },
  { key: 'X-Content-Type-Options',          value: 'nosniff' },
  { key: 'Referrer-Policy',                 value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',              value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security',       value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
