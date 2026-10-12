'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, Plus, Loader2, AlertCircle, Users } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'
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

  // ค้นหา/กรองพนักงาน
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [empWarehouse, setEmpWarehouse] = useState<string>(nlWarehouse || 'all')
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [total, setTotal] = useState(0)

  // การเลือก/หมายเหตุ เก็บแยกจากรายการที่แสดง → ค้นหา/กรองแล้วคนที่ติ๊กไว้ไม่หาย
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set())

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
          setEmpWarehouse(permitted[0].id)
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

  // เมื่อเปลี่ยนคลังของ Namelist ให้ตัวกรองพนักงานตามไปด้วย (เปลี่ยนเป็น "ทุกคลัง" เองได้)
  useEffect(() => {
    if (nlWarehouse) setEmpWarehouse(nlWarehouse)
  }, [nlWarehouse])

  // รายชื่อที่อยู่ใน Namelist ของวันนั้นแล้ว (ทุกคลัง) → ห้ามติ๊กซ้ำ
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/namelist/existing?date=${date}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          const ids = new Set<string>(data.employee_ids || [])
          setExistingIds(ids)
          // ถ้าคนที่เคยติ๊กไว้มีใน Namelist ของวันใหม่แล้ว ให้ยกเลิกการเลือก
          setSelected((prev) => new Set(Array.from(prev).filter((id) => !ids.has(id))))
        }
      } catch (err) {
        console.error(err)
      }
    }
    if (date) load()
    return () => {
      cancelled = true
    }
  }, [date])

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
          setExistingIds((prev) => new Set([...Array.from(prev), ...data.duplicates]))
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
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className={fieldCls}
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
              <label className="block text-[11px] font-bold text-[#5B6B85] mb-1.5">แผนก</label>
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
              <label className="block text-[11px] font-bold text-[#5B6B85] mb-1.5">กะ</label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className={`${fieldCls} min-w-[170px]`}
              >
                <option value="">เลือกกะ</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatShiftRange(s.start_time, s.end_time)} · {s.type === 'N' ? 'Night' : 'Day'}
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
            <select value={empWarehouse} onChange={(e) => setEmpWarehouse(e.target.value)} className={fieldCls}>
              <option value="all">ทุกคลัง</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
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
              <div className="divide-y divide-[#F4F6FA]">
                {selectableVisible.length > 0 && (
                  <label className="flex items-center gap-4 px-6 py-2.5 bg-[#FAFBFD] text-[11px] font-bold text-[#5B6B85] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="w-4 h-4 rounded text-[#2E6FE0] border-gray-300 cursor-pointer"
                    />
                    เลือกทั้งหมดที่แสดง ({selectableVisible.length} คน)
                  </label>
                )}
                {employees.map((emp) => {
                  const isExisting = existingIds.has(emp.id)
                  const isSelected = selected.has(emp.id)
                  return (
                    <div
                      key={emp.id}
                      className={`flex items-center gap-4 px-6 py-3 transition-colors ${
                        isExisting ? 'bg-[#F8FAFC] opacity-70' : isSelected ? 'bg-[#EEF3FC]/60' : 'hover:bg-[#FAFBFD]'
                      }`}
                    >
                      <label className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isExisting}
                          onChange={() => toggle(emp.id)}
                          className="w-4 h-4 rounded text-[#2E6FE0] border-gray-300 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="font-mono text-xs font-bold text-[#16233D] min-w-[90px]">
                          {emp.po_id || '—'}
                        </span>
                        <span className="text-xs font-bold text-[#16233D] truncate">{employeeFullName(emp)}</span>
                        {empWarehouse === 'all' && emp.warehouse && (
                          <span className="text-[10px] font-semibold text-[#5B6B85] bg-[#F4F6FA] border border-[#E1E6EF] px-1.5 py-0.5 rounded">
                            {emp.warehouse}
                          </span>
                        )}
                        {isExisting && (
                          <span className="text-[10px] font-semibold text-[#B45F17] bg-[#FEF3E2] px-2 py-0.5 rounded-full whitespace-nowrap">
                            อยู่ใน Namelist ของวันนี้แล้ว
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="หมายเหตุ (ถ้ามี)"
                        value={notes[emp.id] || ''}
                        disabled={isExisting}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                        className="w-[180px] bg-white border border-[#E1E6EF] text-[#16233D] placeholder-[#9AA5B8] text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0] disabled:bg-gray-50"
                      />
                    </div>
                  )
                })}
                {total > employees.length && (
                  <p className="px-6 py-3 text-[11px] text-[#5B6B85] text-center bg-[#FAFBFD]">
                    แสดง {employees.length} จาก {total} คน — พิมพ์ชื่อหรือรหัสเพื่อค้นหาเพิ่มเติม
                  </p>
                )}
              </div>
            )}
          </div>

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
