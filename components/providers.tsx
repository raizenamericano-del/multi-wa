'use client'

import { SWRConfig } from 'swr'
import { Toaster } from 'sonner'
import { fetcher } from '@/lib/fetcher'
import { SocketProvider } from '@/hooks/use-socket'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        keepPreviousData: true,
      }}
    >
      <SocketProvider>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'rgba(13, 21, 26, 0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(14px)',
              color: '#e9edef',
            },
          }}
        />
      </SocketProvider>
    </SWRConfig>
  )
}
