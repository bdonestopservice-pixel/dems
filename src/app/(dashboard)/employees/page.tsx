import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { EmployeesClient } from './EmployeesClient'

export default async function EmployeesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <>
      <Topbar
        session={session}
        title="ข้อมูลพนักงาน"
        subtitle="ฐานข้อมูลพนักงานรวมทุกคลัง"
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        <EmployeesClient session={session} />
      </div>
    </>
  )
}
