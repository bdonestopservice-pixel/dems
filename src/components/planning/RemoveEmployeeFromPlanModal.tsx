'use client'

import { Trash2, Loader2 } from 'lucide-react'

export interface EmployeeToRemove {
  employee_id: string
  fullName: string
  po_id?: string
}

interface RemoveEmployeeFromPlanModalProps {
  isOpen: boolean
  employee: EmployeeToRemove | null
  onClose: () => void
  onConfirm: () => Promise<void> | void
  loading?: boolean
}

export function RemoveEmployeeFromPlanModal({
  isOpen,
  employee,
  onClose,
  onConfirm,
  loading = false,
}: RemoveEmployeeFromPlanModalProps) {
  if (!isOpen || !employee) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl text-center border border-[#E1E6EF] animate-in zoom-in-95 duration-150">
        <div className="w-16 h-16 rounded-full bg-[#FDECEC] flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-8 h-8 text-[#E5484D]" strokeWidth={2.2} />
        </div>

        <h3 className="text-xl font-bold text-[#16233D] mb-3">
          ยืนยันนำพนักงานออกจากแพลน
        </h3>

        <p className="text-sm text-[#16233D] leading-relaxed mb-2">
          ต้องการนำ <strong className="font-bold text-[#16233D]">{employee.fullName} {employee.po_id ? `(${employee.po_id})` : ''}</strong>
          <br />
          ออกจากแพลนนี้ใช่หรือไม่?
        </p>

        <p className="text-xs text-[#5B6B85] leading-normal mb-7">
          การนำออกจากแพลนจะไม่มีผลต่อข้อมูลพนักงานในระบบ
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 px-5 rounded-2xl border border-[#E1E6EF] text-sm font-bold text-[#16233D] hover:bg-[#F4F6FA] transition-colors cursor-pointer disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 px-5 rounded-2xl bg-[#E5484D] hover:bg-[#D4373C] text-sm font-bold text-white shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังนำออก...
              </>
            ) : (
              'ยืนยันนำออก'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
