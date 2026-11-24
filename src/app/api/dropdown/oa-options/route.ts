import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { hasWarehouseAccess } from '@/lib/auth/warehouse-auth'
import { recordAuditLog } from '@/lib/audit-log'

// GET /api/dropdown/oa-options?warehouse=SOCE
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const warehouse = request.nextUrl.searchParams.get('warehouse')
  if (!warehouse) return NextResponse.json({ error: 'warehouse required' }, { status: 400 })

  const hasAccess = await hasWarehouseAccess(session, warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงคลังนี้' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('oa_options')
    .select('*')
    .eq('warehouse', warehouse)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ oa_options: data })
}

// POST /api/dropdown/oa-options
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  }

  const body = await request.json()
  const { warehouse, name } = body

  if (!warehouse || !name) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
  }

  const hasAccess = await hasWarehouseAccess(session, warehouse)
  if (!hasAccess) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงคลังนี้' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('oa_options')
    .insert({ warehouse, name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'CREATE',
    menu: 'dropdown',
    warehouse: data.warehouse,
    targetId: data.id,
    targetName: `OA ${data.name} (${data.warehouse})`,
    summary: `เพิ่มตัวเลือก OA "${data.name}" ในคลัง ${data.warehouse}`,
  })

  return NextResponse.json({ oa_option: data }, { status: 201 })
}
