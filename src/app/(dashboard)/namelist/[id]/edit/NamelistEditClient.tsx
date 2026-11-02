'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'
import { broadcastRealtime } from '@/lib/realtime'
import { formatThaiDate, getInitials } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import type { AuthSession, NamelistEntry, Department, Shift } from '@/types'

interface NamelistEditClientProps {
  session: AuthSession
  entryId: string
  backWarehouse?: string
}

const fieldCls =
  'w-full bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] cursor-pointer'

export function NamelistEditClient({ session, entryId, backWarehouse }: NamelistEditClientProps) {
  const router = useRouter()

  const [entry, setEntry] = useState<NamelistEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [workStatuses, setWorkStatuses] = useState<string[]>([])
  const [oaOptions, setOaOptions] = useState<string[]>([])

  // ฟอร์ม
  const [date, setDate] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [oaStatus, setOaStatus] = useState('-')
  const [workStatus, setWorkStatus] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/namelist/${entryId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'ไม่พบรายการ')
        const e: NamelistEntry = data.entry
        if (cancelled) return
        setEntry(e)
        setDate(e.date)
        setDepartmentId(e.department_id || '')
        setShiftId(e.shift_id || '')
        setOaStatus(e.oa_status || '-')
        setWorkStatus(e.work_status || '')
        setNote(e.note || '')

        // ตัวเลือก dropdown ดึงจาก "จัดการข้อมูล Dropdown"
        const wh = e.warehouse
        const [ws, d, s, oa] = await Promise.all([
          fetch('/api/dropdown/work-statuses'),
          wh ? fetch(`/api/dropdown/departments?warehouse=${encodeURIComponent(wh)}`) : null,
          wh ? fetch(`/api/dropdown/shifts?warehouse=${encodeURIComponent(wh)}`) : null,
          wh ? fetch(`/api/dropdown/oa-options?warehouse=${encodeURIComponent(wh)}`) : null,
        ])
        if (cancelled) return
        if (ws.ok) setWorkStatuses(((await ws.json()).work_statuses || []).map((x: any) => x.name))
        if (d?.ok) setDepartments((await d.json()).departments || [])
        if (s?.ok) setShifts((await s.json()).shifts || [])
        if (oa?.ok) setOaOptions(((await oa.json()).oa_options || []).map((x: any) => x.name))
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err.message || 'โหลดข้อมูลไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [entryId])

  const backHref = (d: string) =>
    `/namelist?date=${d}&warehouse=${encodeURIComponent(backWarehouse || entry?.warehouse || 'all')}`

  const handleSave = async () => {
    setErrorMsg(null)
    if (!date) return setErrorMsg('กรุณาระบุวันที่')
    if (!departmentId) return setErrorMsg('กรุณาเลือกแผนก')
    if (!shiftId) return setErrorMsg('กรุณาเลือกกะ')

    setSaving(true)
    try {
      const res = await fetch(`/api/namelist/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          department_id: departmentId,
          shift_id: shiftId,
          oa_status: oaStatus,
          work_status: workStatus || null,
          note,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      broadcastRealtime('namelist-updated')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('namelist_needs_refresh', 'true')
      }
      // ไปที่วันที่ของรายการหลังแก้ไข (ถ้าย้ายวัน จะเห็นรายการอยู่ในวันใหม่)
      router.push(backHref(date))
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!entry) return
    if (
      !confirm(
        `ต้องการลบ "${employeeFullName(entry)}" (${entry.po_id}) ออกจาก Namelist ของวันที่ ${formatThaiDate(entry.date)} หรือไม่?\n\n(ลบเฉพาะรายการของวันนี้ ไม่กระทบข้อมูลพนักงานกลาง)`
      )
    )
      return
    setDeleting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/namelist/${entryId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ')
      broadcastRealtime('namelist-updated')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('namelist_needs_refresh', 'true')
      }
      router.push(backHref(entry.date))
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'ลบไม่สำเร็จ')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Topbar session={session} title="แก้ไขข้อมูล Namelist" subtitle="แก้ไขรายการของพนักงาน 1 คน" />
        <div className="flex-1 flex items-center justify-center p-12">
          <Loader2 className="w-7 h-7 text-[#2E6FE0] animate-spin" />
        </div>
      </>
    )
  }

  if (!entry) {
    return (
      <>
        <Topbar session={session} title="แก้ไขข้อมูล Namelist" subtitle="แก้ไขรายการของพนักงาน 1 คน" />
        <div className="p-8 text-center text-[#E5484D] text-sm font-semibold">
          {errorMsg || 'ไม่พบรายการใน Namelist'}
          <div className="mt-4">
            <Link href="/namelist" className="text-xs text-[#2E6FE0] underline">
              กลับไปหน้า Namelist
            </Link>
          </div>
        </div>
      </>
    )
  }

  const statusChoices = Array.from(new Set([...workStatuses, ...(workStatus ? [workStatus] : [])]))
  const oaChoices = Array.from(new Set(['-', ...oaOptions, oaStatus]))
  const fullName = employeeFullName(entry)

  return (
    <>
      <Topbar session={session} title="แก้ไขข้อมูล Namelist" subtitle="แก้ไขรายการของพนักงาน 1 คน" />

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        <div className="max-w-[560px] mx-auto">
          <div className="mb-4">
            <Link
              href={backHref(entry.date)}
              className="inline-flex items-center gap-1.5 text-xs text-[#5B6B85] hover:text-[#2E6FE0] transition-colors font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              กลับไปหน้า Namelist
            </Link>
          </div>

          {/* ข้อมูลพนักงาน */}
          <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm px-5 py-4 mb-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#2E6FE0] text-white flex items-center justify-center text-xs font-bold">
              {getInitials(entry.first_name || fullName)}
            </div>
            <div>
              <div className="text-sm font-bold text-[#16233D]">{fullName}</div>
              <div className="text-[11px] text-[#5B6B85]">
                {entry.po_id} · {entry.warehouse || '—'} · {formatThaiDate(entry.date)}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#FCE8E8] border border-[#F87171] flex items-center gap-2.5 text-[#E5484D] text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ฟอร์มแก้ไข */}
          <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#16233D] mb-1.5">วันที่</label>
              <DateInput value={date} onChange={setDate} className="w-full" />
              {date !== entry.date && (
                <p className="text-[11px] text-[#B45F17] mt-1">
                  รายการนี้จะย้ายไปแสดงในวันที่ {formatThaiDate(date)} (ไม่ค้างในวันเดิม)
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#16233D] mb-1.5">แผนก</label>
              <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={fieldCls}>
                <option value="">เลือกแผนก</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#16233D] mb-1.5">กะ</label>
              <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={fieldCls}>
                <option value="">เลือกกะ</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatShiftRange(s.start_time, s.end_time)} · {s.type === 'N' ? 'Night' : s.type === 'H' ? 'Half' : 'Day'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#16233D] mb-1.5">ต่างพื้นที่</label>
              <select value={oaStatus} onChange={(e) => setOaStatus(e.target.value)} className={fieldCls}>
                {oaChoices.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#16233D] mb-1.5">Status การทำงาน</label>
              <select value={workStatus} onChange={(e) => setWorkStatus(e.target.value)} className={fieldCls}>
                <option value="">— เลือก —</option>
                {statusChoices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#16233D] mb-1.5">หมายเหตุ</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                className="w-full bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0]"
              />
            </div>
          </div>

          {/* ลบออกจาก Namelist */}
          <div className="mt-4 bg-[#FCE8E8] border border-[#F5B5B5] rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#E5484D]">ลบพนักงานคนนี้ออกจาก Namelist</div>
              <div className="text-[11px] text-[#E5484D]/80 mt-0.5">จะลบเฉพาะรายการของวันนี้</div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 bg-white border border-[#F87171] text-[#E5484D] hover:bg-[#FCE8E8] text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              ลบออก
            </button>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <Link
              href={backHref(entry.date)}
              className="text-xs font-semibold text-[#5B6B85] hover:text-[#16233D] bg-white border border-[#E1E6EF] hover:bg-gray-50 px-5 py-2.5 rounded-xl transition-all shadow-sm"
            >
              ยกเลิก
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex items-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              บันทึกการแก้ไข
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
