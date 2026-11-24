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
    .from('oa_options')
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
    warehouse: data.warehouse,
    targetId: data.id,
    targetName: `OA ${data.name} (${data.warehouse})`,
    summary: `แก้ไขตัวเลือก OA เป็น "${data.name}" ในคลัง ${data.warehouse}`,
  })

  return NextResponse.json({ oa_option: data })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 })

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: prevOa } = await supabase.from('oa_options').select('name, warehouse').eq('id', id).maybeSingle()
  const { error } = await supabase.from('oa_options').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'dropdown',
    warehouse: prevOa?.warehouse || null,
    targetId: id,
    targetName: prevOa ? `OA ${prevOa.name} (${prevOa.warehouse})` : id,
    summary: prevOa ? `ลบตัวเลือก OA "${prevOa.name}" ออกจากคลัง ${prevOa.warehouse}` : `ลบตัวเลือก OA (${id})`,
  })

  return NextResponse.json({ success: true })
}
