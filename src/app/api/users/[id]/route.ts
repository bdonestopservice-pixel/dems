import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/users/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'ไม่พบ ID ผู้ใช้งาน' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, warehouses, is_active, created_at')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'ไม่พบผู้ใช้งาน' }, { status: 404 })
  return NextResponse.json({ user: data })
}

// PATCH /api/users/[id] — Update user
export async function PATCH(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'ไม่พบ ID ผู้ใช้งาน' }, { status: 400 })
  }

  const body = await request.json()
  const supabase = createServerSupabaseClient()

  // Cannot change own role to something else or deactivate own account
  if (id === session.userId && body.role !== undefined && body.role !== session.role) {
    return NextResponse.json({ error: 'ไม่สามารถแก้ไข Role ของตัวเองได้' }, { status: 400 })
  }
  if (id === session.userId && body.is_active === false) {
    return NextResponse.json({ error: 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' }, { status: 400 })
  }


  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email
  if (body.role !== undefined) updateData.role = body.role
  if (body.warehouses !== undefined) updateData.warehouses = body.warehouses
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  if (body.password !== undefined && body.password !== '') {
    updateData.password = await bcrypt.hash(body.password, 12)
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('id, name, email, role, warehouses, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}

// DELETE /api/users/[id] — Only admin/payroll can be deleted, not super_admin
export async function DELETE(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'ไม่พบ ID ผู้ใช้งาน' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Check target user role
  const { data: target } = await supabase
    .from('users')
    .select('role')
    .eq('id', id)
    .single()

  if (!target) return NextResponse.json({ error: 'ไม่พบผู้ใช้งาน' }, { status: 404 })
  if (target.role === 'super_admin') {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชี Super Admin ได้' }, { status: 400 })
  }

  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

