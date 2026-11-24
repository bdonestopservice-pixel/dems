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
    .from('work_statuses')
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
    targetId: data.id,
    targetName: `สถานะ ${data.name}`,
    summary: `แก้ไขสถานะการทำงานเป็น "${data.name}"`,
  })

  return NextResponse.json({ work_status: data })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: prevWs } = await supabase.from('work_statuses').select('name').eq('id', id).maybeSingle()
  const { error } = await supabase.from('work_statuses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'dropdown',
    targetId: id,
    targetName: prevWs ? `สถานะ ${prevWs.name}` : id,
    summary: prevWs ? `ลบสถานะการทำงาน "${prevWs.name}"` : `ลบสถานะการทำงาน (${id})`,
  })

  return NextResponse.json({ success: true })
}
