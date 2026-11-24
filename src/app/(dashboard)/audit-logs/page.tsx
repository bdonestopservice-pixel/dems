import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'
import { AuditLogsClient } from './AuditLogsClient'

export default async function AuditLogsPage() {
  const session = await getSession()

  if (!session || session.role !== 'super_admin') {
    redirect('/overview')
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar
        session={session}
        title="ประวัติการใช้งานระบบ"
        subtitle="ตรวจสอบประวัติการเข้าใช้งาน แก้ไข ลบ และส่งออกข้อมูลรายบุคคลย้อนหลังครบทุกเมนู"
      />
      <div className="flex-1 px-8 pb-8">
        <AuditLogsClient />
      </div>
    </div>
  )
}
