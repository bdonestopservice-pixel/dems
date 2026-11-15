'use client'

import { useState, useEffect } from 'react'
import {
  Ban,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Building2,
  CreditCard,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import { cn, formatThaiDateTime } from '@/lib/utils'
import type { Employee } from '@/types'

interface BlacklistModalProps {
  employee: Employee | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedEmployee: Employee, action: 'blacklist' | 'unblacklist') => void
}

const COMMON_REASONS = [
  'ขาดงานติดต่อกันเกินกำหนดโดยไม่แจ้ง',
  'ทุจริต / ลักขโมยทรัพย์สิน',
  'ละทิ้งหน้าที่ระหว่างปฏิบัติงาน',
  'ไม่ผ่านเกณฑ์วินัยร้ายแรง',
  'ทะเลาะวิวาทในสถานที่ทำงาน',
]

export function BlacklistModal({
  employee,
  isOpen,
  onClose,
  onSuccess,
}: BlacklistModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setReason('')
      setErrorMsg(null)
      setSubmitting(false)
    }
  }, [isOpen, employee])

  if (!isOpen || !employee) return null

  const isBlacklisted = !!employee.is_blacklisted
  const fullName = `${employee.prefix ? `${employee.prefix} ` : ''}${employee.first_name} ${employee.last_name}`

  const handleBlacklist = async () => {
    if (!reason.trim()) {
      setErrorMsg('กรุณาระบุเหตุผลในการติดแบล็กลิสต์')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/employees/${employee.id}/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_blacklisted: true,
          blacklist_reason: reason.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      }

      onSuccess(data.employee, 'blacklist')
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnblacklist = async () => {
    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/employees/${employee.id}/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_blacklisted: false,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการปลดแบล็กลิสต์')
      }

      onSuccess(data.employee, 'unblacklist')
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E1E6EF] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={cn(
            'px-6 py-4 flex items-center justify-between border-b',
            isBlacklisted
              ? 'bg-[#FEF2F2] border-[#F8D3D4]'
              : 'bg-white border-[#E1E6EF]'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center',
                isBlacklisted
                  ? 'bg-[#FCE8E8] text-[#E5484D]'
                  : 'bg-[#FEE2E2] text-[#DC2626]'
              )}
            >
              <Ban size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#16233D]">
                {isBlacklisted ? 'ข้อมูลการติดแบล็กลิสต์' : 'ติดแบล็กลิสต์พนักงาน'}
              </h3>
              <p className="text-xs text-[#5B6B85]">
                {isBlacklisted
                  ? 'ดูเหตุผล หรือ ปลดสถานะแบล็กลิสต์พนักงาน'
                  : 'ระบุเหตุผลเพื่อกำหนดสถานะแบล็กลิสต์'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5B6B85] hover:text-[#16233D] hover:bg-[#F4F6FA] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Employee summary card */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E1E6EF] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#16233D]">{fullName}</span>
              <span className="font-mono text-xs font-semibold text-[#2E6FE0] bg-[#EEF3FC] px-2 py-0.5 rounded-md">
                {employee.po_id || 'ไม่มีรหัส PO'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#5B6B85]">
              <div className="flex items-center gap-1.5">
                <CreditCard size={13} className="text-[#9AA5B8]" />
                <span className="font-mono">{employee.id_card}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 size={13} className="text-[#9AA5B8]" />
                <span>{employee.warehouse_name || employee.warehouse || '-'}</span>
              </div>
            </div>
          </div>

          {/* Mode 1: Already Blacklisted */}
          {isBlacklisted ? (
            <div className="space-y-4">
              {/* Status Alert */}
              <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-2">
                <div className="flex items-center gap-2 text-[#DC2626] font-bold text-xs">
                  <ShieldAlert size={16} />
                  <span>สถานะปัจจุบัน: ติดแบล็กลิสต์ (ขึ้นแถบแดงในระบบ)</span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#F8D3D4]/60">
                  <span className="text-xs font-medium text-[#7F1D1D] block mb-1">
                    เหตุผลที่ติดแบล็กลิสต์:
                  </span>
                  <div className="p-3 rounded-lg bg-white/90 border border-[#F8D3D4] text-xs font-semibold text-[#991B1B] whitespace-pre-wrap leading-relaxed shadow-xs">
                    {employee.blacklist_reason || '(ไม่ได้ระบุเหตุผล)'}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#E1E6EF] text-xs text-[#5B6B85]">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-[#9AA5B8]" />
                  <span>
                    วันที่บันทึก:{' '}
                    <strong className="text-[#16233D]">
                      {employee.blacklisted_at ? formatThaiDateTime(employee.blacklisted_at) : '-'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={14} className="text-[#9AA5B8]" />
                  <span>
                    ผู้บันทึก:{' '}
                    <strong className="text-[#16233D]">{employee.blacklisted_by || '-'}</strong>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Form to Blacklist */
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2.5 text-xs text-[#991B1B]">
                <AlertTriangle size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
                <span>
                  เมื่อติดแบล็กลิสต์ พนักงานรายนี้จะถูกแสดงด้วย{' '}
                  <strong className="underline">แถบสีแดงทั้งแถว</strong> ในตารางข้อมูลพนักงาน
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#16233D] mb-1.5">
                  เหตุผลในการติดแบล็กลิสต์ <span className="text-[#E5484D]">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    if (errorMsg) setErrorMsg(null)
                  }}
                  rows={3}
                  placeholder="เช่น ขาดงานติดต่อกันโดยไม่แจ้ง, ทุจริต, ปัญหาวินัยร้ายแรง..."
                  className="w-full text-xs rounded-xl border border-[#C6DCFD] p-3 focus:outline-none focus:ring-2 focus:ring-[#E5484D] focus:border-transparent transition-all placeholder:text-[#9AA5B8]"
                />
              </div>

              {/* Quick Reason Chips */}
              <div>
                <span className="text-[11px] font-medium text-[#5B6B85] block mb-1.5">
                  เลือกเหตุผลด่วน:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setReason(r)
                        if (errorMsg) setErrorMsg(null)
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F4F6FA] hover:bg-[#EEF3FC] text-[#5B6B85] hover:text-[#2E6FE0] border border-[#E1E6EF] hover:border-[#C6DCFD] transition-colors cursor-pointer"
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E1E6EF] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5B6B85] hover:text-[#16233D] hover:bg-white border border-[#E1E6EF] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isBlacklisted ? 'ปิด' : 'ยกเลิก'}
          </button>

          {isBlacklisted ? (
            <button
              type="button"
              onClick={handleUnblacklist}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#16A34A] hover:bg-[#15803D] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังปลดแบล็กลิสต์...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>ปลดแบล็กลิสต์</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBlacklist}
              disabled={submitting || !reason.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E5484D] hover:bg-[#DC2626] shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Ban size={15} className="stroke-[2.5]" />
                  <span>ยืนยันติดแบล็กลิสต์</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
