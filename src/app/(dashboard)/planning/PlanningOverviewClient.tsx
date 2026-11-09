'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, Users, Calendar, AlertCircle, CheckCircle2, Trash2, Loader2 } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { formatThaiDate, todayLocal } from '@/lib/utils'
import { EditPlanModal } from '@/components/planning/EditPlanModal'
import { DeletePlanModal } from '@/components/planning/DeletePlanModal'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import { broadcastRealtime } from '@/lib/realtime'
import { useRealtimeListener, useRealtimeSession } from '@/components/providers/RealtimeProvider'
import type { AuthSession, Plan, Warehouse } from '@/types'

interface PlanningOverviewClientProps {
  session: AuthSession
  initialDate?: string
  initialWarehouse?: string
}

export function PlanningOverviewClient({
  session: initialSession,
  initialDate,
  initialWarehouse,
}: PlanningOverviewClientProps) {
  const { session } = useRealtimeSession()
  const [plans, setPlans] = useState<Plan[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_plans: 0, completed_plans: 0, total_missing: 0 })

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(initialWarehouse || 'all')
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayLocal())
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  // Debounce search input เพื่อลดการยิง API ถี่เกินไปขณะกำลังพิมพ์
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Edit & Delete Modal State
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handlePlanUpdated = (updatedPlan: any) => {
    setPlans((prev) =>
      prev.map((item) => (item.id === updatedPlan.id ? { ...item, ...updatedPlan } : item))
    )
    setFeedbackMsg({ type: 'success', text: 'แก้ไขข้อมูลแพลนเรียบร้อยแล้ว' })
    setTimeout(() => setFeedbackMsg(null), 3000)
    broadcastRealtime('plan-updated')
    fetchPlans()
  }

  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return
    const p = planToDelete
    setDeletingPlanId(p.id)
    try {
      const res = await fetch(`/api/plans/${p.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ไม่สามารถลบแพลนได้')
      }

      setPlans((prev) => prev.filter((item) => item.id !== p.id))
      setFeedbackMsg({ type: 'success', text: `ลบแพลน ${p.department_name} เรียบร้อยแล้ว` })
      setTimeout(() => setFeedbackMsg(null), 3000)
      broadcastRealtime('plan-updated')
      setPlanToDelete(null)
      fetchPlans()
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการลบแพลน' })
      setTimeout(() => setFeedbackMsg(null), 4000)
    } finally {
      setDeletingPlanId(null)
    }
  }

  // Permitted warehouses for current user
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  // Load warehouses list
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) return
        const data = await res.json()
        const all: Warehouse[] = data.warehouses || []
        if (isSuperAdmin) {
          setWarehouses(all)
        } else {
          setWarehouses(all.filter((w) => userWarehouses.includes(w.id)))
        }
      } catch (err) {
        console.error('Failed to load warehouses:', err)
      }
    }
    loadWarehouses()
  }, [isSuperAdmin, userWarehouses])

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedWarehouse && selectedWarehouse !== 'all') {
        params.set('warehouse', selectedWarehouse)
      }
      if (selectedDate) {
        params.set('date', selectedDate)
      }
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim())
      }

      const res = await fetch(`/api/plans?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch plans')
      const data = await res.json()
      setPlans(data.plans || [])
      setStats(data.stats || { total_plans: 0, completed_plans: 0, total_missing: 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedWarehouse, selectedDate, debouncedSearch])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  // โหลดข้อมูลแพลนใหม่ทันทีเมื่อมีการอัปเดตแบบ Realtime
  useRealtimeListener(['plan-updated', 'plan-roster-updated'], () => {
    fetchPlans()
  })

  return (
    <>
      <Topbar
        session={session}
        title="จัดแพลนพนักงาน"
        subtitle="วางแผนจำนวนคนที่ต้องการ แยกตามวันที่ กะ และแผนก แล้วเพิ่มพนักงานให้ครบตามแพลน"
      />

      <div className="flex-1 overflow-y-auto px-8 pt-2 pb-10">
        {/* Filter & Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          {/* Left filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date filter */}
            <DateInput
              value={selectedDate}
              onChange={(val) => setSelectedDate(val)}
              clearable={true}
              placeholder="วว/ดด/ปปปป"
              title="กรองตามวันที่ (วัน/เดือน/ปี)"
            />

            {/* Warehouse filter */}
            <WarehouseSelect
              value={selectedWarehouse}
              onChange={(val) => setSelectedWarehouse(val)}
              warehouses={warehouses}
              allLabel="ทุกคลัง"
            />

            {/* Department search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-[#9AA5B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาแผนก"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm"
              />
            </div>

            {/* Clear filters button if active */}
            {(selectedDate || selectedWarehouse !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedDate('')
                  setSelectedWarehouse('all')
                  setSearchTerm('')
                }}
                className="text-xs text-[#5B6B85] hover:text-[#E5484D] underline font-medium px-2 py-1"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* Right Summary Stats & Create Button */}
          <div className="flex items-center gap-4 self-end lg:self-auto">
            <div className="text-xs text-[#5B6B85] font-medium hidden sm:block">
              ทั้งหมด <span className="font-bold text-[#16233D]">{stats.total_plans}</span> แพลน · ครบแล้ว{' '}
              <span className="font-bold text-[#2E9E5B]">{stats.completed_plans}</span> · ยังขาดรวม{' '}
              <span className="font-bold text-[#E5484D]">{stats.total_missing}</span> คน
            </div>

            <Link
              href="/planning/new"
              className="bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              สร้างแพลนใหม่
            </Link>
          </div>
        </div>

        {/* Feedback Toast Banner */}
        {feedbackMsg && (
          <div
            className={`mb-5 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in ${
              feedbackMsg.type === 'success'
                ? 'bg-[#E7F6ED] border-[#2E9E5B] text-[#2E9E5B]'
                : 'bg-[#FCE8E8] border-[#F87171] text-[#E5484D]'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#E1E6EF] p-5 shadow-sm animate-pulse h-48 flex flex-col justify-between"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 w-6 bg-gray-200 rounded"></div>
                </div>
                <div>
                  <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                  <div className="h-2 bg-gray-200 rounded w-full mt-4"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-[#E1E6EF] p-12 text-center max-w-lg mx-auto mt-10 shadow-sm">
            <div className="w-14 h-14 bg-[#EEF3FC] rounded-full flex items-center justify-center mx-auto text-[#2E6FE0] mb-4">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#16233D]">ยังไม่มีรายการแพลนพนักงาน</h3>
            <p className="text-xs text-[#5B6B85] mt-1.5 max-w-sm mx-auto">
              ยังไม่มีแพลนที่ตรงกับเงื่อนไขที่เลือก คุณสามารถกดปุ่มสร้างแพลนใหม่เพื่อเริ่มวางแผนจำนวนคนในแต่ละกะ
            </p>
            <div className="mt-6">
              <Link
                href="/planning/new"
                className="inline-flex items-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                สร้างแพลนใหม่
              </Link>
            </div>
          </div>
        ) : (
          /* Grid of Plan Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plans.map((p) => {
              const current = p.current_count || 0
              const required = p.required_count || 0
              const isFull = current >= required && required > 0
              const isZero = current === 0
              const missing = Math.max(0, required - current)
              const percent = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0

              // Color configuration
              let progressColor = 'bg-[#2E6FE0]' // partial: blue
              if (isFull) progressColor = 'bg-[#2E9E5B]' // full: green
              else if (isZero) progressColor = 'bg-[#E5484D]' // 0: red
              else if (percent <= 35) progressColor = 'bg-[#E5484D]' // low: red

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-[#E1E6EF] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Card Header: Date & Actions (Edit + Delete) */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#5B6B85]">
                        {formatThaiDate(p.date)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingPlan(p)}
                          title="แก้ไขแผนก / กะ / รายละเอียดแพลน"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5B6B85] hover:text-[#2E6FE0] hover:bg-[#EEF3FC] border border-transparent hover:border-[#E1E6EF] transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPlanToDelete(p)}
                          disabled={deletingPlanId === p.id}
                          title="ลบแพลนนี้"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9AA5B8] hover:text-[#E5484D] hover:bg-[#FCE8E8] border border-transparent hover:border-[#F87171]/40 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {deletingPlanId === p.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E5484D]" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Department Title */}
                    <h3 className="text-base font-bold text-[#16233D] mt-2 tracking-tight line-clamp-1">
                      {p.department_name}
                    </h3>

                    {/* Warehouse & Shift Subtitle */}
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#5B6B85]">
                      <span className="font-semibold text-[#16233D]">{p.warehouse}</span>
                      {p.shift_start && p.shift_end && (
                        <>
                          <span>·</span>
                          <span className="text-[11px]">
                            {p.shift_start}–{p.shift_end} ({p.shift_type === 'N' ? 'Night' : p.shift_type === 'H' ? 'Half' : 'Day'})
                          </span>
                        </>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-[#E1E6EF] rounded-full overflow-hidden mt-4">
                      <div
                        className={`h-full ${progressColor} transition-all duration-300 rounded-full`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Count & Status Badge */}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs font-bold text-[#16233D]">
                        {current} / {required} คน
                      </span>

                      {isFull ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-[#2E9E5B] bg-[#E7F6ED] px-2 py-0.5 rounded-full">
                          ครบแล้ว
                        </span>
                      ) : isZero ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-[#E5484D] bg-[#FCE8E8] px-2 py-0.5 rounded-full">
                          ยังไม่มีคนเลย
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-semibold text-[#B45F17] bg-[#FEF3E2] px-2 py-0.5 rounded-full">
                          ขาด {missing}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="mt-5">
                    {isFull ? (
                      <Link
                        href={`/planning/${p.id}`}
                        className="w-full block text-center py-2 px-3 rounded-xl text-xs font-semibold border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#F4F6FA] hover:text-[#16233D] transition-colors"
                      >
                        ดูรายละเอียดหน้ารายชื่อ ({current} คน)
                      </Link>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/planning/${p.id}`}
                          title="ดูรายละเอียดหน้ารายชื่อแพลน"
                          className="w-full block text-center py-2 px-2 rounded-xl text-xs font-semibold border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#F4F6FA] hover:text-[#16233D] transition-colors"
                        >
                          ดูรายละเอียด
                        </Link>
                        <Link
                          href={`/planning/${p.id}/add`}
                          title="เพิ่มพนักงานเข้าแพลน"
                          className={`w-full block text-center py-2 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                            isZero
                              ? 'border-[#F87171] bg-white text-[#E5484D] hover:bg-[#FCE8E8]'
                              : 'border-[#2E6FE0] bg-white text-[#2E6FE0] hover:bg-[#EEF3FC]'
                          }`}
                        >
                          {isZero ? '+ เพิ่มด่วน' : '+ เพิ่มพนักงาน'}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Plan Modal */}
      <EditPlanModal
        isOpen={Boolean(editingPlan)}
        onClose={() => setEditingPlan(null)}
        plan={editingPlan}
        onUpdated={handlePlanUpdated}
      />

      {/* Delete Plan Confirmation Modal (Mockup 2) */}
      <DeletePlanModal
        isOpen={Boolean(planToDelete)}
        plan={planToDelete}
        onClose={() => setPlanToDelete(null)}
        onConfirm={handleConfirmDeletePlan}
        loading={Boolean(deletingPlanId)}
      />
    </>
  )
}
