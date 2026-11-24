import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })

  const { id } = await context.params
  const body = await request.json()
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('shifts')
    .update({ start_time: body.start_time, end_time: body.end_time, type: body.type })
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
    targetName: `กะ ${data.start_time}–${data.end_time} (${data.warehouse})`,
    summary: `แก้ไขกะการทำงานเป็น ${data.start_time}–${data.end_time} (${data.type}) ในคลัง ${data.warehouse}`,
  })

  return NextResponse.json({ shift: data })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: prevShift } = await supabase.from('shifts').select('start_time, end_time, warehouse').eq('id', id).maybeSingle()
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'dropdown',
    warehouse: prevShift?.warehouse || null,
    targetId: id,
    targetName: prevShift ? `กะ ${prevShift.start_time}–${prevShift.end_time} (${prevShift.warehouse})` : id,
    summary: prevShift ? `ลบกะการทำงาน ${prevShift.start_time}–${prevShift.end_time} ออกจากคลัง ${prevShift.warehouse}` : `ลบกะการทำงาน (${id})`,
  })

  return NextResponse.json({ success: true })
}
