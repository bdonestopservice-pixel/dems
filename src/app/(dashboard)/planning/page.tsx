import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { PlanningOverviewClient } from './PlanningOverviewClient'

export default async function PlanningPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <PlanningOverviewClient session={session} />
    </div>
  )
}
