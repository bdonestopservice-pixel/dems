'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WarehouseOption {
  id: string
  name?: string
}

interface WarehouseSelectProps {
  value: string
  onChange: (value: string) => void
  warehouses: Array<WarehouseOption | string>
  showAllOption?: boolean
  allLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  title?: string
}

export function WarehouseSelect({
  value,
  onChange,
  warehouses = [],
  showAllOption = true,
  allLabel = 'ทุกคลัง',
  placeholder = 'เลือกคลัง/สาขา',
  className = '',
  disabled = false,
  title = 'เลือกคลัง/สาขา',
}: WarehouseSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Normalize warehouse options
  const options = useMemo(() => {
    const list: { id: string; label: string }[] = []
    if (showAllOption) {
      list.push({ id: 'all', label: allLabel })
    }
    for (const w of warehouses) {
      const id = typeof w === 'string' ? w : w.id
      const label = typeof w === 'string' ? w : w.name || w.id
      list.push({ id, label })
    }
    // If current value is not in the list, keep it visible
    if (value && value !== 'all' && !list.some((o) => o.id === value)) {
      list.push({ id: value, label: value })
    }
    return list
  }, [warehouses, showAllOption, allLabel, value])

  // Get display text for currently selected value
  const selectedLabel = useMemo(() => {
    if (!value || value === 'all') return allLabel
    const found = options.find((o) => o.id === value)
    return found ? found.label : value || placeholder
  }, [value, options, allLabel, placeholder])

  // Handle click outside & escape key
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-block text-left" title={title}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'relative inline-flex items-center justify-between gap-2.5 bg-white border text-xs font-medium rounded-xl px-3.5 py-2.5 shadow-2xs transition-all cursor-pointer select-none min-w-[125px]',
          isOpen
            ? 'border-[#2E6FE0] ring-2 ring-[#2E6FE0]/20 text-[#16233D]'
            : 'border-[#E1E6EF] text-[#16233D] hover:border-[#CBD5E1] hover:bg-[#FAFBFC]',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
          className
        )}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={cn(
            'text-[#5B6B85] transition-transform duration-200 flex-shrink-0',
            isOpen && 'rotate-180 text-[#2E6FE0]'
          )}
        />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 min-w-full w-max max-w-[260px] bg-white rounded-xl border border-[#E1E6EF] shadow-lg py-1 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-60 overflow-y-auto divide-y divide-[#F4F6FA]">
            {options.map((opt) => {
              const isSelected = value === opt.id || (!value && opt.id === 'all')
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors text-left cursor-pointer select-none',
                    isSelected
                      ? 'bg-[#EEF3FC] text-[#2E6FE0] font-semibold'
                      : 'text-[#16233D] hover:bg-[#F4F6FA] font-medium'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check size={14} className="text-[#2E6FE0] flex-shrink-0 ml-2" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

