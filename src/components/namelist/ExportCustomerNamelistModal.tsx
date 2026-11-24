'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Download, X, Check, Loader2, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatShiftRange } from '@/lib/namelist'
import {
  exportNamelistToExcel,
  getShiftTypeCode,
} from '@/lib/export-namelist-excel'
import { logExportAudit } from '@/lib/audit-client'
import type { NamelistEntry } from '@/types'

interface ShiftOption {
  key: string
  label: string
  type?: string | null
  start?: string | null
  end?: string | null
  count: number
}

interface ExportCustomerNamelistModalProps {
  isOpen: boolean
  onClose: () => void
  entries: NamelistEntry[]
  date: string
  warehouse: string
  initialDepartment?: string | null
}

export function ExportCustomerNamelistModal({
  isOpen,
  onClose,
  entries,
  date,
  warehouse,
  initialDepartment = null,
}: ExportCustomerNamelistModalProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // แผนกที่เลือก (null = ทุกแผนก)
  const [selectedDept, setSelectedDept] = useState<string | null>(initialDepartment)
  // กะที่เลือก (null = ทุกกะ)
  const [selectedShiftKey, setSelectedShiftKey] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // ซิงค์ initialDepartment เมื่อเปิด modal
  useEffect(() => {
    if (isOpen) {
      setSelectedDept(initialDepartment || null)
      setSelectedShiftKey(null)
    }
  }, [isOpen, initialDepartment])

  // ปิดเมื่อคลิกนอกกล่อง หรือกด Escape
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // 1. ดึงรายการแผนกที่มีใน namelist ของวันนั้น
  const availableDepts = useMemo(() => {
    const deptSet = new Set<string>()
    for (const e of entries) {
      const d = e.department_name?.trim()
      if (d) deptSet.add(d)
    }
    return Array.from(deptSet).sort((a, b) => a.localeCompare(b, 'th'))
  }, [entries])

  // 2. ดึงรายการกะที่มีคนทำงาน (ถ้าเลือกแผนกไว้ จะแสดงเฉพาะกะที่มีคนทำงานของแผนกนั้นเท่านั้น)
  const availableShifts = useMemo(() => {
    const map = new Map<string, ShiftOption>()
    for (const e of entries) {
      // เมื่อเลือกแผนกแล้ว ให้พิจารณาเฉพาะพนักงานที่อยู่ในแผนกนั้นเท่านั้น
      if (selectedDept) {
        const d = e.department_name?.trim() || 'ไม่ระบุแผนก'
        if (d !== selectedDept) continue
      }

      const start = e.shift_start
      const end = e.shift_end
      const type = e.shift_type

      if (!start && !end && !type) continue

      const key = `${start || ''}_${end || ''}_${type || ''}`
      if (!map.has(key)) {
        const timeStr = formatShiftRange(start, end)
        const typeCode = getShiftTypeCode(type, start)
        const label = timeStr !== '—' ? `${typeCode} ${timeStr}` : typeCode
        map.set(key, { key, label, type, start, end, count: 1 })
      } else {
        const existing = map.get(key)!
        existing.count += 1
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.start || '').localeCompare(b.start || ''))
  }, [entries, selectedDept])

  // รีเซ็ตกะที่เลือก หากกะนั้นไม่มีคนทำงานในแผนกใหม่ที่เลือก
  useEffect(() => {
    if (selectedShiftKey) {
      const exists = availableShifts.some((s) => s.key === selectedShiftKey)
      if (!exists) {
        setSelectedShiftKey(null)
      }
    }
  }, [availableShifts, selectedShiftKey])

  // 3. กรองรายการตามแผนกและกะที่เลือก
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (selectedDept) {
        const d = e.department_name?.trim() || 'ไม่ระบุแผนก'
        if (d !== selectedDept) return false
      }
      if (selectedShiftKey) {
        const key = `${e.shift_start || ''}_${e.shift_end || ''}_${e.shift_type || ''}`
        if (key !== selectedShiftKey) return false
      }
      return true
    })
  }, [entries, selectedDept, selectedShiftKey])

  // 4. ข้อความสรุปเงื่อนไขที่จะ Export
  const deptLabel = selectedDept || 'ทุกแผนก'
  const currentShift = availableShifts.find((s) => s.key === selectedShiftKey)
  const shiftLabel = currentShift ? currentShift.label : 'ทุกกะ'
  const count = filteredEntries.length

  // 5. สั่ง Export to Excel
  const handleExport = async () => {
    if (count === 0 || exporting) return
    setExporting(true)
    try {
      await exportNamelistToExcel(filteredEntries, {
        date,
        warehouse,
        departmentName: selectedDept,
        shiftLabel: currentShift ? currentShift.label : null,
      })
      logExportAudit({
        menu: 'namelist',
        warehouse,
        targetName: `Namelist ลูกค้า (${date} · ${deptLabel})`,
        summary: `Export Namelist ให้ลูกค้า วันที่ ${date} แผนก ${deptLabel} กะ ${shiftLabel} (${count} คน)`,
        meta: { date, warehouse, department: deptLabel, shift: shiftLabel, count },
      })
      onClose()
    } catch (err) {
      console.error('Export Excel failed:', err)
      alert('เกิดข้อผิดพลาดในการ Export ไฟล์ Excel กรุณาลองใหม่อีกครั้ง')
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-[#E1E6EF] p-5 z-50 text-left select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#E7F6ED] text-[#10B981] flex items-center justify-center">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[#16233D]">Export Namelist ให้ลูกค้า</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[#9AA5B8] hover:text-[#16233D] hover:bg-[#F4F6FA] transition-colors cursor-pointer"
          title="ปิด"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ส่วนเลือกแผนก */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-[#5B6B85]">แผนก</label>
          {selectedDept && (
            <button
              type="button"
              onClick={() => setSelectedDept(null)}
              className="text-[11px] text-[#2E6FE0] hover:underline font-semibold cursor-pointer"
            >
              เลือกทั้งหมด
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
          {availableDepts.length === 0 ? (
            <p className="text-xs text-[#9AA5B8] italic">ไม่มีข้อมูลแผนกในวันนี้</p>
          ) : (
            availableDepts.map((dept) => {
              const isSelected = selectedDept === dept
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(isSelected ? null : dept)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer',
                    isSelected
                      ? 'bg-[#2E6FE0] text-white shadow-2xs'
                      : 'bg-white hover:bg-[#F8FAFC] text-[#5B6B85] hover:text-[#16233D] border border-[#E1E6EF] hover:border-[#CBD5E1]'
                  )}
                >
                  {dept}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ส่วนเลือกกะ */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-[#5B6B85]">กะ</label>
          {selectedShiftKey && (
            <button
              type="button"
              onClick={() => setSelectedShiftKey(null)}
              className="text-[11px] text-[#2E6FE0] hover:underline font-semibold cursor-pointer"
            >
              เลือกทุกกะ
            </button>
          )}
        </div>
        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
          {availableShifts.length === 0 ? (
            <p className="text-xs text-[#9AA5B8] italic py-2">
              {selectedDept
                ? `ไม่มีกะที่มีคนทำงานในแผนก "${selectedDept}"`
                : 'ไม่มีข้อมูลกะที่มีคนทำงานในวันนี้'}
            </p>
          ) : (
            availableShifts.map((shift) => {
              const isSelected = selectedShiftKey === shift.key
              return (
                <button
                  key={shift.key}
                  type="button"
                  onClick={() => setSelectedShiftKey(isSelected ? null : shift.key)}
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-between cursor-pointer',
                    isSelected
                      ? 'bg-[#EEF3FC] border-2 border-[#2E6FE0] text-[#2E6FE0]'
                      : 'bg-white hover:bg-[#F8FAFC] text-[#16233D] border border-[#E1E6EF] hover:border-[#CBD5E1]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{shift.label}</span>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors',
                        isSelected
                          ? 'bg-[#2E6FE0] text-white'
                          : 'bg-[#F4F6FA] text-[#5B6B85]'
                      )}
                    >
                      {shift.count} คน
                    </span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#2E6FE0] flex-shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* กล่องสรุปสิ่งที่จะ Export (ตามรูป mockup) */}
      <div className="bg-[#F4F6FA] border border-[#E1E6EF]/70 rounded-xl px-3.5 py-2.5 text-xs text-[#5B6B85] text-center mb-4">
        จะ export:{' '}
        <span className="font-bold text-[#16233D]">{deptLabel}</span>
        {' · '}
        <span className="font-bold text-[#16233D]">{shiftLabel}</span>
        {' '}
        <span className="font-bold text-[#2E6FE0]">({count} คน)</span>
      </div>

      {/* ปุ่ม Export to Excel (สีเขียวตาม mockup) */}
      <button
        type="button"
        disabled={count === 0 || exporting}
        onClick={handleExport}
        className={cn(
          'w-full py-3 px-4 rounded-xl text-xs font-bold text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-sm',
          count === 0 || exporting
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#10B981] hover:bg-[#059669] active:bg-[#047857] cursor-pointer'
        )}
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>กำลังสร้างไฟล์ Excel...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Export to Excel</span>
          </>
        )}
      </button>
    </div>
  )
}

