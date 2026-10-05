import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { UserManagementClient } from './UserManagementClient'

export default async function UserManagementPage() {
  const session = await getSession()

  if (!session || session.role !== 'super_admin') {
    redirect('/overview')
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar
        session={session}
        title="จัดการผู้ใช้งาน"
        subtitle="สร้างบัญชีผู้ใช้งานและกำหนด Role / คลังที่สังกัด"
      />
      <div className="flex-1 px-8 pb-8">
        <UserManagementClient />
      </div>
    </div>
  )
}

