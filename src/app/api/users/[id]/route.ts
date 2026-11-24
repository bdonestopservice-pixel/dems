import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog, buildFieldChanges } from '@/lib/audit-log'
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
    .select('id, name, email, role, warehouses, is_active, plain_password, created_at')
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


  const { data: prevUser } = await supabase
    .from('users')
    .select('id, name, email, role, warehouses, is_active')
    .eq('id', id)
    .maybeSingle()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) updateData.name = body.name
  if (body.email !== undefined) updateData.email = body.email
  if (body.role !== undefined) updateData.role = body.role
  if (body.warehouses !== undefined) updateData.warehouses = body.warehouses
  if (body.is_active !== undefined) updateData.is_active = body.is_active
  const passwordChanged = body.password !== undefined && body.password !== ''
  if (passwordChanged) {
    updateData.password = await bcrypt.hash(body.password, 12)
    updateData.plain_password = body.password
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select('id, name, email, role, warehouses, is_active, plain_password, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userChanges = buildFieldChanges(prevUser, data, [
    { key: 'name', label: 'ชื่อผู้ใช้งาน' },
    { key: 'email', label: 'อีเมล' },
    { key: 'role', label: 'Role' },
    { key: 'warehouses', label: 'สิทธิ์คลังสินค้า' },
    { key: 'is_active', label: 'สถานะบัญชี' },
  ])
  if (passwordChanged) {
    userChanges.push({ field: 'password', label: 'รหัสผ่าน', before: '••••••••', after: 'เปลี่ยนรหัสผ่านใหม่' })
  }

  recordAuditLog({
    request,
    session,
    action: 'UPDATE',
    menu: 'users',
    warehouse: Array.isArray(data.warehouses) && data.warehouses.length === 1 ? data.warehouses[0] : null,
    targetId: data.id,
    targetName: `${data.name} (${data.email})`,
    summary:
      userChanges.length > 0
        ? `แก้ไขบัญชีผู้ใช้งาน ${data.name} (${userChanges.map((c) => c.label).join(', ')})`
        : `อัปเดตบัญชีผู้ใช้งาน ${data.name}`,
    changes: userChanges,
  })

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
    .select('id, name, email, role, warehouses')
    .eq('id', id)
    .single()

  if (!target) return NextResponse.json({ error: 'ไม่พบผู้ใช้งาน' }, { status: 404 })
  if (target.role === 'super_admin') {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชี Super Admin ได้' }, { status: 400 })
  }

  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'DELETE',
    menu: 'users',
    targetId: target.id,
    targetName: `${target.name} (${target.email})`,
    summary: `ลบบัญชีผู้ใช้งาน ${target.name} (${target.email}) Role: ${target.role}`,
    meta: { role: target.role, warehouses: target.warehouses },
  })

  return NextResponse.json({ success: true })
}

