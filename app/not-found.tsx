import Link from 'next/link'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/10">
        <Compass className="h-7 w-7 text-[#25D366]" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you are looking for does not exist. Head back to the dashboard to manage your
        WhatsApp sessions.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] px-4 py-2 text-sm font-semibold text-[#04150f]"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
