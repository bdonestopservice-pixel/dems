'use client'

import { useState, useEffect } from 'react'
import { X, RefreshCw, Eye, EyeOff, Loader2 } from 'lucide-react'
import { generatePassword } from '@/lib/utils'
import type { Warehouse, SystemUser } from '@/types'

interface AddUserModalProps {
  onClose: () => void
  onSuccess: (user: SystemUser) => void
}

export function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    selectedWarehouses: [] as string[],
  })
  const [showPassword, setShowPassword] = useState(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.selectedWarehouses.length === 0) {
      setError('กรุณาเลือกคลัง/สาขาอย่างน้อย 1 คลัง')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          warehouses: form.selectedWarehouses,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        return
      }
      onSuccess(data.user)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">เพิ่มผู้ใช้งานใหม่</h2>
            <p className="text-xs text-gray-400 mt-0.5">สร้างบัญชีด้วยอีเมลและตั้งรหัสผ่านให้กัน</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section 1: บัญชี */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
              <h3 className="font-semibold text-gray-800">ข้อมูลบัญชี</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label label-required">ชื่อ-นามสกุล</label>
                <input
                  className="input"
                  placeholder="เช่น สมหญิง ใจงาม"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label label-required">อีเมล</label>
                <input
                  type="text"
                  className="input"
                  placeholder="name@peopleone.co.th"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="label label-required">ตั้งรหัสผ่าน</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="btn-secondary text-xs gap-1.5 flex-shrink-0"
                  title="สร้างรหัสผ่านอัตโนมัติ"
                >
                  <RefreshCw size={13} />
                  สร้างอัตโนมัติ
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">ผู้ใช้งานสามารถเปลี่ยนรหัสผ่านได้จาก Login</p>
            </div>
          </div>

          {/* Section 2: สิทธิ์ */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
              <h3 className="font-semibold text-gray-800">สิทธิ์การใช้งาน</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label label-required">Role</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="admin">Admin</option>
                  <option value="payroll">Payroll</option>
                </select>
              </div>
              <div>
                <label className="label label-required">คลัง/สาขาที่ประจำ (เลือกได้มากกว่า 1 คลัง)</label>
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
            <p className="text-xs text-gray-400 mt-3">
              ผู้ใช้งาน Role นี้จะเข้าและจัดการข้อมูลได้เฉพาะคลังที่เลือกไว้เท่านั้น (เลือกได้หลายคลังพร้อมกัน) ยกเว้นฐานข้อมูลพนักงานที่ใช้ร่วมกัน
            </p>
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
              {loading ? <Loader2 size={15} className="animate-spin" /> : <></>}
              + สร้างบัญชีผู้ใช้งาน
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
