import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'
import type { AuditMenu } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ALLOWED_EXPORT_MENUS: AuditMenu[] = [
  'employees',
  'planning',
  'namelist',
  'reports',
  'dropdown',
  'users',
]

function isMissingTableError(err: any): boolean {
  const msg = String(err?.message || '')
  return (
    err?.code === '42P01' ||
    err?.code === 'PGRST205' ||
    msg.includes('audit_logs') && (msg.includes('does not exist') || msg.includes('schema cache'))
  )
}

function getTodayBangkokStartIso(): string {
  const now = new Date()
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const dateStr = bkk.toISOString().slice(0, 10)
  return `${dateStr}T00:00:00+07:00`
}

// GET /api/audit-logs — Super Admin เท่านั้น
// Query params: page, limit, search, user_id, menu, action, warehouse, date_from, date_to
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null

  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่สามารถดูประวัติการใช้งานได้' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim() || ''
  const userId = searchParams.get('user_id') || 'all'
  const menu = searchParams.get('menu') || 'all'
  const action = searchParams.get('action') || 'all'
  const warehouse = searchParams.get('warehouse') || 'all'
  const dateFrom = searchParams.get('date_from')?.trim() || ''
  const dateTo = searchParams.get('date_to')?.trim() || ''
  const exportCsv = searchParams.get('export') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = exportCsv
    ? 1000
    : Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10) || 50))

  const supabase = createServerSupabaseClient()

  // Build filtered query
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })

  if (userId && userId !== 'all') {
    query = query.eq('user_id', userId)
  }

  if (menu && menu !== 'all') {
    query = query.eq('menu', menu)
  }

  if (action && action !== 'all') {
    query = query.eq('action', action)
  }

  if (warehouse && warehouse !== 'all') {
    query = query.eq('warehouse', warehouse)
  }

  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    query = query.gte('created_at', `${dateFrom}T00:00:00+07:00`)
  }

  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    query = query.lte('created_at', `${dateTo}T23:59:59.999+07:00`)
  }

  if (search) {
    const cleanWords = search
      .split(/\s+/)
      .map((w) => w.replace(/[,()]/g, '').trim())
      .filter(Boolean)

    for (const word of cleanWords) {
      const s = `%${word}%`
      query = query.or(
        `user_name.ilike.${s},user_email.ilike.${s},target_name.ilike.${s},summary.ilike.${s},ip_address.ilike.${s}`
      )
    }
  }

  const from = (page - 1) * limit
  const to = from + limit - 1
  const mainQuery = query.order('created_at', { ascending: false }).range(from, to)

  // รัน Query หลัก, สถิติวันนี้ และรายชื่อผู้ใช้งานพร้อมกันแบบคู่ขนาน (Parallel) เพื่อความเร็วสูงสุด
  const todayStart = getTodayBangkokStartIso()
  const [logsRes, todayRes, usersRes] = await Promise.all([
    mainQuery,
    exportCsv
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('audit_logs')
          .select('user_email, action')
          .gte('created_at', todayStart)
          .limit(5000),
    exportCsv
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('users')
          .select('id, name, email, role')
          .order('name', { ascending: true }),
  ])

  if (logsRes.error) {
    if (isMissingTableError(logsRes.error)) {
      return NextResponse.json(
        {
          logs: [],
          total: 0,
          page: 1,
          limit,
          totalPages: 1,
          table_missing: true,
          stats: {
            today_total: 0,
            active_users_today: 0,
            critical_today: 0,
            failed_logins_today: 0,
          },
          users_list: usersRes.data || [],
        },
        {
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    }
    console.error('Fetch audit_logs error:', logsRes.error)
    return NextResponse.json({ error: logsRes.error.message }, { status: 500 })
  }

  const todayRows = (todayRes.data || []) as { user_email: string; action: string }[]
  const activeUsersSet = new Set<string>()
  let criticalToday = 0
  let failedLoginsToday = 0

  for (const r of todayRows) {
    if (r.action !== 'LOGIN_FAILED' && r.user_email) {
      activeUsersSet.add(r.user_email)
    }
    if (r.action === 'DELETE' || r.action === 'BLACKLIST') {
      criticalToday++
    }
    if (r.action === 'LOGIN_FAILED') {
      failedLoginsToday++
    }
  }

  const total = logsRes.count ?? (logsRes.data?.length || 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return NextResponse.json(
    {
      logs: logsRes.data || [],
      total,
      page,
      limit,
      totalPages,
      table_missing: false,
      stats: {
        today_total: todayRows.length,
        active_users_today: activeUsersSet.size,
        critical_today: criticalToday,
        failed_logins_today: failedLoginsToday,
      },
      users_list: usersRes.data || [],
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
}

// POST /api/audit-logs — บันทึกกิจกรรมฝั่ง Client (อนุญาตเฉพาะ action = EXPORT เท่านั้น)
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { action, menu, warehouse, targetName, summary, meta } = body

    if (action !== 'EXPORT') {
      return NextResponse.json({ error: 'ไม่อนุญาตให้บันทึกประเภทกิจกรรมนี้จากฝั่ง Client' }, { status: 400 })
    }

    if (!ALLOWED_EXPORT_MENUS.includes(menu)) {
      return NextResponse.json({ error: 'เมนูไม่ถูกต้อง' }, { status: 400 })
    }

    if (!summary || typeof summary !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุข้อความสรุป' }, { status: 400 })
    }

    recordAuditLog({
      request,
      session,
      action: 'EXPORT',
      menu,
      warehouse: typeof warehouse === 'string' && warehouse !== 'all' ? warehouse : null,
      targetName: typeof targetName === 'string' ? targetName : null,
      summary: summary.trim(),
      meta: typeof meta === 'object' && meta !== null ? meta : {},
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'บันทึก Log ไม่สำเร็จ' }, { status: 500 })
  }
}
