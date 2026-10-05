'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePicker24hProps {
  value: string // Format "HH:mm" (e.g. "06:00", "13:00", "23:00", "00:00")
  onChange: (val: string) => void
  className?: string
  placement?: 'top' | 'bottom'
  disabled?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = [
  '00', '05', '10', '15', '20', '25',
  '30', '35', '40', '45', '50', '55',
]
const COMMON_PRESETS = [
  '06:00', '07:00', '08:00', '08:30',
  '12:00', '13:00', '17:00', '18:00',
  '20:00', '22:00', '00:00',
]

export function TimePicker24h({
  value,
  onChange,
  className,
  placement = 'bottom',
  disabled = false,
}: TimePicker24hProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hourListRef = useRef<HTMLDivElement>(null)

  // แยกชั่วโมงและนาทีจากค่า value (default: "06:00")
  const [currentHour, currentMinute] = (() => {
    const parts = (value || '06:00').split(':')
    const h = parts[0]?.padStart(2, '0') || '06'
    const m = parts[1]?.padStart(2, '0') || '00'
    return [h, m]
  })()

  // ปิดเมื่อคลิกข้างนอก
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // เลื่อน scroll ของชั่วโมงที่เลือกมาอยู่ตรงกลางตอนเปิด
  useEffect(() => {
    if (open && hourListRef.current) {
      const activeEl = hourListRef.current.querySelector('[data-selected="true"]') as HTMLElement
      if (activeEl) {
        hourListRef.current.scrollTop = activeEl.offsetTop - hourListRef.current.offsetTop - 50
      }
    }
  }, [open])

  function handleSelectHour(h: string) {
    onChange(`${h}:${currentMinute}`)
  }

  function handleSelectMinute(m: string) {
    onChange(`${currentHour}:${m}`)
  }

  function handleSelectPreset(preset: string) {
    onChange(preset)
  }

  // อนุญาตให้พิมพ์ตรงๆ ได้ เช่น "1300", "13.00", "13:00"
  function handleDirectInput(raw: string) {
    const clean = raw.replace(/[^0-9]/g, '')
    if (clean.length === 4) {
      const h = Math.min(23, parseInt(clean.slice(0, 2), 10)).toString().padStart(2, '0')
      const m = Math.min(59, parseInt(clean.slice(2, 4), 10)).toString().padStart(2, '0')
      onChange(`${h}:${m}`)
    } else if (raw.includes(':') || raw.includes('.')) {
      const parts = raw.replace('.', ':').split(':')
      if (parts[0] !== undefined) {
        const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0)).toString().padStart(2, '0')
        const m = parts[1] !== undefined
          ? Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0)).toString().padStart(2, '0')
          : currentMinute
        onChange(`${h}:${m}`)
      }
    }
  }

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Input Display Box */}
      <div
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          'input flex items-center justify-between gap-1.5 cursor-pointer select-none transition-colors px-3 py-1.5 text-sm bg-white',
          open && 'border-[#2E6FE0] ring-2 ring-[#2E6FE0]/15',
          disabled && 'opacity-60 cursor-not-allowed bg-gray-50'
        )}
      >
        <span className="font-semibold text-[#16233D] tracking-wider text-sm">
          {value || '06:00'}
        </span>
        <Clock size={14} className={cn('text-[#5B6B85] flex-shrink-0 transition-colors', open && 'text-[#2E6FE0]')} />
      </div>

      {/* 24-Hour Popover */}
      {open && (
        <div
          className={cn(
            'absolute z-50 bg-white border border-[#E1E6EF] rounded-2xl shadow-xl w-[260px] p-3 text-xs',
            'animate-in fade-in zoom-in-95 duration-150',
            placement === 'top'
              ? 'bottom-full mb-2 left-0'
              : 'top-full mt-2 left-0'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E1E6EF]">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-[#5B6B85]">เวลา (24 ชม.):</span>
              <span className="text-base font-bold text-[#2558B8] tracking-wider">
                {currentHour}:{currentMinute} น.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-[#2558B8] hover:text-[#1D4490] font-semibold px-2 py-0.5 rounded-md hover:bg-[#EEF3FC] transition-colors"
            >
              ตกลง
            </button>
          </div>

          {/* Quick Presets */}
          <div className="mb-2.5">
            <div className="text-[10px] text-[#5B6B85] font-semibold mb-1">เวลายอดนิยม:</div>
            <div className="flex flex-wrap gap-1">
              {COMMON_PRESETS.map((preset) => {
                const isSelected = preset === `${currentHour}:${currentMinute}`
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors',
                      isSelected
                        ? 'bg-[#2E6FE0] text-white shadow-2xs'
                        : 'bg-[#F4F6FA] text-[#16233D] hover:bg-[#EEF3FC] hover:text-[#2558B8]'
                    )}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2-Column Time Selector: ชั่วโมง (00-23) & นาที (00-55) */}
          <div className="grid grid-cols-2 gap-2 border-t border-[#E1E6EF] pt-2">
            {/* ชั่วโมง (Hour) Column */}
            <div>
              <div className="text-center text-[10px] font-bold text-[#5B6B85] pb-1 border-b border-[#E1E6EF]/70 mb-1">
                ชั่วโมง (00–23)
              </div>
              <div
                ref={hourListRef}
                className="h-44 overflow-y-auto pr-1 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-200"
              >
                {HOURS.map((h) => {
                  const isSelected = h === currentHour
                  return (
                    <button
                      key={h}
                      type="button"
                      data-selected={isSelected}
                      onClick={() => handleSelectHour(h)}
                      className={cn(
                        'w-full py-1.5 px-2 rounded-lg text-center text-xs font-semibold transition-colors flex items-center justify-between',
                        isSelected
                          ? 'bg-[#2E6FE0] text-white shadow-xs'
                          : 'text-[#16233D] hover:bg-[#EEF3FC] hover:text-[#2558B8]'
                      )}
                    >
                      <span className="w-full text-center">{h}:00</span>
                      {isSelected && <Check size={12} className="flex-shrink-0 -ml-3" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* นาที (Minute) Column */}
            <div>
              <div className="text-center text-[10px] font-bold text-[#5B6B85] pb-1 border-b border-[#E1E6EF]/70 mb-1">
                นาที (00–55)
              </div>
              <div className="h-44 overflow-y-auto pr-1 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-200">
                {MINUTES.map((m) => {
                  const isSelected = m === currentMinute
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        'w-full py-1.5 px-2 rounded-lg text-center text-xs font-semibold transition-colors flex items-center justify-between',
                        isSelected
                          ? 'bg-[#2E6FE0] text-white shadow-xs'
                          : 'text-[#16233D] hover:bg-[#EEF3FC] hover:text-[#2558B8]'
                      )}
                    >
                      <span className="w-full text-center">:{m}</span>
                      {isSelected && <Check size={12} className="flex-shrink-0 -ml-3" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
