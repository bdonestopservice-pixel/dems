'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange, hhmm } from '@/lib/namelist'
import { broadcastRealtime } from '@/lib/realtime'
import { useRealtimeListener, useRealtimeSession } from '@/components/providers/RealtimeProvider'
import { useWarehouses } from '@/components/providers/WarehouseProvider'
import { cn, todayLocal } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import { ShiftSelect } from '@/components/ui/ShiftSelect'
import { ExportCustomerNamelistModal } from '@/components/namelist/ExportCustomerNamelistModal'
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

function getShiftProximityScore(
  startTime?: string | null,
  currentMinutes: number = 0,
  isToday: boolean = false
): number {
  if (!startTime) return 99999
  const parts = startTime.trim().split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1] || '0', 10)
  if (isNaN(h)) return 99999
  const shiftMinutes = h * 60 + m

  if (isToday) {
    // ถ้าเป็นวันนี้: กะที่กำลังจะมาถึง หรือเพิ่งเริ่มไปไม่เกิน 60 นาที (ongoing) จะมีคะแนนน้อย (ขึ้นก่อน)
    const diff = shiftMinutes - currentMinutes
    if (diff >= -60) {
      return diff >= 0 ? diff : Math.abs(diff) + 0.1
    } else {
      // กะที่จบไปนานแล้ว (เช่น กะเช้าเมื่อเทียบกับเวลาเย็น) ให้อยู่ท้าย
      return 2000 + Math.abs(diff)
    }
  }

  // ถ้าเป็นวันอื่น (อนาคต หรือ อดีต): เรียงตามลำดับเวลาเริ่มจากเช้าไปดึก (06:00 -> 23:00)
  return shiftMinutes
}

const PAGE_SIZE = 50

