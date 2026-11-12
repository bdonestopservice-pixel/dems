'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableOption {
  value: string
  label: string
}

export interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: (string | SearchableOption)[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  emptyText?: string
}

export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'เลือกรายการ',
  searchPlaceholder = 'ค้นหา...',
  disabled = false,
  className = '',
  emptyText = 'ไม่พบข้อมูลที่ค้นหา',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Normalize options to { value, label }
  const normalizedOptions: SearchableOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt }
      }
      return opt
    })
  }, [options])

  // Current selected label
  const selectedLabel = useMemo(() => {
    if (!value) return ''
    const found = normalizedOptions.find((o) => o.value === value)
    return found ? found.label : value
  }, [value, normalizedOptions])

  // Filtered options based on search query (case-insensitive & fast)
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return normalizedOptions
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    )
  }, [searchQuery, normalizedOptions])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setActiveIndex(-1)
      // Slight delay to ensure DOM is rendered before focusing
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Handle click outside & keyboard ESC
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
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

  // Keyboard navigation inside dropdown
  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => {
        const next = prev + 1 >= filteredOptions.length ? 0 : prev + 1
        scrollActiveIntoView(next)
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => {
        const next = prev - 1 < 0 ? filteredOptions.length - 1 : prev - 1
        scrollActiveIntoView(next)
        return next
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        handleSelect(filteredOptions[activeIndex].value)
      } else if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0].value)
      }
    }
  }

  function scrollActiveIntoView(index: number) {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('[data-option-item]')
    const target = items[index]
    if (target) {
      target.scrollIntoView({ block: 'nearest' })
    }
  }

  function handleSelect(val: string) {
    onChange(val)
    setIsOpen(false)
    setSearchQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setSearchQuery('')
  }

  return (
    <div ref={containerRef} className={cn('relative w-full text-left', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen)
        }}
        className={cn(
          'w-full h-9 bg-white border border-[#E1E6EF] rounded-lg px-3 text-xs flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-left shadow-2xs',
          isOpen && 'border-[#2E6FE0] ring-2 ring-[#2E6FE0]/20 bg-white',
          disabled && 'bg-[#F4F6FA] text-[#8C9BAE] cursor-not-allowed border-[#E1E6EF] opacity-80'
        )}
      >
        <span
          className={cn(
            'truncate flex-1',
            value ? 'text-[#16233D] font-medium' : 'text-[#8C9BAE]'
          )}
        >
          {selectedLabel || placeholder}
        </span>

        <div className="flex items-center gap-1 text-[#8C9BAE] flex-shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 hover:text-[#E5484D] hover:bg-[#FCE8E8] rounded transition-colors"
              title="ล้างค่า"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn(
              'transition-transform duration-200',
              isOpen && 'rotate-180 text-[#2E6FE0]'
            )}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-[#E1E6EF] rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[240px]">
          {/* Search Box Header */}
          <div className="p-2 border-b border-[#E1E6EF] bg-[#F8FAFC]">
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-2.5 text-[#8C9BAE] pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={searchPlaceholder}
                className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-[#E1E6EF] rounded-lg text-[#16233D] placeholder:text-[#8C9BAE] focus:outline-none focus:border-[#2E6FE0] focus:ring-2 focus:ring-[#2E6FE0]/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#8C9BAE] hover:text-[#16233D] p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Match Counter */}
            <div className="flex items-center justify-between px-1 mt-1.5 text-[10px] text-[#5B6B85]">
              <span>พิมพ์เพื่อค้นหาทันที</span>
              <span>
                {filteredOptions.length} / {normalizedOptions.length} รายการ
              </span>
            </div>
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {/* Option to clear / empty */}
            {value && !searchQuery && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full text-left px-2.5 py-1.5 text-xs text-[#E5484D] hover:bg-[#FCE8E8]/40 rounded-lg transition-colors flex items-center gap-2"
              >
                <X size={13} className="text-[#E5484D]" />
                <span>{placeholder} (ไม่ระบุ)</span>
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8C9BAE]">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value
                const isActive = idx === activeIndex

                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    data-option-item
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between gap-2 cursor-pointer',
                      isSelected
                        ? 'bg-[#EEF3FC] text-[#2558B8] font-semibold'
                        : isActive
                        ? 'bg-[#F4F6FA] text-[#16233D]'
                        : 'text-[#16233D] hover:bg-[#F4F6FA]'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <Check size={14} className="text-[#2E6FE0] flex-shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

