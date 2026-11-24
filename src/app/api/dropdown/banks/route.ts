import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'

// GET /api/dropdown/banks — super_admin only for write, all can read
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const warehouse = request.nextUrl.searchParams.get('warehouse')

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let banks = data || []
  if (warehouse) {
    banks = banks.filter((b: any) => {
      // If warehouses is not set or empty, treat as all warehouses (backward compatibility)
      if (!b.warehouses || !Array.isArray(b.warehouses) || b.warehouses.length === 0) return true
      return b.warehouses.includes(warehouse)
    })
  }

  return NextResponse.json({ banks })
}

// POST /api/dropdown/banks — super_admin only
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้น' }, { status: 403 })
  }

  const body = await request.json()
  const { name, code, warehouses } = body
  if (!name || !code) return NextResponse.json({ error: 'กรุณากรอกชื่อธนาคารและโค้ด' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const whArray = Array.isArray(warehouses) ? warehouses : []

  // Try insert with warehouses; if column doesn't exist yet, fallback
  let { data, error } = await supabase
    .from('banks')
    .insert({ name, code, warehouses: whArray })
    .select()
    .single()

  if (error && error.message.includes('warehouses')) {
    const fallback = await supabase
      .from('banks')
      .insert({ name, code })
      .select()
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'CREATE',
    menu: 'dropdown',
    targetId: data.id,
    targetName: `ธนาคาร ${data.name} (${data.code})`,
    summary: `เพิ่มธนาคารใหม่ "${data.name}" รหัส ${data.code}`,
    meta: { code: data.code, warehouses: data.warehouses },
  })

  return NextResponse.json({ bank: data }, { status: 201 })
}
