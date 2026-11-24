import { after, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AuthSession, AuditAction, AuditMenu, AuditFieldChange } from '@/types'

export interface RecordAuditParams {
  request?: NextRequest
  session?: AuthSession | null
  /** กรณีไม่มี session เช่น ล็อกอินไม่สำเร็จ */
  actor?: {
    userId?: string | null
    name: string
    email: string
    role: string
  }
  action: AuditAction
  menu: AuditMenu
  warehouse?: string | null
  targetId?: string | null
  targetName?: string | null
  summary: string
  changes?: AuditFieldChange[]
  meta?: Record<string, unknown>
}

function extractClientIp(request?: NextRequest): string | null {
  if (!request) return null
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return null
}

function extractUserAgent(request?: NextRequest): string | null {
  if (!request) return null
  const ua = request.headers.get('user-agent')?.trim()
  return ua ? ua.slice(0, 320) : null
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
  if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '—'
  return String(val).trim() || '—'
}

/**
 * สร้างรายการ Diff (ก่อน → หลัง) เฉพาะฟิลด์ที่มีการเปลี่ยนแปลงจริง
 * เพื่อบันทึกใน audit_logs.details.changes ให้ตรวจสอบย้อนหลังได้ละเอียด
 */
export function buildFieldChanges(
  before: Record<string, unknown> | null | undefined,
  afterObj: Record<string, unknown> | null | undefined,
  fields: { key: string; label: string; mask?: boolean }[]
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = []
  if (!before || !afterObj) return changes

  for (const { key, label, mask } of fields) {
    if (!(key in afterObj)) continue
    const prevRaw = before[key]
    const nextRaw = afterObj[key]
    const prevStr = formatVal(prevRaw)
    const nextStr = formatVal(nextRaw)
    if (prevStr === nextStr) continue

    changes.push({
      field: key,
      label,
      before: mask ? (prevStr === '—' ? '—' : '••••••••') : prevStr,
      after: mask ? (nextStr === '—' ? '—' : '••••••••') : nextStr,
    })
  }
  return changes
}

/**
 * บันทึก Audit Log แบบ Non-Blocking ด้วย Next.js after()
 * - เพิ่ม latency 0ms ให้ผู้ใช้งาน (ส่ง HTTP Response กลับก่อนแล้วจึงเขียนลง Supabase)
 * - การันตีการทำงานจบสมบูรณ์บน Vercel Serverless
 * - หากตารางยังไม่ถูกสร้างหรือเกิดข้อผิดพลาด จะไม่กระทบการทำงานหลักของระบบเด็ดขาด
 */
export function recordAuditLog(params: RecordAuditParams): void {
  const actor = params.actor || (params.session
    ? {
        userId: params.session.userId,
        name: params.session.name,
        email: params.session.email,
        role: params.session.role,
      }
    : null)

  if (!actor) return

  const ip_address = extractClientIp(params.request)
  const user_agent = extractUserAgent(params.request)

  const details: Record<string, unknown> = {}
  if (params.changes && params.changes.length > 0) {
    details.changes = params.changes
  }
  if (params.meta && Object.keys(params.meta).length > 0) {
    details.meta = params.meta
  }

  const row = {
    user_id: actor.userId || null,
    user_name: actor.name || 'ไม่ระบุชื่อ',
    user_email: actor.email || '—',
    user_role: actor.role || 'unknown',
    action: params.action,
    menu: params.menu,
    warehouse: params.warehouse || null,
    target_id: params.targetId ? String(params.targetId) : null,
    target_name: params.targetName ? String(params.targetName).slice(0, 240) : null,
    summary: params.summary.slice(0, 500),
    details,
    ip_address,
    user_agent,
  }

  const persist = async () => {
    try {
      const supabase = createServerSupabaseClient()
      const { error } = await supabase.from('audit_logs').insert(row)
      if (error) {
        // ไม่ throw เพื่อไม่ให้กระทบ flow หลัก (เช่น ช่วงที่ยังไม่ได้รัน SQL สร้างตาราง)
        console.warn('[audit_logs] insert skipped:', error.message)
      }
    } catch (err) {
      console.warn('[audit_logs] unexpected error:', err)
    }
  }

  try {
    after(persist)
  } catch {
    // Fallback กรณีถูกเรียกนอก Next.js request lifecycle
    void persist()
  }
}
