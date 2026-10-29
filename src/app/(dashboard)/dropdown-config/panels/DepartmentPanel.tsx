'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Loader2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthSession, Department } from '@/types'

interface Props {
  warehouse: string
  session: AuthSession
  onCountChange: (n: number) => void
}

export function DepartmentPanel({ warehouse, session, onCountChange }: Props) {
  const [items, setItems] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editShiftName, setEditShiftName] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('')
  const [newShiftName, setNewShiftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = true

  const load = useCallback(async () => {
    if (!warehouse) return
    setLoading(true)
    const res = await fetch(`/api/dropdown/departments?warehouse=${warehouse}`)
    const data = await res.json()
    const list = data.departments || []
    setItems(list)
    onCountChange(list.length)
    setLoading(false)
  }, [warehouse])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newShiftName.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/dropdown/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse, type: newType.trim(), name: newName.trim(), shift_name: newShiftName.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (res.ok) {
      const next = [...items, data.department]
      setItems(next)
      onCountChange(next.length)
      setNewName('')
      setNewType('')
      setNewShiftName('')
    } else {
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/dropdown/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: editType.trim(), name: editName, shift_name: editShiftName.toUpperCase() }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems((prev) => prev.map((d) => (d.id === id ? data.department : d)))
      setEditingId(null)
    } else {
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบแผนก "${name}" ออกจากระบบ?`)) return
    const res = await fetch(`/api/dropdown/departments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const next = items.filter((d) => d.id !== id)
      setItems(next)
      onCountChange(next.length)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#E1E6EF]">
        <h2 className="text-base font-bold text-[#16233D]">แผนก (Department)</h2>
        <p className="text-xs text-[#5B6B85] mt-0.5">
          ใช้เลือกตอน Namelist และจัดแพลนพนักงาน ผูกกับคลังและกะที่เกี่ยวข้อง
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
                <th className="px-7 py-3 text-xs font-semibold text-[#5B6B85] text-left w-24">TYPE</th>
                <th className="px-3 py-3 text-xs font-semibold text-[#5B6B85] text-left">แผนก</th>
                <th className="px-3 py-3 text-xs font-semibold text-[#5B6B85] text-left">SHIFT NAME</th>
                {canEdit && <th className="px-7 py-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-[#9AA5B8] text-sm">
                    ยังไม่มีแผนก — เพิ่มด้านล่าง
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F4F6FA]/50 transition-colors">
                  <td className="px-7 py-4">
                    {editingId === item.id ? (
                      <input
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="input py-1.5 text-sm max-w-[120px]"
                        placeholder="เช่น IB"
                      />
                    ) : item.type ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#EEF3FC] text-[#2558B8]">
                        {item.type}
                      </span>
                    ) : (
                      <span className="text-sm text-[#9AA5B8]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input py-1.5 text-sm max-w-[200px]"
                      />
                    ) : (
                      <span className="text-sm font-medium text-[#16233D]">{item.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {editingId === item.id ? (
                      <input
                        value={editShiftName}
                        onChange={(e) => setEditShiftName(e.target.value)}
                        className="input py-1.5 text-sm max-w-[120px] uppercase"
                        placeholder="เช่น IB-D"
                      />
                    ) : (
                      <span className="text-sm text-[#5B6B85]">{item.shift_name}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-7 py-4">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={saving}
                            className="p-1.5 text-white bg-[#2E6FE0] rounded-lg hover:bg-[#2558B8] transition-colors"
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
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingId(item.id)
                              setEditType(item.type || '')
                              setEditName(item.name)
                              setEditShiftName(item.shift_name)
                            }}
                            className="p-1.5 text-[#5B6B85] hover:text-[#2558B8] hover:bg-[#EEF3FC] border border-[#E1E6EF] rounded-lg transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1.5 text-[#E5484D] hover:bg-[#FCE8E8] border border-[#E1E6EF] rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add form */}
      {canEdit && (
        <form
          onSubmit={handleAdd}
          className="flex items-center gap-3 px-7 py-4 border-t border-[#E1E6EF] bg-[#FAFBFC]"
        >
          <span className="text-xs font-medium text-[#5B6B85] flex-shrink-0">คลัง {warehouse}</span>
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="input text-sm max-w-[110px]"
            placeholder="TYPE เช่น IB"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input text-sm"
            placeholder="ชื่อแผนกใหม่ เช่น QC"
          />
          <input
            value={newShiftName}
            onChange={(e) => setNewShiftName(e.target.value)}
            className="input text-sm max-w-[120px] uppercase"
            placeholder="เช่น IB-D"
          />
          <button type="submit" disabled={saving || !newName.trim() || !newShiftName.trim()} className="btn-primary flex-shrink-0 gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            เพิ่ม
          </button>
        </form>
      )}
      {error && <p className="text-xs text-[#E5484D] px-7 pb-3">{error}</p>}
    </div>
  )
}
