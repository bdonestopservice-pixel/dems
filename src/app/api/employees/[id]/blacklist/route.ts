import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/session'
import { updateEmployeeInSheet } from '@/lib/google-sheets'

// POST /api/employees/[id]/blacklist
// Body: { is_blacklisted: boolean, blacklist_reason?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServerSupabaseClient()

  try {
    const body = await request.json()
    const { is_blacklisted, blacklist_reason } = body

    if (is_blacklisted) {
      if (!blacklist_reason || typeof blacklist_reason !== 'string' || !blacklist_reason.trim()) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลในการติดแบล็กลิสต์' }, { status: 400 })
      }
    }

    // 1. Fetch current employee to get current note & details
    const { data: currentEmp, error: fetchErr } = await supabase
      .from('employees')
      .select('id, note, first_name, last_name, warehouse')
      .eq('id', id)
      .single()

    if (fetchErr || !currentEmp) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 })
    }

    // Check user's warehouse permission if not super_admin
    if (
      session.role !== 'super_admin' &&
      (!session.warehouses || !session.warehouses.includes(currentEmp.warehouse))
    ) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์จัดการข้อมูลพนักงานในคลังนี้' },
        { status: 403 }
      )
    }

    const operatorName = session.name || session.email || 'Admin'
    const nowIso = new Date().toISOString()
    const reasonTrimmed = blacklist_reason?.trim() || ''

    // 2. Try native columns first
    let updatePayload: Record<string, any> = {
      is_blacklisted: !!is_blacklisted,
      blacklist_reason: is_blacklisted ? reasonTrimmed : null,
      blacklisted_at: is_blacklisted ? nowIso : null,
      blacklisted_by: is_blacklisted ? operatorName : null,
      updated_at: nowIso,
    }

    let { data: updated, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        warehouses:warehouse (id, name),
        banks:bank_id (id, name, code)
      `)
      .single()

    // 3. Graceful fallback if native columns don't exist yet in Supabase schema cache
    if (error && (error.message?.includes('is_blacklisted') || error.code === 'PGRST204' || error.message?.includes('schema cache'))) {
      console.warn('Native blacklist columns not yet detected in Supabase, using note metadata fallback:', error.message)

      let cleanNote = (currentEmp.note || '').replace(/__BLACKLIST__:.*?__/g, '').trim()
      if (is_blacklisted) {
        const metaTag = `__BLACKLIST__:${JSON.stringify({
          reason: reasonTrimmed,
          at: nowIso,
          by: operatorName,
        })}__`
        cleanNote = cleanNote ? `${cleanNote} ${metaTag}` : metaTag
      }

      const fallbackRes = await supabase
        .from('employees')
        .update({
          note: cleanNote || null,
          updated_at: nowIso,
        })
        .eq('id', id)
        .select(`
          *,
          warehouses:warehouse (id, name),
          banks:bank_id (id, name, code)
        `)
        .single()

      if (fallbackRes.error) {
        return NextResponse.json({ error: fallbackRes.error.message }, { status: 500 })
      }

      updated = fallbackRes.data
      error = null
    } else if (error) {
      console.error('Blacklist update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 4. Format return object
    let finalIsBlacklisted = updated.is_blacklisted ?? !!is_blacklisted
    let finalReason = updated.blacklist_reason ?? (is_blacklisted ? reasonTrimmed : null)
    let finalAt = updated.blacklisted_at ?? (is_blacklisted ? nowIso : null)
    let finalBy = updated.blacklisted_by ?? (is_blacklisted ? operatorName : null)

    if (!finalIsBlacklisted && updated.note && updated.note.includes('__BLACKLIST__:')) {
      try {
        const match = updated.note.match(/__BLACKLIST__:(.*?)__/)
        if (match) {
          const parsed = JSON.parse(match[1])
          finalIsBlacklisted = true
          finalReason = parsed.reason || null
          finalAt = parsed.at || null
          finalBy = parsed.by || null
        }
      } catch {}
    }

    const displayNote = updated.note ? updated.note.replace(/__BLACKLIST__:.*?__/g, '').trim() : updated.note

    const formatted = {
      ...updated,
      note: displayNote,
      is_blacklisted: finalIsBlacklisted,
      blacklist_reason: finalReason,
      blacklisted_at: finalAt,
      blacklisted_by: finalBy,
      warehouse_name: updated.warehouses?.name || updated.warehouse,
      bank_name: updated.banks?.name || undefined,
      bank_code: updated.banks?.code || undefined,
    }

    // Sync to Google Sheets with timeout protection (ensures Vercel completes before freezing)
    try {
      await Promise.race([
        updateEmployeeInSheet(formatted),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sheet sync timeout')), 4000)),
      ])
    } catch (sheetErr) {
      console.warn('Google Sheets sync warning (blacklist):', sheetErr)
    }

    return NextResponse.json({
      success: true,
      message: is_blacklisted ? 'ติดแบล็กลิสต์พนักงานเรียบร้อยแล้ว' : 'ปลดแบล็กลิสต์พนักงานเรียบร้อยแล้ว',
      employee: formatted,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
