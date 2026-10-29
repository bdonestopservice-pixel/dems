'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Check, AlertCircle } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { todayLocal } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import type { AuthSession, Warehouse, Shift, Department } from '@/types'

interface CreatePlanClientProps {
  session: AuthSession
}

interface PlanRow {
  id: string // local unique ID for key tracking
  date: string
  warehouse: string
  shift_id: string
  department_id: string
  required_count: number | ''
}

export function CreatePlanClient({ session }: CreatePlanClientProps) {
  const router = useRouter()
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  const todayStr = todayLocal()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  // Cache shifts and departments by warehouse ID
  const [shiftsCache, setShiftsCache] = useState<Record<string, Shift[]>>({})
  const [departmentsCache, setDepartmentsCache] = useState<Record<string, Department[]>>({})

  const [rows, setRows] = useState<PlanRow[]>([
    {
      id: 'row-1',
      date: todayStr,
      warehouse: userWarehouses[0] || '',
      shift_id: '',
      department_id: '',
      required_count: '',
    },
  ])

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [invalidRowIds, setInvalidRowIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // 1. Load warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) return
        const data = await res.json()
        const all: Warehouse[] = data.warehouses || []
        const permitted = isSuperAdmin ? all : all.filter((w) => userWarehouses.includes(w.id))
        setWarehouses(permitted)

        // Set default warehouse for row 1 if empty
        if (permitted.length > 0) {
          setRows((prev) =>
            prev.map((r, i) => (i === 0 && !r.warehouse ? { ...r, warehouse: permitted[0].id } : r))
          )
        }
      } catch (err) {
        console.error('Failed to load warehouses:', err)
      }
    }
    loadWarehouses()
  }, [isSuperAdmin, userWarehouses])

  // Helper to load shifts & departments for a warehouse if not yet cached
  const ensureWarehouseData = async (whId: string) => {
    if (!whId) return

    if (!shiftsCache[whId]) {
      try {
        const res = await fetch(`/api/dropdown/shifts?warehouse=${whId}`)
        if (res.ok) {
          const data = await res.json()
          setShiftsCache((prev) => ({ ...prev, [whId]: data.shifts || [] }))
        }
      } catch (err) {
        console.error(err)
      }
    }

    if (!departmentsCache[whId]) {
      try {
        const res = await fetch(`/api/dropdown/departments?warehouse=${whId}`)
        if (res.ok) {
          const data = await res.json()
          setDepartmentsCache((prev) => ({ ...prev, [whId]: data.departments || [] }))
        }
      } catch (err) {
        console.error(err)
      }
    }
  }

  // Load shifts & departments for active warehouses in rows
  useEffect(() => {
    rows.forEach((r) => {
      if (r.warehouse) {
        ensureWarehouseData(r.warehouse)
      }
    })
  }, [rows])

  // Add new row
  const addRow = () => {
    const lastRow = rows[rows.length - 1]
    const newRow: PlanRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: lastRow ? lastRow.date : todayStr,
      warehouse: lastRow ? lastRow.warehouse : (warehouses[0]?.id || ''),
      shift_id: '',
      department_id: '',
      required_count: '',
    }
    setRows([...rows, newRow])
  }

  // Remove row
  const removeRow = (rowId: string) => {
    if (rows.length <= 1) return
    setRows(rows.filter((r) => r.id !== rowId))
    setInvalidRowIds((prev) => {
      const updated = new Set(prev)
      updated.delete(rowId)
      return updated
    })
  }

  // Update row field
  const updateRow = (rowId: string, field: keyof PlanRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const updated = { ...r, [field]: value }
        // If warehouse changes, reset shift_id and department_id for that row
        if (field === 'warehouse') {
          updated.shift_id = ''
          updated.department_id = ''
          ensureWarehouseData(value)
        }
        return updated
      })
    )

    // Clear invalid flag for this row if being edited
    if (invalidRowIds.has(rowId)) {
      setInvalidRowIds((prev) => {
        const next = new Set(prev)
        next.delete(rowId)
        return next
      })
    }
  }

  // Submit all plans
  const handleSubmit = async () => {
    setErrorMsg(null)
    const newInvalidRows = new Set<string>()

    // Validation
    rows.forEach((r) => {
      if (
        !r.date ||
        !r.warehouse ||
        !r.shift_id ||
        !r.department_id ||
        !r.required_count ||
        Number(r.required_count) <= 0
      ) {
        newInvalidRows.add(r.id)
      }
    })

    if (newInvalidRows.size > 0) {
      setInvalidRowIds(newInvalidRows)
      setErrorMsg('กรุณากรอกข้อมูล วันที่, คลัง, กะ, แผนก และจำนวนคนที่ต้องการ ให้ครบถ้วนทุกแถว')
      return
    }

    setSubmitting(true)
    try {
      const payload = rows.map((r) => ({
        date: r.date,
        warehouse: r.warehouse,
        shift_id: r.shift_id,
        department_id: r.department_id,
        required_count: Number(r.required_count),
      }))

      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plans: payload }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการสร้างแพลน')
      }

      // Success -> navigate to planning overview
      router.push('/planning')
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสร้างแพลน')
      setSubmitting(false)
    }
  }

  return (
    <>
      <Topbar session={session} title="จัดแพลนพนักงาน" subtitle="วางแผนจำนวนคนที่ต้องการแต่ละวัน" />

      <div className="flex-1 overflow-y-auto px-8 pb-12">
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

        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#16233D] tracking-tight">สร้างแพลนใหม่</h2>
          <p className="text-xs text-[#5B6B85] mt-1">
            เพิ่มได้หลายแพลนพร้อมกัน ระบุวันที่ กะ แผนก และจำนวนคนที่ต้องการต่อแพลน
          </p>
        </div>

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="mb-5 p-4 rounded-xl bg-[#FCE8E8] border border-[#F87171] flex items-center gap-2.5 text-[#E5484D] text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Plan Table Card */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E1E6EF] text-xs font-bold text-[#5B6B85]">
                  <th className="pb-3.5 font-bold w-[180px]">วันที่</th>
                  <th className="pb-3.5 font-bold w-[190px]">คลัง/สาขา</th>
                  <th className="pb-3.5 font-bold w-[220px]">กะ</th>
                  <th className="pb-3.5 font-bold w-[220px]">แผนก</th>
                  <th className="pb-3.5 font-bold w-[140px]">จำนวนที่ต้องการ</th>
                  <th className="pb-3.5 font-bold w-[60px] text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F6FA]">
                {rows.map((r, index) => {
                  const isInvalid = invalidRowIds.has(r.id)
                  const availableShifts = shiftsCache[r.warehouse] || []
                  const availableDepts = departmentsCache[r.warehouse] || []

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-[#FAFBFD] transition-colors ${
                        isInvalid ? 'bg-red-50/40' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 pr-3">
                        <DateInput
                          value={r.date}
                          onChange={(val) => updateRow(r.id, 'date', val)}
                          className={`w-full ${
                            isInvalid && !r.date ? 'border-[#E5484D]' : ''
                          }`}
                        />
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 pr-3">
                        <select
                          value={r.warehouse}
                          onChange={(e) => updateRow(r.id, 'warehouse', e.target.value)}
                          className={`w-full bg-white border ${
                            isInvalid && !r.warehouse ? 'border-[#E5484D]' : 'border-[#E1E6EF]'
                          } text-[#16233D] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm`}
                        >
                          <option value="">เลือกคลัง...</option>
                          {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>
                              {wh.id}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Shift */}
                      <td className="py-3 pr-3">
                        <select
                          value={r.shift_id}
                          disabled={!r.warehouse}
                          onChange={(e) => updateRow(r.id, 'shift_id', e.target.value)}
                          className={`w-full bg-white border ${
                            isInvalid && !r.shift_id ? 'border-[#E5484D]' : 'border-[#E1E6EF]'
                          } text-[#16233D] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm disabled:bg-gray-50 disabled:text-gray-400`}
                        >
                          <option value="">
                            {!r.warehouse ? 'กรุณาเลือกคลังก่อน' : 'เลือกกะ...'}
                          </option>
                          {availableShifts.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.start_time}–{s.end_time} · {s.type === 'N' ? 'Night' : s.type === 'H' ? 'Half' : 'Day'}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Department */}
                      <td className="py-3 pr-3">
                        <select
                          value={r.department_id}
                          disabled={!r.warehouse}
                          onChange={(e) => updateRow(r.id, 'department_id', e.target.value)}
                          className={`w-full bg-white border ${
                            isInvalid && !r.department_id ? 'border-[#E5484D]' : 'border-[#E1E6EF]'
                          } text-[#16233D] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm disabled:bg-gray-50 disabled:text-gray-400`}
                        >
                          <option value="">
                            {!r.warehouse ? 'กรุณาเลือกคลังก่อน' : 'เลือกแผนก...'}
                          </option>
                          {availableDepts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Required Count */}
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          min="1"
                          placeholder="จำนวน"
                          value={r.required_count}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1)
                            updateRow(r.id, 'required_count', val)
                          }}
                          className={`w-full bg-white border ${
                            isInvalid && (!r.required_count || Number(r.required_count) <= 0)
                              ? 'border-[#E5484D]'
                              : 'border-[#E1E6EF]'
                          } text-[#16233D] text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm`}
                        />
                      </td>

                      {/* Remove Row Button */}
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(r.id)}
                          disabled={rows.length <= 1}
                          title="ลบแถวนี้"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9AA5B8] hover:text-[#E5484D] hover:bg-[#FCE8E8] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#9AA5B8]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E6FE0] bg-white border border-[#E1E6EF] hover:border-[#2E6FE0] hover:bg-[#EEF3FC] px-4 py-2.5 rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              เพิ่มแพลนอีกแถว
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Link
            href="/planning"
            className="text-xs font-semibold text-[#5B6B85] hover:text-[#16233D] bg-white border border-[#E1E6EF] hover:bg-gray-50 px-5 py-2.5 rounded-xl transition-all shadow-sm"
          >
            ยกเลิก
          </Link>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {submitting
              ? 'กำลังบันทึก...'
              : `สร้างแพลนทั้งหมด (${rows.length} แพลน)`}
          </button>
        </div>
      </div>
    </>
  )
}
