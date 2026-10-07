import { Activity, CircleSlash, Link2, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/lib/types'

const config: Record<
  SessionStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' | 'info'; dot: string; icon?: boolean }
> = {
  connected: { label: 'Connected', variant: 'success', dot: 'bg-[#25D366]', icon: true },
  connecting: { label: 'Connecting', variant: 'warning', dot: 'bg-amber-400', icon: true },
  pairing: { label: 'Pairing', variant: 'info', dot: 'bg-sky-400', icon: true },
  disconnected: { label: 'Disconnected', variant: 'secondary', dot: 'bg-zinc-500' },
  error: { label: 'Error', variant: 'danger', dot: 'bg-red-500' },
}

export function SessionStatusBadge({
  status,
  className,
  pulse = true,
}: {
  status: SessionStatus
  className?: string
  pulse?: boolean
}) {
  const item = config[status] ?? config.disconnected
  const animated = pulse && (status === 'connected' || status === 'connecting' || status === 'pairing')

  return (
    <Badge variant={item.variant} className={cn('capitalize', className)}>
      <span className="relative flex h-1.5 w-1.5">
        {animated && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', item.dot)} />
        )}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', item.dot)} />
      </span>
      {item.label}
      {status === 'connected' && <Activity className="h-3 w-3" />}
      {status === 'error' && <TriangleAlert className="h-3 w-3" />}
      {status === 'disconnected' && <CircleSlash className="h-3 w-3" />}
      {status === 'pairing' && <Link2 className="h-3 w-3" />}
    </Badge>
  )
}
