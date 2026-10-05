'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Loader2, X, Check } from 'lucide-react'
import type { AuthSession, OaOption } from '@/types'

interface Props {
  warehouse: string
  session: AuthSession
  onCountChange: (n: number) => void
}

export function OaPanel({ warehouse, session, onCountChange }: Props) {
  const [items, setItems] = useState<OaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = true

  const load = useCallback(async () => {
    if (!warehouse) return
    setLoading(true)
    const res = await fetch(`/api/dropdown/oa-options?warehouse=${warehouse}`)
    const data = await res.json()
    const list = data.oa_options || []
    setItems(list)
    onCountChange(list.length + 1) // +1 รวมค่าเริ่มต้น "-"
    setLoading(false)
  }, [warehouse])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/dropdown/oa-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse, name: newName.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      const next = [...items, data.oa_option]
      setItems(next)
      onCountChange(next.length + 1)
      setNewName('')
    } else {
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/dropdown/oa-options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems((prev) => prev.map((o) => (o.id === id ? data.oa_option : o)))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return
    const res = await fetch(`/api/dropdown/oa-options/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const next = items.filter((o) => o.id !== id)
      setItems(next)
      onCountChange(next.length + 1)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#E1E6EF]">
        <h2 className="text-base font-bold text-[#16233D]">ต่างพื้นที่ (OA)</h2>
        <p className="text-xs text-[#5B6B85] mt-0.5">
          ใช้เลือกในหน้า Namelist เมื่อพนักงานถูกส่งไปทำงานต่างพื้นที่ · คลัง {warehouse}
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
                <th className="px-7 py-3 text-xs font-semibold text-[#5B6B85] text-left">ค่า</th>
                {canEdit && <th className="px-7 py-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {/* Fixed default row */}
              <tr className="bg-[#FAFBFC]">
                <td className="px-7 py-4 text-sm text-[#9AA5B8] italic">
                  - (ค่าเริ่มต้น)
                </td>
                {canEdit && <td className="px-7 py-4" />}
              </tr>

              {items.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-8 text-[#9AA5B8] text-sm">
                    ยังไม่มีตัวเลือกต่างพื้นที่ — เพิ่มด้านล่าง
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F4F6FA]/50 transition-colors">
                  <td className="px-7 py-4">
                    {editingId === item.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input py-1.5 text-sm max-w-[280px]"
                      />
                    ) : (
                      <span className="text-sm font-medium text-[#16233D]">{item.name}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-7 py-4">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={saving}
                            className="p-1.5 text-white bg-[#2E6FE0] rounded-lg hover:bg-[#2558B8]"
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
                            onClick={() => { setEditingId(item.id); setEditName(item.name) }}
                            className="p-1.5 text-[#5B6B85] hover:text-[#2558B8] hover:bg-[#EEF3FC] border border-[#E1E6EF] rounded-lg"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1.5 text-[#E5484D] hover:bg-[#FCE8E8] border border-[#E1E6EF] rounded-lg"
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
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input text-sm flex-1"
            placeholder="เพิ่มค่าใหม่ เช่น OA2"
          />
          <button type="submit" disabled={saving || !newName.trim()} className="btn-primary flex-shrink-0 gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            เพิ่ม
          </button>
        </form>
      )}
      {error && <p className="text-xs text-[#E5484D] px-7 pb-3">{error}</p>}
    </div>
  )
}
