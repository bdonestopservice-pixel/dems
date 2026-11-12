'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Check,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'
import { cn, todayLocal } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import { useWarehouses } from '@/components/providers/WarehouseProvider'
import { exportPpoWageReport } from '@/lib/export-reports-excel'
import type { AuthSession, NamelistEntry, Warehouse } from '@/types'

interface ReportsClientProps {
  session: AuthSession
  initialDate?: string
  initialWarehouse?: string
}

type Toast = { type: 'success' | 'error'; text: string } | null

interface PpoSheet {
  id: string
  department: string
  shift_start?: string | null
  shift_end?: string | null
  shift_type: 'D' | 'N' | 'H'
  shiftRange: string
  shiftLabel: string
  warehouse: string
  entries: NamelistEntry[]
  count: number
}

/**
 * ป้ายกำกับ D / N / H
 */
function getShiftBadge(type: 'D' | 'N' | 'H', size: 'sm' | 'lg' = 'sm') {
  const isNight = type === 'N'
  const isSpecial = type === 'H'

  const colorCls = isNight
    ? 'bg-[#F3E8FF] text-[#7C3AED] border border-[#DDD6FE]'
    : isSpecial
    ? 'bg-[#EEF3FC] text-[#2E6FE0] border border-[#BFDBFE]'
    : 'bg-[#FFF4E5] text-[#D97706] border border-[#FDE68A]'

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none shadow-2xs',
          colorCls
        )}
      >
        {type}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 select-none shadow-2xs',
        colorCls
      )}
    >
      {type}
    </div>
  )
}

/**
 * ป้ายกำกับสถานะ "ตรวจแล้ว" หรือ "รอตรวจ"
 */
function getInspectionBadge(isVerified: boolean) {
  if (isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A] bg-[#DCFCE7] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full whitespace-nowrap">
        ตรวจแล้ว
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A] px-2.5 py-0.5 rounded-full whitespace-nowrap">
      รอตรวจ
    </span>
  )
}

/**
 * แสดง Status การทำงานแบบไม่มีสีตามคำขอของผู้ใช้ ("statusการทำงานไม่ต้องใส่สี")
 */
function renderWorkStatus(status?: string | null) {
  if (!status || status.trim() === '') {
    return <span className="text-[#9AA5B8] text-xs">—</span>
  }
  return <span className="text-xs text-[#16233D] font-normal">{status}</span>
}

