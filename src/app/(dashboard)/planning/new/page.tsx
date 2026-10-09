import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { CreatePlanClient } from './CreatePlanClient'

export default async function CreatePlanPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <CreatePlanClient session={session} />
    </div>
  )
}
