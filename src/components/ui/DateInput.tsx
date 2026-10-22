'use client'

import React, { useRef, useMemo } from 'react'
import { Calendar, X } from 'lucide-react'

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  title?: string
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  clearable?: boolean
  id?: string
}

export function DateInput({
  value,
  onChange,
  placeholder = 'วว/ดด/ปปปป',
  className = '',
  title = 'เลือกวันที่ (วัน/เดือน/ปี)',
  min,
  max,
  required,
  disabled,
  clearable = false,
  id,
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // แปลง YYYY-MM-DD เป็น วัน/เดือน/ปี (DD/MM/YYYY) สำหรับการแสดงผล
  const displayDate = useMemo(() => {
    if (!value) return ''
    const parts = value.split('-')
    if (parts.length === 3) {
      const [y, m, d] = parts
      return `${d}/${m}/${y}`
    }
    return value
  }, [value])

  const openPicker = () => {
    if (disabled) return
    if (inputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          inputRef.current.showPicker()
        } else {
          inputRef.current.focus()
        }
      } catch {
        inputRef.current.focus()
      }
    }
  }

  return (
    <div
      onClick={openPicker}
      className={`relative inline-flex items-center justify-between gap-2.5 bg-white border border-[#E1E6EF] text-xs font-medium rounded-xl px-3 py-2.5 shadow-sm hover:border-[#2E6FE0] focus-within:ring-2 focus-within:ring-[#2E6FE0] transition-all cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
      } ${className}`}
      title={title}
    >
      <span className={`tracking-normal ${displayDate ? 'text-[#16233D] font-medium' : 'text-[#9AA5B8]'}`}>
        {displayDate || placeholder}
      </span>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            className="p-0.5 rounded-full text-[#9AA5B8] hover:text-[#E5484D] hover:bg-[#FCE8E8] transition-colors cursor-pointer"
            title="ล้างวันที่"
          >
            <X size={13} />
          </button>
        )}
        <Calendar size={14} className="text-[#5B6B85] pointer-events-none" />
      </div>

      {/* Input จริงที่ซ่อนไว้เพื่อเปิด Native Date Picker และรองรับ Accessibility */}
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
