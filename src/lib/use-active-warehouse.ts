'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'dems_active_warehouse'
const EVENT_NAME = 'dems:active-warehouse'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * คลังที่ผู้ใช้กำลังเลือกทำงานอยู่ — แชร์ข้ามคอมโพเนนต์ (เช่น Sidebar กับหน้า Dropdown)
 * เก็บใน localStorage และ sync ผ่าน custom event
 * @param fallback ค่าเริ่มต้นเมื่อยังไม่เคยเลือก
 */
export function useActiveWarehouse(fallback: string) {
  const [warehouse, setWarehouseState] = useState<string>(fallback)

  useEffect(() => {
    const stored = readStored()
    if (stored) setWarehouseState(stored)

    const onChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail
      if (next) setWarehouseState(next)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setWarehouseState(e.newValue)
    }
    window.addEventListener(EVENT_NAME, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setWarehouse = useCallback((id: string) => {
    setWarehouseState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {}
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: id }))
  }, [])

  return [warehouse, setWarehouse] as const
}
