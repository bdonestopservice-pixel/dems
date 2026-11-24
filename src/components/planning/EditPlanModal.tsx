'use client'

import { useState, useEffect } from 'react'
import { X, Check, Loader2, AlertCircle, Calendar, Clock, Building2, Users } from 'lucide-react'
import { DateInput } from '@/components/ui/DateInput'
import type { Plan, Department, Shift } from '@/types'

interface EditPlanModalProps {
  isOpen: boolean
  onClose: () => void
  plan: Plan | null
  onUpdated: (updatedPlan: any) => void
}

export function EditPlanModal({ isOpen, onClose, plan, onUpdated }: EditPlanModalProps) {
  const [date, setDate] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [requiredCount, setRequiredCount] = useState<number | ''>('')

  const [departments, setDepartments] = useState<Department[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loadingDropdowns, setLoadingDropdowns] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset form when plan changes or modal opens
  useEffect(() => {
    if (plan && isOpen) {
      setDate(plan.date || '')
      setDepartmentId(plan.department_id || '')
      setShiftId(plan.shift_id || '')
      setRequiredCount(plan.required_count || 1)
      setErrorMsg(null)

      // Fetch departments & shifts for this plan's warehouse
      async function loadOptions() {
        if (!plan?.warehouse) return
        setLoadingDropdowns(true)
        try {
          const [deptRes, shiftRes] = await Promise.all([
            fetch(`/api/dropdown/departments?warehouse=${plan.warehouse}`),
            fetch(`/api/dropdown/shifts?warehouse=${plan.warehouse}`),
          ])

          if (deptRes.ok) {
            const data = await deptRes.json()
            setDepartments(data.departments || [])
          }
          if (shiftRes.ok) {
            const data = await shiftRes.json()
            setShifts(data.shifts || [])
          }
        } catch (err) {
          console.error('Failed to load dropdowns:', err)
        } finally {
          setLoadingDropdowns(false)
        }
      }

      loadOptions()
    }
  }, [plan, isOpen])

  if (!isOpen || !plan) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!departmentId) {
      setErrorMsg('กรุณาเลือกแผนก')
      return
    }
    if (!shiftId) {
      setErrorMsg('กรุณาเลือกกะการทำงาน')
      return
    }
    if (!requiredCount || Number(requiredCount) <= 0) {
      setErrorMsg('จำนวนคนที่ต้องการต้องมากกว่า 0')
      return
    }
    if (Number(requiredCount) > 500) {
      setErrorMsg('จำนวนคนที่ต้องการต่อหนึ่งแพลนต้องไม่เกิน 500 คน')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          department_id: departmentId,
          shift_id: shiftId,
          required_count: Number(requiredCount),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'บันทึกการแก้ไขไม่สำเร็จ')
      }

      onUpdated(data.plan)
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E1E6EF] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E1E6EF] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#16233D]">แก้ไขข้อมูลแพลน</h3>
            <p className="text-xs text-[#5B6B85] mt-0.5">
              คลัง {plan.warehouse} · ปรับเปลี่ยนแผนก กะการทำงาน และจำนวนคนที่ต้องการ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9AA5B8] hover:text-[#16233D] hover:bg-[#F4F6FA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FCE8E8] border border-[#F87171] flex items-center gap-2 text-[#E5484D] text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-[#16233D] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5B6B85]" />
              วันที่
            </label>
            <DateInput
              value={date}
              onChange={setDate}
              required
              className="w-full"
            />
          </div>

          {/* Department (แผนก) Dropdown */}
          <div>
            <label className="block text-xs font-bold text-[#16233D] mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#5B6B85]" />
              แผนก
            </label>
            {loadingDropdowns ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse flex items-center px-3 text-xs text-gray-400">
                กำลังโหลดแผนก...
              </div>
            ) : (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer"
              >
                <option value="">เลือกแผนก...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Shift (กะการทำงาน) Dropdown */}
          <div>
            <label className="block text-xs font-bold text-[#16233D] mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5B6B85]" />
              กะการทำงาน
            </label>
            {loadingDropdowns ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse flex items-center px-3 text-xs text-gray-400">
                กำลังโหลดกะ...
              </div>
            ) : (
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                required
                className="w-full bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer"
              >
                <option value="">เลือกกะ...</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.start_time}–{s.end_time} · {s.type === 'N' ? 'กะดึก (Night)' : s.type === 'H' ? 'กะพิเศษ (Half)' : 'กะกลางวัน (Day)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Required Count */}
          <div>
            <label className="block text-xs font-bold text-[#16233D] mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#5B6B85]" />
              จำนวนคนที่ต้องการ (คน)
            </label>
            <input
              type="number"
              min="1"
              max="500"
              placeholder="สูงสุด 500"
              value={requiredCount}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                const val = e.target.value === '' ? '' : Math.min(500, Math.max(1, isNaN(parsed) ? 1 : parsed))
                setRequiredCount(val)
              }}
              required
              className="w-full bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E6EF]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs font-semibold text-[#5B6B85] hover:text-[#16233D] bg-white border border-[#E1E6EF] hover:bg-gray-50 px-4 py-2.5 rounded-xl transition-all shadow-sm"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={saving || loadingDropdowns}
              className="inline-flex items-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
