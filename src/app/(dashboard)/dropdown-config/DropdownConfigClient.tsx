'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Building2,
  Clock,
  MapPin,
  Activity,
  Landmark,
  Warehouse,
  Lock,
  ChevronDown,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthSession, Warehouse as WarehouseType } from '@/types'
import { useActiveWarehouse } from '@/lib/use-active-warehouse'
import { DepartmentPanel } from './panels/DepartmentPanel'
import { ShiftPanel } from './panels/ShiftPanel'
import { OaPanel } from './panels/OaPanel'
import { WorkStatusPanel } from './panels/WorkStatusPanel'
import { BankPanel } from './panels/BankPanel'
import { WarehousePanel } from './panels/WarehousePanel'

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryId = 'departments' | 'shifts' | 'oa_options' | 'work_statuses' | 'banks' | 'warehouses'

interface Category {
  id: CategoryId
  label: string
  icon: React.ElementType
  superAdminOnly?: boolean
  globalScope?: boolean // ไม่ผูกคลัง (work_statuses)
}

const CATEGORIES: Category[] = [
  { id: 'departments', label: 'แผนก (Department)', icon: Building2 },
  { id: 'shifts', label: 'กะ (Shift)', icon: Clock },
  { id: 'oa_options', label: 'ต่างพื้นที่ (OA)', icon: MapPin },
  { id: 'work_statuses', label: 'Status การทำงาน', icon: Activity, globalScope: true },
  { id: 'banks', label: 'ธนาคาร (Bank)', icon: Landmark, superAdminOnly: true, globalScope: true },
  { id: 'warehouses', label: 'คลัง (Warehouse)', icon: Warehouse, superAdminOnly: true, globalScope: true },
]

