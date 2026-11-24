import type { AuditMenu } from '@/types'

/**
 * บันทึก Audit Log ฝั่ง Client สำหรับเหตุการณ์ Export ไฟล์ (Excel / PDF / CSV)
 * ใช้ keepalive: true เพื่อทำงานเบื้องหลังแบบไม่บล็อกการดาวน์โหลดไฟล์
 */
export function logExportAudit(params: {
  menu: AuditMenu
  warehouse?: string | null
  targetName?: string
  summary: string
  meta?: Record<string, unknown>
}) {
  try {
    void fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        action: 'EXPORT',
        menu: params.menu,
        warehouse: params.warehouse && params.warehouse !== 'all' ? params.warehouse : null,
        targetName: params.targetName || null,
        summary: params.summary,
        meta: params.meta || {},
      }),
    }).catch(() => {})
  } catch {
    // Ignore client network failures
  }
}
