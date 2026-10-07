'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import type { ChatDTO, MessageDTO, SessionDTO, SessionWithStats, StatsDTO } from '@/lib/types'

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<{ sessions: SessionWithStats[] }>(
    '/api/sessions',
    { refreshInterval: 15000 },
  )
  return {
    sessions: data?.sessions ?? [],
    error,
    isLoading,
    mutate,
  }
}

export function useSession(sessionId?: string) {
  const { data, error, isLoading, mutate } = useSWR<{ session: SessionDTO }>(
    sessionId ? `/api/sessions/${sessionId}` : null,
  )
  return { session: data?.session ?? null, error, isLoading, mutate }
}

export function useStats() {
  const { data, mutate } = useSWR<{ stats: StatsDTO }>('/api/stats', { refreshInterval: 20000 })
  return { stats: data?.stats ?? null, mutate }
}

export function useChats(sessionId?: string, search?: string) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const key = sessionId ? `/api/sessions/${sessionId}/chats?${params.toString()}` : null

  const { data, error, isLoading, mutate } = useSWR<{ chats: ChatDTO[] }>(key)
  return { chats: data?.chats ?? [], error, isLoading, mutate }
}

export function useMessages(chatId?: string, limit = 60) {
  const key = chatId ? `/api/chats/${chatId}/messages?limit=${limit}` : null
  const { data, error, isLoading, mutate } = useSWR<{ messages: MessageDTO[]; chat: ChatDTO }>(key)
  return { messages: data?.messages ?? [], chat: data?.chat ?? null, error, isLoading, mutate }
}

/** Invalidate everything that shows session/chat counters. */
export function refreshLists() {
  void globalMutate('/api/sessions')
  void globalMutate('/api/stats')
}