interface Props {
  session: AuthSession
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DropdownConfigClient({ session }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('departments')
  const [currentUserWarehouses, setCurrentUserWarehouses] = useState<string[]>(
    session.warehouses || []
  )
  const [selectedWarehouse, setSelectedWarehouse] = useActiveWarehouse(
    session.warehouses[0] || ''
  )
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
  const [counts, setCounts] = useState<Partial<Record<CategoryId, number>>>({})
  const [showWarehousePicker, setShowWarehousePicker] = useState(false)

  // โหลดคลังทั้งหมด และดึง session ล่าสุดจาก DB (เผื่อมีการเพิ่มคลังให้ admin/payroll ใน user-management)
  useEffect(() => {
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((d) => {
        const whs: WarehouseType[] = d.warehouses || []
        setWarehouses(whs)
      })

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.warehouses && Array.isArray(d.user.warehouses)) {
          setCurrentUserWarehouses(d.user.warehouses)
        }
      })
      .catch(() => {})
  }, [])

  // รายการคลังที่ผู้ใช้มีสิทธิ์เลือกจัดการ
  const allowedWarehouses: WarehouseType[] = useMemo(() => {
    if (session.role === 'super_admin') {
      return warehouses
    }
    // สำหรับ admin และ payroll: แสดงตามคลังที่ตนเองได้รับมอบหมาย
    const matched = warehouses.filter((w) =>
      currentUserWarehouses.some(
        (uw) => uw === w.id || uw.toLowerCase() === w.id.toLowerCase()
      )
    )
    if (matched.length > 0) return matched

    // Fallback ระหว่างรอโหลด warehouses จาก API หรือกรณีชื่อตรงกับ ID
    return currentUserWarehouses.map((id) => ({
      id,
      name: id,
      created_at: '',
    }))
  }, [session.role, warehouses, currentUserWarehouses])

  // เลือกคลังเริ่มต้นอัตโนมัติหากยังไม่ได้เลือก หรือคลังที่เลือกไม่อยู่ในสิทธิ์
  useEffect(() => {
    if (allowedWarehouses.length > 0) {
      const exists = allowedWarehouses.some((w) => w.id === selectedWarehouse)
      if (!selectedWarehouse || !exists) {
        setSelectedWarehouse(allowedWarehouses[0].id)
      }
    }
  }, [allowedWarehouses, selectedWarehouse])

  // โหลด counts สำหรับแต่ละ category ด้วย 1 request เดียว
  const refreshCounts = useCallback(() => {
    if (!selectedWarehouse) return

    fetch(`/api/dropdown/counts?warehouse=${selectedWarehouse}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setCounts(data)
        }
      })
      .catch(() => {})
  }, [selectedWarehouse])

  useEffect(() => {
    refreshCounts()
  }, [refreshCounts])

  const currentCategory = CATEGORIES.find((c) => c.id === selectedCategory)!
  const isGlobal = currentCategory.globalScope
  const isSuperAdminOnly = currentCategory.superAdminOnly

  // warehouse ที่ active อยู่ตอนนี้ (หาชื่อจาก id)
  const activeWarehouseObj = allowedWarehouses.find((w) => w.id === selectedWarehouse)
  const activeWarehouseName = activeWarehouseObj?.id || selectedWarehouse

  // สามารถเลือกคลังได้เมื่อมีมากกว่า 1 คลัง
  const canSelectWarehouse = allowedWarehouses.length > 1

  // หน้าต่าง panel ที่แสดง
  const panelWarehouse = isGlobal ? '' : selectedWarehouse

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* ── Topbar ─────────────────────────────────────── */}
      <header className="px-8 pt-7 pb-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#16233D] tracking-tight">
            จัดการข้อมูล Dropdown
            {selectedCategory === 'banks' && <span> - ธนาคาร</span>}
            {selectedCategory === 'warehouses' && <span> - คลัง</span>}
            {selectedCategory !== 'banks' && selectedCategory !== 'warehouses' && !isGlobal && selectedWarehouse && (
              <span className="ml-2 text-[#2558B8]">— {currentCategory.label}</span>
            )}
            {selectedCategory !== 'banks' && selectedCategory !== 'warehouses' && isGlobal && (
              <span className="ml-2 text-[#2558B8]">— {currentCategory.label}</span>
            )}
          </h1>
          <p className="text-xs text-[#5B6B85] mt-1">
            {selectedCategory === 'banks'
              ? 'เพิ่ม/แก้ไขรายชื่อธนาคารที่ใช้ในระบบ ใช้ร่วมกันทุกคลัง'
              : selectedCategory === 'warehouses'
              ? 'เพิ่ม/แก้ไขรายชื่อคลัง/สาขาที่ใช้ในระบบ ใช้ร่วมกันทุกคลัง'
              : isGlobal
              ? 'เพิ่ม/แก้ไขรายการนี้ใช้งานร่วมกันทุกคลัง'
              : `เพิ่ม/แก้ไขรายการที่ใช้ในระบบ เฉพาะคลัง${selectedWarehouse}ของคุณ`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Warehouse selector badge (ถ้าไม่ใช่ global scope) */}
          {!isGlobal && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (canSelectWarehouse) {
                    setShowWarehousePicker((prev) => !prev)
                  }
                }}
                className={cn(
                  'flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border transition-colors',
                  session.role === 'super_admin'
                    ? 'bg-[#F3EEFE] text-[#7C3AED] border-[#7C3AED]/20 hover:bg-[#EBE4FD]'
                    : 'bg-[#EEF3FC] text-[#2558B8] border-[#2558B8]/20 hover:bg-[#DDE8FA]',
                  !canSelectWarehouse && 'cursor-default'
                )}
              >
                <span>คลัง {activeWarehouseName || '—'}</span>
                {canSelectWarehouse && (
                  <ChevronDown
                    size={13}
                    className={cn(
                      'transition-transform duration-200',
                      showWarehousePicker && 'rotate-180'
                    )}
                  />
                )}
              </button>

              {showWarehousePicker && canSelectWarehouse && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowWarehousePicker(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 bg-white border border-[#E1E6EF] rounded-xl shadow-lg z-20 min-w-[210px] py-1 overflow-hidden">
                    <div className="px-3.5 py-1.5 text-[11px] font-semibold text-[#5B6B85] border-b border-[#E1E6EF] bg-[#F8FAFC]">
                      {session.role === 'super_admin'
                        ? `เลือกคลัง (ทั้งหมด ${allowedWarehouses.length} คลัง)`
                        : `เลือกคลัง (${allowedWarehouses.length} คลังที่คุณดูแล)`}
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {allowedWarehouses.map((w) => {
                        const isSelected = w.id === selectedWarehouse
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              setSelectedWarehouse(w.id)
                              setShowWarehousePicker(false)
                            }}
                            className={cn(
                              'w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-3 hover:bg-[#F4F6FA] transition-colors',
                              isSelected && 'text-[#2558B8] font-semibold bg-[#EEF3FC]/50'
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-[#16233D]">{w.id}</span>
                              {w.name && w.name !== w.id && (
                                <span className="text-[11px] text-[#5B6B85] truncate max-w-[170px]">
                                  {w.name}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle2 size={15} className="text-[#2558B8] flex-shrink-0" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Super Admin badge (for global scope) */}
          {isGlobal && session.role === 'super_admin' && (
            <span className="text-xs font-semibold px-4 py-2 rounded-full bg-[#F3EEFE] text-[#7C3AED] border border-[#7C3AED]/20">
              Super Admin · ทุกคลัง
            </span>
          )}
          {isGlobal && session.role !== 'super_admin' && (
            <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#EEF3FC] text-[#2558B8]">
              {session.role === 'admin' ? 'Admin' : 'Payroll'}
            </span>
          )}

          {/* Avatar */}
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm',
              session.role === 'super_admin' ? 'bg-[#7C3AED]' : 'bg-[#2E6FE0]'
            )}
          >
            {session.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex flex-1 gap-0 px-8 pb-8 min-h-0">
        {/* Left panel: Category list */}
        <div className="w-64 flex-shrink-0 mr-5">
          <div className="bg-white border border-[#E1E6EF] rounded-2xl overflow-hidden">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const isLocked = cat.superAdminOnly && session.role !== 'super_admin'
              const isActive = selectedCategory === cat.id
              const count = counts[cat.id]
              const isSuperAdminCategory = cat.superAdminOnly

              return (
                <button
                  key={cat.id}
                  disabled={isLocked}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3.5 text-sm transition-colors border-b border-[#E1E6EF] last:border-b-0',
                    isActive
                      ? isSuperAdminCategory
                        ? 'bg-[#F3EEFE] text-[#7C3AED] font-semibold'
                        : 'bg-[#EEF3FC] text-[#2558B8] font-semibold'
                      : isLocked
                      ? 'text-[#9AA5B8] cursor-not-allowed bg-[#FAFBFC]'
                      : 'text-[#16233D] hover:bg-[#F4F6FA]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isLocked ? (
                      <Lock size={15} className="text-[#9AA5B8]" />
                    ) : (
                      <Icon
                        size={15}
                        className={
                          isActive
                            ? isSuperAdminCategory
                              ? 'text-[#7C3AED]'
                              : 'text-[#2558B8]'
                            : 'text-[#5B6B85]'
                        }
                      />
                    )}
                    <span className="text-left leading-tight">{cat.label}</span>
                  </div>
                  {!isLocked && count !== undefined && (
                    <span
                      className={cn(
                        'text-xs flex-shrink-0',
                        isActive
                          ? isSuperAdminCategory
                            ? 'text-[#7C3AED] font-semibold'
                            : 'bg-[#2558B8] text-white px-2 py-0.5 rounded-full font-medium'
                          : 'text-[#5B6B85]'
                      )}
                    >
                      {count} รายการ
                    </span>
                  )}
                </button>
              )
            })}

            {/* Note: Super Admin only */}
            {session.role !== 'super_admin' && (
              <div className="px-4 py-3 bg-[#FAFBFC] border-t border-[#E1E6EF]">
                <p className="text-[10px] text-[#9AA5B8] leading-relaxed">
                  ธนาคาร/คลัง เป็นส่วนกลาง — Super Admin เท่านั้นที่เข้าได้
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Detail */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Info banner */}
          <InfoBanner
            category={selectedCategory}
            warehouse={selectedWarehouse}
            role={session.role}
          />

          {/* Panel content */}
          <div className="flex-1 bg-white border border-[#E1E6EF] rounded-2xl overflow-hidden">
            {selectedCategory === 'departments' && (
              <DepartmentPanel
                warehouse={selectedWarehouse}
                session={session}
                onCountChange={(n) => setCounts((prev) => ({ ...prev, departments: n }))}
              />
            )}
            {selectedCategory === 'shifts' && (
              <ShiftPanel
                warehouse={selectedWarehouse}
                session={session}
                onCountChange={(n) => setCounts((prev) => ({ ...prev, shifts: n }))}
              />
            )}
            {selectedCategory === 'oa_options' && (
              <OaPanel
                warehouse={selectedWarehouse}
                session={session}
                onCountChange={(n) => setCounts((prev) => ({ ...prev, oa_options: n }))}
              />
            )}
            {selectedCategory === 'work_statuses' && (
              <WorkStatusPanel
                session={session}
                onCountChange={(n) => setCounts((prev) => ({ ...prev, work_statuses: n }))}
              />
            )}
            {selectedCategory === 'banks' && session.role === 'super_admin' && (
              <BankPanel
                warehouses={warehouses}
                onCountChange={(n) => setCounts((prev) => ({ ...prev, banks: n }))}
              />
            )}
            {selectedCategory === 'warehouses' && session.role === 'super_admin' && (
              <WarehousePanel
                onCountChange={(n) => setCounts((prev) => ({ ...prev, warehouses: n }))}
                onWarehouseChange={() => {
                  // Reload warehouses after add/edit
                  fetch('/api/warehouses')
                    .then((r) => r.json())
                    .then((d) => setWarehouses(d.warehouses || []))
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Info Banner Component ─────────────────────────────────────────────────────
function InfoBanner({
  category,
  warehouse,
  role,
}: {
  category: CategoryId
  warehouse: string
  role: string
}) {
  const banners: Record<CategoryId, React.ReactNode> = {
    departments: (
      <>
        รายการด้านล่างมีผลเฉพาะ{' '}
        <span className="font-semibold text-[#2558B8]">คลัง {warehouse}</span>{' '}
        ของคุณเท่านั้น แต่ละคลังกำหนดแผนก/กะของตัวเองแยกกันได้ —{' '}
        <span
          className="font-semibold text-[#2558B8] cursor-pointer underline underline-offset-2"
        >
          ยกเว้นฐานข้อมูลพนักงาน
        </span>{' '}
        ซึ่งใช้ชุดเดียวกันร่วมกับทุกคลัง
      </>
    ),
    shifts: (
      <>
        รายการด้านล่างมีผลเฉพาะ{' '}
        <span className="font-semibold text-[#2558B8]">คลัง {warehouse}</span>{' '}
        ของคุณเท่านั้น แต่ละคลังกำหนดแผนก/กะของตัวเองแยกกันได้ —{' '}
        <span className="font-semibold text-[#2558B8]">ยกเว้นฐานข้อมูลพนักงาน</span>{' '}
        ซึ่งใช้ชุดเดียวกันร่วมกับทุกคลัง
      </>
    ),
    oa_options: (
      <>
        รายการด้านล่างมีผลเฉพาะ{' '}
        <span className="font-semibold text-[#2558B8]">คลัง {warehouse}</span>{' '}
        ของคุณเท่านั้น ใช้เลือกในหน้า Namelist เมื่อพนักงานถูกส่งไปทำงานต่างพื้นที่
      </>
    ),
    work_statuses: (
      <>
        รายการด้านล่างมีผลเฉพาะ{' '}
        <span className="font-semibold text-[#2558B8]">คลัง {warehouse}</span>{' '}
        ของคุณเท่านั้น ใช้เลือกในหน้า Namelist สำหรับระบุสถานะการทำงานของพนักงานแต่ละวัน
      </>
    ),
    banks: (
      <>
        รายชื่อธนาคารเป็น{' '}
        <span className="font-bold text-[#16233D]">ข้อมูลส่วนกลาง</span>{' '}
        ใช้ร่วมกันทุกคลัง มีเฉพาะ{' '}
        <span className="font-bold text-[#16233D]">Super Admin</span>{' '}
        เท่านั้นที่จัดการรายการนี้ได้ (เช่นตอนกรอกบัญชีธนาคารพนักงาน)
      </>
    ),
    warehouses: (
      <>
        รายชื่อคลัง/สาขาเป็น{' '}
        <span className="font-bold text-[#16233D]">ข้อมูลส่วนกลาง</span>{' '}
        ใช้ร่วมกันทุกคลัง มีเฉพาะ{' '}
        <span className="font-bold text-[#16233D]">Super Admin</span>{' '}
        เท่านั้นที่เพิ่ม/ลบคลังใหม่ได้ (คลังที่มีอยู่ ผูกกับสิทธิ์ผู้ใช้งานในหน้าจัดการผู้ใช้งาน)
      </>
    ),
  }

  const isSuperAdminCat = category === 'banks' || category === 'warehouses'
  const borderColor = isSuperAdminCat ? 'border-[#7C3AED]/25 bg-[#FAF7FE]' : 'border-[#2558B8]/20 bg-[#EEF3FC]'
  const textColor = isSuperAdminCat ? 'text-[#5B6B85]' : 'text-[#1D3A7A]'

  return (
    <div className={cn('flex items-start gap-3 px-5 py-3 rounded-2xl border text-xs leading-relaxed', borderColor, textColor)}>
      {isSuperAdminCat ? (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-[#7C3AED] mt-0.5 flex-shrink-0" />
      ) : (
        <Info size={15} className="mt-0.5 flex-shrink-0 text-[#2558B8]" />
      )}
      <p>{banners[category]}</p>
    </div>
  )
}
