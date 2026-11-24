import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'
import bcrypt from 'bcryptjs'

// GET /api/users — List all users (super_admin only)
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, warehouses, is_active, plain_password, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

// POST /api/users — Create new user (super_admin only)
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, password, role, warehouses } = body

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  if (!['admin', 'payroll'].includes(role)) {
    return NextResponse.json({ error: 'Role ไม่ถูกต้อง' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Check duplicate email
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'อีเมลนี้มีในระบบแล้ว' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const { data, error } = await supabase
    .from('users')
    .insert({
      name,
      email,
      password: hashedPassword,
      plain_password: password,
      role,
      warehouses: warehouses || [],
    })
    .select('id, name, email, role, warehouses, is_active, plain_password, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  recordAuditLog({
    request,
    session,
    action: 'CREATE',
    menu: 'users',
    warehouse: Array.isArray(warehouses) && warehouses.length === 1 ? warehouses[0] : null,
    targetId: data.id,
    targetName: `${data.name} (${data.email})`,
    summary: `สร้างบัญชีผู้ใช้งานใหม่ ${data.name} (${data.email}) Role: ${data.role}`,
    meta: { role: data.role, warehouses: data.warehouses },
  })

  return NextResponse.json({ user: data }, { status: 201 })
}
