import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-[#25D366] to-[#128C7E] text-[#04150f] font-semibold shadow-[0_10px_30px_-12px_rgba(37,211,102,0.8)] hover:brightness-110 active:brightness-95',
        secondary: 'bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-white/[0.06]',
        outline: 'border border-white/15 bg-transparent hover:bg-white/[0.06]',
        ghost: 'hover:bg-white/[0.06] text-muted-foreground hover:text-foreground',
        destructive: 'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
        link: 'text-[#25D366] underline-offset-4 hover:underline',
        subtle: 'bg-[#25D366]/10 text-[#4ade80] hover:bg-[#25D366]/16 border border-[#25D366]/20',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        iconSm: 'h-8 w-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
