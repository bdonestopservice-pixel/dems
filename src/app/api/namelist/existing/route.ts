import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/namelist/existing?date=YYYY-MM-DD[&shift_id=...]
// คืนรายการ { employee_id, shift_id } ที่มีใน Namelist ของวันนั้น (ทุกคลัง) ใช้ทำเครื่องหมายกันเพิ่มซ้ำในหน้า Add
// กฎ: วันที่ + กะ เดียวกัน ห้ามซ้ำ / ต่างกะ เพิ่มซ้ำได้ → ฝั่งหน้าเว็บกรองตามกะที่เลือก
// ถ้าส่ง shift_id มา จะคืน employee_ids เฉพาะของกะนั้น
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = request.nextUrl.searchParams.get('date') || ''
  const shiftId = request.nextUrl.searchParams.get('shift_id') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const entries: { employee_id: string; shift_id: string | null }[] = []
  for (let page = 0; page < 30; page++) {
    const from = page * 1000
    let query = supabase
      .from('namelist')
      .select('employee_id, shift_id')
      .eq('date', date)

    if (shiftId) {
      query = query.eq('shift_id', shiftId)
    }

    const { data, error } = await query
      .order('id', { ascending: true })
      .range(from, from + 999)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    entries.push(...(data || []).map((r: any) => ({ employee_id: r.employee_id, shift_id: r.shift_id })))
    if (!data || data.length < 1000) break
  }

  const employee_ids = entries.map((e) => e.employee_id)

  return NextResponse.json(
    { entries, employee_ids },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
}
