'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Loader2, X, Check } from 'lucide-react'
import type { Warehouse } from '@/types'

interface Props {
  onCountChange: (n: number) => void
  onWarehouseChange: () => void
}

export function WarehousePanel({ onCountChange, onWarehouseChange }: Props) {
  const [items, setItems] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/warehouses')
    const data = await res.json()
    const list = data.warehouses || []
    setItems(list)
    onCountChange(list.length)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newId.trim() || !newName.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/warehouses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId.trim(), name: newName.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      const next = [...items, data.warehouse]
      setItems(next)
      onCountChange(next.length)
      setNewId('')
      setNewName('')
      onWarehouseChange()
    } else {
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/warehouses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems((prev) => prev.map((w) => (w.id === id ? data.warehouse : w)))
      setEditingId(null)
      onWarehouseChange()
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบคลัง "${id} - ${name}" ออกจากระบบ?\n\n⚠️ การลบคลังจะส่งผลต่อข้อมูลพนักงาน, กะ, แผนก และ Namelist ทั้งหมดที่ผูกกับคลังนี้`)) return
    const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const next = items.filter((w) => w.id !== id)
      setItems(next)
      onCountChange(next.length)
      onWarehouseChange()
    } else {
      const data = await res.json()
      alert(data.error || 'ไม่สามารถลบได้')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#E1E6EF]">
        <h2 className="text-base font-bold text-[#16233D]">คลัง (Warehouse)</h2>
        <p className="text-xs text-[#5B6B85] mt-0.5">
          ใช้เลือกตอนกำหนดสิทธิ์ผู้ใช้งานและกรอง Namelist/รายงานตามคลัง
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
                <th className="px-7 py-3 text-xs font-semibold text-[#5B6B85] text-left w-36">รหัสคลัง</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#5B6B85] text-left">ชื่อคลัง</th>
                <th className="px-7 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-[#9AA5B8] text-sm">
                    ยังไม่มีคลัง — เพิ่มด้านล่าง
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F4F6FA]/50 transition-colors">
                  <td className="px-7 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#F3EEFE] text-[#7C3AED]">
                      {item.id}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input py-1.5 text-sm max-w-[320px]"
                        placeholder="ชื่อคลัง"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[#16233D]">{item.name}</span>
                    )}
                  </td>
                  <td className="px-7 py-4">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={saving}
                          className="p-1.5 text-white bg-[#7C3AED] rounded-lg hover:bg-[#6D28D9]"
                        >
                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-[#5B6B85] border border-[#E1E6EF] rounded-lg hover:bg-[#F4F6FA]"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setEditingId(item.id); setEditName(item.name) }}
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex items-center gap-3 px-7 py-4 border-t border-[#E1E6EF] bg-[#FAFBFC]"
      >
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value.toUpperCase())}
          className="input text-sm w-44 uppercase"
          placeholder="รหัสคลัง เช่น SOCX"
          maxLength={10}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input text-sm flex-1"
          placeholder="ชื่อคลังใหม่ เช่น คลังสินค้า SOCX"
        />
        <button
          type="submit"
          disabled={saving || !newId.trim() || !newName.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors flex-shrink-0 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
          เพิ่ม
        </button>
      </form>
      {error && <p className="text-xs text-[#E5484D] px-7 pb-3">{error}</p>}
    </div>
  )
}
