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

  // 2. Fetch namelist usage counts & plan history for this plan's department concurrently (Recently used)
  const usageMap = new Map<string, number>()
  if (plan.department_id) {
    const [nlResult, peResult] = await Promise.all([
      supabase
        .from('namelist')
        .select('employee_id')
        .eq('department_id', plan.department_id)
        .limit(2000),
      supabase
        .from('plan_employees')
        .select('employee_id, plans!inner(department_id)')
        .eq('plans.department_id', plan.department_id)
        .eq('sent_to_namelist', true)
        .limit(2000),
    ])

    if (nlResult.error) {
      console.error('Error fetching namelist usage counts:', nlResult.error)
    } else {
      for (const r of nlResult.data || []) {
        if (r.employee_id) {
          usageMap.set(r.employee_id, (usageMap.get(r.employee_id) || 0) + 1)
        }
      }
    }

    if (peResult.error) {
      console.error('Error fetching plan_employees sent_to_namelist:', peResult.error)
    } else {
      for (const pe of peResult.data || []) {
        if (pe.employee_id && !usageMap.has(pe.employee_id)) {
          usageMap.set(pe.employee_id, 1)
        }
      }
    }
  }

  // 3. Query employees in parallel
  // ค่าเริ่มต้นเป็น 'all' เพื่อดึงพนักงานจากทุกคลัง
  const targetWarehouse = warehouseParam || 'all'

  // ดึงกลุ่ม Recently used ให้ครบถ้วนเสมอ โดยไม่โดนจำกัดด้วย SQL limit
  const recentIds = Array.from(usageMap.keys()).filter((id) => !existingIds.includes(id))

  // Helper function to build employee query filters
  const buildEmployeeQuery = (idFilter?: string[]) => {
    let q = supabase
      .from('employees')
      .select('id, po_id, prefix, first_name, last_name, phone, warehouse, is_active, note, is_blacklisted')
      .eq('is_active', true)

    if (idFilter && idFilter.length > 0) {
      q = q.in('id', idFilter)
    }

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

    return q
  }

  // หั่น recentIds เป็น chunks ย่อยๆ แล้วยิงคำขอแบบคู่ขนาน (Promise.all)
  const chunks: string[][] = []
  for (let i = 0; i < recentIds.length; i += 100) {
    chunks.push(recentIds.slice(i, i + 100))
  }
  const recentPromises = chunks.map((chunk) => buildEmployeeQuery(chunk))

  // ดึงกลุ่มพนักงานทั่วไปพร้อมกันไปเลยในรอบเดียว (Parallel execution)
  let generalQuery = buildEmployeeQuery()

  const excludeFromSql = [...new Set([...existingIds, ...recentIds])].slice(0, 200)
  if (excludeFromSql.length > 0) {
    const notInList = excludeFromSql.join(',')
    generalQuery = generalQuery.not('id', 'in', `(${notInList})`)
  }

  generalQuery = generalQuery.order('po_id', { ascending: true }).limit(500)

  // รันทั้ง recent chunks และ general query พร้อมกันผ่าน Promise.all
  const [recentChunkResults, generalResult] = await Promise.all([
    Promise.all(recentPromises),
    generalQuery,
  ])

  const recentEmployees: any[] = []
  for (const res of recentChunkResults) {
    if (!res.error && res.data) {
      recentEmployees.push(...res.data)
    }
  }

  if (generalResult.error) {
    console.error('Error fetching general employees:', generalResult.error)
  }

  // Helper ตรวจสอบสถานะติดแบล็กลิสต์ (บล็อคไม่ให้เพิ่มลงในแพลนพนักงาน)
  const isBlacklisted = (emp: any) => {
    if (emp.is_blacklisted) return true
    if (emp.note && emp.note.includes('__BLACKLIST__:')) return true
    return false
  }

  // ป้องกันข้อมูลซ้ำซ้อน และคัดกรองพนักงานที่ติดแบล็กลิสต์ออกทั้งหมดในฝั่ง JavaScript
  const nonBlacklistedRecent = recentEmployees.filter((e) => !isBlacklisted(e))
  const recentIdSet = new Set(nonBlacklistedRecent.map((e) => e.id))
  const existingIdSet = new Set(existingIds)
  const generalEmployees = (generalResult.data || []).filter(
    (emp: any) => !recentIdSet.has(emp.id) && !existingIdSet.has(emp.id) && !isBlacklisted(emp)
  )

  // รวมรายการพนักงาน Recently used (ติด badge และจำนวนครั้ง) กับพนักงานทั่วไป (ไม่รวมคนที่ติดแบล็กลิสต์)
  const combined = [
    ...nonBlacklistedRecent.map((emp: any) => ({
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
