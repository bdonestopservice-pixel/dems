import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'

// GET /api/plans/[id]/eligible-employees
// Returns active employees that are NOT yet in this plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim() || ''
  const warehouseParam = searchParams.get('warehouse')

  const supabase = createServerSupabaseClient()

  // 1. Fetch plan and existing employees concurrently in parallel
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
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงคลังนี้' }, { status: 403 })
  }

  const existingIds = (existingResult.data || []).map((e: any) => e.employee_id)

  // 3. Query active employees
  // ค่าเริ่มต้นเป็น 'all' เพื่อดึงพนักงานจากทุกคลัง
  const targetWarehouse = warehouseParam || 'all'

  let query = supabase
    .from('employees')
    .select('id, po_id, prefix, first_name, last_name, phone, warehouse, is_active')
    .eq('is_active', true)

  if (targetWarehouse && targetWarehouse !== 'all') {
    query = query.eq('warehouse', targetWarehouse)
  }

  // Exclude employees already in this plan
  if (existingIds.length > 0) {
    query = query.not('id', 'in', `(${existingIds.join(',')})`)
  }

  // Multi-word search
  if (search) {
    const words = search
      .split(/\s+/)
      .map((w) => w.replace(/[,()]/g, '').trim())
      .filter(Boolean)

    for (const word of words) {
      const s = `%${word}%`
      query = query.or(
        `first_name.ilike.${s},last_name.ilike.${s},po_id.ilike.${s},phone.ilike.${s}`
      )
    }
  }

  query = query.order('po_id', { ascending: true }).limit(1000)

  const { data: employees, error: empErr } = await query

  if (empErr) {
    console.error('Error fetching eligible employees:', empErr)
    return NextResponse.json({ error: empErr.message }, { status: 500 })
  }

  return NextResponse.json({
    employees: employees || [],
    plan_warehouse: plan.warehouse,
  })
}
