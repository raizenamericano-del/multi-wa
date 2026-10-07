import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 6281234567890 -> 6281234567890@s.whatsapp.net */
export function toJid(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

/** 6281234567890@s.whatsapp.net -> 6281234567890 */
export function jidToNumber(jid: string) {
  return jid.split('@')[0].split(':')[0]
}

/** +62 812-3456-7890 / 0812... -> 6281234567890 */
export function normalizePhoneNumber(input: string, defaultCountryCode = '62') {
  let digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) digits = defaultCountryCode + digits.slice(1)
  return digits
}

export function isGroupJid(jid: string) {
  return jid.endsWith('@g.us')
}

export function shortJid(jid: string) {
  return jid.split('@')[0]
}

export function formatPhoneNumber(jid: string) {
  const num = jidToNumber(jid)
  // 6281234567890 -> +62 812-3456-7890  (best effort, keeps readability)
  const match = num.match(/^(\d{1,3})(\d{3,4})(\d{3,4})(\d*)$/)
  if (!match) return `+${num}`
  return `+${match[1]} ${match[2]}-${match[3]}${match[4] ? `-${match[4]}` : ''}`
}

export function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTime(date: string | number | Date) {
  const d = new Date(date)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(date: string | number | Date) {
  const d = new Date(date)
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** WhatsApp-style relative time: 14:05 / Yesterday / 12/09/2025 */
export function formatChatTimestamp(date: string | number | Date) {
  const d = new Date(date)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return formatTime(d)

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dayLabel(date: string | number | Date) {
  const d = new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function getInitials(name?: string | null, fallback = '?') {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || fallback
}

export function truncate(text: string | null | undefined, max = 60) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Small emoji palette used by the chat composer. */
export const avatarEmojis = [
  '😀', '😂', '🥲', '😍', '🤩', '😎', '🤔', '🙏', '👍', '👎',
  '🔥', '🎉', '❤️', '💚', '✅', '❌', '⏰', '📌', '💰', '📞',
]
