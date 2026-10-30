import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'

// GET /api/employees
// Query params:
// - search: text search across first_name, last_name, po_id, id_card
// - warehouse: filter by warehouse id (or 'all')
// - status: filter by is_active ('all', 'active', 'inactive')
// - page: page number (1-based, default: 1)
// - limit: items per page (default: 100)
// - ids: comma-separated employee IDs (for exporting selected items)
// - all: if 'true', returns all matching items without pagination (for export)
export async function GET(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')?.trim() || ''
  const warehouse = searchParams.get('warehouse') || 'all'
  const status = searchParams.get('status') || 'all'
  const startDate = searchParams.get('start_date')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))
  const idsParam = searchParams.get('ids')
  const fetchAll = searchParams.get('all') === 'true'

  const supabase = createServerSupabaseClient()

  // Base query with joined banks and warehouses
  let query = supabase
    .from('employees')
    .select(
      `
      *,
      warehouses:warehouse (id, name),
      banks:bank_id (id, name, code)
    `,
      { count: 'exact' }
    )

  // 1. Specific IDs filter (when exporting selected rows)
  if (idsParam) {
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean)
    if (ids.length > 0) {
      query = query.in('id', ids)
    }
  }

  // 2. Warehouse filter
  if (warehouse && warehouse !== 'all') {
    query = query.eq('warehouse', warehouse)
  }

  // 2.1 Start date filter
  if (startDate) {
    query = query.eq('start_date', startDate)
  }

  // 3. Status filter
  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  // 4. Search query (supports multi-word search e.g. "พงศกร เล็กดวง" or "นาย สมชาย")
  // Optimized: Type-aware targeted column matching to eliminate redundant regex scanning on 16,000+ rows
  if (search) {
    const words = search
      .split(/\s+/)
      .map((w) => w.replace(/[,()]/g, '').trim())
      .filter(Boolean)

    for (const word of words) {
      const s = `%${word}%`
      const isDigitsOnly = /^\d+$/.test(word)
      const isPoIdPattern = /^(po|ops)/i.test(word)
      const isThai = /[\u0E00-\u0E7F]/.test(word)
      const isEnglish = /^[a-zA-Z\s]+$/.test(word)

      let targetFields: string[]

      if (isPoIdPattern) {
        // Explicit PO or OPS ID pattern e.g. "PO100001", "ops123"
        targetFields = [`po_id.ilike.${s}`, `ops_id.ilike.${s}`]
      } else if (isDigitsOnly) {
        // Pure digits e.g. "1103700123456" (ID card), "0812345678" (phone), or "10001" (PO numeric part)
        targetFields = [`id_card.ilike.${s}`, `phone.ilike.${s}`, `po_id.ilike.${s}`]
      } else if (isThai) {
        // Thai text e.g. "สมชาย", "ใจดี" (can never match phone, id_card or po_id)
        targetFields = [`first_name.ilike.${s}`, `last_name.ilike.${s}`, `prefix.ilike.${s}`]
      } else if (isEnglish) {
        // English text e.g. "John", "Smith"
        targetFields = [
          `first_name_en.ilike.${s}`,
          `last_name_en.ilike.${s}`,
          `first_name.ilike.${s}`,
          `last_name.ilike.${s}`,
        ]
      } else {
        // Mixed text fallback
        targetFields = [
          `first_name.ilike.${s}`,
          `last_name.ilike.${s}`,
          `po_id.ilike.${s}`,
          `id_card.ilike.${s}`,
        ]
      }

      query = query.or(targetFields.join(','))
    }
  }

  // Order by po_id ascending or created_at descending
  query = query.order('po_id', { ascending: true, nullsFirst: false })

  // Pagination (unless fetchAll is requested)
  if (!fetchAll && !idsParam) {
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = count ?? (data?.length || 0)
  const totalPages = Math.ceil(total / limit) || 1

  // Format joined fields for convenience
  const formatted = (data || []).map((emp: any) => ({
    ...emp,
    warehouse_name: emp.warehouses?.name || emp.warehouse,
    bank_name: emp.banks?.name || undefined,
    bank_code: emp.banks?.code || undefined,
  }))

  return NextResponse.json({
    employees: formatted,
    total,
    page,
    limit,
    totalPages,
  })
}

