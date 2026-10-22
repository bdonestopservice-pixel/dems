'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Pencil, Trash2, Plus, Loader2, X, Check } from 'lucide-react'
import type { Bank, Warehouse as WarehouseType } from '@/types'
import { broadcastRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'

interface Props {
  warehouses?: WarehouseType[]
  onCountChange: (n: number) => void
}

const DEFAULT_WAREHOUSES: WarehouseType[] = [
  { id: 'SOCE', name: 'SOCE - คลังตะวันออก' },
  { id: 'SOCW', name: 'SOCW - คลังตะวันตก' },
  { id: 'FSOCW', name: 'FSOCW - คลัง F ตะวันตก' },
  { id: 'SOCN', name: 'SOCN - คลังเหนือ' },
  { id: 'SCOM-SS', name: 'SCOM-SS - คลัง SS' },
  { id: 'SCOM-WN', name: 'SCOM-WN - คลัง WN' },
]

function getWarehouseLabel(id: string, name?: string) {
  if (id === 'SCOM-SS') return 'SCOM-SS (สมุทรสาคร)'
  if (id === 'SCOM-WN') return 'SCOM-WN (วังน้อย)'
  return name || id
}

export function BankPanel({ warehouses: initialWarehouses, onCountChange }: Props) {
  const [items, setItems] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)

  // ใช้ ref เพื่อป้องกัน load() เปลี่ยน reference ตลอดเวลาจนเกิด infinite loop
  const onCountChangeRef = useRef(onCountChange)
  onCountChangeRef.current = onCountChange

  const allWarehouses = useMemo(() => {
    return initialWarehouses && initialWarehouses.length > 0
      ? initialWarehouses
      : DEFAULT_WAREHOUSES
  }, [initialWarehouses])

  const allWarehouseIds = useMemo(() => {
    return allWarehouses.map((w) => w.id)
  }, [allWarehouses])

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editWarehouses, setEditWarehouses] = useState<string[]>([])

  // Add state (ค่าเริ่มต้นเลือกทุกคลัง)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newWarehouses, setNewWarehouses] = useState<string[]>([
    'SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN'
  ])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // โหลดรายการธนาคาร (เรียกเพียงครั้งเดียวตอน mount)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dropdown/banks')
      const data = await res.json()
      const list = data.banks || []
      setItems(list)
      onCountChangeRef.current?.(list.length)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Toggle สำหรับฟอร์มเพิ่ม
  const isNewAllSelected =
    allWarehouseIds.length > 0 &&
    allWarehouseIds.every((id) => newWarehouses.includes(id))

  function toggleNewSelectAll() {
    if (isNewAllSelected) {
      setNewWarehouses([])
    } else {
      setNewWarehouses([...allWarehouseIds])
    }
  }

  function toggleNewWarehouse(whId: string) {
    setNewWarehouses((prev) =>
      prev.includes(whId) ? prev.filter((id) => id !== whId) : [...prev, whId]
    )
  }

  // Toggle สำหรับฟอร์มแก้ไข
  const isEditAllSelected =
    allWarehouseIds.length > 0 &&
    allWarehouseIds.every((id) => editWarehouses.includes(id))

  function toggleEditSelectAll() {
    if (isEditAllSelected) {
      setEditWarehouses([])
    } else {
      setEditWarehouses([...allWarehouseIds])
    }
  }

  function toggleEditWarehouse(whId: string) {
    setEditWarehouses((prev) =>
      prev.includes(whId) ? prev.filter((id) => id !== whId) : [...prev, whId]
    )
  }

  // เพิ่มธนาคารใหม่
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newCode.trim()) return
    if (newWarehouses.length === 0) {
      setError('กรุณาเลือกคลังที่มีสิทธิใช้อย่างน้อย 1 คลัง')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/dropdown/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim(),
          warehouses: newWarehouses,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const next = [...items, data.bank]
        setItems(next)
        onCountChange(next.length)
        setNewName('')
        setNewCode('')
        setNewWarehouses([...allWarehouseIds])
        broadcastRealtime('dropdown-updated', { type: 'banks' })
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการเพิ่มธนาคาร')
      }
    } catch (err: any) {
      setError(err?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // เริ่มแก้ไข
  function startEdit(item: Bank) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditCode(item.code)
    const currentWh =
      item.warehouses && item.warehouses.length > 0
        ? item.warehouses
        : [...allWarehouseIds]
    setEditWarehouses(currentWh)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditCode('')
    setEditWarehouses([])
    setError('')
  }

  // บันทึกการแก้ไข
  async function handleSaveEdit(id: string) {
    if (!editName.trim() || !editCode.trim()) {
      setError('กรุณากรอกชื่อธนาคารและรหัส')
      return
    }
    if (editWarehouses.length === 0) {
      setError('กรุณาเลือกคลังที่มีสิทธิใช้อย่างน้อย 1 คลัง')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/dropdown/banks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim(),
          warehouses: editWarehouses,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setItems((prev) => prev.map((b) => (b.id === id ? data.bank : b)))
        cancelEdit()
        broadcastRealtime('dropdown-updated', { type: 'banks' })
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
      }
    } catch (err: any) {
      setError(err?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // ลบธนาคาร
  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบธนาคาร "${name}" ออกจากระบบ?`)) return
    try {
      const res = await fetch(`/api/dropdown/banks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        const next = items.filter((b) => b.id !== id)
        setItems(next)
        onCountChange(next.length)
        broadcastRealtime('dropdown-updated', { type: 'banks' })
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#E1E6EF]">
        <h2 className="text-base font-bold text-[#16233D]">ธนาคาร (Bank)</h2>
        <p className="text-xs text-[#5B6B85] mt-0.5">
          ใช้เลือกตอนกรอกบัญชีธนาคารของพนักงาน แสดงเฉพาะคลังที่ได้รับสิทธิ
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9AA5B8]">
            <Loader2 size={20} className="animate-spin mr-2" /> กำลังโหลด...
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E1E6EF]">
                <th className="px-7 py-3 text-xs font-semibold text-[#5B6B85] text-left">
                  ชื่อธนาคาร
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-[#5B6B85] text-left w-28">
                  รหัสธนาคาร
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-[#5B6B85] text-left">
                  คลังที่มีสิทธิใช้
                </th>
                <th className="px-7 py-3 w-20 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[#9AA5B8] text-sm">
                    ยังไม่มีธนาคาร — เพิ่มด้านล่าง
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const isEditing = editingId === item.id
                const isAllWh =
                  allWarehouseIds.length > 0 &&
                  (item.warehouses?.length || 0) >= allWarehouseIds.length

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'transition-colors',
                      isEditing ? 'bg-[#FAF5FF]/70' : 'hover:bg-[#F4F6FA]/50'
                    )}
                  >
                    {/* ชื่อธนาคาร */}
                    <td className="px-7 py-4 align-top">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input py-1.5 text-sm w-full max-w-[220px]"
                          placeholder="ชื่อธนาคาร"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-[#16233D]">
                          {item.name}
                        </span>
                      )}
                    </td>

                    {/* รหัสธนาคาร */}
                    <td className="px-4 py-4 align-top">
                      {isEditing ? (
                        <input
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="input py-1.5 text-sm w-24"
                          placeholder="รหัส เช่น 024"
                        />
                      ) : (
                        <span className="text-sm text-[#5B6B85]">{item.code}</span>
                      )}
                    </td>

                    {/* คลังที่มีสิทธิใช้ */}
                    <td className="px-4 py-4 align-top">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <label
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none',
                                isEditAllSelected
                                  ? 'border-[#7C3AED] bg-[#FAF5FF] text-[#7C3AED] font-semibold'
                                  : 'border-[#E1E6EF] bg-white text-[#16233D] hover:bg-[#F4F6FA]'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isEditAllSelected}
                                onChange={toggleEditSelectAll}
                                className="sr-only"
                              />
                              <span
                                className={cn(
                                  'w-3.5 h-3.5 rounded flex items-center justify-center transition-all flex-shrink-0',
                                  isEditAllSelected
                                    ? 'bg-[#7C3AED] border border-[#7C3AED] text-white shadow-xs'
                                    : 'border border-[#CBD5E1] bg-white'
                                )}
                              >
                                {isEditAllSelected && (
                                  <Check size={10} strokeWidth={3.5} className="text-white" />
                                )}
                              </span>
                              <span>เลือกทั้งหมด</span>
                            </label>
                            {allWarehouseIds.map((whId) => {
                              const checked = editWarehouses.includes(whId)
                              return (
                                <label
                                  key={whId}
                                  className={cn(
                                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors select-none',
                                    checked
                                      ? 'border-[#7C3AED] bg-[#FAF5FF] text-[#7C3AED] font-semibold'
                                      : 'border-[#E1E6EF] bg-white text-[#16233D] hover:bg-[#F4F6FA]'
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleEditWarehouse(whId)}
                                    className="sr-only"
                                  />
                                  <span
                                    className={cn(
                                      'w-3.5 h-3.5 rounded flex items-center justify-center transition-all flex-shrink-0',
                                      checked
                                        ? 'bg-[#7C3AED] border border-[#7C3AED] text-white shadow-xs'
                                        : 'border border-[#CBD5E1] bg-white'
                                    )}
                                  >
                                    {checked && (
                                      <Check size={10} strokeWidth={3.5} className="text-white" />
                                    )}
                                  </span>
                                  <span>{whId}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {isAllWh || !item.warehouses || item.warehouses.length === 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7C3AED] text-white shadow-sm">
                              ทุกคลัง ({allWarehouseIds.length})
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.warehouses.map((whId) => (
                                <span
                                  key={whId}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]"
                                >
                                  {whId}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-7 py-4 align-top text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={saving}
                            className="p-1.5 text-white bg-[#7C3AED] rounded-lg hover:bg-[#6D28D9] transition-colors shadow-sm disabled:opacity-50"
                            title="บันทึก"
                          >
                            {saving ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Check size={13} />
                            )}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-[#5B6B85] border border-[#E1E6EF] rounded-lg hover:bg-[#F4F6FA] transition-colors"
                            title="ยกเลิก"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-[#9AA5B8] hover:text-[#7C3AED] hover:border-[#7C3AED] border border-[#E1E6EF] rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1.5 text-[#E5484D] hover:bg-[#FCE8E8] border border-[#E1E6EF] rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form (Add or Edit) */}
      <div className="px-7 py-4 border-t border-[#E1E6EF] bg-[#FAFBFC]">
        {/* Warehouse Selection Header */}
        <div className="mb-2.5">
          <p className="text-xs font-semibold text-[#16233D]">
            {editingId
              ? `แก้ไขคลังที่มีสิทธิใช้สำหรับ "${editName || 'ธนาคารนี้'}" (เลือกได้มากกว่า 1 คลัง)`
              : 'คลังที่มีสิทธิใช้รายการนี้ เลือกได้มากกว่า 1 คลัง'}
          </p>
        </div>

        {/* Warehouse Checkbox Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3.5">
          {/* เลือกทั้งหมด */}
          <label
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none',
              (editingId ? isEditAllSelected : isNewAllSelected)
                ? 'border-[#7C3AED] bg-[#FAF5FF] text-[#7C3AED] font-semibold ring-1 ring-[#7C3AED]/20 shadow-sm'
                : 'border-[#E1E6EF] bg-white text-[#16233D] hover:bg-[#F4F6FA]'
            )}
          >
            <input
              type="checkbox"
              checked={editingId ? isEditAllSelected : isNewAllSelected}
              onChange={editingId ? toggleEditSelectAll : toggleNewSelectAll}
              className="sr-only"
            />
            <span
              className={cn(
                'w-4 h-4 rounded-md flex items-center justify-center transition-all flex-shrink-0',
                (editingId ? isEditAllSelected : isNewAllSelected)
                  ? 'bg-[#7C3AED] border border-[#7C3AED] text-white shadow-xs'
                  : 'border border-[#CBD5E1] bg-white'
              )}
            >
              {(editingId ? isEditAllSelected : isNewAllSelected) && (
                <Check size={11} strokeWidth={3.5} className="text-white" />
              )}
            </span>
            <span>เลือกทั้งหมด</span>
          </label>

          {/* รายชื่อคลังทั้งหมด */}
          {allWarehouseIds.map((whId) => {
            const whObj = allWarehouses.find((w) => w.id === whId)
            const isChecked = editingId
              ? editWarehouses.includes(whId)
              : newWarehouses.includes(whId)

            return (
              <label
                key={whId}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none',
                  isChecked
                    ? 'border-[#7C3AED] bg-[#FAF5FF] text-[#7C3AED] font-semibold ring-1 ring-[#7C3AED]/20 shadow-sm'
                    : 'border-[#E1E6EF] bg-white text-[#16233D] hover:bg-[#F4F6FA]'
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    editingId ? toggleEditWarehouse(whId) : toggleNewWarehouse(whId)
                  }
                  className="sr-only"
                />
                <span
                  className={cn(
                    'w-4 h-4 rounded-md flex items-center justify-center transition-all flex-shrink-0',
                    isChecked
                      ? 'bg-[#7C3AED] border border-[#7C3AED] text-white shadow-xs'
                      : 'border border-[#CBD5E1] bg-white'
                  )}
                >
                  {isChecked && <Check size={11} strokeWidth={3.5} className="text-white" />}
                </span>
                <span>{getWarehouseLabel(whId, whObj?.name)}</span>
              </label>
            )
          })}
        </div>

        {/* Inputs & Action Button */}
        {editingId ? (
          <div className="flex items-center gap-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input text-sm flex-1 bg-white"
              placeholder="ชื่อธนาคาร"
            />
            <input
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              className="input text-sm w-36 bg-white"
              placeholder="รหัส เช่น 024"
            />
            <button
              onClick={() => handleSaveEdit(editingId)}
              disabled={saving || !editName.trim() || !editCode.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors flex-shrink-0 disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
              บันทึกการแก้ไข
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#5B6B85] border border-[#E1E6EF] bg-white hover:bg-[#F4F6FA] transition-colors flex-shrink-0"
            >
              ยกเลิก
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdd} className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input text-sm flex-1 bg-white"
              placeholder="ชื่อธนาคารใหม่ เช่น ยูโอบี"
            />
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="input text-sm w-36 bg-white"
              placeholder="รหัส เช่น 024"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim() || !newCode.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors flex-shrink-0 disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
              เพิ่ม
            </button>
          </form>
        )}

        {error && <p className="text-xs text-[#E5484D] mt-2 font-medium">{error}</p>}
      </div>
    </div>
  )
}
