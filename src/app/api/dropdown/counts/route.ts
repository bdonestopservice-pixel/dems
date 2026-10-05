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
