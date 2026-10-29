import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'

// POST /api/plans/[id]/roster
// Adds selected employees to plan roster
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { employee_ids } = body

  if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
    return NextResponse.json({ error: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // 1. Check plan existence and fetch existing employees concurrently in parallel
  const [planResult, existingResult] = await Promise.all([
    supabase.from('plans').select('id, warehouse').eq('id', id).single(),
    supabase.from('plan_employees').select('employee_id').eq('plan_id', id),
  ])

  const plan = planResult.data
  if (planResult.error || !plan) {
    return NextResponse.json({ error: 'ไม่พบแพลนนี้' }, { status: 404 })
  }

  const hasAccess = await hasWarehouseAccess(session, plan.warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการแพลนในคลังนี้' }, { status: 403 })
  }

  const existingSet = new Set((existingResult.data || []).map((e: any) => e.employee_id))
  const toAdd = employee_ids.filter((empId: string) => !existingSet.has(empId))

  if (toAdd.length === 0) {
    return NextResponse.json({
      success: true,
      added_count: 0,
      message: 'พนักงานที่เลือกอยู่ในแพลนนี้อยู่แล้ว',
    })
  }

  // 3. Batch insert new roster entries
  const rows = toAdd.map((empId: string) => ({
    plan_id: id,
    employee_id: empId,
    sent_to_namelist: false,
  }))

  const { data, error } = await supabase.from('plan_employees').insert(rows).select()

  if (error) {
    console.error('Error adding employees to plan roster:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    added_count: data?.length || 0,
  })
}

// DELETE /api/plans/[id]/roster
// Removes an employee from this plan's roster
// (Crucial: only removes from plan_employees, NOT from global employees table!)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = request.nextUrl
  const employeeId = searchParams.get('employee_id')

  if (!employeeId) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Check plan warehouse permission
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('warehouse')
    .eq('id', id)
    .single()

  if (planErr || !plan) {
    return NextResponse.json({ error: 'ไม่พบแพลนนี้' }, { status: 404 })
  }

  const hasAccess = await hasWarehouseAccess(session, plan.warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการแพลนในคลังนี้' }, { status: 403 })
  }

  // Delete from plan_employees only
  const { error } = await supabase
    .from('plan_employees')
    .delete()
    .eq('plan_id', id)
    .eq('employee_id', employeeId)

  if (error) {
    console.error('Error removing employee from plan:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
