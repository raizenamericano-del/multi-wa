'use client'

import * as React from 'react'
import { Pause, Play } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

/** Compact WhatsApp-style voice note player. */
export function AudioPlayer({
  src,
  duration,
  out,
}: {
  src: string
  duration?: number | null
  out?: boolean
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [current, setCurrent] = React.useState(0)
  const [total, setTotal] = React.useState(duration ?? 0)

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      void audio.play()
    }
  }

  return (
    <div className="flex min-w-[210px] items-center gap-3 py-1">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full transition',
          out ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-[#25D366]/20 text-[#4ade80] hover:bg-[#25D366]/30',
        )}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full', out ? 'bg-white/70' : 'bg-[#25D366]')}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[10px] opacity-75">
          <span>{formatDuration(current || total)}</span>
          <span>{formatDuration(total)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
          setCurrent(0)
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget
          setCurrent(audio.currentTime)
          if (audio.duration && Number.isFinite(audio.duration)) {
            setTotal(audio.duration)
            setProgress(audio.currentTime / audio.duration)
          }
        }}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget
          if (audio.duration && Number.isFinite(audio.duration)) setTotal(audio.duration)
        }}
        className="hidden"
      />
    </div>
  )
}
