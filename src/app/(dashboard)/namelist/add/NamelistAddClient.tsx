'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Plus, Loader2, AlertCircle, Users } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import type { AuthSession, Warehouse, Department, Shift } from '@/types'

interface NamelistAddClientProps {
  session: AuthSession
  initialDate: string
  initialWarehouse?: string
}

interface EmployeeRow {
  id: string
  po_id: string
  prefix?: string
  first_name: string
  last_name: string
  warehouse: string
  id_card?: string
  phone?: string
}

const fieldCls =
  'bg-white border border-[#E1E6EF] text-[#16233D] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] shadow-sm cursor-pointer'

export function NamelistAddClient({ session, initialDate, initialWarehouse }: NamelistAddClientProps) {
  const router = useRouter()
  const isSuperAdmin = session.role === 'super_admin'
  const userWarehouses = session.warehouses || []

  // ค่าที่จะใช้กับพนักงานทุกคนที่เลือก
  const [date, setDate] = useState(initialDate)
  const [nlWarehouse, setNlWarehouse] = useState<string>(
    initialWarehouse && initialWarehouse !== 'all' ? initialWarehouse : userWarehouses[0] || ''
  )
  const [departmentId, setDepartmentId] = useState('')
  const [shiftId, setShiftId] = useState('')

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])

  // ค้นหา/กรองพนักงาน: เริ่มต้นเป็น "ทุกคลัง" ('all') ตลอด
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [empWarehouse, setEmpWarehouse] = useState<string>('all')
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [total, setTotal] = useState(0)

  // การเลือก/หมายเหตุ เก็บแยกจากรายการที่แสดง → ค้นหา/กรองแล้วคนที่ติ๊กไว้ไม่หาย
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [existingEntries, setExistingEntries] = useState<{ employee_id: string; shift_id: string | null }[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [warnMsg, setWarnMsg] = useState<string | null>(null)

  const empSeq = useRef(0)

  // คลังที่มีสิทธิ์
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) return
        const data = await res.json()
        const all: Warehouse[] = data.warehouses || []
        const permitted = isSuperAdmin ? all : all.filter((w) => userWarehouses.includes(w.id))
        setWarehouses(permitted)
        if (!nlWarehouse && permitted.length > 0) {
          setNlWarehouse(permitted[0].id)
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  // แผนก/กะ ตามคลัง (ดึงจาก "จัดการข้อมูล Dropdown")
  useEffect(() => {
    setDepartmentId('')
    setShiftId('')
    setDepartments([])
    setShifts([])
    if (!nlWarehouse) return
    let cancelled = false
    async function load() {
      try {
        const [d, s] = await Promise.all([
          fetch(`/api/dropdown/departments?warehouse=${encodeURIComponent(nlWarehouse)}`),
          fetch(`/api/dropdown/shifts?warehouse=${encodeURIComponent(nlWarehouse)}`),
        ])
        if (cancelled) return
        if (d.ok) setDepartments((await d.json()).departments || [])
        if (s.ok) setShifts((await s.json()).shifts || [])
      } catch (err) {
        console.error(err)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [nlWarehouse])


  // รายการที่อยู่ใน Namelist ของวันนั้นแล้ว (ทุกคลัง) → ใช้ร่วมกับกะที่เลือกเพื่อกันซ้ำ
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/namelist/existing?date=${date}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setExistingEntries(data.entries || [])
      } catch (err) {
        console.error(err)
      }
    }
    if (date) load()
    return () => {
      cancelled = true
    }
  }, [date])

  // วันที่ + กะ เดียวกัน ห้ามซ้ำ / ต่างกะเพิ่มซ้ำได้ → ยังไม่เลือกกะ = ยังไม่มีใครถูกล็อก
  const existingIds = useMemo(
    () =>
      new Set<string>(
        shiftId ? existingEntries.filter((e) => e.shift_id === shiftId).map((e) => e.employee_id) : []
      ),
    [existingEntries, shiftId]
  )

  // ถ้าคนที่เคยติ๊กไว้มีใน Namelist ของวัน+กะที่เลือกแล้ว ให้ยกเลิกการเลือก
  useEffect(() => {
    if (existingIds.size === 0) return
    setSelected((prev) => {
      const next = new Set(Array.from(prev).filter((id) => !existingIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [existingIds])

  // debounce ค้นหา
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // โหลดพนักงานจากฐานข้อมูลพนักงาน (เฉพาะ Active)
  useEffect(() => {
    const seq = ++empSeq.current
    async function load() {
      setLoadingEmployees(true)
      try {
        const params = new URLSearchParams({ status: 'active', limit: '100' })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (empWarehouse && empWarehouse !== 'all') params.set('warehouse', empWarehouse)
        const res = await fetch(`/api/employees?${params.toString()}`)
        const data = await res.json()
        if (seq !== empSeq.current) return
        if (!res.ok) throw new Error(data.error || 'โหลดรายชื่อพนักงานไม่สำเร็จ')
        setEmployees(data.employees || [])
        setTotal(data.total ?? (data.employees || []).length)
      } catch (err) {
        if (seq === empSeq.current) {
          console.error(err)
          setEmployees([])
        }
      } finally {
        if (seq === empSeq.current) setLoadingEmployees(false)
      }
    }
    load()
  }, [debouncedSearch, empWarehouse])

  const toggle = (id: string) => {
    if (existingIds.has(id)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableVisible = useMemo(
    () => employees.filter((e) => !existingIds.has(e.id)),
    [employees, existingIds]
  )
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((e) => selected.has(e.id))

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) selectableVisible.forEach((e) => next.delete(e.id))
      else selectableVisible.forEach((e) => next.add(e.id))
      return next
    })
  }

  const canSubmit = selected.size > 0 && !!departmentId && !!shiftId && !!date && !submitting

  const handleSubmit = async () => {
    setErrorMsg(null)
    setWarnMsg(null)
    if (!departmentId) return setErrorMsg('กรุณาเลือกแผนก')
    if (!shiftId) return setErrorMsg('กรุณาเลือกกะ')
    if (selected.size === 0) return setErrorMsg('กรุณาเลือกพนักงานอย่างน้อย 1 คน')

    setSubmitting(true)
    try {
      const res = await fetch('/api/namelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          department_id: departmentId,
          shift_id: shiftId,
          employees: Array.from(selected).map((id) => ({ employee_id: id, note: notes[id] || '' })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.duplicates)) {
          setExistingEntries((prev) => [
            ...prev,
            ...data.duplicates.map((id: string) => ({ employee_id: id, shift_id: shiftId })),
          ])
          setSelected(new Set())
        }
        throw new Error(data.error || 'เพิ่มเข้า Namelist ไม่สำเร็จ')
      }
      router.push(`/namelist?date=${date}&warehouse=${encodeURIComponent(nlWarehouse || 'all')}`)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'เพิ่มเข้า Namelist ไม่สำเร็จ')
      setSubmitting(false)
    }
  }

  const backHref = `/namelist?date=${date}&warehouse=${encodeURIComponent(nlWarehouse || 'all')}`

  return (
    <>
      <Topbar session={session} title="Namelist (Add)" subtitle="เพิ่มพนักงานเข้า Namelist ด้วยตนเอง" />

      <div className="flex-1 overflow-y-auto px-8 pb-10">
        <div className="mb-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-[#5B6B85] hover:text-[#2E6FE0] transition-colors font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            กลับไปหน้า Namelist
          </Link>
        </div>

        {/* ค่าที่ใช้กับพนักงานทุกคนที่เลือก */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm px-6 py-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#5B6B85] mb-1.5">วันที่</label>
              <DateInput
                value={date}
                onChange={(val) => val && setDate(val)}
                className="w-full sm:w-auto"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#5B6B85] mb-1.5">คลัง</label>
              <select value={nlWarehouse} onChange={(e) => setNlWarehouse(e.target.value)} className={fieldCls}>
                {warehouses.length === 0 && nlWarehouse && <option value={nlWarehouse}>{nlWarehouse}</option>}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#5B6B85] mb-1.5">
                แผนก <span className="text-[#E5484D]">*</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={`${fieldCls} min-w-[180px]`}
              >
                <option value="">เลือกแผนก</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#5B6B85] mb-1.5">
                กะ <span className="text-[#E5484D]">*</span>
              </label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className={`${fieldCls} min-w-[170px]`}
              >
                <option value="">เลือกกะ</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatShiftRange(s.start_time, s.end_time)} · {s.type === 'N' ? 'Night' : s.type === 'H' ? 'Half' : 'Day'}
                  </option>
                ))}
              </select>
            </div>
            <p className="lg:ml-auto text-[11px] text-[#5B6B85] lg:text-right max-w-[220px]">
              ตั้งค่านี้จะใช้กับพนักงานที่เลือกเพิ่มด้านล่างทั้งหมด
            </p>
          </div>
        </div>

        {(errorMsg || warnMsg) && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#FCE8E8] border border-[#F87171] flex items-center gap-2.5 text-[#E5484D] text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg || warnMsg}</span>
          </div>
        )}

        {/* รายชื่อพนักงาน */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm overflow-hidden">
          <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-[#F4F6FA]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9AA5B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาชื่อหรือรหัสพนักงาน (PO) ที่จะเพิ่มเข้า Namelist"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] focus:bg-white"
              />
            </div>
            <div className="w-full sm:w-auto">
              <WarehouseSelect
                value={empWarehouse}
                onChange={(val) => setEmpWarehouse(val)}
                warehouses={warehouses}
                allLabel="ทุกคลัง"
                className="py-2"
              />
            </div>
          </div>

          {selectableVisible.length > 0 && (
            <div className="px-6 py-2.5 bg-[#FAFBFD] border-b border-[#E1E6EF] flex items-center justify-between text-xs text-[#5B6B85]">
              <label className="flex items-center gap-2.5 font-bold text-[#5B6B85] text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="rounded border-[#C6DCFD] text-[#2E6FE0] focus:ring-[#2E6FE0] w-4 h-4 cursor-pointer"
                />
                <span>เลือกทั้งหมดที่แสดง ({selectableVisible.length} คน)</span>
              </label>
              <div className="text-xs text-[#5B6B85]">
                แสดง {employees.length} จาก {total.toLocaleString('th-TH')} คน
                {selected.size > 0 && (
                  <span className="ml-2 font-bold text-[#2E6FE0]">
                    · เลือกแล้ว {selected.size} คน
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            {loadingEmployees ? (
              <div className="p-12 text-center">
                <Loader2 className="w-6 h-6 text-[#2E6FE0] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#5B6B85]">กำลังโหลดรายชื่อพนักงาน...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-12 text-center text-[#5B6B85]">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-semibold text-[#16233D]">ไม่พบพนักงานที่ตรงกับเงื่อนไข</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs min-w-[880px]">
                <thead>
                  <tr className="border-b border-[#E1E6EF] bg-[#F8FAFC] sticky top-0 z-10 text-[11px] font-semibold text-[#5B6B85]">
                    <th className="w-12 px-4 py-3 text-center" />
                    <th className="px-4 py-3 font-semibold text-[#5B6B85] whitespace-nowrap">รหัสพนักงาน</th>
                    <th className="px-4 py-3 font-semibold text-[#5B6B85] whitespace-nowrap">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3 font-semibold text-[#5B6B85] whitespace-nowrap">คลัง/สาขา</th>
                    <th className="px-4 py-3 font-semibold text-[#5B6B85] whitespace-nowrap">เลขบัตรประชาชน</th>
                    <th className="px-4 py-3 font-semibold text-[#5B6B85] whitespace-nowrap">เบอร์โทร</th>
                    <th className="px-4 py-3 font-semibold text-[#5B6B85] whitespace-nowrap w-60">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E6EF]">
                  {employees.map((emp) => {
                    const isExisting = existingIds.has(emp.id)
                    const isSelected = selected.has(emp.id)
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => !isExisting && toggle(emp.id)}
                        className={`transition-colors select-none ${
                          isExisting
                            ? 'bg-[#F8FAFC] opacity-70 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#EEF3FC]/50 hover:bg-[#EEF3FC]/70 cursor-pointer'
                            : 'hover:bg-[#FAFBFD] cursor-pointer'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="w-12 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isExisting}
                            onChange={() => toggle(emp.id)}
                            className="rounded border-[#C6DCFD] text-[#2E6FE0] focus:ring-[#2E6FE0] w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* รหัสพนักงาน */}
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-[#16233D] whitespace-nowrap">
                          {emp.po_id || '—'}
                        </td>

                        {/* ชื่อ-นามสกุล */}
                        <td className="px-4 py-3.5 font-semibold text-[#16233D] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{employeeFullName(emp)}</span>
                            {isExisting && (
                              <span className="text-[10px] font-semibold text-[#B45F17] bg-[#FEF3E2] px-2 py-0.5 rounded-full whitespace-nowrap">
                                อยู่ใน Namelist แล้ว
                              </span>
                            )}
                          </div>
                        </td>

                        {/* คลัง/สาขา */}
                        <td className="px-4 py-3.5 text-[#5B6B85] whitespace-nowrap">
                          {emp.warehouse ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]">
                              {emp.warehouse}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* เลขบัตรประชาชน */}
                        <td className="px-4 py-3.5 font-mono text-xs text-[#5B6B85] whitespace-nowrap">
                          {emp.id_card || '—'}
                        </td>

                        {/* เบอร์โทร */}
                        <td className="px-4 py-3.5 text-xs text-[#5B6B85] whitespace-nowrap">
                          {emp.phone || '—'}
                        </td>

                        {/* หมายเหตุ */}
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            placeholder="หมายเหตุ (ถ้ามี)"
                            value={notes[emp.id] || ''}
                            disabled={isExisting}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                            className="w-full bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] disabled:bg-gray-50"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {total > employees.length && (
            <p className="px-6 py-3 text-[11px] text-[#5B6B85] text-center bg-[#FAFBFD] border-t border-[#E1E6EF]">
              แสดง {employees.length} จาก {total} คน — พิมพ์ชื่อหรือรหัสเพื่อค้นหาเพิ่มเติม
            </p>
          )}

          <div className="px-6 py-3.5 border-t border-[#E1E6EF] flex items-center justify-between">
            <div className="text-xs font-semibold text-[#2E6FE0]">เลือกแล้ว {selected.size} คน</div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 bg-[#2E6FE0] hover:bg-[#2558B8] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              เพิ่มเข้า Namelist
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
