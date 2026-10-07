'use client'

import * as React from 'react'
import { Loader2, Mic, Paperclip, Send, Smile, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { avatarEmojis, cn, formatBytes } from '@/lib/utils'

type Attachment = { file: File; kind: 'image' | 'video' | 'audio' | 'document'; previewUrl?: string }

interface Props {
  sessionId: string
  chatId: string
  disabled?: boolean
  onSent: () => void
  onTyping: (state: 'composing' | 'paused') => void
}

const MAX_MB = 64

export function MessageComposer({ sessionId, chatId, disabled, onSent, onTyping }: Props) {
  const [text, setText] = React.useState('')
  const [attachment, setAttachment] = React.useState<Attachment | null>(null)
  const [sending, setSending] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const [seconds, setSeconds] = React.useState(0)
  const [emojiOpen, setEmojiOpen] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const typingRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (typingRef.current) clearTimeout(typingRef.current)
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    }
  }, [attachment])

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum ${MAX_MB} MB.`)
      return
    }
    const kind: Attachment['kind'] = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'document'
    setAttachment({
      file,
      kind,
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
    })
  }

  function handleTyping(value: string) {
    setText(value)
    if (typingRef.current) clearTimeout(typingRef.current)
    onTyping('composing')
    typingRef.current = setTimeout(() => onTyping('paused'), 2500)
  }

  async function send() {
    if (sending || disabled) return
    const trimmed = text.trim()

    if (attachment) {
      setSending(true)
      try {
        const form = new FormData()
        form.append('file', attachment.file)
        form.append('kind', attachment.kind)
        if (trimmed) form.append('caption', trimmed)
        await fetch(`/api/chats/${chatId}/messages`, { method: 'POST', body: form }).then(
          async (response) => {
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as { error?: string } | null
              throw new Error(payload?.error ?? 'Upload failed')
            }
          },
        )
        setAttachment(null)
        setText('')
        onSent()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to send media')
      } finally {
        setSending(false)
      }
      return
    }

    if (!trimmed) return

    setSending(true)
    setText('')
    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? 'Failed to send message')
      }
      onSent()
      onTyping('paused')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send message')
      setText(trimmed)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  /* ------------------------- voice note recording ------------------------ */

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))

      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      chunksRef.current = []
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size < 1200) {
          toast.error('Recording was too short')
          return
        }

        const file = new File([blob], `voice-note.${blob.type.includes('ogg') ? 'ogg' : 'webm'}`, {
          type: blob.type,
        })

        setSending(true)
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('kind', 'audio')
          form.append('ptt', 'true')
          const response = await fetch(`/api/chats/${chatId}/messages`, { method: 'POST', body: form })
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null
            throw new Error(payload?.error ?? 'Failed to send voice note')
          }
          toast.success('Voice note sent')
          onSent()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to send voice note')
        } finally {
          setSending(false)
        }
      }

      recorder.start(250)
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000)
    } catch {
      toast.error('Microphone permission denied')
    }
  }

  function stopRecording(cancel = false) {
    const recorder = recorderRef.current
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    if (!recorder) return
    if (cancel) recorder.ondataavailable = null
    recorder.stop()
  }

  /* ------------------------------- render -------------------------------- */

  if (recording) {
    return (
      <div className="flex items-center gap-3 border-t border-white/[0.06] bg-[hsl(200_25%_5%)]/80 p-3 backdrop-blur">
        <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
        <span className="font-mono text-sm tabular-nums">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </span>
        <span className="text-xs text-muted-foreground">Recording voice note…</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => stopRecording(true)}>
          <X /> Cancel
        </Button>
        <Button size="sm" onClick={() => stopRecording(false)}>
          <Square /> Send
        </Button>
      </div>
    )
  }

  return (
    <div className="border-t border-white/[0.06] bg-[hsl(200_25%_5%)]/80 p-3 backdrop-blur">
      {attachment && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
          {attachment.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.previewUrl} alt="preview" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.05]">
              <Paperclip className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{attachment.file.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {attachment.kind} · {formatBytes(attachment.file.size)}
            </div>
          </div>
          <Button variant="ghost" size="iconSm" onClick={() => setAttachment(null)}>
            <X />
          </Button>
        </div>
      )}

      {emojiOpen && (
        <div className="mb-2 flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
          {avatarEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setText((value) => value + emoji)
                textareaRef.current?.focus()
              }}
              className="rounded-lg px-1.5 py-1 text-lg transition hover:bg-white/[0.06]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" hidden onChange={pickFile} />

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setEmojiOpen((value) => !value)}
          aria-label="Emoji"
        >
          <Smile />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach media"
        >
          <Paperclip />
        </Button>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => handleTyping(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          rows={1}
          placeholder={disabled ? 'Session offline — reconnect to send' : 'Type a message'}
          disabled={disabled}
          className={cn('max-h-32 min-h-11 flex-1 py-3', disabled && 'opacity-60')}
        />

        {text.trim() || attachment ? (
          <Button onClick={() => void send()} loading={sending} size="icon" className="shrink-0" aria-label="Send">
            <Send />
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="icon"
            className="shrink-0"
            onClick={() => void startRecording()}
            disabled={disabled || sending}
            aria-label="Record voice note"
          >
            {sending ? <Loader2 className="animate-spin" /> : <Mic />}
          </Button>
        )}
      </div>
    </div>
  )
}
