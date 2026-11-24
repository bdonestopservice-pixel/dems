import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import { recordAuditLog } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('dems_session')?.value
  const session = token ? await verifySession(token) : null

  if (session) {
    recordAuditLog({
      request,
      session,
      action: 'LOGOUT',
      menu: 'auth',
      warehouse: session.warehouses?.[0] || null,
      targetId: session.userId,
      targetName: `${session.name} (${session.email})`,
      summary: 'ออกจากระบบ',
    })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete('dems_session')
  return response
}
