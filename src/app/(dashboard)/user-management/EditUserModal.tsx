'use client'

import { useState, useEffect } from 'react'
import { X, RefreshCw, Eye, EyeOff, Loader2, AlertTriangle, Copy, Check } from 'lucide-react'
import { generatePassword } from '@/lib/utils'
import { broadcastRealtime } from '@/lib/realtime'
import type { Warehouse, SystemUser } from '@/types'

interface EditUserModalProps {
  user: SystemUser
  onClose: () => void
  onSuccess: (user: SystemUser) => void
  onDelete: (id: string) => void
}

export function EditUserModal({ user, onClose, onSuccess, onDelete }: EditUserModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    selectedWarehouses: user.warehouses || [],
  })
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [copiedCurrent, setCopiedCurrent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((d) => setWarehouses(d.warehouses || []))
  }, [])

  function toggleWarehouse(id: string) {
    setForm((prev) => ({
      ...prev,
      selectedWarehouses: prev.selectedWarehouses.includes(id)
        ? prev.selectedWarehouses.filter((w) => w !== id)
        : [...prev.selectedWarehouses, id],
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.selectedWarehouses.length === 0) {
      setError('กรุณาเลือกคลัง/สาขาอย่างน้อย 1 คลัง')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        warehouses: form.selectedWarehouses,
      }
      if (newPassword) body.password = newPassword

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        return
      }

      // ส่งสัญญาณ Realtime ทันที
      broadcastRealtime('user-updated', {
        userId: user.id,
        warehouses: form.selectedWarehouses,
        role: form.role,
        passwordChanged: !!newPassword,
      })

      onSuccess(data.user)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeactivate() {
    if (!confirm(`ปิดใช้งานบัญชี "${user.name}"? ผู้ใช้งานจะล็อกอินไม่ได้ทันที แต่ข้อมูลยังอยู่ในระบบ`)) return
    setLoading(true)
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    const data = await res.json()
    if (res.ok) {
      broadcastRealtime('user-updated', {
        userId: user.id,
        is_active: !user.is_active,
      })
      onSuccess(data.user)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">แก้ไข Role และคลังที่สังกัดได้ — อีเมลไม่สามารถเปลี่ยนได้จากหน้านี้</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Section 1: ข้อมูลผู้ใช้งาน */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
              <h3 className="font-semibold text-gray-800">ข้อมูลผู้ใช้งาน</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">ชื่อ-นามสกุล</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">อีเมล</label>
                <input
                  type="text"
                  className="input bg-gray-50"
                  value={form.email}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Section 2: สิทธิ์การใช้งาน */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
              <h3 className="font-semibold text-gray-800">สิทธิ์การใช้งาน</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as SystemUser['role'] })}
                >
                  <option value="admin">Admin</option>
                  <option value="payroll">Payroll</option>
                </select>
              </div>
              <div>
                <label className="label">คลัง/สาขาที่ประจำ (เลือกได้มากกว่า 1 คลัง)</label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
                  {warehouses.map((w) => (
                    <label key={w.id} className="flex items-center gap-2 cursor-pointer group">
                      <div
                        onClick={() => toggleWarehouse(w.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                          form.selectedWarehouses.includes(w.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 group-hover:border-blue-400'
                        }`}
                      >
                        {form.selectedWarehouses.includes(w.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-700 font-medium">{w.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: ความปลอดภัยบัญชี */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">3</span>
              <h3 className="font-semibold text-gray-800">ความปลอดภัยบัญชี</h3>
            </div>

            {/* รหัสผ่านเดิม / ปัจจุบัน */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <label className="label">รหัสผ่านปัจจุบัน</label>
              {user.plain_password ? (
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={user.plain_password}
                      readOnly
                      className="input pr-10 font-mono text-sm bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title={showCurrentPassword ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                    >
                      {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (user.plain_password) {
                        navigator.clipboard.writeText(user.plain_password)
                        setCopiedCurrent(true)
                        setTimeout(() => setCopiedCurrent(false), 1500)
                      }
                    }}
                    className="btn-secondary text-xs gap-1.5 flex-shrink-0 cursor-pointer"
                  >
                    {copiedCurrent ? <Check size={13} className="text-[#2E9E5B]" /> : <Copy size={13} />}
                    {copiedCurrent ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  ยังไม่ได้บันทึกรหัสผ่านเดิม (หากสร้างรหัสผ่านใหม่ด้านล่าง ระบบจะบันทึกให้อัตโนมัติ)
                </p>
              )}
            </div>

            <div>
              <label className="label">สร้างรหัสผ่านใหม่</label>
              <p className="text-xs text-gray-400 mb-2">
                ระบบจะสุ่มรหัสผ่านให้กับผู้ใช้ ไม่มีการส่งอีเมลอัตโนมัติ — ต้องแจ้งผู้ใช้งานเอง
              </p>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="ยังไม่ได้สร้างรหัสผ่านใหม่"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewPassword(generatePassword())
                    setShowPassword(true)
                  }}
                  className="btn-secondary text-xs gap-1.5 flex-shrink-0 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  สร้างรหัสผ่านใหม่
                </button>
              </div>
            </div>

            {/* Deactivate */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">ปิดใช้งานบัญชี</p>
                  <p className="text-xs text-gray-400">ผู้ใช้งานจะเข้าสู่ระบบไม่ได้ทันที แต่ข้อมูลจะอยู่เหมือนเดิม</p>
                </div>
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    user.is_active
                      ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'
                      : 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                  }`}
                >
                  <AlertTriangle size={14} />
                  {user.is_active ? 'ปิดใช้งานบัญชีนี้' : 'เปิดใช้งานบัญชีนี้'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">ยกเลิก</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
