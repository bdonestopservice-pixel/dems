'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, Loader2, AlertCircle, CheckCircle2, ClipboardList } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'
import { broadcastRealtime } from '@/lib/realtime'
import { useRealtimeListener, useRealtimeSession } from '@/components/providers/RealtimeProvider'
import type { AuthSession, NamelistEntry, Warehouse } from '@/types'

interface NamelistClientProps {
  session: AuthSession
  initialDate: string
  initialWarehouse?: string
}

type Toast = { type: 'success' | 'error'; text: string } | null

const selectCls =
  'w-full bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] cursor-pointer disabled:opacity-60'

/** ช่องหมายเหตุ: บันทึกอัตโนมัติเมื่อออกจากช่อง (blur) หรือกด Enter */
function NoteInput({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled?: boolean
  onSave: (v: string) => void
}) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  const commit = () => {
    if (text.trim() !== value.trim()) onSave(text)
  }

  return (
    <input
      type="text"
      value={text}
      disabled={disabled}
      placeholder="เพิ่มหมายเหตุ"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className="w-full min-w-[150px] bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0]"
    />
  )
}

export function NamelistClient({ session: initialSession, initialDate, initialWarehouse }: NamelistClientProps) {
  const { session } = useRealtimeSession()
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  const [date, setDate] = useState(initialDate)
  const [warehouse, setWarehouse] = useState<string>(
    initialWarehouse || (isSuperAdmin ? 'all' : userWarehouses[0] || 'all')
  )
  const [search, setSearch] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const [entries, setEntries] = useState<NamelistEntry[]>([])
  const [workStatuses, setWorkStatuses] = useState<string[]>([])
  const [oaOptions, setOaOptions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<Toast>(null)

  const requestSeq = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (t: Toast) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // โหลดรายการคลัง (จำกัดเฉพาะที่มีสิทธิ์)
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) return
        const data = await res.json()
        const all: Warehouse[] = data.warehouses || []
        setWarehouses(isSuperAdmin ? all : all.filter((w) => userWarehouses.includes(w.id)))
      } catch (err) {
        console.error(err)
      }
    }
    loadWarehouses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  // โหลดข้อมูลของวัน/คลังที่เลือกใหม่ทั้งหมดทุกครั้งที่เปลี่ยน (ล้างข้อมูลเก่าทิ้งก่อน)
  const fetchEntries = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setLoadError(null)
    setEntries([])
    try {
      const params = new URLSearchParams({ date, warehouse })
      const res = await fetch(`/api/namelist?${params.toString()}`)
      const data = await res.json()
      if (seq !== requestSeq.current) return // มีการเปลี่ยนวัน/คลังซ้อนเข้ามา ทิ้งผลเก่า
      if (!res.ok) throw new Error(data.error || 'โหลดรายชื่อไม่สำเร็จ')
      setEntries(data.entries || [])
      setWorkStatuses(data.work_statuses || [])
      setOaOptions(data.oa_options || {})
    } catch (err: any) {
      if (seq !== requestSeq.current) return
      setLoadError(err.message || 'โหลดรายชื่อไม่สำเร็จ')
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [date, warehouse])

  useEffect(() => {
    if (date) fetchEntries()
  }, [date, fetchEntries])

  // ซิงค์ข้อมูล Realtime สำหรับ Namelist
  useRealtimeListener('namelist-updated', () => {
    fetchEntries()
  })

  // ค้นหาแบบ real-time ในรายชื่อวันนั้น (รหัส/ชื่อ รองรับพิมพ์เว้นวรรคชื่อ นามสกุล)
  const visible = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return entries
    return entries.filter((e) => {
      const hay = `${e.po_id || ''} ${employeeFullName(e)}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [entries, search])

  // สรุปจำนวนของวัน/คลังที่เลือก (ไม่ขึ้นกับคำค้นหา)
  const summary = useMemo(
    () => ({
      total: entries.length,
      day: entries.filter((e) => e.shift_type === 'D').length,
      night: entries.filter((e) => e.shift_type === 'N').length,
    }),
    [entries]
  )

  // บันทึกทันทีต่อ field (optimistic update แล้วย้อนกลับถ้าล้มเหลว)
  const patchEntry = async (entry: NamelistEntry, patch: Partial<NamelistEntry>) => {
    const previous = { ...entry }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)))
    setSavingIds((prev) => new Set(prev).add(entry.id))
    try {
      const res = await fetch(`/api/namelist/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      // sync ค่าที่ server normalize แล้ว (เช่น trim / '-')
      if (data.entry) {
        setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...data.entry } : e)))
      }
      broadcastRealtime('namelist-updated')
    } catch (err: any) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? previous : e)))
      showToast({ type: 'error', text: err.message || 'บันทึกไม่สำเร็จ' })
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(entry.id)
        return next
      })
    }
  }

  const backQuery = new URLSearchParams({ date, warehouse }).toString()

  return (
    <>
      <Topbar session={session} title="Namelist" subtitle="รายชื่อพนักงานที่ลงบันทึกไว้ในแต่ละวัน" />

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer"
            title="เลือกวันที่"
          />

          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer"
          >
            {(isSuperAdmin || warehouses.length > 1) && <option value="all">ทุกคลัง</option>}
            {warehouses.length === 0 && warehouse !== 'all' && (
              <option value={warehouse}>{warehouse}</option>
            )}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.id}
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9AA5B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือรหัสพนักงานในรายชื่อวันนี้"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm"
            />
          </div>

          <Link
            href={`/namelist/add?${backQuery}`}
            className="inline-flex items-center justify-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            เพิ่มพนักงาน
          </Link>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-2.5 mb-4">
          <span className="bg-white border border-[#E1E6EF] rounded-xl px-3.5 py-2 text-xs font-medium text-[#5B6B85] shadow-sm">
            ทั้งหมด <span className="font-bold text-[#2E6FE0] ml-1">{summary.total} คน</span>
          </span>
          <span className="bg-white border border-[#E1E6EF] rounded-xl px-3.5 py-2 text-xs font-medium text-[#5B6B85] shadow-sm">
            กะ Day <span className="font-bold text-[#F5A623] ml-1">{summary.day} คน</span>
          </span>
          <span className="bg-white border border-[#E1E6EF] rounded-xl px-3.5 py-2 text-xs font-medium text-[#5B6B85] shadow-sm">
            กะ Night <span className="font-bold text-[#16233D] ml-1">{summary.night} คน</span>
          </span>
          {search.trim() && !loading && (
            <span className="text-xs text-[#5B6B85]">พบ {visible.length} จาก {summary.total} คน</span>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-[#E7F6ED] border-[#2E9E5B] text-[#2E9E5B]'
                : 'bg-[#FCE8E8] border-[#F87171] text-[#E5484D]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-14 text-center">
              <Loader2 className="w-6 h-6 text-[#2E6FE0] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#5B6B85]">กำลังโหลดรายชื่อของวันที่เลือก...</p>
            </div>
          ) : loadError ? (
            <div className="p-14 text-center text-[#E5484D] text-xs font-semibold">{loadError}</div>
          ) : visible.length === 0 ? (
            <div className="p-14 text-center text-[#5B6B85]">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-[#16233D]">
                {entries.length === 0 ? 'ยังไม่มีรายชื่อใน Namelist ของวันนี้' : 'ไม่พบพนักงานที่ค้นหา'}
              </p>
              {entries.length === 0 && (
                <p className="text-xs mt-1">กดปุ่ม “เพิ่มพนักงาน” หรือส่งรายชื่อมาจากหน้าจัดแพลนพนักงาน</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E1E6EF] text-[11px] font-bold text-[#5B6B85]">
                    <th className="py-3.5 px-4 whitespace-nowrap">รหัสพนักงาน</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">ชื่อ-นามสกุล</th>
                    <th className="py-3.5 px-3">แผนก</th>
                    <th className="py-3.5 px-3">กะ</th>
                    <th className="py-3.5 px-3 w-[110px]">ต่างพื้นที่</th>
                    <th className="py-3.5 px-3 w-[150px]">Status การทำงาน</th>
                    <th className="py-3.5 px-3">หมายเหตุ</th>
                    <th className="py-3.5 px-4 w-[56px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F6FA]">
                  {visible.map((e) => {
                    const saving = savingIds.has(e.id)
                    const oaList = (e.warehouse && oaOptions[e.warehouse]) || []
                    const oaChoices = Array.from(new Set(['-', ...oaList, e.oa_status || '-']))
                    const statusChoices = Array.from(
                      new Set([...workStatuses, ...(e.work_status ? [e.work_status] : [])])
                    )

                    return (
                      <tr key={e.id} className="hover:bg-[#FAFBFD] transition-colors">
                        <td className="py-3 px-4 text-xs text-[#5B6B85] font-mono whitespace-nowrap">
                          {e.po_id || '—'}
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-[#16233D] whitespace-nowrap">
                          {employeeFullName(e)}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#16233D]">
                          {e.department_name || '—'}
                          {warehouse === 'all' && e.warehouse && (
                            <span className="ml-1.5 text-[10px] font-semibold text-[#5B6B85] bg-[#F4F6FA] border border-[#E1E6EF] px-1.5 py-0.5 rounded">
                              {e.warehouse}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#5B6B85] whitespace-nowrap">
                          {formatShiftRange(e.shift_start, e.shift_end)}
                        </td>

                        {/* ต่างพื้นที่ — บันทึกทันที */}
                        <td className="py-2.5 px-3">
                          <select
                            value={e.oa_status || '-'}
                            disabled={saving}
                            onChange={(ev) => patchEntry(e, { oa_status: ev.target.value })}
                            className={selectCls}
                          >
                            {oaChoices.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Status การทำงาน — บันทึกทันที */}
                        <td className="py-2.5 px-3">
                          <select
                            value={e.work_status || ''}
                            disabled={saving}
                            onChange={(ev) => patchEntry(e, { work_status: ev.target.value || null })}
                            className={selectCls}
                          >
                            <option value="">— เลือก —</option>
                            {statusChoices.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* หมายเหตุ — บันทึกเมื่อออกจากช่อง */}
                        <td className="py-2.5 px-3">
                          <NoteInput
                            value={e.note || ''}
                            onSave={(v) => patchEntry(e, { note: v.trim() || null })}
                          />
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          {saving ? (
                            <Loader2 className="w-4 h-4 text-[#2E6FE0] animate-spin inline" />
                          ) : (
                            <Link
                              href={`/namelist/${e.id}/edit?wh=${encodeURIComponent(warehouse)}`}
                              title="แก้ไขรายการ"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#E1E6EF] text-[#5B6B85] hover:text-[#2E6FE0] hover:bg-[#EEF3FC] hover:border-[#2E6FE0]/40 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
