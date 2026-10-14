import { getSession } from '@/lib/auth/session'
import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import type { Employee } from '@/types'

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      warehouses:warehouse (id, name),
      banks:bank_id (id, name, code)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const employee: Employee = {
    ...data,
    warehouse_name: data.warehouses?.name || data.warehouse,
    bank_name: data.banks?.name || undefined,
    bank_code: data.banks?.code || undefined,
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <EmployeeForm initialData={employee} mode="edit" session={session} />
    </div>
  )
}
