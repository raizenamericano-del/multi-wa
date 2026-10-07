import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#25D366]/12 text-[#4ade80]',
        secondary: 'border-white/[0.06] bg-white/[0.05] text-muted-foreground',
        success: 'border-[#25D366]/25 bg-[#25D366]/12 text-[#4ade80]',
        warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
        danger: 'border-red-500/25 bg-red-500/10 text-red-300',
        info: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
        outline: 'border-white/15 text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