export function NamelistClient({ session: initialSession, initialDate, initialWarehouse }: NamelistClientProps) {
  const { session } = useRealtimeSession()
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  const [date, setDate] = useState(initialDate)
  const [warehouse, setWarehouse] = useState<string>(
    initialWarehouse || (isSuperAdmin ? 'all' : userWarehouses[0] || 'all')
  )

  // ซิงค์ date และ warehouse เฉพาะเมื่อ initial props จากการ redirect หรือ URL ภายนอกเปลี่ยนแปลง
  const prevInitialDateRef = useRef(initialDate)
  useEffect(() => {
    if (initialDate && initialDate !== prevInitialDateRef.current) {
      prevInitialDateRef.current = initialDate
      setDate(initialDate)
    }
  }, [initialDate])

  const prevInitialWarehouseRef = useRef(initialWarehouse)
  useEffect(() => {
    if (initialWarehouse !== prevInitialWarehouseRef.current) {
      prevInitialWarehouseRef.current = initialWarehouse
      if (initialWarehouse) {
        setWarehouse(initialWarehouse)
      }
    }
  }, [initialWarehouse])

  // อัปเดต URL searchParams ในเบราว์เซอร์เมื่อผู้ใช้เปลี่ยนวันหรือคลัง โดยไม่ทำให้หน้า reload
  const updateUrlParams = useCallback((newDate: string, newWarehouse: string) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('date', newDate)
    if (newWarehouse && newWarehouse !== 'all') {
      url.searchParams.set('warehouse', newWarehouse)
    } else {
      url.searchParams.delete('warehouse')
    }
    window.history.replaceState({}, '', url.toString())
  }, [])
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [selectedShift, setSelectedShift] = useState<string>('all')
  const [page, setPage] = useState(1)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [entries, setEntries] = useState<NamelistEntry[]>([])
  const [workStatuses, setWorkStatuses] = useState<string[]>([])
  const [oaOptions, setOaOptions] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<Toast>(null)

  // สถานะสำหรับ Popup ยืนยันการลบ
  const [entryToDelete, setEntryToDelete] = useState<NamelistEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // สถานะสำหรับ Popup Export Namelist ลูกค้า
  const [showExportModal, setShowExportModal] = useState(false)

  const requestSeq = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (t: Toast) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ปิด popup ด้วยปุ่ม Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && entryToDelete && !deleting) {
        setEntryToDelete(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [entryToDelete, deleting])

  const { warehouses: allWarehouses } = useWarehouses()

  // โหลดรายการคลัง (จำกัดเฉพาะที่มีสิทธิ์ จาก In-Memory Cache 0ms)
  useEffect(() => {
    setWarehouses(isSuperAdmin ? allWarehouses : allWarehouses.filter((w) => userWarehouses.includes(w.id)))
  }, [isSuperAdmin, allWarehouses, userWarehouses])

  // โหลดข้อมูลของวัน/คลังที่เลือก (รองรับ silent update เบื้องหลังสำหรับ realtime โดยไม่กระพริบจอโหลด)
  const fetchEntries = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current
    if (!silent) {
      setLoading(true)
      setLoadError(null)
    }
    try {
      const params = new URLSearchParams({ date, warehouse, _t: String(Date.now()) })
      const res = await fetch(`/api/namelist?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const data = await res.json()
      if (seq !== requestSeq.current) return // มีการเปลี่ยนวัน/คลังซ้อนเข้ามา ทิ้งผลเก่า
      if (!res.ok) throw new Error(data.error || 'โหลดรายชื่อไม่สำเร็จ')
      setEntries(data.entries || [])
      setWorkStatuses(data.work_statuses || [])
      setOaOptions(data.oa_options || {})
    } catch (err: any) {
      if (seq !== requestSeq.current) return
      if (!silent) setLoadError(err.message || 'โหลดรายชื่อไม่สำเร็จ')
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [date, warehouse])

  useEffect(() => {
    if (date) fetchEntries()
  }, [date, fetchEntries])

  // ล้าง flag จากหน้าเพิ่ม/แก้ไข Namelist
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('namelist_needs_refresh') === 'true') {
      sessionStorage.removeItem('namelist_needs_refresh')
    }
  }, [])

  // Refetch อัตโนมัติเมื่อผู้ใช้สลับหน้าต่างกลับมาที่หน้านี้
  useEffect(() => {
    const onFocus = () => {
      fetchEntries(true)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchEntries])

  // ซิงค์ข้อมูล Realtime สำหรับ Namelist แบบเงียบๆ ในเบื้องหลัง (ไม่ต้องมีจอโหลดกระพริบ)
  useRealtimeListener('namelist-updated', () => {
    fetchEntries(true)
  })

  // ตัวเลือกกะสำหรับ Filter: ดึงจากข้อมูลกะที่มีอยู่จริงใน namelist ของวันนั้นๆ โดยเรียงตามเวลาที่ใกล้ที่สุดในตอนนั้นขึ้นมาก่อน
  const shiftOptions = useMemo(() => {
    const today = todayLocal()
    const isToday = date === today
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const map = new Map<string, { id: string; label: string; shift_start?: string }>()
    for (const e of entries) {
      if (e.shift_start && e.shift_end) {
        const key = `${hhmm(e.shift_start)}–${hhmm(e.shift_end)}`
        if (!map.has(key)) {
          const typeLabel = e.shift_type === 'N' ? 'Night' : e.shift_type === 'H' ? 'Half' : 'Day'
          map.set(key, {
            id: key,
            label: `${key} (${typeLabel})`,
            shift_start: e.shift_start,
          })
        }
      } else if (e.shift_id && !map.has(e.shift_id)) {
        map.set(e.shift_id, {
          id: e.shift_id,
          label: 'กะไม่ระบุเวลา',
        })
      }
    }

    const rawList = Array.from(map.values())

    // เรียงกะที่มีอยู่จริงโดยเรียงจากเวลาที่ใกล้เคียงที่สุดในตอนนั้นขึ้นมาก่อน
    const sortedShifts = [...rawList].sort((a, b) => {
      const scoreA = getShiftProximityScore(a.shift_start, currentMinutes, isToday)
      const scoreB = getShiftProximityScore(b.shift_start, currentMinutes, isToday)
      return scoreA - scoreB
    })

    return [
      { id: 'all', label: 'ทุกกะ' },
      ...sortedShifts.map((s) => ({ id: s.id, label: s.label })),
    ]
  }, [entries, date])

  // รีเซ็ต selectedShift เป็น 'all' หากกะที่เลือกไว้เดิมไม่มีอยู่ในตัวเลือกของวันนั้นๆ
  useEffect(() => {
    if (selectedShift !== 'all' && !shiftOptions.some((o) => o.id === selectedShift)) {
      setSelectedShift('all')
    }
  }, [shiftOptions, selectedShift])

  // กรองตามกะที่เลือกแบบ Real-time (0ms Instant Filtering)
  const shiftFilteredEntries = useMemo(() => {
    if (!selectedShift || selectedShift === 'all') return entries
    return entries.filter((e) => {
      const key = `${hhmm(e.shift_start)}–${hhmm(e.shift_end)}`
      return key === selectedShift || e.shift_id === selectedShift
    })
  }, [entries, selectedShift])

  // นับจำนวนคนแยกตามแผนกสำหรับแดชบอร์ด (อ้างอิงจากรายการที่ผ่านการกรองกะแล้ว)
  const departmentStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of shiftFilteredEntries) {
      const dept = e.department_name?.trim() || 'ไม่ระบุแผนก'
      map.set(dept, (map.get(dept) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [shiftFilteredEntries])

  // ค้นหาแบบ real-time ในรายชื่อวันนั้น (รหัส/ชื่อ) และกรองตามแผนกที่กดเลือก พร้อมจัดเรียงตามเวลาใกล้ที่สุด
  const filteredEntries = useMemo(() => {
    let list = shiftFilteredEntries

    if (selectedDept) {
      list = list.filter((e) => (e.department_name?.trim() || 'ไม่ระบุแผนก') === selectedDept)
    }

    const words = search.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length > 0) {
      list = list.filter((e) => {
        const hay = `${e.po_id || ''} ${employeeFullName(e)}`.toLowerCase()
        return words.every((w) => hay.includes(w))
      })
    }

    // เรียงลำดับตามเวลาที่ใกล้ที่สุด (เมื่อดูทุกกะ) แล้วตามแผนก และตาม po_id
    const isToday = date === todayLocal()
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    return [...list].sort((a, b) => {
      if (a.shift_start !== b.shift_start) {
        const scoreA = getShiftProximityScore(a.shift_start, currentMinutes, isToday)
        const scoreB = getShiftProximityScore(b.shift_start, currentMinutes, isToday)
        if (scoreA !== scoreB) return scoreA - scoreB
      }
      const deptA = a.department_name || ''
      const deptB = b.department_name || ''
      if (deptA !== deptB) return deptA.localeCompare(deptB)
      return (a.po_id || '').localeCompare(b.po_id || '')
    })
  }, [shiftFilteredEntries, selectedDept, search, date])

  // คำนวณ Pagination
  const totalFiltered = filteredEntries.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredEntries.slice(start, start + PAGE_SIZE)
  }, [filteredEntries, currentPage])

  const fromRecord = totalFiltered === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const toRecord = Math.min(currentPage * PAGE_SIZE, totalFiltered)

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

  // ยืนยันการลบรายชื่อออกจาก Namelist
  const handleConfirmDelete = async () => {
    if (!entryToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/namelist/${entryToDelete.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ')

      setEntries((prev) => prev.filter((e) => e.id !== entryToDelete.id))
      showToast({
        type: 'success',
        text: `ลบรายชื่อ ${employeeFullName(entryToDelete)} ออกจาก Namelist เรียบร้อยแล้ว`,
      })
      broadcastRealtime('namelist-updated')
      setEntryToDelete(null)
    } catch (err: any) {
      showToast({ type: 'error', text: err.message || 'ลบไม่สำเร็จ' })
    } finally {
      setDeleting(false)
    }
  }

  const backQuery = new URLSearchParams({ date, warehouse }).toString()

  return (
    <>
      <Topbar session={session} title="Namelist" subtitle="รายชื่อพนักงานที่ลงบันทึกไว้ในแต่ละวัน" />

      <div className="flex-1 overflow-y-auto px-8 pt-2 pb-10">
        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <DateInput
            value={date}
            onChange={(val) => {
              if (val) {
                setDate(val)
                setSelectedShift('all')
                setSelectedDept(null)
                setPage(1)
                updateUrlParams(val, warehouse)
              }
            }}
            title="เลือกวันที่ (วัน/เดือน/ปี)"
          />

          <WarehouseSelect
            value={warehouse}
            onChange={(val) => {
              setWarehouse(val)
              setSelectedShift('all')
              setSelectedDept(null)
              setPage(1)
              updateUrlParams(date, val)
            }}
            warehouses={warehouses}
            showAllOption={isSuperAdmin || warehouses.length > 1}
            allLabel="ทุกคลัง"
          />

          <ShiftSelect
            value={selectedShift}
            onChange={(val) => {
              setSelectedShift(val)
              setSelectedDept(null)
              setPage(1)
            }}
            options={shiftOptions}
            allLabel="ทุกกะ"
            placeholder="เลือกกะ"
            title="กรองตามกะการทำงาน (เรียงตามเวลาใกล้ที่สุด)"
          />

          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9AA5B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือรหัสพนักงานในรายชื่อวันนี้"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm"
            />
          </div>

          {/* ปุ่ม Export Namelist ลูกค้า (พร้อมตัวเลือกแผนกและกะก่อน Export) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportModal((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-[#F8FAFC] text-[#16233D] border border-[#E1E6EF] hover:border-[#CBD5E1] text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap cursor-pointer"
              title="Export Namelist สำหรับส่งลูกค้า (Excel)"
            >
              <Download className="w-4 h-4 text-[#5B6B85]" />
              <span>Export Namelist ลูกค้า</span>
            </button>

            <ExportCustomerNamelistModal
              isOpen={showExportModal}
              onClose={() => setShowExportModal(false)}
              entries={entries}
              date={date}
              warehouse={warehouse}
              initialDepartment={selectedDept}
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

        {/* Department / Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Tab: ทั้งหมด */}
          <button
            type="button"
            onClick={() => {
              setSelectedDept(null)
              setPage(1)
            }}
            className={cn(
              'h-9 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
              selectedDept === null
                ? 'bg-[#2E6FE0] text-white shadow-2xs border border-[#2558B8]'
                : 'bg-white hover:bg-[#F8FAFC] text-[#5B6B85] hover:text-[#16233D] border border-[#E1E6EF] hover:border-[#CBD5E1] shadow-2xs'
            )}
          >
            <span>ทั้งหมด</span>
            <span
              className={cn(
                'text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors',
                selectedDept === null
                  ? 'bg-white/20 text-white'
                  : 'bg-[#EEF3FC] text-[#2E6FE0]'
              )}
            >
              {shiftFilteredEntries.length} คน
            </span>
          </button>

          {/* Tabs: แผนกแต่ละแผนก */}
          {departmentStats.map((dept) => {
            const isSelected = selectedDept === dept.name
            return (
              <button
                key={dept.name}
                type="button"
                onClick={() => {
                  setSelectedDept(isSelected ? null : dept.name)
                  setPage(1)
                }}
                className={cn(
                  'h-9 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none',
                  isSelected
                    ? 'bg-[#2E6FE0] text-white shadow-2xs border border-[#2558B8]'
                    : 'bg-white hover:bg-[#F8FAFC] text-[#5B6B85] hover:text-[#16233D] border border-[#E1E6EF] hover:border-[#CBD5E1] shadow-2xs'
                )}
              >
                <span>{dept.name}</span>
                <span
                  className={cn(
                    'text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors',
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EEF3FC] text-[#2E6FE0]'
                  )}
                >
                  {dept.count} คน
                </span>
              </button>
            )
          })}
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
          ) : filteredEntries.length === 0 ? (
            <div className="p-14 text-center text-[#5B6B85]">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-[#16233D]">
                {entries.length === 0
                  ? 'ยังไม่มีรายชื่อใน Namelist ของวันนี้'
                  : 'ไม่พบพนักงานในเงื่อนไขที่เลือก'}
              </p>
              {entries.length === 0 ? (
                <p className="text-xs mt-1">กดปุ่ม “เพิ่มพนักงาน” หรือส่งรายชื่อมาจากหน้าจัดแพลนพนักงาน</p>
              ) : (
                <p className="text-xs mt-1">
                  ลองล้างคำค้นหาหรือคลิกที่การ์ด “ทั้งหมด” เพื่อดูรายชื่อทั้งหมด
                </p>
              )}
            </div>
          ) : (
            <>
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
                      <th className="py-3.5 px-4 w-[80px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F6FA]">
                    {paginatedEntries.map((e) => {
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

                          {/* Action Buttons: แก้ไข และ ถังขยะ (รูปที่ 1) */}
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {saving ? (
                                <Loader2 className="w-4 h-4 text-[#2E6FE0] animate-spin inline" />
                              ) : (
                                <>
                                  <Link
                                    href={`/namelist/${e.id}/edit?wh=${encodeURIComponent(warehouse)}`}
                                    title="แก้ไขรายการ"
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#E1E6EF] text-[#5B6B85] hover:text-[#2E6FE0] hover:bg-[#EEF3FC] hover:border-[#2E6FE0]/40 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => setEntryToDelete(e)}
                                    title="ลบออกจาก Namelist"
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-[#FDECEC] text-[#E5484D] hover:bg-[#FCD8D8] hover:text-[#DC2626] transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer (เหมือนในภาพ) */}
              <div className="px-6 py-3.5 border-t border-[#E1E6EF] flex flex-wrap items-center justify-between gap-3 bg-white text-xs text-[#5B6B85]">
                <div>
                  แสดง {fromRecord}–{toRecord} จาก {totalFiltered} คน
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded-lg border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#F4F6FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="หน้าก่อนหน้า"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={cn(
                          'min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-colors',
                          p === currentPage
                            ? 'bg-[#2E6FE0] text-white shadow-2xs'
                            : 'border border-[#E1E6EF] text-[#16233D] hover:bg-[#F4F6FA]'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1.5 rounded-lg border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#F4F6FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="หน้าถัดไป"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (รูปที่ 2) */}
      {entryToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !deleting && setEntryToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-[420px] w-full p-8 text-center animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Trash Icon Circle */}
            <div className="w-20 h-20 bg-[#FEECEC] rounded-full flex items-center justify-center mx-auto mb-5">
              <Trash2 className="w-8 h-8 text-[#E5484D]" strokeWidth={2.2} />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-[#16233D] mb-3">
              ยืนยันการลบรายชื่อ
            </h3>

            {/* Description with bold employee name & PO ID */}
            <p className="text-sm text-[#16233D] leading-relaxed mb-2">
              ต้องการลบ{' '}
              <strong className="font-bold text-[#16233D]">
                {employeeFullName(entryToDelete)}{' '}
                {entryToDelete.po_id ? `(${entryToDelete.po_id})` : ''}
              </strong>{' '}
              <br />
              ออกจาก Namelist ใช่หรือไม่?
            </p>

            {/* Subtext */}
            <p className="text-xs text-[#5B6B85] leading-normal mb-7">
              รายชื่อจะถูกนำออกจาก Namelist ของวันนี้เท่านั้น ไม่ได้ลบข้อมูลพนักงาน
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={deleting}
                className="flex-1 py-3 px-5 rounded-2xl border border-[#E1E6EF] text-sm font-bold text-[#16233D] hover:bg-[#F4F6FA] transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-3 px-5 rounded-2xl bg-[#E5484D] hover:bg-[#D4373C] text-sm font-bold text-white shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  'ยืนยันลบ'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
