'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Loader2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthSession, Shift } from '@/types'
import { TimePicker24h } from '@/components/ui/TimePicker24h'

interface Props {
  warehouse: string
  session: AuthSession
  onCountChange: (n: number) => void
}

export function ShiftPanel({ warehouse, session, onCountChange }: Props) {
  const [items, setItems] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editType, setEditType] = useState<'D' | 'N' | 'H'>('D')
  const [newStart, setNewStart] = useState('06:00')
  const [newEnd, setNewEnd] = useState('18:00')
  const [newType, setNewType] = useState<'D' | 'N' | 'H'>('D')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = true

  const load = useCallback(async () => {
    if (!warehouse) return
    setLoading(true)
    const res = await fetch(`/api/dropdown/shifts?warehouse=${warehouse}`)
    const data = await res.json()
    const list = data.shifts || []
    setItems(list)
    onCountChange(list.length)
    setLoading(false)
  }, [warehouse])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newStart || !newEnd) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/dropdown/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouse, start_time: newStart, end_time: newEnd, type: newType }),
    })
    const data = await res.json()
    if (res.ok) {
      const next = [...items, data.shift]
      setItems(next)
      onCountChange(next.length)
      setNewStart('06:00')
      setNewEnd('18:00')
      setNewType('D')
    } else {
      setError(data.error || 'เกิดข้อผิดพลาด')
    }
    setSaving(false)
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/dropdown/shifts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: editStart, end_time: editEnd, type: editType }),
    })
    const data = await res.json()
    if (res.ok) {
      setItems((prev) => prev.map((s) => (s.id === id ? data.shift : s)))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`ลบกะ "${label}" ออกจากระบบ?`)) return
    const res = await fetch(`/api/dropdown/shifts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const next = items.filter((s) => s.id !== id)
      setItems(next)
      onCountChange(next.length)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[#E1E6EF]">
        <h2 className="text-base font-bold text-[#16233D]">กะ (Shift)</h2>
        <p className="text-xs text-[#5B6B85] mt-0.5">
          ใช้เลือกตอน Namelist และจัดแพลนพนักงาน กำหนดช่วงเวลาและประเภท (D/N) · คลัง {warehouse}
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
                <th className="px-7 py-3 text-xs font-semibold text-[#5B6B85] text-left">ช่วงเวลา</th>
                <th className="px-3 py-3 text-xs font-semibold text-[#5B6B85] text-left">ประเภท</th>
                {canEdit && <th className="px-7 py-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-[#9AA5B8] text-sm">
                    ยังไม่มีกะ — เพิ่มด้านล่าง
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F4F6FA]/50 transition-colors">
                  <td className="px-7 py-4">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <TimePicker24h
                          value={editStart}
                          onChange={setEditStart}
                          className="w-[120px]"
                          placement="bottom"
                        />
                        <span className="text-[#5B6B85]">–</span>
                        <TimePicker24h
                          value={editEnd}
                          onChange={setEditEnd}
                          className="w-[120px]"
                          placement="bottom"
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-[#16233D]">
                        {item.start_time}–{item.end_time}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {editingId === item.id ? (
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as 'D' | 'N' | 'H')}
                        className="input py-1.5 text-sm w-20"
                      >
                        <option value="D">D</option>
                        <option value="N">N</option>
                        <option value="H">H</option>
                      </select>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                          item.type === 'D'
                            ? 'bg-[#FEF3E2] text-[#B45F17]'
                            : item.type === 'H'
                            ? 'bg-[#E1F0FF] text-[#0066CC]'
                            : 'bg-[#16233D] text-white'
                        )}
                      >
                        {item.type}
                      </span>
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
                              setEditStart(item.start_time)
                              setEditEnd(item.end_time)
                              setEditType(item.type)
                            }}
                            className="p-1.5 text-[#5B6B85] hover:text-[#2558B8] hover:bg-[#EEF3FC] border border-[#E1E6EF] rounded-lg transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, `${item.start_time}–${item.end_time}`)}
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
          <TimePicker24h
            value={newStart}
            onChange={setNewStart}
            className="w-[130px]"
            placement="top"
          />
          <span className="text-[#5B6B85] font-medium">–</span>
          <TimePicker24h
            value={newEnd}
            onChange={setNewEnd}
            className="w-[130px]"
            placement="top"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'D' | 'N' | 'H')}
            className="input text-sm w-20"
          >
            <option value="D">D</option>
            <option value="N">N</option>
            <option value="H">H</option>
          </select>
          <button type="submit" disabled={saving} className="btn-primary flex-shrink-0 gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            เพิ่ม
          </button>
        </form>
      )}
      {error && <p className="text-xs text-[#E5484D] px-7 pb-3">{error}</p>}
    </div>
  )
}
