import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้น' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const supabase = createServerSupabaseClient()

  const updatePayload: Record<string, any> = {}
  if (body.name !== undefined) updatePayload.name = body.name
  if (body.code !== undefined) updatePayload.code = body.code
  if (body.warehouses !== undefined && Array.isArray(body.warehouses)) {
    updatePayload.warehouses = body.warehouses
  }

  let { data, error } = await supabase
    .from('banks')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error && error.message.includes('warehouses')) {
    delete updatePayload.warehouses
    const fallback = await supabase
      .from('banks')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bank: data })
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้น' }, { status: 403 })
  }

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('banks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
