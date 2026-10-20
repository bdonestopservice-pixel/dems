import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'

export default async function OverviewPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <>
      <Topbar
        session={session}
        title="ภาพรวม"
        subtitle="สรุปข้อมูลพนักงานและกิจกรรมวันนี้"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'พนักงานทั้งหมด', value: '—', color: 'blue' },
            { label: 'Namelist วันนี้', value: '—', color: 'green' },
            { label: 'แพลนวันนี้', value: '—', color: 'orange' },
          ].map((stat) => (
            <div key={stat.label} className="card p-5">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="card p-8 text-center text-gray-400">
          <p className="text-lg font-medium">ยินดีต้อนรับสู่ DEMS</p>
          <p className="text-sm mt-1">ระบบจัดการพนักงานรายวัน — กำลังพัฒนา</p>
        </div>
      </div>
    </>
  )
}
