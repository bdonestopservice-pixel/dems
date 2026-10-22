'use client'

import { Trash2, Loader2 } from 'lucide-react'
import { formatThaiDate } from '@/lib/utils'

export interface PlanToDelete {
  id: string
  department_name?: string
  warehouse?: string
  date: string
  current_count?: number
}

interface DeletePlanModalProps {
  isOpen: boolean
  plan: PlanToDelete | null
  onClose: () => void
  onConfirm: () => Promise<void> | void
  loading?: boolean
}

export function DeletePlanModal({
  isOpen,
  plan,
  onClose,
  onConfirm,
  loading = false,
}: DeletePlanModalProps) {
  if (!isOpen || !plan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl text-center border border-[#E1E6EF] animate-in zoom-in-95 duration-150">
        {/* Trash Icon inside soft red circle */}
        <div className="w-16 h-16 rounded-full bg-[#FDECEC] flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-8 h-8 text-[#E5484D]" strokeWidth={2.2} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-[#16233D] mb-3">
          ยืนยันการลบแพลน
        </h3>

        {/* Description matching user mockup */}
        <p className="text-sm text-[#16233D] leading-relaxed mb-2">
          ต้องการลบแพลน{' '}
          <strong className="font-bold text-[#16233D]">
            {plan.department_name || 'ไม่ระบุแผนก'}{plan.warehouse ? ` (${plan.warehouse})` : ''}
          </strong>
          <br />
          วันที่ <strong className="font-bold text-[#16233D]">{formatThaiDate(plan.date)}</strong> ใช่หรือไม่?
        </p>

        {/* Subtext */}
        <p className="text-xs text-[#5B6B85] leading-normal mb-7">
          แพลนนี้มีพนักงาน {plan.current_count ?? 0} คน การลบแพลนจะนำพนักงานออกจากแพลนนี้ทั้งหมด แต่ไม่ได้ลบข้อมูลพนักงาน
        </p>

        {/* Actions */}
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
                กำลังลบ...
              </>
            ) : (
              'ยืนยันลบแพลน'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
