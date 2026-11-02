'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Check, AlertCircle, Loader2, Users } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
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
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')

  // Selected employee IDs set (preserves across searches and filters!)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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

  // 2. Load warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) return
        const data = await res.json()
        const all: Warehouse[] = data.warehouses || []
        const permitted = isSuperAdmin ? all : all.filter((w) => userWarehouses.includes(w.id))
        setWarehouses(permitted)
      } catch (err) {
        console.error(err)
      }
    }
    loadWarehouses()
  }, [isSuperAdmin, userWarehouses])

  // 3. Fetch eligible employees based on search & warehouse
  const fetchEligible = useCallback(async () => {
    if (!planId) return
    setLoadingEmployees(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set('search', searchTerm.trim())
      if (selectedWarehouse) {
        params.set('warehouse', selectedWarehouse)
      }

      const res = await fetch(`/api/plans/${planId}/eligible-employees?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch eligible employees')
      const data = await res.json()
      setEligibleEmployees(data.employees || [])
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingEmployees(false)
    }
  }, [planId, searchTerm, selectedWarehouse])

  useEffect(() => {
    fetchEligible()
  }, [fetchEligible])

  // Calculations for live progress bar and counts
  const currentCount = plan?.current_count || 0
  const requiredCount = plan?.required_count || 0
  const currentlyMissing = Math.max(0, requiredCount - currentCount)
  const isPlanAlreadyFull = requiredCount > 0 && currentCount >= requiredCount
  const isSelectionLimitReached = requiredCount > 0 && selectedIds.size >= currentlyMissing
  const countAfterAdding = currentCount + selectedIds.size
  const remainingMissing = Math.max(0, requiredCount - countAfterAdding)
  const progressPercent =
    requiredCount > 0 ? Math.min(100, Math.round((countAfterAdding / requiredCount) * 100)) : 0

  // Toggle selection (ป้องกันไม่ให้เลือกเกินจำนวนที่แพลนต้องการ)
  const toggleSelect = (id: string) => {
    if (isPlanAlreadyFull) {
      setErrorMsg(`แพลนนี้มีพนักงานครบตามที่กำหนดแล้ว (${requiredCount} คน) ไม่สามารถเพิ่มได้อีก`)
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setErrorMsg(null)
      } else {
        if (requiredCount > 0 && prev.size >= currentlyMissing) {
          setErrorMsg(
            `สามารถเลือกพนักงานได้สูงสุดอีกเพียง ${currentlyMissing} คน ตามจำนวนที่แพลนต้องการ (${requiredCount} คน)`
          )
          return prev
        }
        next.add(id)
        setErrorMsg(null)
      }
      return next
    })
  }

  // Toggle select all currently visible (เติมคนให้พอดีกับโควตาที่เหลือ ไม่เกินแพลน)
  const handleSelectAllVisible = () => {
    if (isPlanAlreadyFull) {
      setErrorMsg(`แพลนนี้มีพนักงานครบตามที่กำหนดแล้ว (${requiredCount} คน)`)
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
        const slotsLeft = requiredCount > 0 ? Math.max(0, currentlyMissing - next.size) : unselectedVisible.length

        if (slotsLeft === 0) {
          setErrorMsg(`เลือกพนักงานครบตามโควตาที่แพลนต้องการแล้ว (${currentlyMissing} คน)`)
          return prev
        }

        const toAdd = unselectedVisible.slice(0, slotsLeft)
        toAdd.forEach((id) => next.add(id))

        if (unselectedVisible.length > slotsLeft) {
          setErrorMsg(
            `เลือกเพิ่ม ${toAdd.length} คน เพื่อเติมแพลนให้ครบ ${requiredCount} คนพอดี (ไม่เกินตามที่กำหนด)`
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
                  className="bg-[#2E6FE0] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <span className="text-xs font-bold text-[#16233D] whitespace-nowrap">
                {countAfterAdding} / {requiredCount} คน
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
                  : `เหลือที่ว่างอีก ${remainingMissing} คน`}
              </span>
            </div>
          </div>
        </div>

        {/* Full Plan Alert */}
        {isPlanAlreadyFull && (
          <div className="mb-5 p-4 rounded-xl bg-[#E7F6ED] border border-[#A3E5BA] flex items-center gap-2.5 text-[#2E9E5B] text-xs font-semibold">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>
              แพลนนี้มีพนักงานครบตามจำนวนที่กำหนดแล้ว ({currentCount}/{requiredCount} คน) ไม่สามารถเพิ่มพนักงานได้อีก
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
                    className={`flex items-center justify-between px-6 py-3.5 transition-colors select-none ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed bg-gray-50/50'
                        : 'hover:bg-[#FAFBFD] cursor-pointer'
                    } ${isSelected ? 'bg-[#EEF3FC]/50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Custom Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleSelect(emp.id)}
                        className="w-4 h-4 rounded text-[#2E6FE0] focus:ring-[#2E6FE0] border-gray-300 cursor-pointer disabled:cursor-not-allowed"
                      />

                      {/* PO-ID */}
                      <span className="font-mono text-xs font-bold text-[#16233D] min-w-[90px]">
                        {emp.po_id || '—'}
                      </span>

                      {/* Name */}
                      <span className="text-xs font-medium text-[#16233D]">
                        {fullName}
                      </span>

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

      {/* Fixed Bottom Action Bar matching Mockup 3 */}
      <div
        className={cn(
          'fixed bottom-0 right-0 bg-white border-t border-[#E1E6EF] px-8 py-3.5 shadow-lg flex items-center justify-between z-20 transition-all duration-300 ease-in-out',
          isCollapsed ? 'left-16' : 'left-72'
        )}
      >
        <div className="text-xs font-medium text-[#5B6B85]">
          เลือกแล้ว <span className="font-bold text-[#2E6FE0]">{selectedIds.size}</span> คน ·{' '}
          {isPlanAlreadyFull ? (
            <span className="font-bold text-[#2E9E5B]">แพลนนี้มีคนครบแล้ว</span>
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
          disabled={selectedIds.size === 0 || isPlanAlreadyFull || countAfterAdding > requiredCount || submitting}
          className="inline-flex items-center gap-2 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isPlanAlreadyFull ? 'แพลนเต็มแล้ว' : `เพิ่มเข้าแพลนนี้ (${selectedIds.size} คน)`}
        </button>
      </div>
    </>
  )
}
