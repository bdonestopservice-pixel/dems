'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  REALTIME_CHANNEL_NAME,
  getOrCreateRealtimeChannel,
  type RealtimeEventType,
  type RealtimePayload,
} from '@/lib/realtime'
import type { AuthSession } from '@/types'
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'

interface RealtimeContextValue {
  session: AuthSession
  refreshSession: () => Promise<AuthSession | null>
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtimeSession() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    return {
      session: {
        userId: '',
        name: '',
        email: '',
        role: 'admin' as const,
        warehouses: [],
      },
      refreshSession: async () => null,
    }
  }
  return ctx
}

/**
 * Hook สำหรับให้คอมโพเนนต์ต่างๆ ฟัง Realtime Event ได้ง่ายๆ
 */
export function useRealtimeListener(
  events: RealtimeEventType | RealtimeEventType[],
  callback: (payload: RealtimePayload) => void
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const eventList = Array.isArray(events) ? events : [events]

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ event: RealtimeEventType; payload: RealtimePayload }>
      if (eventList.includes(customEvent.detail.event)) {
        callbackRef.current(customEvent.detail.payload)
      }
    }

    window.addEventListener('dems:realtime', handleCustomEvent)
    return () => {
      window.removeEventListener('dems:realtime', handleCustomEvent)
    }
  }, [events])
}

interface RealtimeProviderProps {
  initialSession: AuthSession
  children: React.ReactNode
}

export function RealtimeProvider({ initialSession, children }: RealtimeProviderProps) {
  const [session, setSession] = useState<AuthSession>(initialSession)
  const [notification, setNotification] = useState<{ title: string; text: string; type: 'success' | 'warning' } | null>(null)
  const router = useRouter()
  const sessionRef = useRef(session)
  sessionRef.current = session
  const isSubscribedRef = useRef(false)

  const refreshSession = useCallback(async (): Promise<AuthSession | null> => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) {
        // Session invalid (e.g. password changed or user deactivated)
        router.push('/login')
        return null
      }
      const data = await res.json()
      if (data.user) {
        setSession(data.user)
        return data.user
      }
    } catch (err) {
      console.warn('Error refreshing session:', err)
    }
    return null
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isSubscribedRef.current) return

    const channel = getOrCreateRealtimeChannel()
    if (!channel) return

    try {
      if (channel.state !== 'joined' && channel.state !== 'joining') {
        // 1. รับสัญญาณ Realtime Broadcast
        channel
          .on('broadcast', { event: 'user-updated' }, async ({ payload }: { payload: RealtimePayload }) => {
            const curUser = sessionRef.current
            if (payload?.userId === curUser.userId) {
              if (payload.passwordChanged) {
                setNotification({
                  title: 'รหัสผ่านถูกเปลี่ยนแปลง',
                  text: 'รหัสผ่านของคุณถูกเปลี่ยนโดยผู้ดูแลระบบ กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...',
                  type: 'warning',
                })
                setTimeout(() => {
                  window.location.href = '/login'
                }, 1800)
                return
              }

              if (payload.is_active === false) {
                setNotification({
                  title: 'บัญชีถูกปิดการใช้งาน',
                  text: 'บัญชีของคุณถูกระงับสิทธิ์การใช้งานโดยผู้ดูแลระบบ',
                  type: 'warning',
                })
                setTimeout(() => {
                  window.location.href = '/login'
                }, 1800)
                return
              }

              // กรณีอัปเดตสิทธิ์คลัง (Warehouses grant) หรือข้อมูลอื่น
              const updated = await refreshSession()
              if (updated) {
                const whList = updated.warehouses?.length ? updated.warehouses.join(', ') : 'ไม่มีคลัง'
                setNotification({
                  title: 'สิทธิ์คลังได้รับการอัปเดตแบบ Realtime',
                  text: `ผู้ดูแลระบบได้ปรับสิทธิ์คลังของคุณเป็น: ${whList}`,
                  type: 'success',
                })
                setTimeout(() => setNotification(null), 5000)

                // ซิงค์ Active Warehouse ถ้าคลังที่เลือกอยู่เดิมถูกตัดสิทธิ์
                try {
                  const currentActive = window.localStorage.getItem('dems_active_warehouse')
                  if (currentActive && !updated.warehouses.includes(currentActive)) {
                    const nextWh = updated.warehouses[0] || ''
                    window.localStorage.setItem('dems_active_warehouse', nextWh)
                    window.dispatchEvent(new CustomEvent('dems:active-warehouse', { detail: nextWh }))
                  }
                } catch {}

                router.refresh()
              }
            }
          })
          .on('broadcast', { event: '*' }, (msg) => {
            // กระจาย event ไปยัง window เพื่อให้ hooks ในแต่ละหน้าทำงาน
            if (typeof window !== 'undefined' && msg.event) {
              window.dispatchEvent(
                new CustomEvent('dems:realtime', {
                  detail: { event: msg.event, payload: msg.payload },
                })
              )
            }
          })
        // หมายเหตุ: ใช้เฉพาะ Supabase Realtime Broadcast (WebSocket in-memory, 0 DB queries)
        // ไม่ใช้ postgres_changes เพราะระบบใช้ Custom JWT + RLS (service_role เท่านั้น)
        // การตัด postgres_changes ช่วยลดภาระการยิง realtime.list_changes (WAL polling) ลง 100%

        channel.subscribe((status, err) => {
          if (err) {
            console.warn('Realtime channel subscription status:', status, err)
          }
        })
        isSubscribedRef.current = true
      }
    } catch (err) {
      console.warn('Realtime setup error:', err)
    }

    return () => {
      // ไม่ remove channel เพื่อแชร์ connection เดียวกันตลอด session
    }
  }, [refreshSession, router])

  return (
    <RealtimeContext.Provider value={{ session, refreshSession }}>
      {children}

      {/* Floating Realtime Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-md animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-start gap-3 p-4 rounded-xl shadow-xl border ${
              notification.type === 'success'
                ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#14532D]'
                : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#7F1D1D]'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-bold text-sm">{notification.title}</div>
              <div className="text-xs mt-0.5 opacity-90">{notification.text}</div>
            </div>
          </div>
        </div>
      )}
    </RealtimeContext.Provider>
  )
}
