import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'

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
          prefix,
          first_name,
          last_name,
          phone,
          warehouse,
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
    prefix: pe.employees?.prefix || '',
    first_name: pe.employees?.first_name || '',
    last_name: pe.employees?.last_name || '',
    phone: pe.employees?.phone || '—',
    warehouse: pe.employees?.warehouse || plan.warehouse,
    department_name: plan.departments?.name || '—',
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
    .select('warehouse')
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

  return NextResponse.json({ success: true })
}
