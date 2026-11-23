import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { validateThaiCitizenId } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/employees/check-id-card?id_card=1103700123456&exclude_id=uuid
// Checks whether an ID card already exists in the system in real time (excluding current employee in edit mode)
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawIdCard = request.nextUrl.searchParams.get('id_card') || ''
  const excludeId = request.nextUrl.searchParams.get('exclude_id')?.trim() || ''
  const cleanIdCard = rawIdCard.replace(/[^0-9]/g, '')

  if (cleanIdCard.length !== 13) {
    return NextResponse.json({
      exists: false,
      valid: false,
      message: 'เลขบัตรประชาชนต้องมี 13 หลัก',
    })
  }

  // ตรวจสอบความถูกต้องตามหลัก Checksum ประเทศไทย
  if (!validateThaiCitizenId(cleanIdCard)) {
    return NextResponse.json({
      exists: false,
      valid: false,
      invalidChecksum: true,
      message: 'เลขบัตรประชาชนไม่ถูกต้องตามหลักการคำนวณ 13 หลักของกรมการปกครอง (Checksum ไม่ผ่าน)',
    })
  }

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('employees')
    .select('id, po_id, first_name, last_name, warehouse')
    .eq('id_card', cleanIdCard)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data: existing, error } = await query.maybeSingle()

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

  return NextResponse.json({ exists: false, valid: true })
}