// POST /api/employees
// Creates a new employee with automatic PO-id generation
export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      id_card,
      prefix,
      first_name,
      last_name,
      gender,
      first_name_en,
      last_name_en,
      dob,
      warehouse,
      start_date,
      phone,
      // Optional fields
      ops_id,
      address_no,
      address_moo,
      address_trok,
      address_soi,
      address_road,
      address_tambon,
      address_amphoe,
      address_province,
      address_zipcode,
      address_full,
      bank_id,
      bank_account,
      promptpay_status,
      note,
    } = body

    // 1. Validation of required fields
    if (
      !id_card ||
      !prefix ||
      !first_name ||
      !last_name ||
      !gender ||
      !first_name_en ||
      !last_name_en ||
      !dob ||
      !warehouse ||
      !start_date ||
      !phone
    ) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมายดอกจัน (*)' },
        { status: 400 }
      )
    }

    // Check user's warehouse permission if not super_admin
    if (
      session.role !== 'super_admin' &&
      (!session.warehouses || !session.warehouses.includes(warehouse))
    ) {
      return NextResponse.json(
        { error: `คุณไม่มีสิทธิ์เพิ่มพนักงานในคลัง ${warehouse}` },
        { status: 403 }
      )
    }

    // Clean id_card, phone & bank_account
    const cleanIdCard = id_card.replace(/[^0-9]/g, '')
    if (cleanIdCard.length !== 13) {
      return NextResponse.json(
        { error: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก' },
        { status: 400 }
      )
    }

    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : ''
    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: 'เบอร์ติดต่อต้องเป็นตัวเลข 10 หลัก (เฉพาะตัวเลขเท่านั้น เช่น 0812345678)' },
        { status: 400 }
      )
    }

    const cleanBankAccount = bank_account ? bank_account.replace(/[^0-9]/g, '') : null

    // 1.1 Validate unconfirmed promptpay requires bank & account
    if (promptpay_status === 'ยังไม่ยืนยัน') {
      if (!bank_id || !cleanBankAccount) {
        return NextResponse.json(
          { error: 'กรณีไม่ยืนยันพร้อมเพย์ จำเป็นต้องระบุธนาคารและเลขที่บัญชี (เฉพาะตัวเลข ไม่ต้องมีขีด)' },
          { status: 400 }
        )
      }
    }

    const supabase = createServerSupabaseClient()

    // 2. Check duplicate id_card
    const { data: existing, error: checkErr } = await supabase
      .from('employees')
      .select('id, po_id, first_name, last_name')
      .eq('id_card', cleanIdCard)
      .maybeSingle()

    if (checkErr && checkErr.code !== 'PGRST116') {
      console.error('Check ID card error:', checkErr)
    }

    if (existing) {
      return NextResponse.json(
        {
          error: `เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว (${existing.first_name} ${existing.last_name} รหัส ${existing.po_id || '-'})`,
        },
        { status: 400 }
      )
    }

    // 3. Fallback PO-id generation if DB sequence isn't assigned by default
    let assignedPoId = body.po_id
    if (!assignedPoId) {
      try {
        // Query current max numeric po_id
        const { data: maxEmp } = await supabase
          .from('employees')
          .select('po_id')
          .like('po_id', 'PO%')
          .order('po_id', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (maxEmp?.po_id) {
          const numPart = parseInt(maxEmp.po_id.replace(/^PO/i, ''), 10)
          if (!isNaN(numPart)) {
            // Keep at least 112840 (the reserved range boundary)
            const nextNum = Math.max(112840, numPart + 1)
            assignedPoId = `PO${nextNum}`
          }
        }
      } catch {}
    }

    // 4. Insert record
    const insertPayload: any = {
      id_card: cleanIdCard,
      prefix,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      gender,
      first_name_en: first_name_en.trim(),
      last_name_en: last_name_en.trim(),
      dob,
      warehouse,
      start_date,
      phone: cleanPhone,
      ops_id: ops_id?.trim() || null,
      address_no: address_no?.trim() || null,
      address_moo: address_moo?.trim() || null,
      address_trok: address_trok?.trim() || null,
      address_soi: address_soi?.trim() || null,
      address_road: address_road?.trim() || null,
      address_tambon: address_tambon?.trim() || null,
      address_amphoe: address_amphoe?.trim() || null,
      address_province: address_province?.trim() || null,
      address_zipcode: address_zipcode?.trim() || null,
      address_full: address_full?.trim() || null,
      bank_id: bank_id || null,
      bank_account: cleanBankAccount || null,
      promptpay_status: promptpay_status || 'ยังไม่ยืนยัน',
      note: note?.trim() || null,
      is_active: true,
    }

    if (assignedPoId) {
      insertPayload.po_id = assignedPoId
    }

    const { data: newEmp, error: insertErr } = await supabase
      .from('employees')
      .insert(insertPayload)
      .select()
      .single()

    if (insertErr) {
      console.error('Insert employee error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ employee: newEmp }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
