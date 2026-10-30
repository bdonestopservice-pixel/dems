import type { NamelistEntry } from '@/types'

/** select string สำหรับดึง namelist พร้อม join พนักงาน/แผนก/กะ */
export const NAMELIST_SELECT = `
  *,
  employees:employee_id (id, po_id, prefix, first_name, last_name, warehouse),
  departments:department_id (id, name, warehouse),
  shifts:shift_id (id, warehouse, start_time, end_time, type)
`

/** select string สำหรับดึง namelist พร้อม inner join แผนกเพื่อกรองตามคลังที่ระดับฐานข้อมูล (SQL level) */
export const NAMELIST_SELECT_INNER_DEPT = `
  *,
  employees:employee_id (id, po_id, prefix, first_name, last_name, warehouse),
  departments:department_id!inner (id, name, warehouse),
  shifts:shift_id (id, warehouse, start_time, end_time, type)
`

/** ตัด HH:MM:SS → HH:MM */
export function hhmm(t?: string | null): string {
  return t ? t.slice(0, 5) : ''
}

export function formatShiftRange(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—'
  return `${hhmm(start)}–${hhmm(end)}`
}

export function employeeFullName(e: { prefix?: string | null; first_name?: string | null; last_name?: string | null }): string {
  // ไม่แสดงคำนำหน้า (prefix) ในหน้า Namelist / จัดแพลนพนักงาน
  return `${e.first_name || ''} ${e.last_name || ''}`.trim()
}

/** แปลงแถวจาก Supabase (มี join) เป็น NamelistEntry */
export function mapNamelistRow(row: any): NamelistEntry {
  return {
    id: row.id,
    date: row.date,
    employee_id: row.employee_id,
    department_id: row.department_id,
    shift_id: row.shift_id,
    work_status: row.work_status,
    oa_status: row.oa_status || '-',
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    po_id: row.employees?.po_id,
    prefix: row.employees?.prefix || '',
    first_name: row.employees?.first_name || '',
    last_name: row.employees?.last_name || '',
    department_name: row.departments?.name,
    shift_start: row.shifts?.start_time,
    shift_end: row.shifts?.end_time,
    shift_type: row.shifts?.type,
    // คลังของรายการ: กะ → แผนก → คลังของพนักงาน
    warehouse:
      row.shifts?.warehouse || row.departments?.warehouse || row.employees?.warehouse || null,
  }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
