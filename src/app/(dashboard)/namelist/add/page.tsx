import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { NamelistAddClient } from './NamelistAddClient'

function todayTH() {
  const th = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return th.toISOString().slice(0, 10)
}

export default async function NamelistAddPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; warehouse?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayTH()

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <NamelistAddClient session={session} initialDate={date} initialWarehouse={sp.warehouse} />
    </div>
  )
}
