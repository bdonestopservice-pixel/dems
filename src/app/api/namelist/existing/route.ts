import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

// GET /api/namelist/existing?date=YYYY-MM-DD
// คืนเฉพาะ employee_id ที่มีใน Namelist ของวันนั้น (ทุกคลัง) ใช้ทำเครื่องหมายกันเพิ่มซ้ำในหน้า Add
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = request.nextUrl.searchParams.get('date') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const ids: string[] = []
  for (let page = 0; page < 30; page++) {
    const from = page * 1000
    const { data, error } = await supabase
      .from('namelist')
      .select('employee_id')
      .eq('date', date)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    ids.push(...(data || []).map((r: any) => r.employee_id))
    if (!data || data.length < 1000) break
  }

  return NextResponse.json({ employee_ids: ids })
}
