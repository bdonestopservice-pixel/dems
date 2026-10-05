'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { cn } from '@/lib/utils'
import type { AuthSession } from '@/types'

interface DashboardShellProps {
  session: AuthSession
  children: React.ReactNode
}

export function DashboardShell({ session, children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-[#F4F6FA] overflow-hidden">
      <Sidebar
        session={session}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      <main
        className={cn(
          'flex-1 flex flex-col overflow-y-auto transition-all duration-300 min-w-0 bg-[#F4F6FA]',
          isCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {children}
      </main>
    </div>
  )
}

