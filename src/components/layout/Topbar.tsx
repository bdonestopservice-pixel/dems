'use client'

import { getInitials } from '@/lib/utils'
import type { AuthSession } from '@/types'

interface TopbarProps {
  session?: AuthSession | null
  title: string
  subtitle?: string
}

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin เท่านั้น',
  admin: 'Admin',
  payroll: 'Payroll',
}

export function Topbar({ session, title, subtitle }: TopbarProps) {
  return (
    <header className="px-8 pt-7 pb-4 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-2xl font-bold text-[#16233D] tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-[#5B6B85] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {session?.role && (
          <span className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#EEF3FC] text-[#2558B8]">
            {roleLabel[session.role] || session.role}
          </span>
        )}
        <div className="w-9 h-9 bg-[#2E6FE0] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {session?.name ? getInitials(session.name) : 'U'}
        </div>
      </div>
    </header>
  )
}

