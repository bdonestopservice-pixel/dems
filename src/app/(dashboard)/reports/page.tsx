import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { ReportsClient } from './ReportsClient'

export const metadata = {
  title: 'รายงาน (Export) | DEMS',
}

interface ReportsPageProps {
  searchParams?: Promise<{
    date?: string
    warehouse?: string
  }>
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const resolvedParams = searchParams ? await searchParams : {}

  return (
    <ReportsClient
      session={session}
      initialDate={resolvedParams.date}
      initialWarehouse={resolvedParams.warehouse}
    />
  )
}
