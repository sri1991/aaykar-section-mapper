export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.4rem',
            color: 'var(--ink)',
            margin: '0 0 0.75rem',
          }}
        >
          Authentication error
        </h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          {message ?? 'Something went wrong during sign-in. Please try again.'}
        </p>
        <a
          href="/auth/login"
          style={{
            display: 'inline-block',
            padding: '0.625rem 1.25rem',
            background: 'var(--teal)',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
