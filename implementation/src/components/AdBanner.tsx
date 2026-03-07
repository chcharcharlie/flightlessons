import React, { useEffect, useRef } from 'react'

interface AdBannerProps {
  slot?: string
  format?: 'auto' | 'horizontal' | 'rectangle'
  className?: string
}

// To activate: set VITE_ADSENSE_CLIENT and VITE_ADSENSE_SLOT in .env
// and replace the placeholder in index.html with your actual publisher ID.
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const ADSENSE_SLOT_DEFAULT = import.meta.env.VITE_ADSENSE_SLOT as string | undefined

export const AdBanner: React.FC<AdBannerProps> = ({
  slot,
  format = 'horizontal',
  className = '',
}) => {
  const adRef = useRef<HTMLModElement>(null)
  const initialized = useRef(false)
  const slotId = slot || ADSENSE_SLOT_DEFAULT

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slotId || initialized.current) return
    try {
      // @ts-ignore
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      initialized.current = true
    } catch (e) {
      // AdSense not loaded yet or blocked
    }
  }, [slotId])

  // Placeholder shown when not configured or in development
  if (!ADSENSE_CLIENT || !slotId) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 border border-dashed border-gray-300 text-gray-400 text-xs select-none ${className}`}
        style={{ minHeight: 60 }}
      >
        Ad · 728×90
      </div>
    )
  }

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}
