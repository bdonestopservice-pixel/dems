'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Check, AlertCircle, Loader2, Users, Clock } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import { useWarehouses } from '@/components/providers/WarehouseProvider'
import { cn, formatThaiDate } from '@/lib/utils'
import { useSidebar } from '@/components/layout/SidebarContext'
import { broadcastRealtime } from '@/lib/realtime'
import type { AuthSession, Plan, Warehouse } from '@/types'

interface AddEmployeesToPlanClientProps {
  session: AuthSession
  planId: string
}

interface EligibleEmployee {
  id: string
  po_id: string
  prefix?: string
  first_name: string
  last_name: string
  phone?: string
  warehouse: string
  recently_used?: boolean
  usage_count?: number
}

export function AddEmployeesToPlanClient({ session, planId }: AddEmployeesToPlanClientProps) {
  const router = useRouter()
  const { isCollapsed } = useSidebar()
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  const [plan, setPlan] = useState<Plan | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([])
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filters: เริ่มต้นเป็น "ทุกคลัง" ('all') ตลอดตามที่ต้องการ
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')

  // Debounce search input 300ms เพื่อป้องกันการยิง API ถี่เกินไปขณะกำลังพิมพ์
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Selected employee IDs set (preserves across searches and filters!)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const initialAutoSelectedRef = useRef(false)
  const recentlyUsedMap = useRef<Map<string, boolean>>(new Map())

  // 1. Fetch Plan details
  useEffect(() => {
    async function loadPlan() {
      setLoadingPlan(true)
      try {
        const res = await fetch(`/api/plans/${planId}`)
        if (!res.ok) throw new Error('ไม่พบข้อมูลแพลนนี้')
        const data = await res.json()
        setPlan(data.plan)
        // คงค่า selectedWarehouse ไว้เป็น 'all' เพื่อให้เริ่มต้นเป็นทุกคลังเสมอ
      } catch (err: any) {
        setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลแพลนได้')
      } finally {
        setLoadingPlan(false)
      }
    }
    loadPlan()
  }, [planId])

  const { warehouses: allWarehouses } = useWarehouses()

  // 2. Load warehouses (จาก In-Memory Cache 0ms)
  useEffect(() => {
    const permitted = isSuperAdmin ? allWarehouses : allWarehouses.filter((w) => userWarehouses.includes(w.id))
    setWarehouses(permitted)
  }, [isSuperAdmin, userWarehouses, allWarehouses])

  // 3. Fetch eligible employees based on search & warehouse
  const fetchEligible = useCallback(async () => {
    if (!planId) return
    setLoadingEmployees(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (selectedWarehouse) {
        params.set('warehouse', selectedWarehouse)
      }

      const res = await fetch(`/api/plans/${planId}/eligible-employees?${params.toString()}&_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to fetch eligible employees')
      const data = await res.json()
      const emps: EligibleEmployee[] = data.employees || []
      setEligibleEmployees(emps)

      // บันทึกสถานะ Recently used ของพนักงาน
      emps.forEach((e) => {
        if (e.recently_used) recentlyUsedMap.current.set(e.id, true)
      })

      // เลือกพนักงาน Recently used ให้อัตโนมัติเมื่อพบ โดยจำกัดไม่ให้เกินจำนวนที่แพลนต้องการ และไม่เกิน 500 คน
      if (!initialAutoSelectedRef.current) {
        const recentIds = emps.filter((e) => e.recently_used).map((e) => e.id)
        if (recentIds.length > 0) {
          initialAutoSelectedRef.current = true
          setSelectedIds((prev) => {
            const next = new Set(prev)
            const currentTotal = plan?.current_count || 0
            const req = plan?.required_count || 0
            const maxAllowed = req > 0 ? Math.min(req, 500) : 500
            const availableSlots = Math.max(0, maxAllowed - currentTotal)
            const toAdd = recentIds.slice(0, availableSlots)
            toAdd.forEach((id) => next.add(id))
            return next
          })
        }
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingEmployees(false)
    }
  }, [planId, debouncedSearch, selectedWarehouse, plan?.current_count, plan?.required_count])

  useEffect(() => {
    fetchEligible()
  }, [fetchEligible])

  // นับจำนวนพนักงาน Recently used ที่ถูกเลือกอยู่ขณะนี้
  const recentlyUsedSelectedCount = useMemo(() => {
    let count = 0
    for (const id of selectedIds) {
      if (recentlyUsedMap.current.get(id)) count++
    }
    return count
  }, [selectedIds])

  // Calculations for live progress bar and counts (จำกัดไม่เกิน 500 คนต่อแพลน)
  const MAX_PLAN_EMPLOYEES = 500
  const currentCount = plan?.current_count || 0
  const requiredCount = plan?.required_count || 0
  const effectiveLimit = requiredCount > 0 ? Math.min(requiredCount, MAX_PLAN_EMPLOYEES) : MAX_PLAN_EMPLOYEES
  const currentlyMissing = Math.max(0, effectiveLimit - currentCount)
  const isPlanAlreadyFull = currentCount >= effectiveLimit || currentCount >= MAX_PLAN_EMPLOYEES
  const isSelectionLimitReached = selectedIds.size >= currentlyMissing
  const countAfterAdding = currentCount + selectedIds.size
  const remainingMissing = Math.max(0, effectiveLimit - countAfterAdding)
  const progressPercent =
    effectiveLimit > 0 ? Math.min(100, Math.round((countAfterAdding / effectiveLimit) * 100)) : 0

  // Toggle selection (ป้องกันไม่ให้เลือกเกิน 500 คน และไม่เกินจำนวนที่แพลนต้องการ)
  const toggleSelect = (id: string) => {
    if (isPlanAlreadyFull) {
      setErrorMsg(
        currentCount >= MAX_PLAN_EMPLOYEES
          ? `แพลนนี้มีพนักงานครบตามขีดจำกัดสูงสุดแล้ว (${MAX_PLAN_EMPLOYEES} คน) ไม่สามารถเพิ่มได้อีก`
          : `แพลนนี้มีพนักงานครบตามที่กำหนดแล้ว (${effectiveLimit} คน) ไม่สามารถเพิ่มได้อีก`
      )
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setErrorMsg(null)
      } else {
        if (prev.size >= currentlyMissing) {
          setErrorMsg(
            `สามารถเลือกพนักงานได้สูงสุดอีกเพียง ${currentlyMissing} คน (ขีดจำกัดไม่เกิน ${effectiveLimit} คนต่อแพลน)`
          )
          return prev
        }
        next.add(id)
        setErrorMsg(null)
      }
      return next
    })
  }

  // Toggle select all currently visible (เติมคนให้พอดีกับโควตาที่เหลือ ไม่เกิน 500 คน)
  const handleSelectAllVisible = () => {
    if (isPlanAlreadyFull) {
      setErrorMsg(
        currentCount >= MAX_PLAN_EMPLOYEES
          ? `แพลนนี้มีพนักงานครบตามขีดจำกัดสูงสุดแล้ว (${MAX_PLAN_EMPLOYEES} คน)`
          : `แพลนนี้มีพนักงานครบตามที่กำหนดแล้ว (${effectiveLimit} คน)`
      )
      return
    }

    const visibleIds = eligibleEmployees.map((e) => e.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visibleIds.forEach((id) => next.delete(id))
        return next
      })
      setErrorMsg(null)
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        const unselectedVisible = visibleIds.filter((id) => !next.has(id))
        const slotsLeft = Math.max(0, currentlyMissing - next.size)

        if (slotsLeft === 0) {
          setErrorMsg(`เลือกพนักงานครบตามโควตาที่แพลนต้องการแล้ว (${currentlyMissing} คน, สูงสุดไม่เกิน ${effectiveLimit} คน)`)
          return prev
        }

        const toAdd = unselectedVisible.slice(0, slotsLeft)
        toAdd.forEach((id) => next.add(id))

        if (unselectedVisible.length > slotsLeft) {
          setErrorMsg(
            `เลือกเพิ่ม ${toAdd.length} คน เพื่อเติมแพลนให้ครบ ${effectiveLimit} คนพอดี (ไม่เกิน 500 คนตามที่กำหนด)`
          )
        } else {
          setErrorMsg(null)
        }

        return next
      })
    }
  }

  // Submit addition to roster
  const handleAddSubmit = async () => {
    if (selectedIds.size === 0) return
    if (countAfterAdding > MAX_PLAN_EMPLOYEES) {
      setErrorMsg(`ไม่สามารถเพิ่มพนักงานเกิน ${MAX_PLAN_EMPLOYEES} คนต่อหนึ่งแพลนได้`)
      return
    }
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/plans/${planId}/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: Array.from(selectedIds) }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการเพิ่มพนักงาน')

      broadcastRealtime('plan-roster-updated')
      broadcastRealtime('plan-updated')

      // Redirect back to plan roster view
      router.push(`/planning/${planId}`)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด')
      setSubmitting(false)
    }
  }

  if (loadingPlan) {
    return (
      <>
        <Topbar session={session} title="จัดแพลนพนักงาน" subtitle="วางแผนจำนวนคนที่ต้องการแต่ละวัน" />
        <div className="flex-1 flex items-center justify-center p-12">
          <Loader2 className="w-7 h-7 text-[#2E6FE0] animate-spin" />
        </div>
      </>
    )
  }

  if (!plan) {
    return (
      <>
        <Topbar session={session} title="จัดแพลนพนักงาน" subtitle="วางแผนจำนวนคนที่ต้องการแต่ละวัน" />
        <div className="p-8 text-center text-[#E5484D]">
          {errorMsg || 'ไม่พบข้อมูลแพลนนี้'}
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar session={session} title="จัดแพลนพนักงาน" subtitle="วางแผนจำนวนคนที่ต้องการแต่ละวัน" />

      <div className="flex-1 overflow-y-auto px-8 pb-24">
        {/* Navigation Breadcrumb */}
        <div className="mb-4">
          <Link
            href={`/planning/${planId}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#5B6B85] hover:text-[#2E6FE0] transition-colors font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            กลับไปหน้ารายชื่อในแพลน
          </Link>
        </div>

        {/* Page Title */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-[#16233D] tracking-tight">เพิ่มพนักงานเข้าแพลน</h2>
        </div>

        {/* Top Summary Banner matching Mockup 3 */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] px-6 py-4 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Plan Info Details */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-bold text-[#16233D]">
                {formatThaiDate(plan.date)}
              </span>

              {plan.shift_start && plan.shift_end && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#FEF3E2] text-[#B45F17]">
                  {plan.shift_type === 'N' ? 'Night' : plan.shift_type === 'H' ? 'Half' : 'Day'} · {plan.shift_start}–{plan.shift_end}
                </span>
              )}

              <span className="text-sm font-bold text-[#16233D]">{plan.department_name}</span>

              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]">
                {plan.warehouse}
              </span>
            </div>

            {/* Live Progress Bar & Counter */}
            <div className="flex items-center gap-4 flex-1 max-w-md md:justify-end">
              <div className="w-48 bg-[#E1E6EF] h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    remainingMissing === 0
                      ? 'bg-[#2E9E5B]'
                      : progressPercent >= 50
                      ? 'bg-[#EAB308]'
                      : 'bg-[#2E6FE0]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <span className="text-xs font-bold text-[#16233D] whitespace-nowrap">
                {countAfterAdding} / {effectiveLimit} คน
              </span>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                  remainingMissing === 0
                    ? 'bg-[#E7F6ED] text-[#2E9E5B]'
                    : 'bg-[#FEF3E2] text-[#B45F17]'
                }`}
              >
                {remainingMissing === 0
                  ? 'ครบตามจำนวนแล้ว'
                  : `เหลือที่ว่างอีก ${remainingMissing} คน (สูงสุด 500)`}
              </span>
            </div>
          </div>
        </div>

        {/* Full Plan Alert */}
        {isPlanAlreadyFull && (
          <div className="mb-5 p-4 rounded-xl bg-[#E7F6ED] border border-[#A3E5BA] flex items-center gap-2.5 text-[#2E9E5B] text-xs font-semibold">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>
              {currentCount >= MAX_PLAN_EMPLOYEES
                ? `แพลนนี้มีพนักงานครบตามขีดจำกัดสูงสุดแล้ว (${currentCount}/500 คน) ไม่สามารถเพิ่มพนักงานได้อีก`
                : `แพลนนี้มีพนักงานครบตามจำนวนที่กำหนดแล้ว (${currentCount}/${effectiveLimit} คน) ไม่สามารถเพิ่มพนักงานได้อีก`}
            </span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-5 p-4 rounded-xl bg-[#FCE8E8] border border-[#F87171] flex items-center gap-2.5 text-[#E5484D] text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-4 shadow-sm mb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-[#9AA5B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อหรือรหัสพนักงาน (PO) ที่จะเพิ่มเข้าแพลนนี้"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] focus:bg-white transition-all"
              />
            </div>

            {/* Warehouse Filter Dropdown */}
            <div className="w-full sm:w-auto">
              <WarehouseSelect
                value={selectedWarehouse}
                onChange={(val) => setSelectedWarehouse(val)}
                warehouses={warehouses}
                allLabel="ทุกคลัง"
                className="py-2"
              />
            </div>
          </div>
        </div>

        {/* Employee Checkbox List Card */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] overflow-hidden shadow-sm">
          {/* Recently Used Notice Header matching Mockup */}
          <div className="px-6 py-3 bg-[#FAF5FF] border-b border-[#F3E8FF] flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 bg-[#7C3AED] rounded-full flex-shrink-0" />
              <p className="text-xs text-[#5B21B6]">
                <span className="font-bold text-[#6D28D9]">สีม่วง = Recently used</span>{' '}
                เพิ่มเข้าแพลนให้อัตโนมัติตามโควตา (ไม่เกิน 500 คนต่อแพลน) คนไหนที่ไม่เอาให้เลือกออกเอง
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#7C3AED] bg-[#EDE9FE] px-2.5 py-0.5 rounded-full whitespace-nowrap">
              จำกัดสูงสุด 500 คน/แพลน
            </span>
          </div>

          {loadingEmployees ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 text-[#2E6FE0] animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#5B6B85]">กำลังโหลดรายชื่อพนักงาน...</p>
            </div>
          ) : eligibleEmployees.length === 0 ? (
            <div className="p-12 text-center text-[#5B6B85]">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-[#16233D]">ไม่พบพนักงานที่สามารถเพิ่มได้</p>
              <p className="text-xs text-[#5B6B85] mt-1">
                {selectedWarehouse === 'all'
                  ? 'พนักงานทุกคนอาจถูกเพิ่มเข้าแพลนนี้หมดแล้ว หรือไม่มีพนักงานที่ตรงกับเงื่อนไขค้นหา'
                  : 'พนักงานในคลังนี้อาจถูกเพิ่มเข้าแพลนหมดแล้ว หรือไม่มีพนักงานที่ตรงกับเงื่อนไขค้นหา'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F4F6FA]">
              {eligibleEmployees.map((emp) => {
                const isSelected = selectedIds.has(emp.id)
                const isRecent = !!emp.recently_used
                const isDisabled = isPlanAlreadyFull || (isSelectionLimitReached && !isSelected)
                const fullName = `${emp.first_name} ${emp.last_name}`

                return (
                  <label
                    key={emp.id}
                    title={
                      isDisabled
                        ? isPlanAlreadyFull
                          ? 'แพลนนี้มีพนักงานครบตามที่กำหนดแล้ว'
                          : `เลือกครบตามโควตาที่ต้องการแล้ว (${currentlyMissing} คน)`
                        : undefined
                    }
                    className={cn(
                      'flex items-center justify-between px-6 py-3.5 transition-colors select-none',
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed bg-gray-50/50'
                        : isRecent
                        ? isSelected
                          ? 'bg-[#FAF5FF] hover:bg-[#F3E8FF]/60 cursor-pointer'
                          : 'bg-[#FCFAFF] hover:bg-[#FAF5FF] cursor-pointer'
                        : isSelected
                        ? 'bg-[#EEF3FC]/50 hover:bg-[#E5EEFA] cursor-pointer'
                        : 'bg-white hover:bg-[#FAFBFD] cursor-pointer'
                    )}
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Custom Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleSelect(emp.id)}
                        className={cn(
                          'w-4 h-4 rounded cursor-pointer disabled:cursor-not-allowed transition-colors',
                          isRecent
                            ? 'accent-[#7C3AED] text-[#7C3AED] focus:ring-[#7C3AED] border-[#C4B5FD]'
                            : 'text-[#2E6FE0] focus:ring-[#2E6FE0] border-gray-300'
                        )}
                      />

                      {/* PO-ID */}
                      <span className="font-mono text-xs font-bold text-[#16233D] min-w-[90px]">
                        {emp.po_id || '—'}
                      </span>

                      {/* Name */}
                      <span className="text-xs font-medium text-[#16233D]">
                        {fullName}
                      </span>

                      {/* Recently Used Badge & Count */}
                      {isRecent && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 bg-[#7C3AED] text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-xs">
                            <Clock className="w-3 h-3" />
                            Recently used
                          </span>
                          <span className="text-xs font-semibold text-[#6D28D9]">
                            ใช้ {emp.usage_count || 1} ครั้ง
                          </span>
                        </div>
                      )}

                      {/* Warehouse Badge */}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]">
                        {emp.warehouse || '—'}
                      </span>
                    </div>

                    {/* Phone Number */}
                    <div className="text-xs text-[#5B6B85] font-mono">
                      {emp.phone || '—'}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action Bar matching Mockup */}
      <div
        className={cn(
          'fixed bottom-0 right-0 bg-white border-t border-[#E1E6EF] px-8 py-3.5 shadow-lg flex items-center justify-between z-20 transition-all duration-300 ease-in-out',
          isCollapsed ? 'left-16' : 'left-72'
        )}
      >
        <div className="text-xs font-medium text-[#5B6B85]">
          เลือกแล้ว <span className="font-bold text-[#2E6FE0]">{selectedIds.size}</span> คน
          {recentlyUsedSelectedCount > 0 && (
            <span className="text-[#6D28D9] font-medium">
              {' '}(รวม Recently used ที่ติ๊กไว้ให้อัตโนมัติ {recentlyUsedSelectedCount} คน)
            </span>
          )}{' '}
          ·{' '}
          {isPlanAlreadyFull ? (
            <span className="font-bold text-[#2E9E5B]">แพลนนี้มีคนครบแล้ว</span>
          ) : countAfterAdding > effectiveLimit ? (
            <span className="font-bold text-[#E5484D]">
              เลือกเกินโควตา {countAfterAdding - effectiveLimit} คน (เหลือที่ว่างอีก {currentlyMissing} คน — กรุณาเลือกออก)
            </span>
          ) : remainingMissing === 0 ? (
            <span className="font-bold text-[#2E9E5B]">ครบตามจำนวนที่แพลนต้องการแล้ว</span>
          ) : (
            <>
              จะเหลือขาดอีก{' '}
              <span className="font-bold text-[#E5484D]">{remainingMissing}</span> คน
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddSubmit}
          disabled={
            selectedIds.size === 0 ||
            isPlanAlreadyFull ||
            countAfterAdding > effectiveLimit ||
            countAfterAdding > MAX_PLAN_EMPLOYEES ||
            submitting
          }
          className="inline-flex items-center gap-2 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isPlanAlreadyFull
            ? 'แพลนเต็มแล้ว'
            : countAfterAdding > effectiveLimit
            ? `เลือกเกิน ${countAfterAdding - effectiveLimit} คน`
            : `เพิ่มเข้าแพลนนี้ (${selectedIds.size} คน)`}
        </button>
      </div>
    </>
  )
}
