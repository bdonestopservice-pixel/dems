import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { getLiveUserWarehouses, hasWarehouseAccess } from '@/lib/auth/warehouse-auth'
import { recordAuditLog } from '@/lib/audit-log'
import type { Plan } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  const shift = searchParams.get('shift') || 'all'
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

  // ดึงรายการกะที่มีอยู่จริงของวันนั้นๆ (ก่อนถูกกรองด้วย shift filter)
  const available_shifts = Array.from(
    new Set(
      plans
        .filter((p) => p.shift_start && p.shift_end)
        .map((p) => `${p.shift_start}-${p.shift_end}`)
    )
  ).map((key) => {
    const [start, end] = key.split('-')
    const sample = plans.find((p) => p.shift_start === start && p.shift_end === end)
    const type = sample?.shift_type || 'D'
    const typeLabel = type === 'N' ? 'Night' : type === 'H' ? 'Half' : 'Day'
    return {
      id: key,
      label: `${start}–${end} (${typeLabel})`,
      shift_start: start,
      shift_end: end,
      shift_type: type,
    }
  })

  // Apply shift filter
  if (shift && shift !== 'all') {
    plans = plans.filter((p) => {
      if (shift === 'type:D' || shift === 'D') return p.shift_type === 'D'
      if (shift === 'type:N' || shift === 'N') return p.shift_type === 'N'
      if (shift === 'type:H' || shift === 'H') return p.shift_type === 'H'
      if (p.shift_id === shift) return true
      const range = `${p.shift_start || ''}-${p.shift_end || ''}`
      if (range === shift) return true
      if (p.shift_start === shift) return true
      return false
    })
  }

  // Helper คำนวณความใกล้ชิดของกะกับเวลาปัจจุบัน ("เวลาที่ใกล้ที่สุดในตอนนั้น")
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const getShiftProximityScore = (startTime?: string | null, planDate?: string): number => {
    if (!startTime) return 99999
    const parts = startTime.trim().split(':')
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1] || '0', 10)
    if (isNaN(h)) return 99999
    const shiftMinutes = h * 60 + m

    if (planDate === today) {
      // ถ้าเป็นวันนี้: กะที่กำลังจะมาถึง หรือเพิ่งเริ่มไปไม่เกิน 60 นาที (ongoing) จะมีคะแนนน้อย (ขึ้นก่อน)
      const diff = shiftMinutes - currentMinutes
      if (diff >= -60) {
        return diff >= 0 ? diff : Math.abs(diff) + 0.1
      } else {
        // กะที่จบไปนานแล้ว (เช่น กะเช้าเมื่อเทียบกับเวลาเย็น) ให้อยู่ท้าย
        return 2000 + Math.abs(diff)
      }
    }

    // วันอื่น เรียงจากเช้าไปดึก (06:00 -> 23:00)
    return shiftMinutes
  }

  // จัดเรียง available_shifts ตามเวลาที่ใกล้ที่สุดในตอนนั้น
  available_shifts.sort((a, b) => {
    const scoreA = getShiftProximityScore(a.shift_start, date || today)
    const scoreB = getShiftProximityScore(b.shift_start, date || today)
    return scoreA - scoreB
  })

  // จัดเรียง plans
  plans.sort((a, b) => {
    // 1. ถ้าดูหลายวัน เรียงตามวันที่ล่าสุดก่อน (DESC)
    if (a.date !== b.date) {
      return (b.date || '').localeCompare(a.date || '')
    }
    // 2. ในวันเดียวกัน เรียงตามเวลาที่ใกล้ที่สุดในตอนนั้นขึ้นมาก่อน
    const scoreA = getShiftProximityScore(a.shift_start, a.date)
    const scoreB = getShiftProximityScore(b.shift_start, b.date)
    if (scoreA !== scoreB) {
      return scoreA - scoreB
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

  return NextResponse.json(
    {
      plans,
      stats: {
        total_plans,
        completed_plans,
        total_missing,
      },
      available_shifts,
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

      if (Number(p.required_count) > 500) {
        return NextResponse.json(
          { error: `จำนวนคนที่ต้องการต่อหนึ่งแพลนต้องไม่เกิน 500 คน (แถวที่ ${i + 1} ระบุ ${p.required_count} คน)` },
          { status: 400 }
        )
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

    const uniqueWh = Array.from(new Set(rowsToInsert.map((r) => r.warehouse)))
    const uniqueDates = Array.from(new Set(rowsToInsert.map((r) => r.date)))
    const totalReq = rowsToInsert.reduce((acc, r) => acc + r.required_count, 0)
    recordAuditLog({
      request,
      session,
      action: 'CREATE',
      menu: 'planning',
      warehouse: uniqueWh.length === 1 ? uniqueWh[0] : null,
      targetId: data?.[0]?.id || null,
      targetName: `${uniqueWh.join(', ')} (${uniqueDates.join(', ')})`,
      summary: `สร้างแพลนพนักงานใหม่ ${data?.length || 0} แพลน รวมต้องการ ${totalReq} คน (คลัง ${uniqueWh.join(', ')})`,
      meta: { plan_count: data?.length || 0, total_required: totalReq, warehouses: uniqueWh, dates: uniqueDates },
    })

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      plans: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกแพลน' }, { status: 500 })
  }
}
