import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/warehouses/[id] — super_admin only, update name
export async function PATCH(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้น' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('warehouses')
    .update({ name: body.name })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'UPDATE',
    menu: 'dropdown',
    warehouse: id,
    targetId: id,
    targetName: `คลัง ${id} (${data.name})`,
    summary: `แก้ไขชื่อคลังสินค้า ${id} เป็น "${data.name}"`,
  })

  return NextResponse.json({ warehouse: data })
}

// DELETE /api/warehouses/[id] — super_admin only
export async function DELETE(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้น' }, { status: 403 })
  }

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('warehouses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'dropdown',
    warehouse: id,
    targetId: id,
    targetName: `คลัง ${id}`,
    summary: `ลบคลังสินค้า ${id}`,
  })

  return NextResponse.json({ success: true })
}
