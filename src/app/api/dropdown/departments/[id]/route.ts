import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/dropdown/departments/[id]
export async function PATCH(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const supabase = createServerSupabaseClient()

  const update: Record<string, unknown> = { name: body.name, shift_name: body.shift_name }
  if (body.type !== undefined) {
    update.type = typeof body.type === 'string' ? body.type.trim() : body.type
  }

  const { data, error } = await supabase
    .from('departments')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'UPDATE',
    menu: 'dropdown',
    warehouse: data.warehouse,
    targetId: data.id,
    targetName: `แผนก ${data.name} (${data.warehouse})`,
    summary: `แก้ไขแผนก "${data.name}" ในคลัง ${data.warehouse}`,
  })

  return NextResponse.json({ department: data })
}

// DELETE /api/dropdown/departments/[id]
export async function DELETE(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })
  }

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: prevDept } = await supabase.from('departments').select('name, warehouse').eq('id', id).maybeSingle()
  const { error } = await supabase.from('departments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'dropdown',
    warehouse: prevDept?.warehouse || null,
    targetId: id,
    targetName: prevDept ? `แผนก ${prevDept.name} (${prevDept.warehouse})` : id,
    summary: prevDept ? `ลบแผนก "${prevDept.name}" ออกจากคลัง ${prevDept.warehouse}` : `ลบแผนก (${id})`,
  })

  return NextResponse.json({ success: true })
}
