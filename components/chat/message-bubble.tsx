'use client'

import * as React from 'react'
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  MapPin,
} from 'lucide-react'
import { AudioPlayer } from '@/components/chat/audio-player'
import { cn, formatBytes, formatTime } from '@/lib/utils'
import type { MessageDTO, MessageStatus } from '@/lib/types'

function StatusTicks({ status }: { status: MessageStatus }) {
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  if (status === 'pending') return <Clock className="h-3 w-3 opacity-80" />
  if (status === 'sent') return <Check className="h-3.5 w-3.5 opacity-80" />
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
  return <CheckCheck className="h-3.5 w-3.5 opacity-80" />
}

interface Props {
  message: MessageDTO
  showSender: boolean
  onOpenMedia: (message: MessageDTO) => void
}

export function MessageBubble({ message, showSender, onOpenMedia }: Props) {
  const out = message.fromMe
  const mediaUrl = message.mediaPath ? `/api/media?id=${message.id}` : null
  const downloadUrl = mediaUrl ? `${mediaUrl}&download=1` : null

  return (
    <div className={cn('flex w-full animate-slide-up', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'group relative max-w-[85%] px-3 py-2 text-sm shadow-sm sm:max-w-[70%] md:max-w-[65%]',
          out ? 'bubble-out' : 'bubble-in',
        )}
      >
        {showSender && !out && message.senderName && (
          <div className="mb-1 text-[11px] font-semibold text-[#4ade80]">{message.senderName}</div>
        )}

        {/* Media */}
        {message.type === 'image' && mediaUrl && (
          <button type="button" onClick={() => onOpenMedia(message)} className="mb-1 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt={message.text ?? 'image'}
              className="max-h-80 w-full rounded-xl object-cover"
              loading="lazy"
            />
          </button>
        )}

        {message.type === 'sticker' && mediaUrl && (
          <button type="button" onClick={() => onOpenMedia(message)} className="mb-1 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl} alt="sticker" className="h-32 w-32 object-contain" loading="lazy" />
          </button>
        )}

        {message.type === 'video' && mediaUrl && (
          <video
            src={mediaUrl}
            controls
            preload="metadata"
            className="mb-1 max-h-80 w-full rounded-xl bg-black/40"
          />
        )}

        {message.type === 'audio' && mediaUrl && (
          <AudioPlayer src={mediaUrl} duration={message.mediaDuration} out={out} />
        )}

        {message.type === 'document' && (
          <a
            href={downloadUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'mb-1 flex items-center gap-3 rounded-xl p-2 transition',
              out ? 'bg-white/10 hover:bg-white/15' : 'bg-black/25 hover:bg-black/35',
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
                {message.mediaName ?? 'Document'}
              </span>
              <span className="block text-[10px] opacity-70">
                {formatBytes(message.mediaSize)} · tap to download
              </span>
            </span>
            <Download className="h-4 w-4 opacity-70" />
          </a>
        )}

        {message.type === 'other' && message.text?.startsWith('📍') && (
          <div className="mb-1 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#4ade80]" />
          </div>
        )}

        {/* Caption / text */}
        {message.text && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
        )}

        {!message.text && !mediaUrl && message.type !== 'audio' && (
          <p className="text-xs italic opacity-70">[{message.type} message]</p>
        )}

        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', out ? 'text-white/70' : 'text-white/50')}>
          <span>{formatTime(message.timestamp)}</span>
          {out && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  )
}
