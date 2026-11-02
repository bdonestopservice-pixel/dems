import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'

export const dynamic = 'force-dynamic'

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
    supabase.from('plans').select('id, warehouse, department_id').eq('id', id).single(),
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

  // 2. Fetch namelist usage counts for this plan's department (Recently used)
  const usageMap = new Map<string, number>()
  if (plan.department_id) {
    for (let page = 0; page < 10; page++) {
      const from = page * 1000
      const { data: nlRows, error: nlErr } = await supabase
        .from('namelist')
        .select('employee_id')
        .eq('department_id', plan.department_id)
        .range(from, from + 999)

      if (nlErr) {
        console.error('Error fetching namelist usage counts:', nlErr)
        break
      }
      for (const r of nlRows || []) {
        if (r.employee_id) {
          usageMap.set(r.employee_id, (usageMap.get(r.employee_id) || 0) + 1)
        }
      }
      if (!nlRows || nlRows.length < 1000) break
    }

    // รวมพนักงานจาก plan_employees ที่มี sent_to_namelist = true ของแผนกนี้ด้วย
    const { data: planList } = await supabase
      .from('plans')
      .select('id')
      .eq('department_id', plan.department_id)

    if (planList && planList.length > 0) {
      const planIds = planList.map((p) => p.id)
      const { data: peRows } = await supabase
        .from('plan_employees')
        .select('employee_id')
        .in('plan_id', planIds)
        .eq('sent_to_namelist', true)

      for (const pe of peRows || []) {
        if (pe.employee_id && !usageMap.has(pe.employee_id)) {
          usageMap.set(pe.employee_id, 1)
        }
      }
    }
  }

  // 3. Query employees
  // ค่าเริ่มต้นเป็น 'all' เพื่อดึงพนักงานจากทุกคลัง
  const targetWarehouse = warehouseParam || 'all'

  // ดึงกลุ่ม Recently used ให้ครบถ้วนเสมอ โดยไม่โดนจำกัดด้วย SQL limit
  const recentIds = Array.from(usageMap.keys()).filter((id) => !existingIds.includes(id))
  let recentEmployees: any[] = []

  if (recentIds.length > 0) {
    for (let i = 0; i < recentIds.length; i += 100) {
      const chunk = recentIds.slice(i, i + 100)
      let q = supabase
        .from('employees')
        .select('id, po_id, prefix, first_name, last_name, phone, warehouse, is_active')
        .in('id', chunk)
        .eq('is_active', true)

      if (targetWarehouse && targetWarehouse !== 'all') {
        q = q.eq('warehouse', targetWarehouse)
      }

      if (search) {
        const words = search
          .split(/\s+/)
          .map((w) => w.replace(/[,()]/g, '').trim())
          .filter(Boolean)

        for (const word of words) {
          const s = `%${word}%`
          q = q.or(`first_name.ilike.${s},last_name.ilike.${s},po_id.ilike.${s},phone.ilike.${s}`)
        }
      }

      const { data: chunkData, error: chunkErr } = await q
      if (!chunkErr && chunkData) {
        recentEmployees.push(...chunkData)
      }
    }
  }

  // ดึงกลุ่มพนักงานทั่วไป (ไม่รวมคนที่อยู่ในแพลนแล้ว และไม่รวมคนที่อยู่ในกลุ่ม Recently used)
  const excludedIds = [...new Set([...existingIds, ...recentEmployees.map((e) => e.id)])]

  let generalQuery = supabase
    .from('employees')
    .select('id, po_id, prefix, first_name, last_name, phone, warehouse, is_active')
    .eq('is_active', true)

  if (targetWarehouse && targetWarehouse !== 'all') {
    generalQuery = generalQuery.eq('warehouse', targetWarehouse)
  }

  if (excludedIds.length > 0) {
    const notInList = excludedIds.slice(0, 200).join(',')
    generalQuery = generalQuery.not('id', 'in', `(${notInList})`)
  }

  // Multi-word search
  if (search) {
    const words = search
      .split(/\s+/)
      .map((w) => w.replace(/[,()]/g, '').trim())
      .filter(Boolean)

    for (const word of words) {
      const s = `%${word}%`
      generalQuery = generalQuery.or(
        `first_name.ilike.${s},last_name.ilike.${s},po_id.ilike.${s},phone.ilike.${s}`
      )
    }
  }

  generalQuery = generalQuery.order('po_id', { ascending: true }).limit(500)

  const { data: generalEmployees, error: empErr } = await generalQuery

  if (empErr) {
    console.error('Error fetching general employees:', empErr)
  }

  // รวมรายการพนักงาน Recently used (ติด badge และจำนวนครั้ง) กับพนักงานทั่วไป
  const combined = [
    ...recentEmployees.map((emp: any) => ({
      ...emp,
      recently_used: true,
      usage_count: usageMap.get(emp.id) || 1,
    })),
    ...(generalEmployees || []).map((emp: any) => ({
      ...emp,
      recently_used: false,
      usage_count: 0,
    })),
  ]

  // เรียง Recently used ไว้ด้านบนสุด (เรียงตามจำนวนครั้งที่ใช้มากไปน้อย) แล้วตามด้วยคนทั่วไปตาม po_id
  combined.sort((a: any, b: any) => {
    if (a.recently_used && !b.recently_used) return -1
    if (!a.recently_used && b.recently_used) return 1
    if (a.recently_used && b.recently_used) {
      if (b.usage_count !== a.usage_count) {
        return b.usage_count - a.usage_count
      }
    }
    return (a.po_id || '').localeCompare(b.po_id || '')
  })

  return NextResponse.json({
    employees: combined,
    plan_warehouse: plan.warehouse,
  })
}
