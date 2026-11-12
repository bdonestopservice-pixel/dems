import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { getLiveUserWarehouses, hasWarehouseAccess } from '@/lib/auth/warehouse-auth'
import type { Plan } from '@/types'

// GET /api/plans
// Query params:
// - date: filter by exact date (YYYY-MM-DD) or 'all'
// - date_from: filter by date >= date_from
// - date_to: filter by date <= date_to
// - warehouse: filter by warehouse ID (or 'all')
// - search: search department name
// - limit: max records to return (default 100, max 200)
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const warehouse = searchParams.get('warehouse') || 'all'
  const search = searchParams.get('search')?.trim().toLowerCase() || ''
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10) || 100)) : 100

  const supabase = createServerSupabaseClient()

  // 1. Determine permitted warehouses
  const isSuperAdmin = session.role === 'super_admin'
  const permittedWarehouses = isSuperAdmin ? [] : await getLiveUserWarehouses(session)

  if (!isSuperAdmin && permittedWarehouses.length === 0) {
    return NextResponse.json({
      plans: [],
      stats: { total_plans: 0, completed_plans: 0, total_missing: 0 },
    })
  }

  // 2. Base query with joins
  let query = supabase
    .from('plans')
    .select(`
      *,
      warehouses:warehouse (id, name),
      shifts:shift_id (id, start_time, end_time, type),
      departments:department_id (id, name),
      plan_employees (id, employee_id, sent_to_namelist)
    `)

  // Apply warehouse permission & filter
  if (!isSuperAdmin) {
    if (warehouse !== 'all') {
      if (!permittedWarehouses.includes(warehouse)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงคลังนี้' }, { status: 403 })
      }
      query = query.eq('warehouse', warehouse)
    } else {
      query = query.in('warehouse', permittedWarehouses)
    }
  } else {
    if (warehouse !== 'all') {
      query = query.eq('warehouse', warehouse)
    }
  }

  // Apply date filters & limits
  if (date && date !== 'all') {
    query = query.eq('date', date)
    query = query.order('date', { ascending: true }).order('created_at', { ascending: false })
  } else {
    if (dateFrom) {
      query = query.gte('date', dateFrom)
    } else {
      // ป้องกัน unbounded query: ค่าเริ่มต้นย้อนหลัง 30 วัน เมื่อไม่ได้ระบุวันที่
      const d = new Date()
      d.setDate(d.getDate() - 30)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const thirtyDaysAgo = `${d.getFullYear()}-${mm}-${dd}`
      query = query.gte('date', thirtyDaysAgo)
    }

    if (dateTo) {
      query = query.lte('date', dateTo)
    }

    // เมื่อดูหลายวัน/ทุกวัน ให้เรียงตามวันที่ล่าสุดก่อน
    query = query.order('date', { ascending: false }).order('created_at', { ascending: false })
  }

  // ป้องกันการดึงข้อมูลไม่จำกัดจำนวน (ค่าเริ่มต้น 100 รายการ สูงสุด 200 รายการ)
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching plans:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map and calculate current counts
  let plans: Plan[] = (data || []).map((row: any) => {
    const employees = row.plan_employees || []
    return {
      id: row.id,
      date: row.date,
      warehouse: row.warehouse,
      shift_id: row.shift_id,
      department_id: row.department_id,
      required_count: row.required_count || 0,
      created_by: row.created_by,
      created_at: row.created_at,
      warehouse_name: row.warehouses?.name || row.warehouse,
      shift_start: row.shifts?.start_time,
      shift_end: row.shifts?.end_time,
      shift_type: row.shifts?.type,
      department_name: row.departments?.name || '—',
      current_count: employees.length,
    }
  })

  // Apply department search filter (client or query)
  if (search) {
    plans = plans.filter((p) =>
      p.department_name?.toLowerCase().includes(search)
    )
  }

  // จัดเรียงแผนงานตามเวลาที่ใกล้ถึงในวันนั้น (shift_start เช้า -> ดึก)
  const getShiftSortKey = (shiftStart?: string | null): string => {
    if (!shiftStart) return '99:99'
    const parts = shiftStart.trim().split(':')
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    }
    return shiftStart
  }

  plans.sort((a, b) => {
    // 1. ถ้าดูหลายวัน เรียงตามวันที่ล่าสุดก่อน (DESC)
    if (a.date !== b.date) {
      return (b.date || '').localeCompare(a.date || '')
    }
    // 2. ในวันเดียวกัน เรียงตามเวลาเริ่มกะ (shift_start) จากเวลาที่ใกล้ถึงที่สุด (ASC: 06:00 -> 23:00)
    const timeA = getShiftSortKey(a.shift_start)
    const timeB = getShiftSortKey(b.shift_start)
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB)
    }
    // 3. หากเวลาเริ่มเท่ากัน เรียงตามชื่อแผนก
    return (a.department_name || '').localeCompare(b.department_name || '')
  })

  // Calculate statistics
  const total_plans = plans.length
  const completed_plans = plans.filter((p) => (p.current_count || 0) >= p.required_count).length
  const total_missing = plans.reduce(
    (sum, p) => sum + Math.max(0, p.required_count - (p.current_count || 0)),
    0
  )

  return NextResponse.json({
    plans,
    stats: {
      total_plans,
      completed_plans,
      total_missing,
    },
  })
}

// POST /api/plans
// Batch create multiple plans at once
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { plans } = body

    if (!Array.isArray(plans) || plans.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุข้อมูลแพลนอย่างน้อย 1 แถว' }, { status: 400 })
    }

    // Validate all rows
    const invalidRows: number[] = []
    const isSuperAdmin = session.role === 'super_admin'
    const permittedWarehouses = isSuperAdmin ? [] : await getLiveUserWarehouses(session)

    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]
      if (
        !p.date ||
        !p.warehouse ||
        !p.shift_id ||
        !p.department_id ||
        !p.required_count ||
        Number(p.required_count) <= 0
      ) {
        invalidRows.push(i + 1)
        continue
      }

      // Check warehouse permissions
      if (!isSuperAdmin && !permittedWarehouses.includes(p.warehouse)) {
        return NextResponse.json(
          { error: `คุณไม่มีสิทธิ์สร้างแพลนในคลัง ${p.warehouse} (แถวที่ ${i + 1})` },
          { status: 403 }
        )
      }
    }

    if (invalidRows.length > 0) {
      return NextResponse.json(
        {
          error: `ข้อมูลไม่ครบถ้วนในแถวที่ ${invalidRows.join(', ')} กรุณากรอก วันที่, คลัง, กะ, แผนก และจำนวนคนที่ต้องการให้ครบ`,
          invalid_rows: invalidRows,
        },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const rowsToInsert = plans.map((p) => ({
      date: p.date,
      warehouse: p.warehouse,
      shift_id: p.shift_id,
      department_id: p.department_id,
      required_count: Number(p.required_count),
      created_by: session.userId,
    }))

    const { data, error } = await supabase.from('plans').insert(rowsToInsert).select()

    if (error) {
      console.error('Error inserting plans:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      plans: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกแพลน' }, { status: 500 })
  }
}
