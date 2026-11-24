'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Pencil,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckSquare,
  Square,
  Users,
  Bell,
  CheckCircle2,
  AlertCircle,
  Ban,
} from 'lucide-react'
import { cn, getInitials, formatThaiDate, todayLocal } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import { BlacklistModal } from '@/components/employees/BlacklistModal'
import { useRealtimeListener } from '@/components/providers/RealtimeProvider'
import { useWarehouses } from '@/components/providers/WarehouseProvider'
import type { Employee, Warehouse, AuthSession } from '@/types'
import { exportOpsExcel } from '@/lib/export-ops-excel'
import { exportCustomerRegistryReport } from '@/lib/export-reports-excel'
import { logExportAudit } from '@/lib/audit-client'

interface EmployeesClientProps {
  session: AuthSession
}

export function EmployeesClient({ session }: EmployeesClientProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingType, setExportingType] = useState<'registry' | 'ops' | null>(null)
  const { warehouses } = useWarehouses()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Blacklist Modal State
  const [blacklistTarget, setBlacklistTarget] = useState<Employee | null>(null)
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false)

  const showToast = (t: { type: 'success' | 'error'; text: string }) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const handleBlacklistSuccess = (updatedEmp: Employee, action: 'blacklist' | 'unblacklist') => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updatedEmp.id ? { ...emp, ...updatedEmp } : emp))
    )
    showToast({
      type: 'success',
      text: action === 'blacklist' ? 'ติดแบล็กลิสต์พนักงานเรียบร้อยแล้ว' : 'ปลดแบล็กลิสต์เรียบร้อยแล้ว',
    })
  }

  // Search & Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')

  // Pagination (100 per page as requested)
  const [page, setPage] = useState(1)
  const [limit] = useState(100)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Selection state for export: Set of employee IDs
  // Must preserve selection across page changes and filter adjustments!
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Keep a cache of selected employee full objects so we can export without re-fetching
  const selectedEmployeesCache = useRef<Map<string, Employee>>(new Map())
  const requestSeq = useRef(0)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // reset to page 1 on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch employees data (รองรับ silent update เบื้องหลังสำหรับ realtime โดยไม่กระพริบหน้าจอ)
  const fetchEmployees = useCallback(
    async (silent = false) => {
      const seq = ++requestSeq.current
      if (!silent) {
        setLoading(true)
      }
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          search: debouncedSearch,
          warehouse: selectedWarehouse,
          status: selectedStatus,
          _t: String(Date.now()),
        })
        if (startDate) {
          params.set('start_date', startDate)
        }

        const res = await fetch(`/api/employees?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (seq !== requestSeq.current) return
        if (res.ok) {
          const data = await res.json()
          setEmployees(data.employees || [])
          setTotal(data.total || 0)
          setTotalPages(data.totalPages || 1)

          // Cache visible employees
          ;(data.employees || []).forEach((emp: Employee) => {
            selectedEmployeesCache.current.set(emp.id, emp)
          })
        }
      } catch (err) {
        if (seq !== requestSeq.current) return
        console.error('Fetch employees error:', err)
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false)
        }
      }
    },
    [page, limit, debouncedSearch, selectedWarehouse, selectedStatus, startDate]
  )

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  // ซิงค์ข้อมูลพนักงานใหม่ทันทีแบบ Realtime (silent ไม่กระพริบจอ)
  useRealtimeListener('employee-updated', () => {
    fetchEmployees(true)
  })

  // Select all / Deselect all in current view
  const isAllCurrentSelected = useMemo(() => {
    if (employees.length === 0) return false
    return employees.every((emp) => selectedIds.has(emp.id))
  }, [employees, selectedIds])

  function handleToggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllCurrentSelected) {
        // Deselect currently visible items
        employees.forEach((emp) => next.delete(emp.id))
      } else {
        // Select currently visible items
        employees.forEach((emp) => {
          next.add(emp.id)
          selectedEmployeesCache.current.set(emp.id, emp)
        })
      }
      return next
    })
  }

  function handleToggleSelectRow(emp: Employee) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(emp.id)) {
        next.delete(emp.id)
      } else {
        next.add(emp.id)
        selectedEmployeesCache.current.set(emp.id, emp)
      }
      return next
    })
  }

  // Helper to fetch any missing selected employees before exporting
  async function getSelectedEmployeesData(): Promise<Employee[]> {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return []

    // Check which IDs are already in cache
    const missingIds = ids.filter((id) => !selectedEmployeesCache.current.has(id))

    if (missingIds.length > 0) {
      try {
        const res = await fetch(`/api/employees?ids=${missingIds.join(',')}&limit=1000`)
        if (res.ok) {
          const data = await res.json()
          ;(data.employees || []).forEach((emp: Employee) => {
            selectedEmployeesCache.current.set(emp.id, emp)
          })
        }
      } catch (err) {
        console.error('Error fetching selected employees for export:', err)
      }
    }

    return ids
      .map((id) => selectedEmployeesCache.current.get(id))
      .filter((emp): emp is Employee => Boolean(emp))
  }

  // Export ทะเบียนลูกค้า (Excel 13 คอลัมน์ เหมือนโมดูลรายงาน)
  async function handleExportCustomerRegistry() {
    if (selectedIds.size === 0) return
    setExportingType('registry')
    try {
      const employeesToExport = await getSelectedEmployeesData()
      if (employeesToExport.length === 0) {
        showToast({ type: 'error', text: 'ไม่พบข้อมูลพนักงานที่เลือก' })
        return
      }
      await exportCustomerRegistryReport(employeesToExport, {
        date: todayLocal(),
        warehouse: selectedWarehouse,
      })
      logExportAudit({
        menu: 'employees',
        warehouse: selectedWarehouse,
        targetName: `ทะเบียนลูกค้า (${employeesToExport.length} คน)`,
        summary: `Export ทะเบียนลูกค้า (Excel) จำนวน ${employeesToExport.length} คน`,
        meta: { type: 'customer_registry', count: employeesToExport.length, warehouse: selectedWarehouse },
      })
      showToast({
        type: 'success',
        text: `Export ทะเบียนลูกค้า (${employeesToExport.length} คน) เรียบร้อยแล้ว`,
      })
    } catch (err: any) {
      console.error('Export customer registry error:', err)
      showToast({ type: 'error', text: err?.message || 'Export ทะเบียนลูกค้าล้มเหลว' })
    } finally {
      setExportingType(null)
    }
  }

  // Export OPS ID (Excel)
  async function handleExportOPS() {
    if (selectedIds.size === 0) return
    setExportingType('ops')
    try {
      const employeesToExport = await getSelectedEmployeesData()
      if (employeesToExport.length === 0) {
        showToast({ type: 'error', text: 'ไม่พบข้อมูลพนักงานที่เลือก' })
        return
      }
      await exportOpsExcel(employeesToExport)
      logExportAudit({
        menu: 'employees',
        warehouse: selectedWarehouse,
        targetName: `OPS ID (${employeesToExport.length} คน)`,
        summary: `Export OPS ID (Excel) จำนวน ${employeesToExport.length} คน`,
        meta: { type: 'ops_id', count: employeesToExport.length, warehouse: selectedWarehouse },
      })
      showToast({
        type: 'success',
        text: `Export OPS ID (${employeesToExport.length} คน) เรียบร้อยแล้ว`,
      })
    } catch (err: any) {
      console.error('Export OPS ID error:', err)
      showToast({ type: 'error', text: err?.message || 'Export OPS ID ล้มเหลว' })
    } finally {
      setExportingType(null)
    }
  }

  // Range info (e.g. 1-100 จาก 428 รายการ)
  const fromRecord = total === 0 ? 0 : (page - 1) * limit + 1
  const toRecord = Math.min(page * limit, total)

  // Generate pagination page numbers
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, page])

  return (
    <div className="flex flex-col h-full bg-[#F4F6FA] px-8 pt-7 pb-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#16233D] tracking-tight">ข้อมูลพนักงาน</h1>
          <p className="text-xs text-[#5B6B85] mt-1">
            ค้นหาและจัดการข้อมูลพนักงานทั้งหมด · {total.toLocaleString('th-TH')} รายชื่อ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-white border border-[#E1E6EF] flex items-center justify-center text-[#5B6B85] hover:bg-[#F4F6FA] hover:text-[#16233D] transition-colors shadow-2xs relative"
            title="การแจ้งเตือน"
          >
            <Bell size={16} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#F5A623] rounded-full" />
          </button>
          <div
            className="w-9 h-9 rounded-full bg-[#2E6FE0] text-white flex items-center justify-center text-xs font-bold shadow-sm"
            title={`${session.name} (${session.role})`}
          >
            {getInitials(session.name)}
          </div>
        </div>
      </div>

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

      {/* Main Card Container */}
      <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Toolbar Row 1: Search and Action Buttons */}
        <div className="p-4 border-b border-[#E1E6EF] flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[280px]">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA5B8]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, รหัสพนักงาน (PO) หรือเลขบัตรประชาชน"
              className="w-full h-10 pl-10 pr-4 text-xs rounded-xl border border-[#E1E6EF] bg-[#FAFBFC] focus:bg-white text-[#16233D] placeholder-[#9AA5B8] focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-2xs transition-all"
            />
          </div>

          {/* Right actions: Export and Add Buttons */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Export ทะเบียนลูกค้า (Excel 13 คอลัมน์ เหมือนโมดูลรายงาน) */}
            <button
              type="button"
              onClick={handleExportCustomerRegistry}
              disabled={selectedIds.size === 0 || !!exportingType}
              className={cn(
                'h-10 inline-flex items-center justify-center gap-2 px-4 text-xs font-semibold rounded-xl border transition-all shadow-2xs select-none whitespace-nowrap',
                selectedIds.size > 0 && !exportingType
                  ? 'bg-white hover:bg-[#F8FAFC] text-[#16233D] border-[#E1E6EF] hover:border-[#CBD5E1] cursor-pointer'
                  : 'bg-[#FAFBFC] text-[#9AA5B8] border-[#E1E6EF] cursor-not-allowed opacity-60'
              )}
              title={
                selectedIds.size === 0
                  ? 'เลือกพนักงานอย่างน้อย 1 คนเพื่อ Export'
                  : `Export ทะเบียนลูกค้า (${selectedIds.size} คน)`
              }
            >
              {exportingType === 'registry' ? (
                <Loader2 className="w-4 h-4 text-[#2E6FE0] animate-spin" />
              ) : (
                <Users className="w-4 h-4 text-[#2E6FE0]" />
              )}
              <span>Export ทะเบียนลูกค้า</span>
              {selectedIds.size > 0 && (
                <span className="bg-[#EEF3FC] text-[#2E6FE0] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {selectedIds.size}
                </span>
              )}
            </button>

            {/* Export OPS (CSV) */}
            <button
              type="button"
              onClick={handleExportOPS}
              disabled={selectedIds.size === 0 || !!exportingType}
              className={cn(
                'h-10 inline-flex items-center justify-center gap-2 px-4 text-xs font-semibold rounded-xl border transition-all shadow-2xs whitespace-nowrap',
                selectedIds.size > 0 && !exportingType
                  ? 'bg-white hover:bg-[#F8FAFC] text-[#16233D] border-[#E1E6EF] hover:border-[#CBD5E1] cursor-pointer'
                  : 'bg-[#FAFBFC] text-[#9AA5B8] border-[#E1E6EF] cursor-not-allowed opacity-60'
              )}
              title={
                selectedIds.size === 0
                  ? 'เลือกพนักงานอย่างน้อย 1 คนเพื่อ Export'
                  : `Export OPS ID (${selectedIds.size} คน)`
              }
            >
              {exportingType === 'ops' ? (
                <Loader2 className="w-4 h-4 text-[#5B6B85] animate-spin" />
              ) : (
                <Download size={14} className="flex-shrink-0 text-[#5B6B85]" />
              )}
              <span>Export OPS ID</span>
              {selectedIds.size > 0 && (
                <span className="bg-[#EEF3FC] text-[#2E6FE0] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {selectedIds.size}
                </span>
              )}
            </button>

            {/* + เพิ่มพนักงานใหม่ */}
            <Link
              href="/employees/new"
              className="h-10 inline-flex items-center justify-center gap-1.5 px-4 text-xs font-semibold rounded-xl bg-[#2E6FE0] hover:bg-[#2558B8] text-white transition-all shadow-xs whitespace-nowrap"
            >
              <Plus size={15} />
              <span>เพิ่มพนักงานใหม่</span>
            </Link>
          </div>
        </div>

        {/* Toolbar Row 2: Filters under search input */}
        <div className="px-4 py-2.5 bg-[#FAFBFC] border-b border-[#E1E6EF] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-[#5B6B85]">ตัวกรอง:</span>

            {/* Warehouse Filter */}
            <WarehouseSelect
              value={selectedWarehouse}
              onChange={(val) => {
                setSelectedWarehouse(val)
                setPage(1)
              }}
              warehouses={warehouses}
              allLabel="ทุกคลัง"
              className="py-2"
            />

            {/* Start Date Filter */}
            <div className="w-[165px]">
              <DateInput
                value={startDate}
                onChange={(val) => {
                  setStartDate(val)
                  setPage(1)
                }}
                clearable={true}
                placeholder="วันที่เริ่มงาน"
                title="กรองตามวันที่เริ่มงาน (วัน/เดือน/ปี)"
              />
            </div>

            {/* Clear filters button if active */}
            {(selectedWarehouse !== 'all' || startDate || search) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWarehouse('all')
                  setStartDate('')
                  setSearch('')
                  setPage(1)
                }}
                className="text-xs text-[#5B6B85] hover:text-[#E5484D] font-medium underline px-2 py-1 transition-colors cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* Right: Found employee count */}
          <div className="text-xs text-[#5B6B85] font-medium">
            พบพนักงาน <span className="font-bold text-[#16233D]">{total.toLocaleString('th-TH')}</span> คน
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[#2E6FE0] font-semibold">
                (เลือกแล้ว {selectedIds.size} คน)
              </span>
            )}
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-72 gap-2 text-[#5B6B85]">
              <Loader2 size={24} className="animate-spin text-[#2E6FE0]" />
              <p className="text-xs">กำลังโหลดข้อมูลพนักงาน...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-center text-[#9AA5B8] p-6">
              <Users size={32} className="mb-2 text-[#C6DCFD]" />
              <p className="text-sm font-semibold text-[#16233D]">ไม่พบข้อมูลพนักงาน</p>
              <p className="text-xs mt-1 text-[#5B6B85]">
                {search || selectedWarehouse !== 'all' || startDate
                  ? 'ลองเปลี่ยนเงื่อนไขค้นหาหรือตัวกรอง'
                  : 'ยังไม่มีพนักงานในระบบ เริ่มต้นโดยการกดปุ่ม "+ เพิ่มพนักงานใหม่"'}
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E1E6EF] bg-white sticky top-0 z-10">
                  {/* Select All Checkbox */}
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-[#C6DCFD] text-[#2E6FE0] focus:ring-[#2E6FE0] w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">รหัสพนักงาน</th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">คลัง/สาขา</th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">วันที่เริ่มงาน</th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">เลขบัตรประชาชน</th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">เบอร์โทร</th>
                  <th className="w-20 px-3 py-3 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6EF]">
                {employees.map((emp) => {
                  const isChecked = selectedIds.has(emp.id)
                  const fullName = `${emp.first_name} ${emp.last_name}`
                  const isBlacklisted = !!emp.is_blacklisted
                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        'transition-colors',
                        isBlacklisted
                          ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border-l-4 border-l-[#E5484D]'
                          : isChecked
                          ? 'bg-[#EEF3FC]/40 hover:bg-[#F4F6FA]/70'
                          : 'hover:bg-[#F4F6FA]/70'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(emp)}
                          className="rounded border-[#C6DCFD] text-[#2E6FE0] focus:ring-[#2E6FE0] w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* PO-ID */}
                      <td
                        className={cn(
                          'px-4 py-3.5 font-medium whitespace-nowrap',
                          isBlacklisted ? 'text-[#E5484D] font-bold' : 'text-[#16233D]'
                        )}
                      >
                        {emp.po_id || '-'}
                      </td>

                      {/* ชื่อ-นามสกุล */}
                      <td className="px-4 py-3.5 font-semibold text-[#16233D] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={cn(isBlacklisted && 'text-[#B91C1C]')}>{fullName}</span>
                          {isBlacklisted && (
                            <button
                              type="button"
                              onClick={() => {
                                setBlacklistTarget(emp)
                                setIsBlacklistModalOpen(true)
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FCE8E8] text-[#E5484D] border border-[#F8D3D4] hover:bg-[#F8D3D4] transition-colors cursor-pointer"
                              title={
                                emp.blacklist_reason
                                  ? `เหตุผล: ${emp.blacklist_reason}`
                                  : 'ติดแบล็กลิสต์'
                              }
                            >
                              <Ban size={10} className="stroke-[2.5]" />
                              ติดแบล็กลิสต์
                            </button>
                          )}
                        </div>
                      </td>

                      {/* คลัง/สาขา */}
                      <td className="px-4 py-3.5 text-[#5B6B85] whitespace-nowrap">
                        {emp.warehouse || emp.warehouse_name || '-'}
                      </td>

                      {/* วันที่เริ่มงาน */}
                      <td className="px-4 py-3.5 text-[#16233D] font-medium whitespace-nowrap">
                        {formatThaiDate(emp.start_date)}
                      </td>

                      {/* เลขบัตรประชาชน */}
                      <td className="px-4 py-3.5 text-[#5B6B85] font-mono whitespace-nowrap">
                        {emp.id_card}
                      </td>

                      {/* เบอร์โทร */}
                      <td className="px-4 py-3.5 text-[#5B6B85] whitespace-nowrap">
                        {emp.phone || '-'}
                      </td>

                      {/* Action Buttons: Edit + Blacklist */}
                      <td className="w-20 px-3 py-3.5 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg text-[#5B6B85] hover:text-[#2558B8] hover:bg-[#EEF3FC] border border-transparent hover:border-[#E1E6EF] transition-colors"
                            title="แก้ไขข้อมูลพนักงาน"
                          >
                            <Pencil size={14} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setBlacklistTarget(emp)
                              setIsBlacklistModalOpen(true)
                            }}
                            className={cn(
                              'inline-flex items-center justify-center p-1.5 rounded-lg border transition-colors cursor-pointer',
                              isBlacklisted
                                ? 'text-[#E5484D] bg-[#FCE8E8] border-[#F8D3D4] hover:bg-[#F8D3D4] shadow-xs'
                                : 'text-[#5B6B85] hover:text-[#E5484D] hover:bg-[#FCE8E8] border-transparent hover:border-[#F8D3D4]'
                            )}
                            title={
                              isBlacklisted
                                ? 'ดูเหตุผลที่ติดแบล็กลิสต์ / ปลดแบล็กลิสต์'
                                : 'ติดแบล็กลิสต์พนักงาน'
                            }
                          >
                            <Ban size={14} className={isBlacklisted ? 'stroke-[2.5]' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: Pagination */}
        <div className="px-6 py-3.5 border-t border-[#E1E6EF] flex flex-wrap items-center justify-between gap-3 bg-white text-xs text-[#5B6B85]">
          <div>
            แสดง {fromRecord.toLocaleString('th-TH')}–{toRecord.toLocaleString('th-TH')} จาก{' '}
            {total.toLocaleString('th-TH')} รายการ
          </div>

          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#F4F6FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Page numbers */}
            {pageNumbers.map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400">
                    ...
                  </span>
                )
              }
              const isCurrent = p === page
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => setPage(Number(p))}
                  className={cn(
                    'min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-colors',
                    isCurrent
                      ? 'bg-[#2E6FE0] text-white shadow-2xs'
                      : 'border border-[#E1E6EF] text-[#16233D] hover:bg-[#F4F6FA]'
                  )}
                >
                  {p}
                </button>
              )
            })}

            {/* Next */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#F4F6FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Blacklist Modal */}
      <BlacklistModal
        employee={blacklistTarget}
        isOpen={isBlacklistModalOpen}
        onClose={() => {
          setIsBlacklistModalOpen(false)
          setBlacklistTarget(null)
        }}
        onSuccess={handleBlacklistSuccess}
      />
    </div>
  )
}
