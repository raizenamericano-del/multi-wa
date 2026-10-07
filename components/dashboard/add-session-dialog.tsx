'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/fetcher'
import type { SessionDTO } from '@/lib/types'

export function AddSessionDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [name, setName] = React.useState('')
  const [phoneNumber, setPhoneNumber] = React.useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const { session } = await api.post<{ session: SessionDTO }>('/api/sessions', {
        name: name || undefined,
        phoneNumber,
      })
      toast.success('Session created — generating pairing code…')
      setOpen(false)
      setName('')
      setPhoneNumber('')
      router.push(`/pair?session=${session.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Add New Number
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#25D366]" /> Add New Number
          </DialogTitle>
          <DialogDescription>
            Enter the WhatsApp number in international format (without <code>+</code> or spaces).
            You will get a pairing code to enter on the phone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              WhatsApp number
            </label>
            <Input
              id="phone"
              autoFocus
              inputMode="numeric"
              placeholder="6281234567890"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d+]/g, ''))}
              required
              minLength={8}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Example: <span className="font-mono text-foreground/80">6281234567890</span> (62 =
              Indonesia). A leading 0 is automatically converted.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Label <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="name"
              placeholder="Support Team"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create &amp; continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
