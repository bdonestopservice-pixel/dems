import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { EmployeeForm } from '@/components/employees/EmployeeForm'

export default async function NewEmployeePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex-1 overflow-y-auto">
      <EmployeeForm mode="create" />
    </div>
  )
}
