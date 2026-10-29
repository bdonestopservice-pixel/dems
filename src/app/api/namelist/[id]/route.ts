import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { getLiveUserWarehouses } from '@/lib/auth/warehouse-auth'
import { NAMELIST_SELECT, mapNamelistRow } from '@/lib/namelist'
import type { AuthSession, NamelistEntry } from '@/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function canAccess(session: AuthSession, warehouse?: string | null) {
  if (session.role === 'super_admin') return true
  if (!warehouse) return false
  const permitted = await getLiveUserWarehouses(session)
  return permitted.includes(warehouse)
}

async function loadEntry(id: string): Promise<NamelistEntry | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('namelist')
    .select(NAMELIST_SELECT)
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapNamelistRow(data)
}

// GET /api/namelist/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const entry = await loadEntry(id)
  if (!entry) return NextResponse.json({ error: 'ไม่พบรายการใน Namelist' }, { status: 404 })
  if (!(await canAccess(session, entry.warehouse))) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงรายการนี้' }, { status: 403 })
  }
  return NextResponse.json({ entry })
}

// PATCH /api/namelist/[id]
// แก้ได้: date, department_id, shift_id, work_status, oa_status, note (ส่งเฉพาะ field ที่ต้องการแก้)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const entry = await loadEntry(id)
  if (!entry) return NextResponse.json({ error: 'ไม่พบรายการใน Namelist' }, { status: 404 })
  if (!(await canAccess(session, entry.warehouse))) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขรายการนี้' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const body = await request.json()
  const update: Record<string, any> = {}

  // วันที่ / กะ — ห้ามชนกับรายการของพนักงานคนเดียวกันที่ "วันที่ + กะ" เดียวกัน (ต่างกะซ้ำได้)
  const targetDate: string = 'date' in body ? body.date : entry.date
  const targetShiftId: string | null = 'shift_id' in body ? body.shift_id : entry.shift_id
  if ('date' in body) {
    if (!DATE_RE.test(body.date || '')) {
      return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 })
    }
    update.date = body.date
  }
  if (('date' in body && body.date !== entry.date) || ('shift_id' in body && body.shift_id !== entry.shift_id)) {
    let dupQuery = supabase
      .from('namelist')
      .select('id')
      .eq('date', targetDate)
      .eq('employee_id', entry.employee_id)
      .neq('id', id)
    if (targetShiftId) dupQuery = dupQuery.eq('shift_id', targetShiftId)
    const { data: dup } = await dupQuery.limit(1)
    if (dup && dup.length > 0) {
      return NextResponse.json(
        { error: 'พนักงานคนนี้มีชื่ออยู่ใน Namelist ของวันที่และกะที่เลือกแล้ว' },
        { status: 409 }
      )
    }
  }

  // แผนก / กะ — ต้องเป็นคลังเดียวกัน และอยู่ในสิทธิ์ของผู้ใช้
  if ('department_id' in body || 'shift_id' in body) {
    const deptId = 'department_id' in body ? body.department_id : entry.department_id
    const shiftId = 'shift_id' in body ? body.shift_id : entry.shift_id
    if (!deptId) return NextResponse.json({ error: 'กรุณาเลือกแผนก' }, { status: 400 })
    if (!shiftId) return NextResponse.json({ error: 'กรุณาเลือกกะ' }, { status: 400 })

    const [{ data: dept }, { data: shift }] = await Promise.all([
      supabase.from('departments').select('id, warehouse').eq('id', deptId).single(),
      supabase.from('shifts').select('id, warehouse').eq('id', shiftId).single(),
    ])
    if (!dept) return NextResponse.json({ error: 'ไม่พบแผนกที่เลือก' }, { status: 400 })
    if (!shift) return NextResponse.json({ error: 'ไม่พบกะที่เลือก' }, { status: 400 })
    if (dept.warehouse !== shift.warehouse) {
      return NextResponse.json({ error: 'แผนกและกะต้องเป็นของคลังเดียวกัน' }, { status: 400 })
    }
    if (!(await canAccess(session, dept.warehouse))) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ย้ายรายการไปยังคลังนี้' }, { status: 403 })
    }
    if ('department_id' in body) update.department_id = deptId
    if ('shift_id' in body) update.shift_id = shiftId
  }

  // Status การทำงาน — ต้องเป็นค่าจากชุดส่วนกลาง (ว่าง = ยังไม่ระบุ)
  if ('work_status' in body) {
    const v = typeof body.work_status === 'string' ? body.work_status.trim() : ''
    if (v) {
      const { data: ws } = await supabase
        .from('work_statuses')
        .select('id')
        .eq('name', v)
        .limit(1)
      if (!ws || ws.length === 0) {
        return NextResponse.json({ error: 'ไม่พบ Status การทำงานที่เลือก' }, { status: 400 })
      }
    }
    update.work_status = v || null
  }

  // ต่างพื้นที่ — '-' หรือชื่อ OA (ค่าเริ่มต้น '-')
  if ('oa_status' in body) {
    const v = typeof body.oa_status === 'string' ? body.oa_status.trim() : ''
    update.oa_status = v || '-'
  }

  // หมายเหตุ — ว่างได้
  if ('note' in body) {
    const v = typeof body.note === 'string' ? body.note.trim() : ''
    update.note = v || null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องอัปเดต' }, { status: 400 })
  }

  update.updated_at = new Date().toISOString()

  const { error } = await supabase.from('namelist').update(update).eq('id', id)
  if (error) {
    console.error('Error updating namelist:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updated = await loadEntry(id)
  return NextResponse.json({ success: true, entry: updated })
}

// DELETE /api/namelist/[id]
// ลบเฉพาะรายการของวันนั้นออกจาก Namelist (ไม่กระทบข้อมูลพนักงานกลาง)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const entry = await loadEntry(id)
  if (!entry) return NextResponse.json({ error: 'ไม่พบรายการใน Namelist' }, { status: 404 })
  if (!(await canAccess(session, entry.warehouse))) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบรายการนี้' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('namelist').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // คืนสถานะ "ส่งแล้ว" ในแพลนของวันนั้น เพื่อให้ส่งเข้า Namelist ใหม่ได้อีกครั้ง
  const { data: dayPlans } = await supabase.from('plans').select('id').eq('date', entry.date)
  const planIds = (dayPlans || []).map((p: any) => p.id)
  if (planIds.length > 0) {
    await supabase
      .from('plan_employees')
      .update({ sent_to_namelist: false })
      .eq('employee_id', entry.employee_id)
      .in('plan_id', planIds)
  }

  return NextResponse.json({ success: true })
}
