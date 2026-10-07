import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm text-foreground shadow-inner shadow-black/20 transition-colors',
      'placeholder:text-muted-foreground/70 focus-visible:border-[#25D366]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/25',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
