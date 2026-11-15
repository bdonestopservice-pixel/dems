import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { parseDobInput } from '@/lib/utils'

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

  let is_blacklisted = data.is_blacklisted ?? false
  let blacklist_reason = data.blacklist_reason ?? null
  let blacklisted_at = data.blacklisted_at ?? null
  let blacklisted_by = data.blacklisted_by ?? null

  if (!is_blacklisted && data.note && data.note.includes('__BLACKLIST__:')) {
    try {
      const match = data.note.match(/__BLACKLIST__:(.*?)__/)
      if (match) {
        const parsed = JSON.parse(match[1])
        is_blacklisted = true
        blacklist_reason = parsed.reason || null
        blacklisted_at = parsed.at || null
        blacklisted_by = parsed.by || null
      }
    } catch {}
  }

  const displayNote = data.note ? data.note.replace(/__BLACKLIST__:.*?__/g, '').trim() : data.note

  const formatted = {
    ...data,
    note: displayNote,
    is_blacklisted,
    blacklist_reason,
    blacklisted_at,
    blacklisted_by,
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

    // Check user's warehouse permission if not super_admin
    if (
      session.role !== 'super_admin' &&
      (!session.warehouses || !session.warehouses.includes(body.warehouse))
    ) {
      return NextResponse.json(
        { error: `คุณไม่มีสิทธิ์แก้ไขหรือย้ายพนักงานไปยังคลัง ${body.warehouse}` },
        { status: 403 }
      )
    }

    // Clean and validate phone (10 digits)
    const cleanPhone = body.phone ? body.phone.replace(/[^0-9]/g, '') : ''
    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: 'เบอร์ติดต่อต้องเป็นตัวเลข 10 หลัก (เฉพาะตัวเลขเท่านั้น เช่น 0812345678)' },
        { status: 400 }
      )
    }

    const cleanBankAccount = body.bank_account ? body.bank_account.replace(/[^0-9]/g, '') : null

    // Validate unconfirmed promptpay requires bank & account
    if (body.promptpay_status === 'ยังไม่ยืนยัน') {
      if (!body.bank_id || !cleanBankAccount) {
        return NextResponse.json(
          { error: 'กรณีไม่ยืนยันพร้อมเพย์ จำเป็นต้องระบุธนาคารและเลขที่บัญชี (เฉพาะตัวเลข ไม่ต้องมีขีด)' },
          { status: 400 }
        )
      }
    }

    // ตรวจสอบอายุต่ำกว่า 18 ปี
    const dobCheck = parseDobInput(body.dob)
    if (dobCheck.isUnder18) {
      return NextResponse.json(
        { error: `อายุพนักงานต้องไม่ต่ำกว่า 18 ปีบริบูรณ์ (ปัจจุบันอายุ ${dobCheck.age} ปี)` },
        { status: 400 }
      )
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
      phone: cleanPhone,
      ops_id: body.ops_id?.trim() || null,
      ops_hub: body.ops_hub?.trim() || null,
      ops_contract_type: body.ops_contract_type?.trim() || null,
      ops_department: body.ops_department?.trim() || null,
      ops_designation: body.ops_designation?.trim() || null,
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
      bank_account: cleanBankAccount || null,
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

    let is_blacklisted = updated.is_blacklisted ?? false
    let blacklist_reason = updated.blacklist_reason ?? null
    let blacklisted_at = updated.blacklisted_at ?? null
    let blacklisted_by = updated.blacklisted_by ?? null

    if (!is_blacklisted && updated.note && updated.note.includes('__BLACKLIST__:')) {
      try {
        const match = updated.note.match(/__BLACKLIST__:(.*?)__/)
        if (match) {
          const parsed = JSON.parse(match[1])
          is_blacklisted = true
          blacklist_reason = parsed.reason || null
          blacklisted_at = parsed.at || null
          blacklisted_by = parsed.by || null
        }
      } catch {}
    }

    const displayNote = updated.note ? updated.note.replace(/__BLACKLIST__:.*?__/g, '').trim() : updated.note

    const formatted = {
      ...updated,
      note: displayNote,
      is_blacklisted,
      blacklist_reason,
      blacklisted_at,
      blacklisted_by,
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
