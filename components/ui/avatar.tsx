'use client'

import * as React from 'react'
import { cn, getInitials } from '@/lib/utils'

interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  ring?: boolean
}

const sizes: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

/**
 * Initials avatar with a deterministic gradient, falling back automatically
 * when WhatsApp hides the profile picture URL.
 */
export function Avatar({ name, src, size = 'md', className, ring = false }: AvatarProps) {
  const [failed, setFailed] = React.useState(false)
  const initials = getInitials(name, '?')

  const hue = React.useMemo(() => {
    const source = name ?? 'wa'
    let hash = 0
    for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) % 360
    return hash
  }, [name])

  const showImage = Boolean(src) && !failed

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold uppercase tracking-wide',
        sizes[size],
        ring && 'ring-2 ring-[#25D366]/30 ring-offset-2 ring-offset-[hsl(200_24%_7%)]',
        className,
      )}
      style={
        showImage
          ? undefined
          : {
              backgroundImage: `linear-gradient(140deg, hsl(${hue} 55% 38%), hsl(${(hue + 42) % 360} 60% 22%))`,
            }
      }
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name ?? 'avatar'}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-white/90">{initials}</span>
      )}
    </div>
  )
}
