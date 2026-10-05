import { getSession } from '@/lib/auth/session'
import { Topbar } from '@/components/layout/Topbar'

export default async function NamelistPage() {
  const session = await getSession()
  return (
    <>
      <Topbar session={session!} title="Namelist" subtitle="รายชื่อพนักงานที่ลงบันทึกแต่ละวัน" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card p-8 text-center text-gray-400">
          <p className="text-lg font-medium">Namelist</p>
          <p className="text-sm mt-1">— Phase 6 กำลังพัฒนา —</p>
        </div>
      </div>
    </>
  )
}
