import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { updateEmployeeInSheet, syncBatchEmployeesToSheet, getSheetsClient, resolveSheetTitle } from '@/lib/google-sheets'
import type { Employee } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

/**
 * GET & POST /api/cron/sync-sheets
 *
 * ทำหน้าที่ Reconcile ข้อมูลพนักงานระหว่าง Supabase Database และ Google Sheets
 * เพื่อรับประกันว่าไม่มีข้อมูลตกหล่น (Self-Healing / Disaster Recovery)
 *
 * Query Params:
 * - action: 'reconcile' (ค่าเริ่มต้น - sync เฉพาะคนที่อัปเดต 2 ชม. ล่าสุด) หรือ 'init' / 'full' (sync ทุกคน)
 * - hours: จำนวนชั่วโมงย้อนหลังสำหรับ reconcile (ค่าเริ่มต้น 2 ชม.)
 */
export async function GET(request: NextRequest) {
  return handleSync(request)
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}

async function handleSync(request: NextRequest) {
  try {
    // ตรวจสอบสิทธิ์: อนุญาตหากส่ง Authorization Header ตรงกับ CRON_SECRET หรือมี Session เป็น super_admin
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    let isAuthorized = false

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true
    } else {
      const token = request.cookies.get('dems_session')?.value
      if (token) {
        const session = await verifySession(token)
        if (session && (session.role === 'super_admin' || session.role === 'admin')) {
          isAuthorized = true
        }
      }
    }

    // หากไม่มีการตั้ง CRON_SECRET ในระบบ ให้ยอมรับ Vercel Cron Header
    if (!cronSecret && request.headers.get('x-vercel-cron')) {
      isAuthorized = true
    }

    if (!isAuthorized && cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const action = searchParams.get('action') || 'reconcile'
    const hours = Math.max(1, parseInt(searchParams.get('hours') || '2', 10))

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('employees')
      .select(`
        *,
        warehouses:warehouse (id, name),
        banks:bank_id (id, name, code)
      `)

    if (action === 'reconcile') {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      query = query.gte('updated_at', cutoffTime)
    }

    query = query.order('po_id', { ascending: true })

    const { data: rawEmployees, error } = await query

    if (error) {
      console.error('Supabase query error in cron sync:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const employees: Employee[] = (rawEmployees || []).map((emp: any) => ({
      ...emp,
      warehouse_name: emp.warehouses?.name || emp.warehouse,
      bank_name: emp.banks?.name || undefined,
      bank_code: emp.banks?.code || undefined,
    }))

    if (employees.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No employees modified within the timeframe to sync.',
        count: 0,
        timestamp: new Date().toISOString(),
      })
    }

    if (action === 'init' || action === 'full') {
      // Sync ทั้งหมดเป็นชุด
      await syncBatchEmployeesToSheet(employees)
      return NextResponse.json({
        success: true,
        message: `Successfully batch synced ${employees.length} employees to Google Sheets`,
        count: employees.length,
        timestamp: new Date().toISOString(),
      })
    }

    // สำหรับ Reconcile: วนอัปเดตแถวข้อมูลเพื่อป้องกันแถวซ้ำ
    let successCount = 0
    let failCount = 0

    for (const emp of employees) {
      try {
        await updateEmployeeInSheet(emp)
        successCount++
      } catch (e) {
        failCount++
        console.error(`Failed to reconcile employee ${emp.po_id || emp.id_card}:`, e)
      }
    }

    return NextResponse.json({
      success: true,
      action: 'reconcile',
      synced: successCount,
      failed: failCount,
      totalChecked: employees.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Cron sync route fatal error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
