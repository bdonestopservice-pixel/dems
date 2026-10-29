'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { cn } from '@/lib/utils'
import type { AuthSession } from '@/types'
import { RealtimeProvider, useRealtimeSession } from '@/components/providers/RealtimeProvider'

interface DashboardShellProps {
  session: AuthSession
  children: React.ReactNode
}

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { session: liveSession } = useRealtimeSession()

  return (
    <div className="flex h-screen bg-[#F4F6FA] overflow-hidden">
      <Sidebar
        session={liveSession}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      <main
        className={cn(
          'flex-1 flex flex-col overflow-y-auto transition-all duration-300 min-w-0 bg-[#F4F6FA]',
          isCollapsed ? 'ml-16' : 'ml-72'
        )}
      >
        {children}
      </main>
    </div>
  )
}

export function DashboardShell({ session, children }: DashboardShellProps) {
  return (
    <RealtimeProvider initialSession={session}>
      <DashboardShellContent>{children}</DashboardShellContent>
    </RealtimeProvider>
  )
}


