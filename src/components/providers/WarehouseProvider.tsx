'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { Warehouse } from '@/types'
import { useRealtimeListener } from '@/components/providers/RealtimeProvider'

// ============================================================
// Module-level In-Memory Cache (0ms latency across page changes)
// ============================================================
let memoryWarehousesCache: Warehouse[] | null = null
let inFlightFetchPromise: Promise<Warehouse[]> | null = null

const CACHE_EVENT = 'dems:warehouses-cache-updated'

/**
 * ฟังก์ชันดึงข้อมูลคลังสินค้าพร้อมระบบ In-Memory Cache
 * - ถ้ามีข้อมูลในหน่วยความจำแล้ว จะคืนค่าทันที 0ms
 * - ถ้ามีคำขอกำลังส่งอยู่ จะรอคำขอเดิม ไม่ส่งคำขอซ้ำ (Deduplication)
 */
export async function fetchWarehousesCached(forceRefresh = false): Promise<Warehouse[]> {
  if (!forceRefresh && memoryWarehousesCache !== null) {
    return memoryWarehousesCache
  }

  if (!forceRefresh && inFlightFetchPromise !== null) {
    return inFlightFetchPromise
  }

  inFlightFetchPromise = (async () => {
    try {
      const res = await fetch('/api/warehouses')
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      const data = await res.json()
      const list: Warehouse[] = data.warehouses || []
      memoryWarehousesCache = list
      return list
    } catch (err) {
      console.warn('Error fetching warehouses:', err)
      return memoryWarehousesCache || []
    } finally {
      inFlightFetchPromise = null
    }
  })()

  return inFlightFetchPromise
}

/**
 * สั่งล้างแคชคลังสินค้าในหน่วยความจำ (เช่น เมื่อ Admin มีการเพิ่ม/แก้ไข/ลบคลัง)
 */
export function invalidateWarehousesCache() {
  memoryWarehousesCache = null
  inFlightFetchPromise = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CACHE_EVENT))
  }
}

// ============================================================
// React Context & Provider
// ============================================================

interface WarehouseContextValue {
  warehouses: Warehouse[]
  loading: boolean
  error: string | null
  refreshWarehouses: () => Promise<Warehouse[]>
}

const WarehouseContext = createContext<WarehouseContextValue | null>(null)

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>(memoryWarehousesCache || [])
  const [loading, setLoading] = useState<boolean>(memoryWarehousesCache === null)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  const load = useCallback(async (force = false) => {
    if (force || memoryWarehousesCache === null) {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await fetchWarehousesCached(force)
      if (isMountedRef.current) {
        setWarehouses(data)
        setLoading(false)
      }
      return data
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to load warehouses')
        setLoading(false)
      }
      return memoryWarehousesCache || []
    }
  }, [])

  // โหลดเมื่อ Provider ถูก Mount ครั้งแรก
  useEffect(() => {
    isMountedRef.current = true
    load(false)

    // ฟัง Event เมื่อแคชถูก Invalidate ในแท็บเดียวกัน
    const handleCacheUpdated = () => {
      load(true)
    }
    window.addEventListener(CACHE_EVENT, handleCacheUpdated)

    return () => {
      isMountedRef.current = false
      window.removeEventListener(CACHE_EVENT, handleCacheUpdated)
    }
  }, [load])

  // ดักฟัง Realtime Event เมื่อมีการอัปเดตข้อมูล Dropdown จากเครื่องอื่น
  useRealtimeListener('dropdown-updated', () => {
    load(true)
  })

  const refreshWarehouses = useCallback(async () => {
    return load(true)
  }, [load])

  return (
    <WarehouseContext.Provider
      value={{
        warehouses,
        loading,
        error,
        refreshWarehouses,
      }}
    >
      {children}
    </WarehouseContext.Provider>
  )
}

/**
 * Custom Hook สำหรับดึงข้อมูลคลังสินค้าที่ถูกแคชไว้ใน Client Memory
 * - เรียกใช้ได้จากทุกหน้า/คอมโพเนนต์
 * - ครั้งแรกโหลดผ่าน API ครั้งถัดไปดึงจากแคชทันที (0ms Latency)
 */
export function useWarehouses() {
  const ctx = useContext(WarehouseContext)
  const [fallbackWarehouses, setFallbackWarehouses] = useState<Warehouse[]>(memoryWarehousesCache || [])
  const [fallbackLoading, setFallbackLoading] = useState(memoryWarehousesCache === null)

  // กรณีเรียกใช้นอก WarehouseProvider (Defensive Fallback)
  useEffect(() => {
    if (!ctx && memoryWarehousesCache === null) {
      fetchWarehousesCached(false).then((data) => {
        setFallbackWarehouses(data)
        setFallbackLoading(false)
      })
    }
  }, [ctx])

  if (ctx) {
    return ctx
  }

  // Fallback standalone hook
  return {
    warehouses: fallbackWarehouses,
    loading: fallbackLoading,
    error: null,
    refreshWarehouses: async () => {
      invalidateWarehousesCache()
      const data = await fetchWarehousesCached(true)
      setFallbackWarehouses(data)
      return data
    },
  }
}

