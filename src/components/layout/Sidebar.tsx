'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  User,
  Calendar,
  ClipboardList,
  Download,
  SlidersHorizontal,
  Users,
  LogOut,
  Menu,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { AuthSession } from '@/types'
import { LOGO_URL } from '@/lib/brand'
import { useActiveWarehouse } from '@/lib/use-active-warehouse'

interface SidebarProps {
  session?: AuthSession | null
  isCollapsed: boolean
  onToggle: () => void
}

const mainNav = [
  { href: '/overview', label: 'ภาพรวม', icon: Home },
  { href: '/employees', label: 'ข้อมูลพนักงาน', icon: User },
  { href: '/planning', label: 'จัดแพลนพนักงาน', icon: Calendar },
  { href: '/namelist', label: 'Namelist', icon: ClipboardList },
  { href: '/reports', label: 'รายงาน', icon: Download },
]

const adminNav = [
  {
    href: '/dropdown-config',
    label: 'จัดการข้อมูล Dropdown',
    icon: SlidersHorizontal,
    roles: ['super_admin', 'admin', 'payroll'],
  },
  {
    href: '/user-management',
    label: 'จัดการผู้ใช้งาน',
    icon: Users,
    roles: ['super_admin'],
    badge: 'Super Admin',
  },
]

export function Sidebar({ session, isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const roleLabel =
    session?.role === 'super_admin'
      ? 'Super Admin'
      : session?.role === 'admin'
      ? 'Admin'
      : 'Payroll'

  const [activeWarehouse] = useActiveWarehouse(session?.warehouses?.[0] || '')
  // หมายเหตุ: ไม่ตรวจกับ session.warehouses เพราะ JWT อาจเก่ากว่าคลังที่เพิ่งได้รับสิทธิ์
  // (หน้า Dropdown ตรวจสิทธิ์จาก DB และแก้ค่านี้ให้ถูกต้องอยู่แล้ว)
  const userWarehouse = activeWarehouse || session?.warehouses?.[0] || '—'

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white text-[#16233D] flex flex-col z-50 border-r border-[#E1E6EF] transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-72'
      )}
    >
      {/* Top Section: Hamburger & Logo */}
      <div className="pt-4 px-4 pb-2">
        {/* Hamburger Toggle */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onToggle}
            className="text-[#5B6B85] hover:text-[#16233D] hover:bg-[#F4F6FA] p-1.5 rounded-lg transition-colors"
            title={isCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Logo and App Title */}
        {!isCollapsed ? (
          <div className="flex items-center gap-3 px-1 py-1">
            {/* DEMS Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="DEMS logo" className="w-10 h-10 object-contain flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-extrabold text-[#16233D] text-lg tracking-tight leading-none">
                DEMS
              </span>
              <span className="text-[#5B6B85] text-[8px] font-semibold tracking-wider uppercase leading-tight mt-0.5">
                Daily Employee<br />Management System
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="DEMS logo" className="w-9 h-9 object-contain flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-5">
        {/* Group 1: เมนูหลัก */}
        <div>
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold text-[#5B6B85]">
              เมนูหลัก
            </div>
          )}
          <div className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'sidebar-item',
                    isActive && 'active',
                    isCollapsed && 'justify-center px-0 mx-0'
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Group 2: การจัดการ */}
        {adminNav.some((n) => !!session?.role && n.roles.includes(session.role)) && (
          <div>
            {!isCollapsed && (
              <div className="px-3 pb-2 text-[11px] font-semibold text-[#5B6B85]">
                การจัดการ
              </div>
            )}
            <div className="space-y-1">
              {adminNav.map((item) => {
                if (!session?.role || !item.roles.includes(session.role)) return null
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'sidebar-item',
                      isActive && 'active',
                      isCollapsed && 'justify-center px-0 mx-0'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!isCollapsed && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="whitespace-nowrap">{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-1.5 transition-colors',
                              isActive
                                ? 'bg-white text-[#2558B8] shadow-sm'
                                : 'bg-[#F3EEFE] text-[#7C3AED]'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Profile & Logout Footer */}
      <div className="border-t border-[#E1E6EF] p-3 mt-auto bg-white">
        <div
          className={cn(
            'flex items-center gap-3',
            isCollapsed && 'justify-center'
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm',
              session?.role === 'super_admin' ? 'bg-[#7C3AED]' : 'bg-[#2E6FE0]'
            )}
          >
            {getInitials(session?.name || 'U')}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#16233D] truncate leading-tight">
                {session?.name || '—'}
              </div>
              <div className="text-xs text-[#5B6B85] truncate leading-tight mt-0.5">
                {session?.role === 'super_admin'
                  ? 'Super Admin · ทุกคลัง'
                  : `${roleLabel} · ${userWarehouse}`}
              </div>
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="text-[#5B6B85] hover:text-[#E5484D] hover:bg-[#FCE8E8]/50 p-1.5 rounded-lg transition-colors flex-shrink-0"
              title="ออกจากระบบ"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center mt-2 text-[#5B6B85] hover:text-[#E5484D] hover:bg-[#FCE8E8]/50 p-1.5 rounded-lg transition-colors"
            title="ออกจากระบบ"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  )
}

