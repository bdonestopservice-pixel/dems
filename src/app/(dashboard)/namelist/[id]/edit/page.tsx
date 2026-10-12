import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { NamelistEditClient } from './NamelistEditClient'

export default async function NamelistEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ wh?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const sp = await searchParams

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <NamelistEditClient session={session} entryId={id} backWarehouse={sp.wh} />
    </div>
  )
}
