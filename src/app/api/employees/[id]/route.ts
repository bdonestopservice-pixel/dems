import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

// GET /api/employees/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      warehouses:warehouse (id, name),
      banks:bank_id (id, name, code)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 })
  }

  const formatted = {
    ...data,
    warehouse_name: data.warehouses?.name || data.warehouse,
    bank_name: data.banks?.name || undefined,
    bank_code: data.banks?.code || undefined,
  }

  return NextResponse.json({ employee: formatted })
}

// PUT /api/employees/[id]
// Updates employee details. Note: id_card cannot be modified!
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()

    // Required fields validation
    if (
      !body.prefix ||
      !body.first_name ||
      !body.last_name ||
      !body.gender ||
      !body.first_name_en ||
      !body.last_name_en ||
      !body.dob ||
      !body.warehouse ||
      !body.start_date ||
      !body.phone
    ) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมายดอกจัน (*)' },
        { status: 400 }
      )
    }

    // Validate unconfirmed promptpay requires bank & account
    if (body.promptpay_status === 'ยังไม่ยืนยัน') {
      if (!body.bank_id || !body.bank_account || !body.bank_account.trim()) {
        return NextResponse.json(
          { error: 'กรณีไม่ยืนยันพร้อมเพย์ จำเป็นต้องระบุธนาคารและเลขที่บัญชี' },
          { status: 400 }
        )
      }
    }

    const supabase = createServerSupabaseClient()

    // Security check: Never allow changing id_card or id
    const updatePayload: any = {
      prefix: body.prefix,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      gender: body.gender,
      first_name_en: body.first_name_en.trim(),
      last_name_en: body.last_name_en.trim(),
      dob: body.dob,
      warehouse: body.warehouse,
      start_date: body.start_date,
      phone: body.phone.trim(),
      ops_id: body.ops_id?.trim() || null,
      address_no: body.address_no?.trim() || null,
      address_moo: body.address_moo?.trim() || null,
      address_trok: body.address_trok?.trim() || null,
      address_soi: body.address_soi?.trim() || null,
      address_road: body.address_road?.trim() || null,
      address_tambon: body.address_tambon?.trim() || null,
      address_amphoe: body.address_amphoe?.trim() || null,
      address_province: body.address_province?.trim() || null,
      address_zipcode: body.address_zipcode?.trim() || null,
      address_full: body.address_full?.trim() || null,
      bank_id: body.bank_id || null,
      bank_account: body.bank_account?.trim() || null,
      promptpay_status: body.promptpay_status || 'ยังไม่ยืนยัน',
      note: body.note?.trim() || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        warehouses:warehouse (id, name),
        banks:bank_id (id, name, code)
      `)
      .single()

    if (error) {
      console.error('Update employee error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = {
      ...updated,
      warehouse_name: updated.warehouses?.name || updated.warehouse,
      bank_name: updated.banks?.name || undefined,
      bank_code: updated.banks?.code || undefined,
    }

    return NextResponse.json({ employee: formatted })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
