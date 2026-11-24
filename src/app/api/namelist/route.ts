import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { getLiveUserWarehouses } from '@/lib/auth/warehouse-auth'
import { recordAuditLog } from '@/lib/audit-log'
import { NAMELIST_SELECT, NAMELIST_SELECT_INNER_DEPT, mapNamelistRow, chunk } from '@/lib/namelist'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/namelist?date=YYYY-MM-DD&warehouse=SOCE|all
// คืนรายชื่อของวันนั้น เฉพาะคลังที่ผู้ใช้มีสิทธิ์ + ตัวเลือก dropdown (Status / OA ตามคลัง)
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const date = searchParams.get('date') || ''
  const warehouse = searchParams.get('warehouse') || 'all'

  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 })
  }

  const isSuperAdmin = session.role === 'super_admin'
  const permitted = isSuperAdmin ? null : await getLiveUserWarehouses(session)

  if (warehouse !== 'all' && permitted && !permitted.includes(warehouse)) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงคลังนี้' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()

  // 1. Determine target warehouses for SQL filtering and OA options
  const targetWarehouses: string[] =
    warehouse !== 'all'
      ? [warehouse]
      : !isSuperAdmin && permitted && permitted.length > 0
      ? permitted
      : []

  const hasSpecificWarehouseFilter = targetWarehouses.length > 0
  const selectQuery = hasSpecificWarehouseFilter ? NAMELIST_SELECT_INNER_DEPT : NAMELIST_SELECT

  // 2. Start fetching work_statuses and oa_options concurrently in parallel
  const statusesPromise = supabase
    .from('work_statuses')
    .select('id, name, sort_order')
    .order('sort_order')

  const oaPromise = hasSpecificWarehouseFilter
    ? supabase
        .from('oa_options')
        .select('warehouse, name, created_at')
        .in('warehouse', targetWarehouses)
        .order('created_at')
    : null

  // 3. Fetch namelist entries filtered directly at DATABASE (SQL) level
  const rows: any[] = []
  for (let page = 0; page < 30; page++) {
    const from = page * 1000
    let query = supabase
      .from('namelist')
      .select(selectQuery)
      .eq('date', date)

    if (warehouse !== 'all') {
      query = query.eq('departments.warehouse', warehouse)
    } else if (!isSuperAdmin && permitted && permitted.length > 0) {
      query = query.in('departments.warehouse', permitted)
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999)

    if (error) {
      console.error('Error fetching namelist:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  let entries = rows.map(mapNamelistRow)

  // Fail-safe sanity check (already filtered in database)
  if (warehouse !== 'all') {
    entries = entries.filter((e) => e.warehouse === warehouse)
  } else if (permitted) {
    entries = entries.filter((e) => !!e.warehouse && permitted.includes(e.warehouse))
  }

  // เรียงตามเวลาเริ่มกะ แล้วตามรหัสพนักงาน
  entries.sort((a, b) => {
    const sa = a.shift_start || '99:99'
    const sb = b.shift_start || '99:99'
    if (sa !== sb) return sa.localeCompare(sb)
    return (a.po_id || '').localeCompare(b.po_id || '')
  })

  const summary = {
    total: entries.length,
    day: entries.filter((e) => e.shift_type === 'D').length,
    night: entries.filter((e) => e.shift_type === 'N').length,
  }

  // ตัวเลือก dropdown: รวมผลลัพธ์จาก Promise.all
  const whs = Array.from(new Set(entries.map((e) => e.warehouse).filter(Boolean))) as string[]

  const resolvedOaPromise = oaPromise
    ? oaPromise
    : whs.length > 0
    ? supabase
        .from('oa_options')
        .select('warehouse, name, created_at')
        .in('warehouse', whs)
        .order('created_at')
    : Promise.resolve({ data: [] })

  const [{ data: statuses }, { data: oaRows }] = await Promise.all([
    statusesPromise,
    resolvedOaPromise,
  ])

  const oaOptions: Record<string, string[]> = {}
  for (const w of whs.length > 0 ? whs : targetWarehouses) oaOptions[w] = []
  for (const r of oaRows || []) oaOptions[r.warehouse]?.push(r.name)

  return NextResponse.json(
    {
      entries,
      summary,
      work_statuses: (statuses || []).map((s: any) => s.name),
      oa_options: oaOptions,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
}

// POST /api/namelist
// เพิ่มพนักงานหลายคนเข้า Namelist ของวัน/แผนก/กะ เดียวกัน (บันทึกครั้งเดียว)
// body: { date, department_id, shift_id, employees: [{ employee_id, note? }] }
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { date, department_id, shift_id, employees } = body

    if (!DATE_RE.test(date || '')) {
      return NextResponse.json({ error: 'กรุณาระบุวันที่' }, { status: 400 })
    }
    if (!department_id) return NextResponse.json({ error: 'กรุณาเลือกแผนก' }, { status: 400 })
    if (!shift_id) return NextResponse.json({ error: 'กรุณาเลือกกะ' }, { status: 400 })
    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    const [{ data: dept }, { data: shift }] = await Promise.all([
      supabase.from('departments').select('id, name, warehouse').eq('id', department_id).single(),
      supabase.from('shifts').select('id, start_time, end_time, warehouse').eq('id', shift_id).single(),
    ])
    if (!dept) return NextResponse.json({ error: 'ไม่พบแผนกที่เลือก' }, { status: 400 })
    if (!shift) return NextResponse.json({ error: 'ไม่พบกะที่เลือก' }, { status: 400 })
    if (dept.warehouse !== shift.warehouse) {
      return NextResponse.json({ error: 'แผนกและกะต้องเป็นของคลังเดียวกัน' }, { status: 400 })
    }

    // Admin เพิ่มได้เฉพาะคลังของตัวเอง
    if (session.role !== 'super_admin') {
      const permitted = await getLiveUserWarehouses(session)
      if (!permitted.includes(dept.warehouse)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เพิ่มรายชื่อในคลังนี้' }, { status: 403 })
      }
    }

    // รวมรายการซ้ำใน request เอง
    const notes = new Map<string, string | null>()
    for (const e of employees) {
      if (e?.employee_id && !notes.has(e.employee_id)) {
        const n = typeof e.note === 'string' ? e.note.trim() : ''
        notes.set(e.employee_id, n || null)
      }
    }
    const ids = Array.from(notes.keys())

    // ตรวจสอบสถานะติดแบล็กลิสต์ (ห้ามเพิ่มพนักงานที่ติดแบล็กลิสต์เข้าสู่ Namelist เด็ดขาด)
    const { data: empCheck } = await supabase
      .from('employees')
      .select('id, first_name, last_name, note, is_blacklisted')
      .in('id', ids)

    const blacklisted = (empCheck || []).find((e: any) => {
      if (e.is_blacklisted) return true
      if (e.note && e.note.includes('__BLACKLIST__:')) return true
      return false
    })

    if (blacklisted) {
      return NextResponse.json(
        {
          error: `ไม่สามารถเพิ่มพนักงาน "${blacklisted.first_name} ${blacklisted.last_name}" เข้าสู่ Namelist ได้ เนื่องจากติดสถานะแบล็กลิสต์`,
        },
        { status: 400 }
      )
    }

    // ตรวจรายชื่อที่มีใน Namelist ของ "วันที่ + กะ" เดียวกันอยู่แล้ว (ไม่ให้ซ้ำ) — ต่างกะเพิ่มซ้ำได้
    const duplicates = new Set<string>()
    for (const part of chunk(ids, 150)) {
      const { data: existing, error: exErr } = await supabase
        .from('namelist')
        .select('employee_id')
        .eq('date', date)
        .eq('shift_id', shift_id)
        .in('employee_id', part)
      if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
      for (const r of existing || []) duplicates.add(r.employee_id)
    }

    const toInsert = ids.filter((id) => !duplicates.has(id))
    if (toInsert.length === 0) {
      return NextResponse.json(
        {
          error: 'พนักงานที่เลือกมีชื่ออยู่ใน Namelist ของวันที่และกะนี้แล้วทั้งหมด',
          duplicates: Array.from(duplicates),
        },
        { status: 409 }
      )
    }

    const rows = toInsert.map((employee_id) => ({
      date,
      employee_id,
      department_id,
      shift_id,
      work_status: null,
      oa_status: '-',
      note: notes.get(employee_id) ?? null,
      created_by: session.userId,
    }))

    const { error: insErr } = await supabase.from('namelist').insert(rows)
    if (insErr) {
      console.error('Error inserting namelist:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    const sampleEmps = (empCheck || [])
      .filter((e: any) => toInsert.includes(e.id))
      .slice(0, 5)
      .map((e: any) => `${e.first_name} ${e.last_name}`)
    recordAuditLog({
      request,
      session,
      action: 'CREATE',
      menu: 'namelist',
      warehouse: dept.warehouse,
      targetId: department_id,
      targetName: `${dept.name || '—'} (${shift.start_time}–${shift.end_time}) · ${date}`,
      summary: `เพิ่มรายชื่อเข้า Namelist วันที่ ${date} แผนก ${dept.name || '—'} กะ ${shift.start_time}–${shift.end_time} จำนวน ${toInsert.length} คน`,
      meta: {
        date,
        department: dept.name,
        shift: `${shift.start_time}–${shift.end_time}`,
        inserted_count: toInsert.length,
        duplicate_count: duplicates.size,
        sample_employees: sampleEmps,
      },
    })

    return NextResponse.json({
      success: true,
      inserted_count: toInsert.length,
      duplicate_count: duplicates.size,
      duplicates: Array.from(duplicates),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
