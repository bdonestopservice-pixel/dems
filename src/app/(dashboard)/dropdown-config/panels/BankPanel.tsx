'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Loader2, X, Check } from 'lucide-react'
import type { Bank } from '@/types'

interface Props {
  onCountChange: (n: number) => void
}

export function BankPanel({ onCountChange }: Props) {
  const [items, setItems] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dropdown/banks')
    const data = await res.json()
    const list = data.banks || []
    setItems(list)
    onCountChange(list.length)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newCode.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/dropdown/banks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), code: newCode.trim().toUpperCase() }),
    })
    const data = await res.json()
    if (res.ok) {
      const next = [...items, data.bank]
      setItems(next)
      onCountChange(next.length)
      setNewName('')
      setNewCode('')
    } else {
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/dropdown/banks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, code: editCode.toUpperCase() }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems((prev) => prev.map((b) => (b.id === id ? data.bank : b)))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`ลบธนาคาร "${name}" ออกจากระบบ?`)) return
    const res = await fetch(`/api/dropdown/banks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const next = items.filter((b) => b.id !== id)
      setItems(next)
      onCountChange(next.length)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#E1E6EF]">
        <h2 className="text-base font-bold text-[#16233D]">ธนาคาร (Bank)</h2>
        <p className="text-xs text-[#5B6B85] mt-0.5">
          ใช้เลือกตอนกรอกบัญชีธนาคารของพนักงาน ใช้ร่วมกันทุกคลัง
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
                <th className="px-7 py-3 text-xs font-semibold text-[#5B6B85] text-left">ชื่อธนาคาร</th>
                <th className="px-4 py-3 text-xs font-semibold text-[#5B6B85] text-left w-36">รหัสธนาคาร</th>
                <th className="px-7 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-[#9AA5B8] text-sm">
                    ยังไม่มีธนาคาร — เพิ่มด้านล่าง
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
                        placeholder="ชื่อธนาคาร"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-[#16233D]">{item.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {editingId === item.id ? (
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="input py-1.5 text-sm w-28 uppercase"
                        placeholder="รหัส เช่น 024"
                      />
                    ) : (
                      <span className="text-sm text-[#5B6B85]">{item.code}</span>
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
                          onClick={() => { setEditingId(item.id); setEditName(item.name); setEditCode(item.code) }}
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
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input text-sm flex-1"
          placeholder="ชื่อธนาคารใหม่ เช่น ยูโอบี"
        />
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          className="input text-sm w-44"
          placeholder="รหัส เช่น 024"
        />
        <button
          type="submit"
          disabled={saving || !newName.trim() || !newCode.trim()}
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
