import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name')
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { warehouses: data },
    {
      headers: {
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
      },
    }
  )
}

// POST /api/warehouses — super_admin only
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้น' }, { status: 403 })
  }

  const body = await request.json()
  const { id, name } = body
  if (!id || !name) return NextResponse.json({ error: 'กรุณากรอกรหัสคลังและชื่อคลัง' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('warehouses')
    .insert({ id: id.toUpperCase().trim(), name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'CREATE',
    menu: 'dropdown',
    warehouse: data.id,
    targetId: data.id,
    targetName: `คลัง ${data.id} (${data.name})`,
    summary: `เพิ่มคลังสินค้าใหม่ ${data.id} (${data.name})`,
  })

  return NextResponse.json({ warehouse: data }, { status: 201 })
}

