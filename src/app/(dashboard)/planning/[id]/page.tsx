import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { PlanRosterClient } from './PlanRosterClient'

export default async function PlanDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <PlanRosterClient session={session} planId={id} />
    </div>
  )
}
