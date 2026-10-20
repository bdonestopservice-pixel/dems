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
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useRealtimeListener } from '@/components/providers/RealtimeProvider'
import type { Employee, Warehouse, AuthSession } from '@/types'
import { exportCustomerRegistryCSV, exportOpsCSV } from '@/lib/export-csv'

interface EmployeesClientProps {
  session: AuthSession
}

export function EmployeesClient({ session }: EmployeesClientProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // Search & Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) // reset to page 1 on new search
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Load warehouses for filter
  useEffect(() => {
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((d) => {
        if (d.warehouses) setWarehouses(d.warehouses)
      })
      .catch(() => {})
  }, [])

  // Fetch employees data
  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
        warehouse: selectedWarehouse,
        status: selectedStatus,
      })

      const res = await fetch(`/api/employees?${params.toString()}`)
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
      console.error('Fetch employees error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, selectedWarehouse, selectedStatus])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  // ซิงค์ข้อมูลพนักงานใหม่ทันทีแบบ Realtime
  useRealtimeListener('employee-updated', () => {
    fetchEmployees()
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

  // Export Customer Registry CSV
  async function handleExportCustomerRegistry() {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const employeesToExport = await getSelectedEmployeesData()
      exportCustomerRegistryCSV(employeesToExport)
    } finally {
      setExporting(false)
    }
  }

  // Export OPS CSV
  async function handleExportOPS() {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const employeesToExport = await getSelectedEmployeesData()
      exportOpsCSV(employeesToExport)
    } finally {
      setExporting(false)
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

      {/* Main Card Container */}
      <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-[#E1E6EF] flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA5B8]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, รหัสพนักงาน (PO) หรือเลขบัตรประชาชน"
              className="input pl-10 pr-4 py-2 text-xs w-full bg-[#FAFBFC]"
            />
          </div>

          {/* Right actions: Filters and Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Warehouse Filter */}
            <div className="relative">
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value)
                  setPage(1)
                }}
                className="input py-2 pl-3 pr-8 text-xs font-medium cursor-pointer min-w-[110px] bg-[#FAFBFC]"
              >
                <option value="all">ทุกคลัง</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id} - {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Export CSV (ทะเบียนลูกค้า) */}
            <button
              type="button"
              onClick={handleExportCustomerRegistry}
              disabled={selectedIds.size === 0 || exporting}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors shadow-2xs',
                selectedIds.size > 0
                  ? 'bg-white text-[#16233D] border-[#E1E6EF] hover:bg-[#F4F6FA] active:bg-[#EEF3FC]'
                  : 'bg-[#F4F6FA] text-[#9AA5B8] border-[#E1E6EF] cursor-not-allowed opacity-60'
              )}
              title={
                selectedIds.size === 0
                  ? 'เลือกพนักงานอย่างน้อย 1 คนเพื่อ Export'
                  : `Export ทะเบียนลูกค้า (${selectedIds.size} คน)`
              }
            >
              <Download size={13} className="flex-shrink-0" />
              <span>Export CSV (ทะเบียนลูกค้า)</span>
              {selectedIds.size > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#2E6FE0] text-white text-[10px] font-bold">
                  {selectedIds.size}
                </span>
              )}
            </button>

            {/* Export OPS (CSV) */}
            <button
              type="button"
              onClick={handleExportOPS}
              disabled={selectedIds.size === 0 || exporting}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors shadow-2xs',
                selectedIds.size > 0
                  ? 'bg-white text-[#16233D] border-[#E1E6EF] hover:bg-[#F4F6FA] active:bg-[#EEF3FC]'
                  : 'bg-[#F4F6FA] text-[#9AA5B8] border-[#E1E6EF] cursor-not-allowed opacity-60'
              )}
              title={
                selectedIds.size === 0
                  ? 'เลือกพนักงานอย่างน้อย 1 คนเพื่อ Export'
                  : `Export OPS (${selectedIds.size} คน)`
              }
            >
              <Download size={13} className="flex-shrink-0" />
              <span>Export OPS (CSV)</span>
              {selectedIds.size > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#2E6FE0] text-white text-[10px] font-bold">
                  {selectedIds.size}
                </span>
              )}
            </button>

            {/* + เพิ่มพนักงานใหม่ */}
            <Link
              href="/employees/new"
              className="btn-primary text-xs px-4 py-2 gap-1.5 shadow-xs"
            >
              <Plus size={14} />
              <span>เพิ่มพนักงานใหม่</span>
            </Link>
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
                {search || selectedWarehouse !== 'all'
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
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">เลขบัตรประชาชน</th>
                  <th className="px-4 py-3 font-semibold text-[#5B6B85]">เบอร์โทร</th>
                  <th className="w-14 px-4 py-3 text-center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6EF]">
                {employees.map((emp) => {
                  const isChecked = selectedIds.has(emp.id)
                  const fullName = `${emp.first_name} ${emp.last_name}`
                  return (
                    <tr
                      key={emp.id}
                      className={cn(
                        'transition-colors hover:bg-[#F4F6FA]/70',
                        isChecked && 'bg-[#EEF3FC]/40'
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
                      <td className="px-4 py-3.5 font-medium text-[#16233D] whitespace-nowrap">
                        {emp.po_id || '-'}
                      </td>

                      {/* ชื่อ-นามสกุล */}
                      <td className="px-4 py-3.5 font-semibold text-[#16233D] whitespace-nowrap">
                        {fullName}
                      </td>

                      {/* คลัง/สาขา */}
                      <td className="px-4 py-3.5 text-[#5B6B85] whitespace-nowrap">
                        {emp.warehouse || emp.warehouse_name || '-'}
                      </td>

                      {/* เลขบัตรประชาชน */}
                      <td className="px-4 py-3.5 text-[#5B6B85] font-mono whitespace-nowrap">
                        {emp.id_card}
                      </td>

                      {/* เบอร์โทร */}
                      <td className="px-4 py-3.5 text-[#5B6B85] whitespace-nowrap">
                        {emp.phone || '-'}
                      </td>

                      {/* Edit Button */}
                      <td className="w-14 px-4 py-3.5 text-center">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-[#5B6B85] hover:text-[#2558B8] hover:bg-[#EEF3FC] border border-transparent hover:border-[#E1E6EF] transition-colors"
                          title="แก้ไขข้อมูลพนักงาน"
                        >
                          <Pencil size={14} />
                        </Link>
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
    </div>
  )
}
