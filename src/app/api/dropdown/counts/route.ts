import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

// GET /api/dropdown/counts?warehouse=SOCE
// Returns count of all categories in a single lightning-fast request
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const warehouse = request.nextUrl.searchParams.get('warehouse')
  const supabase = createServerSupabaseClient()

  try {
    // 1. เรียกใช้งาน Postgres Stored Procedure get_dropdown_counts (Single Query / 1 DB Roundtrip)
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dropdown_counts', {
      p_warehouse: warehouse || null,
    })

    if (!rpcError && rpcData && typeof rpcData === 'object') {
      return NextResponse.json(rpcData, {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=15',
        },
      })
    }

    // 2. Fallback: หากยังไม่ได้รัน Migration สร้าง RPC ในฐานข้อมูล ให้ใช้ PostgREST HEAD count ตามปกติ
    const [depts, shifts, oa, statuses, banks, whs] = await Promise.all([
      warehouse
        ? supabase.from('departments').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse)
        : Promise.resolve({ count: 0, error: null }),
      warehouse
        ? supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse)
        : Promise.resolve({ count: 0, error: null }),
      warehouse
        ? supabase.from('oa_options').select('id', { count: 'exact', head: true }).eq('warehouse', warehouse)
        : Promise.resolve({ count: 0, error: null }),
      supabase.from('work_statuses').select('id', { count: 'exact', head: true }),
      supabase.from('banks').select('id', { count: 'exact', head: true }),
      supabase.from('warehouses').select('id', { count: 'exact', head: true }),
    ])

    return NextResponse.json(
      {
        departments: depts.count ?? 0,
        shifts: shifts.count ?? 0,
        oa_options: oa.count ?? 0,
        work_statuses: statuses.count ?? 0,
        banks: banks.count ?? 0,
        warehouses: whs.count ?? 0,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=15',
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
