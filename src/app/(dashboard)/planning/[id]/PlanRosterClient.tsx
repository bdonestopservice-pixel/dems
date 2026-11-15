'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  X,
  FileDown,
  ArrowRight,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
  Users,
  Pencil,
  Trash2,
  Ban,
} from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { cn, formatThaiDate } from '@/lib/utils'
import { useSidebar } from '@/components/layout/SidebarContext'
import { exportPlanAttendanceSheet } from '@/lib/export-plan-pdf'
import { EditPlanModal } from '@/components/planning/EditPlanModal'
import { DeletePlanModal } from '@/components/planning/DeletePlanModal'
import { RemoveEmployeeFromPlanModal, type EmployeeToRemove } from '@/components/planning/RemoveEmployeeFromPlanModal'
import { broadcastRealtime } from '@/lib/realtime'
import { useRealtimeListener } from '@/components/providers/RealtimeProvider'
import type { AuthSession, Plan, PlanEmployee } from '@/types'

interface PlanRosterClientProps {
  session: AuthSession
  planId: string
}

export function PlanRosterClient({ session, planId }: PlanRosterClientProps) {
  const router = useRouter()
  const { isCollapsed } = useSidebar()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [roster, setRoster] = useState<PlanEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Selected for sending to Namelist
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingNamelist, setSendingNamelist] = useState(false)
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeletePlanOpen, setIsDeletePlanOpen] = useState(false)
  const [deletingPlan, setDeletingPlan] = useState(false)
  const [employeeToRemove, setEmployeeToRemove] = useState<EmployeeToRemove | null>(null)

  const handlePlanUpdated = (updatedPlan: any) => {
    setPlan((prev) => (prev ? { ...prev, ...updatedPlan } : updatedPlan))
    setSuccessMsg('แก้ไขข้อมูลแผนก กะ และรายละเอียดแพลนสำเร็จแล้ว')
    setTimeout(() => setSuccessMsg(null), 3500)
    broadcastRealtime('plan-updated')
  }

  // Delete Plan completely
  const handleConfirmDeletePlan = async () => {
    if (!plan) return
    setDeletingPlan(true)
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ไม่สามารถลบแพลนได้')
      }
      broadcastRealtime('plan-updated')
      setIsDeletePlanOpen(false)
      router.push('/planning')
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการลบแพลน')
      setDeletingPlan(false)
    }
  }

  // Fetch plan & roster
  const fetchPlanData = useCallback(async () => {
    try {
      const res = await fetch(`/api/plans/${planId}`)
      if (!res.ok) throw new Error('ไม่พบข้อมูลแพลนนี้')
      const data = await res.json()
      setPlan(data.plan)
      setRoster(data.plan.roster || [])
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถโหลดข้อมูลแพลนได้')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    fetchPlanData()
  }, [fetchPlanData])

  // ซิงค์ข้อมูล Realtime เมื่อมีการเปลี่ยนแปลงแพลนหรือรายชื่อพนักงาน
  useRealtimeListener(['plan-updated', 'plan-roster-updated'], () => {
    fetchPlanData()
  })

  // Select / Deselect individual employee for Namelist
  const toggleSelect = (empId: string) => {
    const targetEmp = roster.find((r) => r.employee_id === empId)
    if (targetEmp?.is_blacklisted) return

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(empId)) {
        next.delete(empId)
      } else {
        next.add(empId)
      }
      return next
    })
  }

  // Select / Deselect all eligible (not yet sent to namelist and not blacklisted)
  const handleSelectAll = () => {
    const eligibleToSend = roster
      .filter((r) => !r.sent_to_namelist && !r.is_blacklisted)
      .map((r) => r.employee_id)
    const allSelected = eligibleToSend.length > 0 && eligibleToSend.every((id) => selectedIds.has(id))

    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(eligibleToSend))
    }
  };

  // Confirm remove employee from roster
  const handleConfirmRemoveEmployee = async () => {
    if (!employeeToRemove) return
    const empId = employeeToRemove.employee_id
    const fullName = employeeToRemove.fullName

    setDeletingEmpId(empId)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/plans/${planId}/roster?employee_id=${empId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ลบพนักงานไม่สำเร็จ')
      }

      // Remove from selected if was selected
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(empId)
        return next
      })

      // Refresh roster data
      await fetchPlanData()
      broadcastRealtime('plan-roster-updated')
      broadcastRealtime('plan-updated')
      setSuccessMsg(`นำ ${fullName} ออกจากแพลนเรียบร้อยแล้ว`)
      setTimeout(() => setSuccessMsg(null), 3500)
      setEmployeeToRemove(null)
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการนำพนักงานออก')
    } finally {
      setDeletingEmpId(null)
    }
  }

  // Send selected employees to Namelist
  const handleSendNamelist = async () => {
    if (selectedIds.size === 0) return

    const hasBlacklisted = Array.from(selectedIds).some((id) => {
      const targetEmp = roster.find((r) => r.employee_id === id)
      return targetEmp?.is_blacklisted
    })
    if (hasBlacklisted) {
      setErrorMsg('มีพนักงานที่ติดสถานะแบล็กลิสต์อยู่ในรายการที่เลือก ไม่สามารถส่งเข้า Namelist ได้')
      return
    }

    setSendingNamelist(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(`/api/plans/${planId}/send-namelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: Array.from(selectedIds) }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ส่งเข้า Namelist ไม่สำเร็จ')

      setSelectedIds(new Set())
      await fetchPlanData()

      broadcastRealtime('namelist-updated')
      broadcastRealtime('plan-roster-updated')

      const inserted = data.inserted_count || 0
      const existed = data.already_in_namelist_count || 0
      if (existed > 0 && inserted > 0) {
        setSuccessMsg(
          `ส่งรายชื่อเข้า Namelist สำเร็จ ${inserted} คน (พบมีชื่ออยู่แล้ว ${existed} คน จึงอัปเดตสถานะให้โดยไม่สร้างซ้ำ)`
        )
      } else if (existed > 0 && inserted === 0) {
        setSuccessMsg(`พนักงานทั้ง ${existed} คนมีชื่อใน Namelist ของวันดังกล่าวอยู่แล้ว`)
      } else {
        setSuccessMsg(`ส่งรายชื่อเข้า Namelist สำเร็จ ${inserted} คน เรียบร้อยแล้ว`)
      }
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการส่งเข้า Namelist')
    } finally {
      setSendingNamelist(false)
    }
  }

  // Export PDF Attendance Sheet
  const handleExportPDF = () => {
    if (!plan) return
    exportPlanAttendanceSheet({ plan, roster, adminName: session.name })
  }

  if (loading) {
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

  const currentCount = roster.length
  const requiredCount = plan.required_count || 0
  const isFull = currentCount >= requiredCount && requiredCount > 0
  const missingCount = Math.max(0, requiredCount - currentCount)
  const percent = requiredCount > 0 ? Math.min(100, Math.round((currentCount / requiredCount) * 100)) : 0

  const eligibleToSendCount = roster.filter((r) => !r.sent_to_namelist).length
  const isAllEligibleSelected =
    eligibleToSendCount > 0 &&
    roster.filter((r) => !r.sent_to_namelist).every((r) => selectedIds.has(r.employee_id))

  return (
    <>
      <Topbar session={session} title="จัดแพลนพนักงาน" subtitle="วางแผนจำนวนคนที่ต้องการแต่ละวัน" />

      <div className="flex-1 overflow-y-auto px-8 pb-24">
        {/* Navigation Breadcrumb */}
        <div className="mb-4">
          <Link
            href="/planning"
            className="inline-flex items-center gap-1.5 text-xs text-[#5B6B85] hover:text-[#2E6FE0] transition-colors font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            กลับไปหน้าจัดแพลนพนักงาน
          </Link>
        </div>

        {/* Page Title & Add Button */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-[#16233D] tracking-tight">รายชื่อในแพลน</h2>

          {isFull ? (
            <span
              title="แพลนนี้มีพนักงานครบตามจำนวนที่กำหนดแล้ว"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E9E5B] bg-[#E7F6ED] border border-[#A3E5BA] px-3.5 py-2 rounded-xl shadow-sm select-none"
            >
              <Check className="w-3.5 h-3.5" />
              ครบตามแพลนแล้ว ({currentCount}/{requiredCount})
            </span>
          ) : (
            <Link
              href={`/planning/${planId}/add`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E6FE0] bg-white border border-[#2E6FE0] hover:bg-[#EEF3FC] px-3.5 py-2 rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              เพิ่มพนักงานเข้าแพลน (ขาดอีก {missingCount} คน)
            </Link>
          )}
        </div>

        {/* Summary Banner matching Mockup 4 */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] px-6 py-4 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left Plan Details */}
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

              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                title="แก้ไขแผนก / กะ / จำนวนคนที่ต้องการ"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E6FE0] hover:text-[#1D4490] bg-white border border-[#E1E6EF] hover:border-[#2E6FE0] hover:bg-[#EEF3FC] px-2.5 py-1 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                แก้ไขแผนก/กะ
              </button>

              <button
                type="button"
                onClick={() => setIsDeletePlanOpen(true)}
                title="ลบแพลนนี้"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5484D] hover:text-[#DC2626] bg-white border border-[#E1E6EF] hover:border-[#F87171] hover:bg-[#FCE8E8] px-2.5 py-1 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                ลบแพลน
              </button>
            </div>

            {/* Right Progress & Status */}
            <div className="flex items-center gap-4 flex-1 max-w-md md:justify-end">
              <div className="w-48 bg-[#E1E6EF] h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isFull ? 'bg-[#2E9E5B]' : percent >= 50 ? 'bg-[#EAB308]' : 'bg-[#2E6FE0]'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <span className="text-xs font-bold text-[#16233D] whitespace-nowrap">
                {currentCount} / {requiredCount} คน
              </span>

              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                  isFull ? 'bg-[#E7F6ED] text-[#2E9E5B]' : 'bg-[#FEF3E2] text-[#B45F17]'
                }`}
              >
                {isFull ? 'ครบตามแพลนแล้ว' : `ขาด ${missingCount} คน`}
              </span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-5 p-4 rounded-xl bg-[#FCE8E8] border border-[#F87171] flex items-center gap-2.5 text-[#E5484D] text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-4 rounded-xl bg-[#E7F6ED] border border-[#2E9E5B] flex items-center gap-2.5 text-[#2E9E5B] text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Roster Table Card matching Mockup 4 */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] overflow-hidden shadow-sm">
          {roster.length === 0 ? (
            <div className="p-12 text-center text-[#5B6B85]">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-[#16233D]">ยังไม่มีพนักงานในแพลนนี้</p>
              <p className="text-xs text-[#5B6B85] mt-1">
                คุณสามารถเพิ่มพนักงานเข้าสู่แพลนเพื่อเริ่มจัดสรรกำลังพล
              </p>
              <div className="mt-4">
                <Link
                  href={`/planning/${planId}/add`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2E6FE0] hover:bg-[#2558B8] px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มพนักงานเข้าแพลน
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E1E6EF] text-xs font-bold text-[#5B6B85] bg-[#FAFBFD]">
                    <th className="py-3 px-4 w-[48px] text-center">
                      <input
                        type="checkbox"
                        checked={isAllEligibleSelected}
                        onChange={handleSelectAll}
                        title="เลือกทั้งหมดที่ยังไม่ส่ง"
                        className="w-4 h-4 rounded text-[#2E6FE0] focus:ring-[#2E6FE0] border-gray-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 w-[130px]">รหัสพนักงาน</th>
                    <th className="py-3 px-4">พนักงาน</th>
                    <th className="py-3 px-4 w-[160px]">ตำแหน่ง</th>
                    <th className="py-3 px-4 w-[140px]">เบอร์ติดต่อ</th>
                    <th className="py-3 px-4 w-[130px] text-center">สถานะ</th>
                    <th className="py-3 px-4 w-[60px] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F6FA]">
                  {roster.map((emp) => {
                    const isSelected = selectedIds.has(emp.employee_id)
                    const isSent = emp.sent_to_namelist
                    const isBlacklisted = !!emp.is_blacklisted
                    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim()

                    return (
                      <tr
                        key={emp.id}
                        className={cn(
                          'transition-colors',
                          isBlacklisted
                            ? 'bg-[#FEF2F2] text-[#B91C1C]'
                            : isSelected
                            ? 'bg-[#EEF3FC]/40'
                            : 'hover:bg-[#FAFBFD]'
                        )}
                      >
                        {/* Checkbox for Namelist */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isSent || isBlacklisted}
                            onChange={() => toggleSelect(emp.employee_id)}
                            className="w-4 h-4 rounded text-[#2E6FE0] focus:ring-[#2E6FE0] border-gray-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* PO ID */}
                        <td
                          className={cn(
                            'py-3.5 px-4 font-mono text-xs font-bold',
                            isBlacklisted ? 'text-[#E5484D]' : 'text-[#16233D]'
                          )}
                        >
                          {emp.po_id || '—'}
                        </td>

                        {/* Full Name */}
                        <td className="py-3.5 px-4 text-xs font-medium text-[#16233D]">
                          <div className="flex items-center gap-2">
                            <span className={cn(isBlacklisted && 'text-[#B91C1C] font-semibold')}>
                              {fullName}
                            </span>
                            {isBlacklisted && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E5484D] bg-[#FCE8E8] border border-[#F8D3D4] px-2 py-0.5 rounded-full whitespace-nowrap"
                                title={emp.blacklist_reason ? `เหตุผล: ${emp.blacklist_reason}` : 'ติดแบล็กลิสต์'}
                              >
                                <Ban size={10} className="stroke-[2.5]" />
                                ติดแบล็กลิสต์ (บล็อค)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Department / Position */}
                        <td className="py-3.5 px-4 text-xs text-[#5B6B85]">
                          {emp.position || plan.department_name || '—'}
                        </td>

                        {/* Phone */}
                        <td className="py-3.5 px-4 text-xs text-[#5B6B85] font-mono">
                          {emp.phone || '—'}
                        </td>

                        {/* Sent Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isBlacklisted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E5484D] bg-[#FCE8E8] border border-[#F8D3D4] px-2.5 py-0.5 rounded-full">
                              <Ban size={11} className="stroke-[2.5]" /> ถูกบล็อค
                            </span>
                          ) : isSent ? (
                            <span className="inline-flex items-center text-[11px] font-semibold text-[#2E9E5B] bg-[#E7F6ED] px-2.5 py-0.5 rounded-full">
                              ✓ ส่งแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-medium text-[#5B6B85] bg-[#F4F6FA] px-2 py-0.5 rounded-full">
                              ยังไม่ส่ง
                            </span>
                          )}
                        </td>

                        {/* Delete from roster action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setEmployeeToRemove({
                                employee_id: emp.employee_id,
                                fullName,
                                po_id: emp.po_id,
                              })
                            }
                            disabled={deletingEmpId === emp.employee_id}
                            title="นำออกจากแพลนนี้"
                            className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[#9AA5B8] hover:text-[#E5484D] hover:bg-[#FCE8E8] transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            {deletingEmpId === emp.employee_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E5484D]" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
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

      {/* Fixed Bottom Action Bar matching Mockup 4 */}
      <div
        className={cn(
          'fixed bottom-0 right-0 bg-white border-t border-[#E1E6EF] px-8 py-3.5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 z-20 transition-all duration-300 ease-in-out',
          isCollapsed ? 'left-16' : 'left-72'
        )}
      >
        <div>
          <div className="text-xs font-bold text-[#16233D]">
            เลือกแล้ว <span className="text-[#2E6FE0]">{selectedIds.size}</span> จาก{' '}
            <span>{currentCount}</span> คน
          </div>
          <p className="text-[11px] text-[#5B6B85] mt-0.5">
            ติ๊กเฉพาะคนที่มาทำงานจริง แล้วส่งเข้า Namelist ได้เลย ไม่ต้องคีย์ซ้ำ
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5484D] bg-white border border-[#E1E6EF] hover:border-[#E5484D] hover:bg-[#FCE8E8]/30 px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>

          {/* Send to Namelist Button */}
          <button
            type="button"
            onClick={handleSendNamelist}
            disabled={selectedIds.size === 0 || sendingNamelist}
            className="inline-flex items-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sendingNamelist ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            ส่งเข้า Namelist
          </button>
        </div>
      </div>

      {/* Edit Plan Modal */}
      <EditPlanModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        plan={plan}
        onUpdated={handlePlanUpdated}
      />

      {/* Delete Plan Modal (Mockup 2) */}
      <DeletePlanModal
        isOpen={isDeletePlanOpen}
        plan={
          plan
            ? {
                id: plan.id,
                department_name: plan.department_name,
                warehouse: plan.warehouse,
                date: plan.date,
                current_count: currentCount,
              }
            : null
        }
        onClose={() => setIsDeletePlanOpen(false)}
        onConfirm={handleConfirmDeletePlan}
        loading={deletingPlan}
      />

      {/* Remove Employee From Plan Modal */}
      <RemoveEmployeeFromPlanModal
        isOpen={Boolean(employeeToRemove)}
        employee={employeeToRemove}
        onClose={() => setEmployeeToRemove(null)}
        onConfirm={handleConfirmRemoveEmployee}
        loading={Boolean(deletingEmpId)}
      />
    </>
  )
}
