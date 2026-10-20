import { supabase } from '@/lib/supabase/client'

export const REALTIME_CHANNEL_NAME = 'dems-realtime-channel'

export type RealtimeEventType =
  | 'user-updated'       // เมื่อมีการ grant คลัง, เปลี่ยนบทบาท, ปิดบัญชี หรือเปลี่ยนรหัสผ่าน
  | 'plan-updated'       // เมื่อมีการสร้าง, แก้ไข, ลบแพลน
  | 'plan-roster-updated'// เมื่อมีการเพิ่ม/ลบพนักงานในแพลน
  | 'employee-updated'   // เมื่อมีการเพิ่ม/แก้ไขข้อมูลพนักงาน
  | 'namelist-updated'   // เมื่อมีการบันทึก/อัปเดต namelist
  | 'dropdown-updated'   // เมื่อมีการเพิ่ม/แก้ไขข้อมูลคลัง, แผนก, กะ ฯลฯ

export interface RealtimePayload {
  userId?: string
  warehouses?: string[]
  role?: string
  is_active?: boolean
  passwordChanged?: boolean
  timestamp?: number
  [key: string]: unknown
}

let activeChannel: ReturnType<typeof supabase.channel> | null = null

export function getOrCreateRealtimeChannel() {
  if (!activeChannel) {
    activeChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
      config: {
        broadcast: { ack: true, self: true },
      },
    })
    activeChannel.subscribe()
  }
  return activeChannel
}

/**
 * ส่งสัญญาณ Realtime แจ้งเตือนทุกเครื่องและทุกแท็บที่เปิดอยู่
 */
export function broadcastRealtime(event: RealtimeEventType, payload: RealtimePayload = {}) {
  try {
    const channel = getOrCreateRealtimeChannel()
    const enrichedPayload = {
      ...payload,
      timestamp: Date.now(),
    }

    // 1. กระจายสัญญาณผ่าน Supabase Realtime WebSocket (ข้ามเบราว์เซอร์/ข้ามอุปกรณ์)
    channel.send({
      type: 'broadcast',
      event,
      payload: enrichedPayload,
    })

    // 2. กระจาย CustomEvent ภายในเบราว์เซอร์เดียวกันทันที (ไม่ต้องรอรอบ socket)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dems:realtime', {
          detail: { event, payload: enrichedPayload },
        })
      )
    }
  } catch (err) {
    console.warn('Realtime broadcast error:', err)
  }
}
