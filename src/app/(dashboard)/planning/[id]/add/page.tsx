import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AddEmployeesToPlanClient } from './AddEmployeesToPlanClient'

export default async function AddEmployeesToPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <AddEmployeesToPlanClient session={session} planId={id} />
    </div>
  )
}
