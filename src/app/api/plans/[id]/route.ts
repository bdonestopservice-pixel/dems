import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'
import { recordAuditLog, buildFieldChanges } from '@/lib/audit-log'

// GET /api/plans/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: plan, error } = await supabase
    .from('plans')
    .select(`
      *,
      warehouses:warehouse (id, name),
      shifts:shift_id (id, start_time, end_time, type),
      departments:department_id (id, name),
      plan_employees (
        id,
        employee_id,
        sent_to_namelist,
        created_at,
        employees:employee_id (
          id,
          po_id,
          ops_id,
          id_card,
          prefix,
          first_name,
          last_name,
          phone,
          warehouse,
          note,
          is_blacklisted,
          blacklist_reason,
          is_active
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !plan) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลแพลนนี้' }, { status: 404 })
  }

  // Check warehouse permission
  const hasAccess = await hasWarehouseAccess(session, plan.warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงคลังของแพลนนี้' }, { status: 403 })
  }

  // Format plan details & roster
  const rawEmployees = plan.plan_employees || []
  const roster = rawEmployees.map((pe: any) => ({
    id: pe.id,
    plan_id: plan.id,
    employee_id: pe.employee_id,
    sent_to_namelist: Boolean(pe.sent_to_namelist),
    created_at: pe.created_at,
    po_id: pe.employees?.po_id || '—',
    ops_id: pe.employees?.ops_id || '—',
    id_card: pe.employees?.id_card || '',
    prefix: pe.employees?.prefix || '',
    first_name: pe.employees?.first_name || '',
    last_name: pe.employees?.last_name || '',
    phone: pe.employees?.phone || '—',
    warehouse: pe.employees?.warehouse || plan.warehouse,
    department_name: plan.departments?.name || '—',
    is_blacklisted:
      Boolean(pe.employees?.is_blacklisted) ||
      Boolean(pe.employees?.note && pe.employees.note.includes('__BLACKLIST__:')),
    blacklist_reason: pe.employees?.blacklist_reason || null,
  }))

  const formattedPlan = {
    id: plan.id,
    date: plan.date,
    warehouse: plan.warehouse,
    shift_id: plan.shift_id,
    department_id: plan.department_id,
    required_count: plan.required_count || 0,
    created_by: plan.created_by,
    created_at: plan.created_at,
    warehouse_name: plan.warehouses?.name || plan.warehouse,
    shift_start: plan.shifts?.start_time,
    shift_end: plan.shifts?.end_time,
    shift_type: plan.shifts?.type,
    department_name: plan.departments?.name || '—',
    current_count: roster.length,
    roster,
  }

  return NextResponse.json({ plan: formattedPlan })
}

// PATCH /api/plans/[id]
// Updates plan details: department_id, shift_id, required_count, date
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServerSupabaseClient()

  // 1. Fetch current plan to check warehouse permission
  const { data: currentPlan, error: fetchErr } = await supabase
    .from('plans')
    .select('*, shifts:shift_id (start_time, end_time), departments:department_id (name)')
    .eq('id', id)
    .single()

  if (fetchErr || !currentPlan) {
    return NextResponse.json({ error: 'ไม่พบแพลนนี้' }, { status: 404 })
  }

  const hasAccess = await hasWarehouseAccess(session, currentPlan.warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขแพลนในคลังนี้' }, { status: 403 })
  }

  // 2. Parse payload
  const body = await request.json()
  const { department_id, shift_id, required_count, date } = body

  const updateFields: Record<string, any> = {}

  if (department_id || shift_id) {
    const deptPromise = department_id
      ? supabase.from('departments').select('id, warehouse').eq('id', department_id).single()
      : Promise.resolve({ data: null })
    const shiftPromise = shift_id
      ? supabase.from('shifts').select('id, warehouse').eq('id', shift_id).single()
      : Promise.resolve({ data: null })

    const [deptResult, shiftResult] = await Promise.all([deptPromise, shiftPromise])

    if (department_id) {
      if (!deptResult.data) {
        return NextResponse.json({ error: 'ไม่พบแผนกที่เลือก' }, { status: 400 })
      }
      updateFields.department_id = department_id
    }

    if (shift_id) {
      if (!shiftResult.data) {
        return NextResponse.json({ error: 'ไม่พบกะที่เลือก' }, { status: 400 })
      }
      updateFields.shift_id = shift_id
    }
  }

  if (required_count !== undefined && required_count !== '') {
    const countNum = Number(required_count)
    if (isNaN(countNum) || countNum <= 0) {
      return NextResponse.json({ error: 'จำนวนคนที่ต้องการต้องมากกว่า 0' }, { status: 400 })
    }
    if (countNum > 500) {
      return NextResponse.json({ error: 'จำนวนคนที่ต้องการต่อหนึ่งแพลนต้องไม่เกิน 500 คน' }, { status: 400 })
    }
    updateFields.required_count = countNum
  }

  if (date) {
    updateFields.date = date
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องอัปเดต' }, { status: 400 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('plans')
    .update(updateFields)
    .eq('id', id)
    .select(`
      *,
      warehouses:warehouse (id, name),
      shifts:shift_id (id, start_time, end_time, type),
      departments:department_id (id, name)
    `)
    .single()

  if (updateErr) {
    console.error('Error updating plan:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const prevShiftText = currentPlan.shifts ? `${currentPlan.shifts.start_time}–${currentPlan.shifts.end_time}` : null
  const nextShiftText = updated.shifts ? `${updated.shifts.start_time}–${updated.shifts.end_time}` : null
  const planChanges = buildFieldChanges(
    {
      date: currentPlan.date,
      department: currentPlan.departments?.name || currentPlan.department_id,
      shift: prevShiftText,
      required_count: currentPlan.required_count,
    },
    {
      date: updated.date,
      department: updated.departments?.name || updated.department_id,
      shift: nextShiftText,
      required_count: updated.required_count,
    },
    [
      { key: 'date', label: 'วันที่' },
      { key: 'department', label: 'แผนก' },
      { key: 'shift', label: 'กะการทำงาน' },
      { key: 'required_count', label: 'จำนวนคนที่ต้องการ' },
    ]
  )

  const planTitle = `${updated.departments?.name || '—'} · ${updated.date} (${updated.warehouse})`
  recordAuditLog({
    request,
    session,
    action: 'UPDATE',
    menu: 'planning',
    warehouse: updated.warehouse,
    targetId: updated.id,
    targetName: planTitle,
    summary:
      planChanges.length > 0
        ? `แก้ไขแพลน ${planTitle} (${planChanges.map((c) => c.label).join(', ')})`
        : `บันทึกแก้ไขแพลน ${planTitle}`,
    changes: planChanges,
  })

  return NextResponse.json({
    success: true,
    plan: {
      ...updated,
      warehouse_name: updated.warehouses?.name || updated.warehouse,
      shift_start: updated.shifts?.start_time,
      shift_end: updated.shifts?.end_time,
      shift_type: updated.shifts?.type,
      department_name: updated.departments?.name || '—',
    },
  })
}

// DELETE /api/plans/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServerSupabaseClient()

  // Fetch plan to check warehouse access
  const { data: plan, error: fetchErr } = await supabase
    .from('plans')
    .select('id, date, warehouse, required_count, shifts:shift_id (start_time, end_time), departments:department_id (name)')
    .eq('id', id)
    .single()

  if (fetchErr || !plan) {
    return NextResponse.json({ error: 'ไม่พบแพลนที่ต้องการลบ' }, { status: 404 })
  }

  const hasAccess = await hasWarehouseAccess(session, plan.warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบแพลนในคลังนี้' }, { status: 403 })
  }

  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const deptName = (plan as any).departments?.name || '—'
  const shiftStr = (plan as any).shifts ? `${(plan as any).shifts.start_time}–${(plan as any).shifts.end_time}` : ''
  const planTitle = `${deptName}${shiftStr ? ` (${shiftStr})` : ''} · ${plan.date}`
  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'planning',
    warehouse: plan.warehouse,
    targetId: plan.id,
    targetName: planTitle,
    summary: `ลบแพลน ${planTitle} คลัง ${plan.warehouse} (ต้องการ ${plan.required_count} คน)`,
    meta: { date: plan.date, department: deptName, shift: shiftStr, required_count: plan.required_count },
  })

  return NextResponse.json({ success: true })
}

