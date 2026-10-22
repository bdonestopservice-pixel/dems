'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Pencil, Trash2, ChevronDown, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { broadcastRealtime } from '@/lib/realtime'
import { useRealtimeListener } from '@/components/providers/RealtimeProvider'
import type { SystemUser } from '@/types'
import { AddUserModal } from './AddUserModal'
import { EditUserModal } from './EditUserModal'

const roleBadge = {
  super_admin: <span className="badge-super-admin">Super Admin</span>,
  admin: <span className="badge-admin">Admin</span>,
  payroll: <span className="badge-payroll">Payroll</span>,
}

const avatarColors: Record<string, string> = {
  super_admin: 'bg-purple-600',
  admin: 'bg-blue-600',
  payroll: 'bg-orange-500',
}

export function UserManagementClient() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // อัปเดตข้อมูลผู้ใช้งานในตารางทันทีแบบ Realtime
  useRealtimeListener('user-updated', () => {
    fetchUsers()
  })

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  async function handleDelete(user: SystemUser) {
    if (!confirm(`ลบบัญชี "${user.name}" ออกจากระบบ?`)) return
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      broadcastRealtime('user-updated', { userId: user.id, is_active: false })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } else {
      const data = await res.json()
      alert(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  const roleOptions = [
    { value: 'all', label: 'ทุก Role' },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'payroll', label: 'Payroll' },
  ]

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA5B8]" />
          <input
            type="text"
            placeholder="ค้นหาชื่อหรืออีเมล"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* Role filter */}
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="btn-secondary gap-2 min-w-[120px] justify-between"
          >
            {roleOptions.find((r) => r.value === roleFilter)?.label || 'ทุก Role'}
            <ChevronDown size={14} />
          </button>
          {showRoleDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[140px] py-1">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setRoleFilter(opt.value)
                    setShowRoleDropdown(false)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                    roleFilter === opt.value && 'text-blue-600 font-medium bg-blue-50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add user */}
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus size={16} />
          เพิ่มผู้ใช้งานใหม่
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr className="border-b border-[#E1E6EF]">
                <th className="py-3.5 px-6 font-semibold text-xs text-[#5B6B85]">ผู้ใช้งาน</th>
                <th className="py-3.5 px-6 font-semibold text-xs text-[#5B6B85]">Role</th>
                <th className="py-3.5 px-6 font-semibold text-xs text-[#5B6B85]">คลัง/สาขา</th>
                <th className="py-3.5 px-6 font-semibold text-xs text-[#5B6B85]">รหัสผ่าน</th>
                <th className="py-3.5 px-6 font-semibold text-xs text-[#5B6B85]">สถานะ</th>
                <th className="py-3.5 px-6 font-semibold text-xs text-[#5B6B85] w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#9AA5B8]">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#9AA5B8]">
                    ไม่พบผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F4F6FA]/50 transition-colors">
                    {/* User info */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm',
                            user.role === 'super_admin' ? 'bg-[#2E6FE0]' : 'bg-[#9AA5B8]'
                          )}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[#16233D] flex items-center gap-1.5">
                            {user.name}
                            {user.role === 'super_admin' && (
                              <span className="text-xs text-[#2558B8] font-medium">(คุณ)</span>
                            )}
                          </div>
                          <div className="text-xs text-[#5B6B85] mt-0.5">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {user.role === 'super_admin' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#EEF3FC] text-[#2558B8] whitespace-nowrap">
                          Super Admin
                        </span>
                      ) : user.role === 'admin' ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#334155] whitespace-nowrap">
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#F5F3FF] text-[#7C3AED] whitespace-nowrap">
                          Payroll
                        </span>
                      )}
                    </td>

                    {/* Warehouses */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {user.role === 'super_admin' ? (
                          <span className="text-xs font-normal text-[#5B6B85]">ทุกคลัง</span>
                        ) : user.warehouses?.length > 0 ? (
                          user.warehouses.map((w) => (
                            <span
                              key={w}
                              className="text-xs bg-white text-[#16233D] border border-[#E1E6EF] px-2.5 py-0.5 rounded-md font-medium"
                            >
                              {w}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#9AA5B8] text-xs">—</span>
                        )}
                      </div>
                    </td>

                    {/* Password */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {user.plain_password ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-[#16233D] bg-[#F4F6FA] border border-[#E1E6EF] px-2.5 py-1 rounded-md min-w-[70px] text-center select-all">
                            {revealedPasswords[user.id] ? user.plain_password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedPasswords((prev) => ({
                                ...prev,
                                [user.id]: !prev[user.id],
                              }))
                            }
                            className="p-1.5 rounded-lg text-[#5B6B85] hover:text-[#2E6FE0] hover:bg-[#EEF3FC] border border-[#E1E6EF] transition-colors cursor-pointer"
                            title={revealedPasswords[user.id] ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                          >
                            {revealedPasswords[user.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (user.plain_password) {
                                navigator.clipboard.writeText(user.plain_password)
                                setCopiedId(user.id)
                                setTimeout(() => setCopiedId(null), 1500)
                              }
                            }}
                            className="p-1.5 rounded-lg text-[#5B6B85] hover:text-[#2E9E5B] hover:bg-[#E7F6ED] border border-[#E1E6EF] transition-colors cursor-pointer"
                            title="คัดลอกรหัสผ่าน"
                          >
                            {copiedId === user.id ? (
                              <Check size={13} className="text-[#2E9E5B]" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span
                          className="text-xs text-[#9AA5B8] italic"
                          title="ยังไม่ได้บันทึกรหัสผ่านเดิม สามารถกดแก้ไขเพื่อสร้างรหัสใหม่ได้"
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {user.is_active ? (
                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-[#E7F6ED] text-[#2E9E5B]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold bg-[#FCE8E8] text-[#E5484D]">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-[#5B6B85] hover:text-[#2558B8] hover:bg-[#EEF3FC] border border-[#E1E6EF] rounded-lg transition-colors cursor-pointer"
                          title="แก้ไข / เปลี่ยนรหัสผ่าน"
                        >
                          <Pencil size={14} />
                        </button>
                        {user.role !== 'super_admin' && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 text-[#E5484D] hover:text-[#E5484D] hover:bg-[#FCE8E8] border border-[#E1E6EF] rounded-lg transition-colors cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Modals */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newUser) => {
            setUsers((prev) => [...prev, newUser])
            setShowAddModal(false)
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
            setEditingUser(null)
          }}
          onDelete={(id) => {
            setUsers((prev) => prev.filter((u) => u.id !== id))
            setEditingUser(null)
          }}
        />
      )}

      {/* Close dropdown on outside click */}
      {showRoleDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowRoleDropdown(false)}
        />
      )}
    </>
  )
}
