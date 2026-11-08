'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search,
  Download,
  FileSpreadsheet,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Check,
  ChevronDown,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'
import { cn, todayLocal } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import {
  exportCustomerNamelistReport,
  exportCustomerRegistryReport,
  exportPpoWageReport,
} from '@/lib/export-reports-excel'
import type { AuthSession, NamelistEntry, Warehouse } from '@/types'

interface ReportsClientProps {
  session: AuthSession
  initialDate?: string
  initialWarehouse?: string
}

type Toast = { type: 'success' | 'error'; text: string } | null

function getStatusBadge(status?: string | null) {
  if (!status || status.trim() === '') {
    return <span className="text-[#9AA5B8] text-xs">—</span>
  }
  const s = status.trim().toLowerCase()
  let badgeCls = 'bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]'

  if (s.includes('cxdp') || s.includes('ปกติ') || s.includes('มาทำงาน')) {
    badgeCls = 'bg-[#EEF3FC] text-[#2E6FE0] border border-[#2E6FE0]/25'
  } else if (s.includes('0.5') || s.includes('ครึ่ง') || s.includes('สาย')) {
    badgeCls = 'bg-[#FEF3E2] text-[#D97706] border border-[#D97706]/25'
  } else if (s.includes('hold') || s.includes('พัก')) {
    badgeCls = 'bg-[#F1F3F7] text-[#5B6B85] border border-[#CBD5E1]'
  } else if (
    s.includes('หนี') ||
    s.includes('ขาด') ||
    s.includes('ไม่จ่าย') ||
    s.includes('ออก')
  ) {
    badgeCls = 'bg-[#FDECEC] text-[#E5484D] border border-[#E5484D]/25'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide',
        badgeCls
      )}
    >
      {status}
    </span>
  )
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

  // ตัวกรอง กะ และ แผนก
  const [selectedShiftKey, setSelectedShiftKey] = useState<string>('all')
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [search, setSearch] = useState<string>('')

  // รายการข้อมูล
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [entries, setEntries] = useState<NamelistEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // การเลือกพนักงาน (Persistent selection)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // สถานะการ Export
  const [exportingType, setExportingType] = useState<
    'namelist' | 'registry' | 'ppo' | null
  >(null)
  const [toast, setToast] = useState<Toast>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (t: Toast) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // โหลดรายชื่อคลัง (จำกัดเฉพาะที่ user มีสิทธิ์ตามกฎ Super Admin / Admin)
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) return
        const data = await res.json()
        const all: Warehouse[] = data.warehouses || []
        setWarehouses(isSuperAdmin ? all : all.filter((w) => userWarehouses.includes(w.id)))
      } catch (err) {
        console.error('Failed to load warehouses:', err)
      }
    }
    loadWarehouses()
  }, [isSuperAdmin, userWarehouses])

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

      // รีเซ็ต selection เป็นติ๊กเลือกทั้งหมดตามค่าเริ่มต้นของข้อมูลวันนั้น (เหมือนใน Mockup)
      // หรือเก็บเฉพาะคนที่ยังอยู่ในรายการ
      setSelectedIds(new Set(fetchedEntries.map((e) => e.id)))
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

  // ดึงรายการกะที่มีในข้อมูล
  const shiftOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>()
    for (const e of entries) {
      if (!e.shift_start && !e.shift_end && !e.shift_type) continue
      const key = `${e.shift_start || ''}_${e.shift_end || ''}_${e.shift_type || ''}`
      if (!map.has(key)) {
        const timeRange = formatShiftRange(e.shift_start, e.shift_end)
        let typeLabel = 'กะ'
        if (e.shift_type === 'D') typeLabel = 'กะกลางวัน'
        else if (e.shift_type === 'N') typeLabel = 'กะกลางคืน'
        else if (e.shift_type === 'H') typeLabel = 'กะพิเศษ'
        else if (e.shift_start) {
          const h = parseInt(e.shift_start.split(':')[0], 10)
          typeLabel = h >= 6 && h < 18 ? 'กะกลางวัน' : 'กะกลางคืน'
        }
        const label = timeRange !== '—' ? `${typeLabel} ${timeRange}` : typeLabel
        map.set(key, { key, label })
      }
    }
    return Array.from(map.values())
  }, [entries])

  // ดึงรายการแผนกที่มีในข้อมูล
  const departmentOptions = useMemo(() => {
    const depts = new Set<string>()
    for (const e of entries) {
      const d = e.department_name?.trim()
      if (d) depts.add(d)
    }
    return Array.from(depts).sort((a, b) => a.localeCompare(b, 'th'))
  }, [entries])

  // กรองข้อมูลตามเงื่อนไข (วันที่ / กะ / แผนก / ค้นหาชื่อ-รหัส)
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // กรองกะ
      if (selectedShiftKey !== 'all') {
        const key = `${e.shift_start || ''}_${e.shift_end || ''}_${e.shift_type || ''}`
        if (key !== selectedShiftKey) return false
      }

      // กรองแผนก
      if (selectedDept !== 'all') {
        const d = e.department_name?.trim() || 'ไม่ระบุแผนก'
        if (d !== selectedDept) return false
      }

      // กรองคำค้นหา
      const words = search.toLowerCase().split(/\s+/).filter(Boolean)
      if (words.length > 0) {
        const hay = `${e.po_id || ''} ${employeeFullName(e)}`.toLowerCase()
        if (!words.every((w) => hay.includes(w))) return false
      }

      return true
    })
  }, [entries, selectedShiftKey, selectedDept, search])

  // จำนวนพนักงานที่เลือก
  const selectedInFilterCount = filteredEntries.filter((e) => selectedIds.has(e.id)).length
  const totalSelectedCount = selectedIds.size

  // ตรวจสอบว่าใน filtered list ถูกเลือกทั้งหมดหรือไม่
  const isAllFilteredSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((e) => selectedIds.has(e.id))

  const isIndeterminate =
    selectedInFilterCount > 0 && selectedInFilterCount < filteredEntries.length

  // Toggle เลือก/ไม่เลือก รายคน (ไม่กระทบคนอื่นที่เลือกไว้)
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Toggle เลือกทั้งหมดในผลลัพธ์การกรองปัจจุบัน
  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllFilteredSelected) {
        // ยกเลิกเฉพาะคนที่อยู่ใน filter ปัจจุบัน
        for (const e of filteredEntries) {
          next.delete(e.id)
        }
      } else {
        // เลือกทุกคนที่อยู่ใน filter ปัจจุบัน
        for (const e of filteredEntries) {
          next.add(e.id)
        }
      }
      return next
    })
  }

  // ดึงรายการพนักงานที่ถูกติ๊กเลือกจริงเพื่อนำไป Export
  const getSelectedEmployeesForExport = () => {
    return entries.filter((e) => selectedIds.has(e.id))
  }

  // 1. Export Namelist ลูกค้า (4 คอลัมน์)
  const handleExportNamelist = async () => {
    const list = getSelectedEmployeesForExport()
    if (list.length === 0) {
      showToast({ type: 'error', text: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' })
      return
    }
    setExportingType('namelist')
    try {
      await exportCustomerNamelistReport(list, { date, warehouse })
      showToast({
        type: 'success',
        text: `Export Namelist ลูกค้า (${list.length} คน) เรียบร้อยแล้ว`,
      })
    } catch (err: any) {
      showToast({ type: 'error', text: err.message || 'Export Namelist ล้มเหลว' })
    } finally {
      setExportingType(null)
    }
  }

  // 2. Export ทะเบียนลูกค้า (13 คอลัมน์)
  const handleExportRegistry = async () => {
    const list = getSelectedEmployeesForExport()
    if (list.length === 0) {
      showToast({ type: 'error', text: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' })
      return
    }
    setExportingType('registry')
    try {
      await exportCustomerRegistryReport(list, { date, warehouse })
      showToast({
        type: 'success',
        text: `Export ทะเบียนลูกค้า (${list.length} คน) เรียบร้อยแล้ว`,
      })
    } catch (err: any) {
      showToast({ type: 'error', text: err.message || 'Export ทะเบียนลูกค้าล้มเหลว' })
    } finally {
      setExportingType(null)
    }
  }

  // 3. Export คำนวณค่าจ้าง PPO Sheet (9 คอลัมน์)
  const handleExportPpoWage = async () => {
    const list = getSelectedEmployeesForExport()
    if (list.length === 0) {
      showToast({ type: 'error', text: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' })
      return
    }
    setExportingType('ppo')
    try {
      await exportPpoWageReport(list, { date, warehouse })
      showToast({
        type: 'success',
        text: `Export ค่าจ้าง PPO Sheet (${list.length} คน) เรียบร้อยแล้ว`,
      })
    } catch (err: any) {
      showToast({ type: 'error', text: err.message || 'Export ค่าจ้างล้มเหลว' })
    } finally {
      setExportingType(null)
    }
  }

  return (
    <>
      <Topbar
        session={session}
        title="รายงาน (Export)"
        subtitle="เลือกรายชื่อจาก Namelist แล้วส่งออกข้อมูล"
      />

      <div className="flex-1 overflow-y-auto px-8 pt-2 pb-12">
        {/* Toast Alert */}
        {toast && (
          <div
            className={cn(
              'mb-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold shadow-sm transition-all',
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

        {/* Filter bar card (ตรงตาม Mockup) */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm p-4 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
            <div className="flex flex-wrap items-end gap-3 flex-1">
              {/* 1. วันที่ */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[#5B6B85]">วันที่</label>
                <DateInput
                  value={date}
                  onChange={(val) => {
                    if (val) setDate(val)
                  }}
                  title="เลือกวันที่ (วัน/เดือน/ปี)"
                />
              </div>

              {/* 2. คลัง (สำหรับ Super Admin และ Admin ที่มีสิทธิ์) */}
              <div className="flex flex-col gap-1.5 min-w-[130px]">
                <label className="text-[11px] font-bold text-[#5B6B85]">คลังสินค้า</label>
                <WarehouseSelect
                  value={warehouse}
                  onChange={(val) => setWarehouse(val)}
                  warehouses={warehouses}
                  showAllOption={isSuperAdmin || warehouses.length > 1}
                  allLabel="ทุกคลัง"
                  disabled={!isSuperAdmin && warehouses.length <= 1}
                />
              </div>

              {/* 3. กะ */}
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-[11px] font-bold text-[#5B6B85]">กะ</label>
                <div className="relative">
                  <select
                    value={selectedShiftKey}
                    onChange={(e) => setSelectedShiftKey(e.target.value)}
                    className="w-full appearance-none bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer"
                  >
                    <option value="all">ทุกกะ</option>
                    {shiftOptions.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#9AA5B8] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* 4. แผนก */}
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="text-[11px] font-bold text-[#5B6B85]">แผนก</label>
                <div className="relative">
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full appearance-none bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl pl-3 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer"
                  >
                    <option value="all">ทุกแผนก</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#9AA5B8] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* 5. ค้นหาชื่อ / รหัสพนักงาน */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold text-[#5B6B85]">ชื่อ / รหัสพนักงาน</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#9AA5B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อหรือรหัสพนักงาน"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* แสดงจำนวนที่เลือกอยู่ (ตาม Mockup: "เลือกแล้ว 4 จาก 7 คน") */}
            <div className="flex items-center gap-3 self-end pb-1 whitespace-nowrap">
              <span className="text-xs font-bold text-[#16233D]">
                เลือกแล้ว{' '}
                <span className="text-[#2E6FE0] font-bold">{selectedInFilterCount}</span>{' '}
                จาก {filteredEntries.length} คน
              </span>
              {totalSelectedCount > selectedInFilterCount && (
                <span className="text-[11px] text-[#5B6B85] bg-[#F4F6FA] px-2 py-0.5 rounded-md border border-[#E1E6EF]">
                  (รวมที่เลือกไว้ {totalSelectedCount} คน)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ตารางแสดงผลลัพธ์ Namelist ที่พร้อม Export (ตรงตาม Mockup) */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm overflow-hidden mb-6">
          {loading ? (
            <div className="p-16 text-center">
              <Loader2 className="w-6 h-6 text-[#2E6FE0] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#5B6B85]">กำลังโหลดรายชื่อพนักงานสำหรับ Export...</p>
            </div>
          ) : loadError ? (
            <div className="p-16 text-center text-[#E5484D] text-xs font-semibold">
              {loadError}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-16 text-center text-[#5B6B85]">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-[#16233D]">
                {entries.length === 0
                  ? 'ไม่พบข้อมูล Namelist ของวันที่เลือก'
                  : 'ไม่พบพนักงานที่ตรงตามเงื่อนไขตัวกรอง'}
              </p>
              <p className="text-xs mt-1">
                ลองปรับเปลี่ยนวันที่ กะ แผนก หรือล้างคำค้นหาเพื่อดูข้อมูล
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E1E6EF] text-[11px] font-bold text-[#5B6B85] bg-white">
                    <th className="py-3.5 px-4 w-[50px] text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isIndeterminate
                        }}
                        onChange={toggleSelectAllFiltered}
                        className="w-4 h-4 rounded text-[#2E6FE0] border-gray-300 focus:ring-[#2E6FE0] cursor-pointer"
                        title={
                          isAllFilteredSelected
                            ? 'ยกเลิกการเลือกทั้งหมด'
                            : 'เลือกพนักงานทั้งหมดที่แสดง'
                        }
                      />
                    </th>
                    <th className="py-3.5 px-3 whitespace-nowrap">รหัสพนักงาน</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">ชื่อ-นามสกุล</th>
                    <th className="py-3.5 px-3">แผนก</th>
                    <th className="py-3.5 px-3 whitespace-nowrap">กะ</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Status การทำงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F6FA]">
                  {filteredEntries.map((e) => {
                    const isSelected = selectedIds.has(e.id)
                    return (
                      <tr
                        key={e.id}
                        onClick={() => toggleSelect(e.id)}
                        className={cn(
                          'transition-colors cursor-pointer select-none',
                          isSelected ? 'bg-[#FAFBFD]' : 'hover:bg-[#FAFBFD]/60'
                        )}
                      >
                        {/* Checkbox */}
                        <td
                          className="py-3 px-4 text-center"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(e.id)}
                            className="w-4 h-4 rounded text-[#2E6FE0] border-gray-300 focus:ring-[#2E6FE0] cursor-pointer"
                          />
                        </td>

                        {/* รหัสพนักงาน */}
                        <td className="py-3 px-3 text-xs text-[#5B6B85] font-mono whitespace-nowrap">
                          {e.po_id || '—'}
                        </td>

                        {/* ชื่อ-นามสกุล */}
                        <td className="py-3 px-3 text-xs font-bold text-[#16233D] whitespace-nowrap">
                          {employeeFullName(e)}
                        </td>

                        {/* แผนก */}
                        <td className="py-3 px-3 text-xs text-[#16233D]">
                          {e.department_name || '—'}
                          {warehouse === 'all' && e.warehouse && (
                            <span className="ml-1.5 text-[10px] font-semibold text-[#5B6B85] bg-[#F4F6FA] border border-[#E1E6EF] px-1.5 py-0.5 rounded">
                              {e.warehouse}
                            </span>
                          )}
                        </td>

                        {/* กะ */}
                        <td className="py-3 px-3 text-xs text-[#5B6B85] whitespace-nowrap">
                          {formatShiftRange(e.shift_start, e.shift_end)}
                        </td>

                        {/* Status การทำงาน */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getStatusBadge(e.work_status)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* แถบส่งออกข้อมูล (Bottom Action Bar ตรงตาม Mockup) */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm p-5 flex flex-col lg:flex-row items-stretch justify-between gap-5">
          {/* Card ฝั่งซ้าย: EXPORT ลูกค้า */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-[#EEF3FC] text-[#2E6FE0] text-[11px] font-bold px-2.5 py-0.5 rounded-md tracking-wider">
                EXPORT ลูกค้า
              </span>
              <span className="text-xs text-[#5B6B85]">
                ไฟล์สำหรับส่งให้ลูกค้าแต่ละคลัง
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* ปุ่ม 1: Namelist (Google Sheet ลูกค้า) - 4 คอลัมน์ */}
              <button
                type="button"
                disabled={totalSelectedCount === 0 || !!exportingType}
                onClick={handleExportNamelist}
                className={cn(
                  'h-11 px-4 rounded-xl text-xs font-semibold border flex items-center gap-2.5 transition-all shadow-2xs select-none',
                  totalSelectedCount === 0 || !!exportingType
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white hover:bg-[#F8FAFC] text-[#16233D] border-[#E1E6EF] hover:border-[#CBD5E1] cursor-pointer'
                )}
                title="ส่งออก Namelist 4 คอลัมน์ (วันที่, ค้นหา, เข้างาน, Shift Name)"
              >
                {exportingType === 'namelist' ? (
                  <Loader2 className="w-4 h-4 text-[#10B981] animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                )}
                <span>Namelist (Google Sheet ลูกค้า)</span>
                {totalSelectedCount > 0 && (
                  <span className="bg-[#EEF3FC] text-[#2E6FE0] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {totalSelectedCount}
                  </span>
                )}
              </button>

              {/* ปุ่ม 2: Export ทะเบียนลูกค้า - 13 คอลัมน์ */}
              <button
                type="button"
                disabled={totalSelectedCount === 0 || !!exportingType}
                onClick={handleExportRegistry}
                className={cn(
                  'h-11 px-4 rounded-xl text-xs font-semibold border flex items-center gap-2.5 transition-all shadow-2xs select-none',
                  totalSelectedCount === 0 || !!exportingType
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white hover:bg-[#F8FAFC] text-[#16233D] border-[#E1E6EF] hover:border-[#CBD5E1] cursor-pointer'
                )}
                title="ส่งออกทะเบียนพนักงานลูกค้า 13 คอลัมน์พร้อมที่อยู่และเลขบัตร"
              >
                {exportingType === 'registry' ? (
                  <Loader2 className="w-4 h-4 text-[#2E6FE0] animate-spin" />
                ) : (
                  <Users className="w-4 h-4 text-[#2E6FE0]" />
                )}
                <span>Export ทะเบียนลูกค้า</span>
                {totalSelectedCount > 0 && (
                  <span className="bg-[#EEF3FC] text-[#2E6FE0] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {totalSelectedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Card ฝั่งขวา: EXPORT PPO */}
          <div className="lg:border-l lg:border-[#E1E6EF] lg:pl-6 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-[#FEF3E2] text-[#D97706] text-[11px] font-bold px-2.5 py-0.5 rounded-md tracking-wider">
                EXPORT PPO
              </span>
              <span className="text-xs text-[#5B6B85]">ใช้ภายในทีม</span>
            </div>

            <div>
              {/* ปุ่ม 3: คำนวณค่าจ้าง (PPO Sheet) - 9 คอลัมน์ */}
              <button
                type="button"
                disabled={totalSelectedCount === 0 || !!exportingType}
                onClick={handleExportPpoWage}
                className={cn(
                  'h-11 px-5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm w-full lg:w-auto select-none',
                  totalSelectedCount === 0 || !!exportingType
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#2E6FE0] hover:bg-[#2558B8] active:bg-[#1D4ED8] cursor-pointer'
                )}
                title="ส่งออกข้อมูลสำหรับคำนวณค่าจ้าง PPO Sheet 9 คอลัมน์"
              >
                {exportingType === 'ppo' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังสร้างไฟล์ Excel...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>คำนวณค่าจ้าง (PPO Sheet)</span>
                    {totalSelectedCount > 0 && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                        {totalSelectedCount} คน
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
