'use client'

import * as React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Renders a WhatsApp QR string as an image. The `qrcode` library is imported
 * lazily (client only) so it never lands in the server bundle.
 */
export function QrCodeImage({
  value,
  className,
  size = 220,
}: {
  value: string
  className?: string
  size?: number
}) {
  const [src, setSrc] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (!value) {
      setSrc(null)
      return
    }

    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(value, {
          width: size * 2,
          margin: 1,
          color: { dark: '#0b1410', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) {
    return <Skeleton className={cn('rounded-2xl', className)} style={{ width: size, height: size }} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="WhatsApp pairing QR code"
      width={size}
      height={size}
      className={cn('rounded-2xl bg-white p-3', className)}
    />
  )
}
