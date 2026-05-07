'use client'

import { useState, useEffect, useCallback } from 'react'

interface TourStep {
  targetId: string
  title: string
  content: string
  position: 'bottom' | 'top' | 'left' | 'right' | 'center'
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-logo',
    title: 'Welcome to AaykarSetu!',
    content: 'Your compliance workbench for the Income Tax Act 2025. Let’s take a quick 1-minute tour of how to use it.',
    position: 'bottom'
  },
  {
    targetId: 'tour-search',
    title: 'Smart Section Mapper',
    content: 'Search any old section number (like 80C) and instantly find its new 2025 home with plain-English summaries of what changed.',
    position: 'bottom'
  },
  {
    targetId: 'tour-stats',
    title: 'Live Stats',
    content: 'Keep track of the total sections remapped and specific sections where monetary limits have changed in the new Act.',
    position: 'top'
  },
  {
    targetId: 'tour-nav',
    title: 'Powerful Tools',
    content: 'Switch between the Document Scanner (to sanitize agreements) and AaykarMitra (your AI search assistant).',
    position: 'bottom'
  },
  {
    targetId: 'tour-notice',
    title: 'Notice Analyzer',
    content: 'Upload any Income Tax notice and let Aaykar Setu extract key demands, deadlines, and a tailored checklist for your response.',
    position: 'bottom'
  }
]

export default function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('aaykar_tour_seen')
    if (!hasSeenTour) {
      // Start tour after a short delay
      const timer = setTimeout(() => setCurrentStep(0), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const updateCoords = useCallback(() => {
    if (currentStep === null) return
    const step = TOUR_STEPS[currentStep]
    const el = document.getElementById(step.targetId)
    if (el) {
      const rect = el.getBoundingClientRect()
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      })
    } else if (step.position === 'center') {
      setCoords(null)
    }
  }, [currentStep])

  useEffect(() => {
    updateCoords()
    window.addEventListener('resize', updateCoords)
    return () => window.removeEventListener('resize', updateCoords)
  }, [updateCoords])

  if (currentStep === null) return null

  const step = TOUR_STEPS[currentStep]
  const isLast = currentStep === TOUR_STEPS.length - 1

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('aaykar_tour_seen', 'true')
      setCurrentStep(null)
    } else {
      setCurrentStep(s => (s !== null ? s + 1 : null))
    }
  }

  const handleSkip = () => {
    localStorage.setItem('aaykar_tour_seen', 'true')
    setCurrentStep(null)
  }


  // Tooltip positioning logic
  let tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10001,
    width: 300,
    background: 'white',
    borderRadius: 16,
    padding: '24px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '1px solid var(--border)'
  }

  if (coords) {
    if (step.position === 'bottom') {
      tooltipStyle.top = coords.top + coords.height + 15
      tooltipStyle.left = Math.max(20, Math.min(window.innerWidth - 320, coords.left + coords.width / 2 - 150))
    } else if (step.position === 'top') {
      tooltipStyle.top = coords.top - 180 // Approximate height
      tooltipStyle.left = Math.max(20, Math.min(window.innerWidth - 320, coords.left + coords.width / 2 - 150))
    }
  } else {
    // Default center fallback
    tooltipStyle.top = '50%'
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translate(-50%, -50%)'
    tooltipStyle.position = 'fixed'
  }

  // Extract and parse the value safely before the math operation
  const tooltipLeft = typeof tooltipStyle.left === 'number'
    ? tooltipStyle.left
    : parseFloat(tooltipStyle.left as string) || 0;

  return (
    <>
      {/* Dimmed Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          transition: 'all 0.3s'
        }}
        onClick={handleSkip}
      />

      {/* Spotlight effect */}
      {coords && (
        <div style={{
          position: 'absolute',
          top: coords.top - 8,
          left: coords.left - 8,
          width: coords.width + 16,
          height: coords.height + 16,
          borderRadius: 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
          zIndex: 10000,
          pointerEvents: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      )}

      {/* Tooltip */}
      <div style={tooltipStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--saffron-dark)',
            background: 'var(--saffron-light)',
            padding: '2px 8px',
            borderRadius: 100,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: '0.75rem' }}
          >
            Skip tour
          </button>
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: 'var(--ink)' }}>
          {step.title}
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 20 }}>
          {step.content}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={handleNext}
            style={{
              background: 'var(--ink)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Triangle arrow */}
        {coords && step.position === 'bottom' && (
          <div style={{
            position: 'absolute',
            top: -10,
            left: Math.max(15, Math.min(270, coords.left + coords.width / 2 - tooltipLeft - 10)),
            width: 20,
            height: 10,
            background: 'white',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
          }} />
        )}
        {coords && step.position === 'top' && (
          <div style={{
            position: 'absolute',
            bottom: -10,
            left: Math.max(15, Math.min(270, coords.left + coords.width / 2 - tooltipLeft - 10)),
            width: 20,
            height: 10,
            background: 'white',
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)'
          }} />
        )}
      </div>
    </>
  )
}
