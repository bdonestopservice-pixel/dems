import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'

// POST /api/plans/[id]/send-namelist
// Sends selected employees from plan roster to daily namelist
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
    return NextResponse.json({ error: 'กรุณาเลือกพนักงานที่จะส่งเข้า Namelist' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // ตรวจสอบสถานะติดแบล็กลิสต์ (ห้ามส่งพนักงานที่ติดแบล็กลิสต์เข้า Namelist เด็ดขาด)
  const { data: empCheck } = await supabase
    .from('employees')
    .select('id, first_name, last_name, note, is_blacklisted')
    .in('id', employee_ids)

  const blacklisted = (empCheck || []).find((e: any) => {
    if (e.is_blacklisted) return true
    if (e.note && e.note.includes('__BLACKLIST__:')) return true
    return false
  })

  if (blacklisted) {
    return NextResponse.json(
      {
        error: `ไม่สามารถส่งพนักงาน "${blacklisted.first_name} ${blacklisted.last_name}" เข้า Namelist ได้ เนื่องจากติดสถานะแบล็กลิสต์`,
      },
      { status: 400 }
    )
  }

  // 1. Fetch plan details
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, date, warehouse, department_id, shift_id')
    .eq('id', id)
    .single()

  if (planErr || !plan) {
    return NextResponse.json({ error: 'ไม่พบแพลนนี้' }, { status: 404 })
  }

  // 2. Check authorization
  const hasAccess = await hasWarehouseAccess(session, plan.warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการแพลนในคลังนี้' }, { status: 403 })
  }

  // 3. Check for existing entries in namelist on the same date + shift (ต่างกะเพิ่มซ้ำได้)
  let existingQuery = supabase
    .from('namelist')
    .select('employee_id')
    .eq('date', plan.date)
    .in('employee_id', employee_ids)
  if (plan.shift_id) existingQuery = existingQuery.eq('shift_id', plan.shift_id)
  const { data: existingNamelist, error: checkErr } = await existingQuery

  if (checkErr) {
    console.error('Error checking existing namelist entries:', checkErr)
  }

  const existingEmployeeIds = new Set((existingNamelist || []).map((n: any) => n.employee_id))
  const newEmployeesToInsert = employee_ids.filter((empId: string) => !existingEmployeeIds.has(empId))

  // 4. Insert new entries into namelist
  if (newEmployeesToInsert.length > 0) {
    const namelistRows = newEmployeesToInsert.map((empId: string) => ({
      date: plan.date,
      employee_id: empId,
      department_id: plan.department_id,
      shift_id: plan.shift_id,
      work_status: null,
      oa_status: '-',
      created_by: session.userId,
    }))

    const { error: insertErr } = await supabase.from('namelist').insert(namelistRows)
    if (insertErr) {
      console.error('Error inserting into namelist:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // 5. Update plan_employees to set sent_to_namelist = true
  const { error: updateErr } = await supabase
    .from('plan_employees')
    .update({ sent_to_namelist: true })
    .eq('plan_id', id)
    .in('employee_id', employee_ids)

  if (updateErr) {
    console.error('Error updating plan_employees sent_to_namelist flag:', updateErr)
  }

  return NextResponse.json({
    success: true,
    total_selected: employee_ids.length,
    inserted_count: newEmployeesToInsert.length,
    already_in_namelist_count: existingEmployeeIds.size,
  })
}
