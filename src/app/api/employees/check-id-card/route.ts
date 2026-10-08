import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

// GET /api/employees/check-id-card?id_card=1103700123456
// Checks whether an ID card already exists in the system in real time
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawIdCard = request.nextUrl.searchParams.get('id_card') || ''
  const cleanIdCard = rawIdCard.replace(/[^0-9]/g, '')

  if (cleanIdCard.length !== 13) {
    return NextResponse.json({
      exists: false,
      message: 'เลขบัตรประชาชนต้องมี 13 หลัก',
    })
  }

  const supabase = createServerSupabaseClient()

  const { data: existing, error } = await supabase
    .from('employees')
    .select('id, po_id, first_name, last_name, warehouse')
    .eq('id_card', cleanIdCard)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Check ID card error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({
      exists: true,
      employee: {
        id: existing.id,
        po_id: existing.po_id,
        name: `${existing.first_name} ${existing.last_name}`,
        warehouse: existing.warehouse,
      },
    })
  }

  return NextResponse.json({ exists: false })
}