export function ReportsClient({
  session,
  initialDate,
  initialWarehouse,
}: ReportsClientProps) {
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  // วันที่เลือก (เริ่มต้นเป็นวันที่ปัจจุบัน หรือ initialDate)
  const [date, setDate] = useState<string>(initialDate || todayLocal())

  // คลังที่เลือก (Super Admin เริ่มต้นเป็น all, Admin เริ่มต้นเป็นคลังแรกที่มีสิทธิ์)
  const [warehouse, setWarehouse] = useState<string>(
    initialWarehouse || (isSuperAdmin ? 'all' : userWarehouses[0] || 'all')
  )

  // รายการข้อมูล
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [entries, setEntries] = useState<NamelistEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ใบที่เลือกแสดงผลในกล่องขวา
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)

  // ใบที่ถูกติ๊กเลือกสำหรับ Export
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set())

  // ใบที่ผ่านการตรวจแล้ว (ตรวจแล้ว / รอตรวจ) เก็บใน localStorage อิงตามวันที่
  const [verifiedSheetIds, setVerifiedSheetIds] = useState<Set<string>>(new Set())

  // สถานะการ Export
  const [exporting, setExporting] = useState<boolean>(false)
  const [toast, setToast] = useState<Toast>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (t: Toast) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const { warehouses: allWarehouses } = useWarehouses()

  // โหลดรายชื่อคลัง (จำกัดเฉพาะที่ user มีสิทธิ์ จาก In-Memory Cache 0ms)
  useEffect(() => {
    setWarehouses(isSuperAdmin ? allWarehouses : allWarehouses.filter((w) => userWarehouses.includes(w.id)))
  }, [isSuperAdmin, userWarehouses, allWarehouses])

  // โหลด Namelist ตามวันและคลัง
  const fetchEntries = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        date,
        warehouse,
        _t: String(Date.now()),
      })
      const res = await fetch(`/api/namelist?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'โหลดข้อมูล Namelist ไม่สำเร็จ')
      const fetchedEntries: NamelistEntry[] = data.entries || []
      setEntries(fetchedEntries)
    } catch (err: any) {
      setLoadError(err.message || 'โหลดข้อมูลไม่สำเร็จ')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [date, warehouse])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // โหลดสถานะใบที่ตรวจแล้วจาก localStorage ตามวันที่และคลัง
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storageKey = `dems_ppo_verified_${warehouse}_${date}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed: string[] = JSON.parse(saved)
        setVerifiedSheetIds(new Set(parsed))
      } else {
        setVerifiedSheetIds(new Set())
      }
    } catch {
      setVerifiedSheetIds(new Set())
    }
  }, [warehouse, date])

  // แยก Namelist เป็นใบตาม (แผนก + กะ + คลัง)
  const sheets = useMemo<PpoSheet[]>(() => {
    const map = new Map<string, PpoSheet>()

    for (const e of entries) {
      const dept = e.department_name?.trim() || 'ไม่ระบุแผนก'
      const start = e.shift_start || ''
      const end = e.shift_end || ''
      let type: 'D' | 'N' | 'H' = (e.shift_type as any) || 'D'
      if (!e.shift_type && start) {
        const h = parseInt(start.split(':')[0], 10)
        type = !isNaN(h) && h >= 6 && h < 18 ? 'D' : 'N'
      }
      const wh = e.warehouse || warehouse || 'SOCE'
      const key = `${dept}__${start}_${end}_${type}__${wh}`

      if (!map.has(key)) {
        const timeStr = formatShiftRange(start, end)
        const shiftRange = timeStr !== '—' ? timeStr : start ? `${start}-${end}` : 'ไม่ระบุกะ'
        const shiftLabel = `${shiftRange} (${type})`
        map.set(key, {
          id: key,
          department: dept,
          shift_start: start,
          shift_end: end,
          shift_type: type,
          shiftRange,
          shiftLabel,
          warehouse: wh,
          entries: [e],
          count: 1,
        })
      } else {
        const sheet = map.get(key)!
        sheet.entries.push(e)
        sheet.count += 1
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // เรียงตามชื่อแผนกก่อน
      const deptCmp = a.department.localeCompare(b.department, 'th')
      if (deptCmp !== 0) return deptCmp
      // เรียงประเภทกะ (D มาก่อน N มาก่อน H)
      const rank = { D: 1, N: 2, H: 3 }
      const diff = (rank[a.shift_type] || 4) - (rank[b.shift_type] || 4)
      if (diff !== 0) return diff
      // เรียงตามเวลาเริ่มต้นกะ
      return (a.shift_start || '').localeCompare(b.shift_start || '')
    })
  }, [entries, warehouse])

  // ซิงค์ activeSheetId และ selectedSheetIds เมื่อ sheets เปลี่ยนแปลง
  useEffect(() => {
    if (sheets.length > 0) {
      // ตั้ง activeSheet ให้เป็นใบแรกถ้ายังไม่มีการเลือก
      setActiveSheetId((prev) => (prev && sheets.some((s) => s.id === prev) ? prev : sheets[0].id))

      // ซิงค์ selectedSheetIds: เลือกใบที่ตรวจแล้วไว้ล่วงหน้า (ถ้าไม่มีให้เลือกทั้งหมด)
      setSelectedSheetIds((prev) => {
        if (prev.size > 0) {
          // เก็บเฉพาะใบที่ยังคงอยู่ใน sheets ปัจจุบัน
          const next = new Set<string>()
          sheets.forEach((s) => {
            if (prev.has(s.id)) next.add(s.id)
          })
          return next
        }
        // ค่าเริ่มต้น: เลือกใบที่ตรวจแล้ว หรือถ้ายังไม่มีตรวจให้เลือกทุกใบ
        const verifiedInSheets = sheets.filter((s) => verifiedSheetIds.has(s.id)).map((s) => s.id)
        if (verifiedInSheets.length > 0) {
          return new Set(verifiedInSheets)
        }
        return new Set(sheets.map((s) => s.id))
      })
    } else {
      setActiveSheetId(null)
      setSelectedSheetIds(new Set())
    }
  }, [sheets, verifiedSheetIds])

  // ใบที่กำลังแสดงข้อมูลในกล่องขวา
  const activeSheet = useMemo(() => {
    return sheets.find((s) => s.id === activeSheetId) || sheets[0] || null
  }, [sheets, activeSheetId])

  // ข้อมูลสถิติความคืบหน้าการตรวจใบ
  const totalSheets = sheets.length
  const verifiedCount = sheets.filter((s) => verifiedSheetIds.has(s.id)).length
  const remainingCount = Math.max(0, totalSheets - verifiedCount)
  const progressPercent =
    totalSheets > 0 ? Math.min(100, Math.round((verifiedCount / totalSheets) * 100)) : 0

  // สลับสถานะ "ตรวจแล้ว" / "รอตรวจ" ของใบ
  const toggleVerifySheet = (sheetId: string) => {
    setVerifiedSheetIds((prev) => {
      const next = new Set(prev)
      const isNowVerified = !next.has(sheetId)
      if (isNowVerified) {
        next.add(sheetId)
        // ติ๊กเลือกให้อัตโนมัติเมื่อตรวจใบนี้แล้ว เพื่อความสะดวกในการ Export
        setSelectedSheetIds((s) => new Set(s).add(sheetId))
      } else {
        next.delete(sheetId)
      }
      try {
        const storageKey = `dems_ppo_verified_${warehouse}_${date}`
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  // เลือก/ไม่เลือก ใบสำหรับส่งออก Excel
  const toggleSheetSelection = (sheetId: string) => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev)
      if (next.has(sheetId)) {
        next.delete(sheetId)
      } else {
        next.add(sheetId)
      }
      return next
    })
  }

  // เลือกทั้งหมด / ยกเลิกทั้งหมด
  const isAllSheetsSelected = totalSheets > 0 && selectedSheetIds.size === totalSheets
  const toggleSelectAllSheets = () => {
    setSelectedSheetIds((prev) => {
      if (prev.size === totalSheets) {
        return new Set()
      }
      return new Set(sheets.map((s) => s.id))
    })
  }

  // ส่งออกคำนวณค่าจ้าง PPO ไป Excel
  const handleExportPPO = async () => {
    const sheetsToExport = sheets.filter((s) => selectedSheetIds.has(s.id))
    const list = sheetsToExport.flatMap((s) => s.entries)

    if (list.length === 0) {
      showToast({ type: 'error', text: 'กรุณาเลือกใบที่ต้องการส่งออกอย่างน้อย 1 ใบ' })
      return
    }

    setExporting(true)
    try {
      await exportPpoWageReport(list, { date, warehouse })
      showToast({
        type: 'success',
        text: `Export PPO ไปค่าจ้าง (${list.length} คน จาก ${sheetsToExport.length} ใบ) เรียบร้อยแล้ว`,
      })
    } catch (err: any) {
      showToast({ type: 'error', text: err?.message || 'Export ค่าจ้างล้มเหลว' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Topbar
        session={session}
        title="คำนวณค่าจ้าง (Export PPO)"
        subtitle="ตรวจใบลงเวลากับรายชื่อรายแผนก/รายกะ แล้วส่งออก Excel ให้ฝ่ายค่าจ้าง"
      />

      <div className="flex-1 overflow-y-auto px-6 sm:px-8 pt-2 pb-12">
        {/* Toast Alert */}
        {toast && (
          <div
            className={cn(
              'mb-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold shadow-sm transition-all animate-in fade-in',
              toast.type === 'success'
                ? 'bg-[#E7F6ED] border-[#2E9E5B] text-[#2E9E5B]'
                : 'bg-[#FCE8E8] border-[#F87171] text-[#E5484D]'
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Top Control Bar (ตรงตาม Mockup) */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm p-4 sm:p-5 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* ซ้าย: ตัวเลือกวันที่ และคลังสินค้า */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[#5B6B85]">วันที่ทำงาน</label>
                <DateInput
                  value={date}
                  onChange={(val) => {
                    if (val) setDate(val)
                  }}
                  title="เลือกวันที่ (วัน/เดือน/ปี)"
                />
              </div>

              {/* ตัวเลือกคลัง (แสดงเมื่อมีสิทธิ์หลายคลัง หรือเป็น Super Admin) */}
              {(isSuperAdmin || warehouses.length > 1) && (
                <div className="flex flex-col gap-1.5 min-w-[140px]">
                  <label className="text-[11px] font-bold text-[#5B6B85]">คลังสินค้า</label>
                  <WarehouseSelect
                    value={warehouse}
                    onChange={(val) => setWarehouse(val)}
                    warehouses={warehouses}
                    allLabel="ทุกคลัง"
                  />
                </div>
              )}
            </div>

            {/* กลาง: แถบสถานะความคืบหน้าการตรวจใบ (ตรวจแล้ว X / Y ใบ | เหลือรอตรวจ Z ใบ) */}
            <div className="flex flex-col gap-2 min-w-[260px] max-w-[340px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#16233D]">
                  ตรวจแล้ว{' '}
                  <span className="text-[#10B981] font-extrabold">{verifiedCount}</span> /{' '}
                  {totalSheets} ใบ
                </span>
                <span className="text-[11px] text-[#5B6B85]">
                  เหลือรอตรวจ <span className="font-semibold">{remainingCount}</span> ใบ
                </span>
              </div>
              <div className="w-full h-2 bg-[#F1F3F7] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* ขวา: ปุ่ม Export PPO ไปค่าจ้าง */}
            <div className="flex items-center self-end lg:self-center">
              <button
                type="button"
                onClick={handleExportPPO}
                disabled={selectedSheetIds.size === 0 || exporting}
                className={cn(
                  'h-11 px-5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 select-none whitespace-nowrap',
                  selectedSheetIds.size === 0 || exporting
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-[#2E6FE0] hover:bg-[#2558B8] active:bg-[#1D4ED8] text-white cursor-pointer'
                )}
                title="ส่งออกรายงานคำนวณค่าจ้าง PPO ตามใบที่เลือก"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Download className="w-4 h-4 text-white" />
                )}
                <span>Export PPO ไปค่าจ้าง · {selectedSheetIds.size} ใบ</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Split Layout (ซ้าย: แยกแผนก/กะ | ขวา: ข้อมูลในใบที่เลือก) */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E1E6EF] p-20 text-center shadow-sm">
            <Loader2 className="w-8 h-8 text-[#2E6FE0] animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#16233D]">กำลังโหลดข้อมูล Namelist...</p>
            <p className="text-xs text-[#5B6B85] mt-1">กรุณารอสักครู่</p>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-[#F87171] p-16 text-center text-[#E5484D] text-xs font-semibold shadow-sm">
            {loadError}
          </div>
        ) : sheets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E1E6EF] p-20 text-center text-[#5B6B85] shadow-sm">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-[#16233D]">ไม่พบข้อมูล Namelist ของวันที่เลือก</p>
            <p className="text-xs mt-1">ลองเปลี่ยนวันที่หรือคลังสินค้าเพื่อดูรายการ</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-start gap-5">
            {/* กล่องฝั่งซ้าย: แยกแผนก / กะ */}
            <div className="w-full lg:w-[380px] flex-shrink-0 bg-white rounded-2xl border border-[#E1E6EF] shadow-sm overflow-hidden flex flex-col">
              {/* Header ฝั่งซ้าย */}
              <div className="px-4 py-3.5 border-b border-[#E1E6EF] flex items-center justify-between bg-white">
                <span className="text-xs font-bold text-[#16233D]">แยกแผนก / กะ</span>
                <label className="flex items-center gap-1.5 text-xs text-[#5B6B85] font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllSheetsSelected}
                    onChange={toggleSelectAllSheets}
                    className="w-4 h-4 rounded text-[#2E6FE0] border-gray-300 focus:ring-[#2E6FE0] cursor-pointer"
                  />
                  <span>เลือกทั้งหมด</span>
                </label>
              </div>

              {/* รายการการ์ดใบแยกแผนก/กะ */}
              <div className="p-3 space-y-2.5 max-h-[620px] overflow-y-auto">
                {sheets.map((sheet) => {
                  const isVerified = verifiedSheetIds.has(sheet.id)
                  const isChecked = selectedSheetIds.has(sheet.id)
                  const isActive = activeSheet?.id === sheet.id

                  return (
                    <div
                      key={sheet.id}
                      onClick={() => setActiveSheetId(sheet.id)}
                      className={cn(
                        'p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 select-none',
                        isActive
                          ? 'bg-[#F8FAFC] border-2 border-[#2E6FE0] shadow-2xs'
                          : 'bg-white border border-[#E1E6EF] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox เลือกสำหรับ Export */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleSheetSelection(sheet.id)
                          }}
                          className="w-4 h-4 rounded text-[#2E6FE0] border-gray-300 focus:ring-[#2E6FE0] cursor-pointer flex-shrink-0"
                        />

                        {/* D / N Badge */}
                        {getShiftBadge(sheet.shift_type, 'sm')}

                        {/* ข้อมูลแผนกและเวลา */}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#16233D] truncate">
                            {sheet.department}
                          </div>
                          <div className="text-[11px] text-[#5B6B85] truncate mt-0.5">
                            {sheet.shiftRange} · {sheet.warehouse} · {sheet.count} คน
                          </div>
                        </div>
                      </div>

                      {/* ป้ายสถานะ รอตรวจ / ตรวจแล้ว */}
                      <div className="flex-shrink-0">
                        {getInspectionBadge(isVerified)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* กล่องฝั่งขวา: รายละเอียดของใบที่เลือก */}
            <div className="flex-1 w-full bg-white rounded-2xl border border-[#E1E6EF] shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              {activeSheet ? (
                <>
                  {/* Header ฝั่งขวา */}
                  <div className="px-6 py-4 border-b border-[#E1E6EF] flex items-center justify-between gap-4 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                      {getShiftBadge(activeSheet.shift_type, 'lg')}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#16233D] truncate">
                          {activeSheet.department} · {activeSheet.shiftRange}
                        </h3>
                        <p className="text-xs text-[#5B6B85] truncate mt-0.5">
                          คลัง {activeSheet.warehouse} · {activeSheet.count} คน · เทียบ Namelist กับใบลงเวลา
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {getInspectionBadge(verifiedSheetIds.has(activeSheet.id))}
                    </div>
                  </div>

                  {/* ตารางรายชื่อพนักงานในใบนี้ */}
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#E1E6EF] text-[11px] font-bold text-[#5B6B85] bg-white">
                          <th className="py-3 px-6 whitespace-nowrap">รหัสพนักงาน</th>
                          <th className="py-3 px-4 whitespace-nowrap">ชื่อ-นามสกุล</th>
                          <th className="py-3 px-4 whitespace-nowrap">แผนก</th>
                          <th className="py-3 px-4 whitespace-nowrap">กะ</th>
                          <th className="py-3 px-6 whitespace-nowrap">Status การทำงาน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F4F6FA]">
                        {activeSheet.entries.map((e) => (
                          <tr key={e.id} className="hover:bg-[#F8FAFC] transition-colors">
                            {/* รหัสพนักงาน */}
                            <td className="py-3 px-6 whitespace-nowrap text-xs font-bold text-[#16233D]">
                              {e.po_id || '—'}
                            </td>

                            {/* ชื่อ-นามสกุล */}
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-[#16233D] font-medium">
                              {employeeFullName(e)}
                            </td>

                            {/* แผนก */}
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5B6B85]">
                              {e.department_name || activeSheet.department}
                            </td>

                            {/* กะ */}
                            <td className="py-3 px-4 whitespace-nowrap text-xs text-[#5B6B85]">
                              {activeSheet.shiftLabel}
                            </td>

                            {/* Status การทำงาน (ตามคำสั่ง: "และstatusการทำงานไม่ต้องใส่สี") */}
                            <td className="py-3 px-6 whitespace-nowrap">
                              {renderWorkStatus(e.work_status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer ฝั่งขวา */}
                  <div className="px-6 py-4 border-t border-[#E1E6EF] bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-[#5B6B85]">
                      แสดง <span className="font-bold text-[#16233D]">{activeSheet.entries.length}</span> จาก{' '}
                      <span className="font-bold text-[#16233D]">{activeSheet.entries.length}</span> คน · ตรวจเทียบกับใบลงเวลาแล้วกดยืนยัน
                    </div>

                    <div className="flex items-center gap-2">
                      {verifiedSheetIds.has(activeSheet.id) ? (
                        <button
                          type="button"
                          onClick={() => toggleVerifySheet(activeSheet.id)}
                          className="px-4 py-2.5 rounded-xl border border-[#E1E6EF] hover:border-red-200 hover:bg-[#FDECEC] text-[#5B6B85] hover:text-[#E5484D] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Check className="w-4 h-4 text-[#10B981]" />
                          <span>ตรวจแล้ว (คลิกเพื่อยกเลิก)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleVerifySheet(activeSheet.id)}
                          className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Check className="w-4 h-4 text-white" />
                          <span>ยืนยัน ตรวจใบนี้แล้ว</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-16 text-center text-[#5B6B85] m-auto">
                  <p className="text-xs">กรุณาเลือกใบทางฝั่งซ้ายเพื่อดูรายละเอียด</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
