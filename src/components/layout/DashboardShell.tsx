'use client'

import { Sidebar } from './Sidebar'
import { SidebarProvider, useSidebar } from './SidebarContext'
import { cn } from '@/lib/utils'
import type { AuthSession } from '@/types'
import { RealtimeProvider, useRealtimeSession } from '@/components/providers/RealtimeProvider'
import { WarehouseProvider } from '@/components/providers/WarehouseProvider'

interface DashboardShellProps {
  session: AuthSession
  children: React.ReactNode
}

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, toggle } = useSidebar()
  const { session: liveSession } = useRealtimeSession()

  return (
    <div className="flex h-screen bg-[#F4F6FA] overflow-hidden">
      <Sidebar
        session={liveSession}
        isCollapsed={isCollapsed}
        onToggle={toggle}
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
      <WarehouseProvider>
        <SidebarProvider>
          <DashboardShellContent>{children}</DashboardShellContent>
        </SidebarProvider>
      </WarehouseProvider>
    </RealtimeProvider>
  )
}


