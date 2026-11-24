'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search,
  RotateCcw,
  RefreshCw,
  Download,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
  Users,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Clock,
  Globe,
  Monitor,
  Database,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import { WarehouseSelect } from '@/components/ui/WarehouseSelect'
import { useWarehouses } from '@/components/providers/WarehouseProvider'
import type { AuditLog, AuditAction, AuditMenu } from '@/types'

interface AuditUserOption {
  id: string
  name: string
  email: string
  role: string
}

interface AuditStats {
  today_total: number
  active_users_today: number
  critical_today: number
  failed_logins_today: number
}

const MENU_META: Record<AuditMenu, { label: string; badgeCls: string }> = {
  auth: { label: 'เข้าสู่ระบบ', badgeCls: 'bg-[#EEF3FC] text-[#2558B8]' },
  employees: { label: 'ข้อมูลพนักงาน', badgeCls: 'bg-[#EEF3FC] text-[#1D4490]' },
  planning: { label: 'จัดแพลนพนักงาน', badgeCls: 'bg-[#F3EEFE] text-[#7C3AED]' },
  namelist: { label: 'Namelist', badgeCls: 'bg-[#E7F6ED] text-[#2E9E5B]' },
  reports: { label: 'รายงาน / ค่าจ้าง', badgeCls: 'bg-[#FEF3E2] text-[#B45F17]' },
  dropdown: { label: 'จัดการ Dropdown', badgeCls: 'bg-[#F4F6FA] text-[#5B6B85]' },
  users: { label: 'จัดการผู้ใช้งาน', badgeCls: 'bg-[#F3EEFE] text-[#7C3AED]' },
}

const ACTION_META: Record<AuditAction, { label: string; badgeCls: string; dotCls: string }> = {
  LOGIN: {
    label: 'เข้าสู่ระบบ',
    badgeCls: 'bg-[#E7F6ED] text-[#2E9E5B] border border-[#2E9E5B]/20',
    dotCls: 'bg-[#2E9E5B]',
  },
  LOGIN_FAILED: {
    label: 'ล็อกอินไม่สำเร็จ',
    badgeCls: 'bg-[#FCE8E8] text-[#E5484D] border border-[#E5484D]/25',
    dotCls: 'bg-[#E5484D]',
  },
  LOGOUT: {
    label: 'ออกจากระบบ',
    badgeCls: 'bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]',
    dotCls: 'bg-[#9AA5B8]',
  },
  CREATE: {
    label: 'เพิ่มข้อมูล',
    badgeCls: 'bg-[#E7F6ED] text-[#2E9E5B] border border-[#2E9E5B]/20',
    dotCls: 'bg-[#2E9E5B]',
  },
  UPDATE: {
    label: 'แก้ไขข้อมูล',
    badgeCls: 'bg-[#EEF3FC] text-[#2558B8] border border-[#2E6FE0]/20',
    dotCls: 'bg-[#2E6FE0]',
  },
  DELETE: {
    label: 'ลบข้อมูล',
    badgeCls: 'bg-[#FCE8E8] text-[#E5484D] border border-[#E5484D]/25',
    dotCls: 'bg-[#E5484D]',
  },
  BLACKLIST: {
    label: 'ติดแบล็กลิสต์',
    badgeCls: 'bg-[#FCE8E8] text-[#E5484D] border border-[#E5484D]/25',
    dotCls: 'bg-[#E5484D]',
  },
  UNBLACKLIST: {
    label: 'ปลดแบล็กลิสต์',
    badgeCls: 'bg-[#FEF3E2] text-[#B45F17] border border-[#F5A623]/30',
    dotCls: 'bg-[#F5A623]',
  },
  SEND_NAMELIST: {
    label: 'ส่งเข้า Namelist',
    badgeCls: 'bg-[#EEF3FC] text-[#2558B8] border border-[#2E6FE0]/20',
    dotCls: 'bg-[#2E6FE0]',
  },
  EXPORT: {
    label: 'Export ไฟล์',
    badgeCls: 'bg-[#FEF3E2] text-[#B45F17] border border-[#F5A623]/30',
    dotCls: 'bg-[#F5A623]',
  },
}

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  super_admin: { label: 'Super Admin', cls: 'bg-[#F3EEFE] text-[#7C3AED]' },
  admin: { label: 'Admin', cls: 'bg-[#EEF3FC] text-[#2558B8]' },
  payroll: { label: 'Payroll', cls: 'bg-[#FEF3E2] text-[#B45F17]' },
  unknown: { label: 'ไม่ระบุ', cls: 'bg-[#F4F6FA] text-[#5B6B85]' },
}

function formatDateTimeTH(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: '—', time: '' }
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  const dd = String(bkk.getUTCDate()).padStart(2, '0')
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = bkk.getUTCFullYear() + 543
  const hh = String(bkk.getUTCHours()).padStart(2, '0')
  const min = String(bkk.getUTCMinutes()).padStart(2, '0')
  const ss = String(bkk.getUTCSeconds()).padStart(2, '0')
  return {
    date: `${dd}/${mm}/${yyyy}`,
    time: `${hh}:${min}:${ss}`,
  }
}

function parseDeviceSummary(ua?: string | null): string {
  if (!ua) return '—'
  let browser = 'Browser อื่นๆ'
  if (ua.includes('Edg/')) browser = 'Microsoft Edge'
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Google Chrome'
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'
  else if (ua.includes('Firefox/')) browser = 'Firefox'

  let os = ''
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS X')) os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Linux')) os = 'Linux'

  return os ? `${browser} · ${os}` : browser
}

const selectCls =
  'bg-white border border-[#E1E6EF] hover:border-[#B6C2D8] text-[#16233D] text-xs font-medium rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2E6FE0]/25 focus:border-[#2E6FE0] transition-all shadow-sm cursor-pointer'

export function AuditLogsClient() {
  const { warehouses } = useWarehouses()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [usersList, setUsersList] = useState<AuditUserOption[]>([])
  const [stats, setStats] = useState<AuditStats>({
    today_total: 0,
    active_users_today: 0,
    critical_today: 0,
    failed_logins_today: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [userId, setUserId] = useState('all')
  const [menu, setMenu] = useState('all')
  const [action, setAction] = useState('all')
  const [warehouse, setWarehouse] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [copiedId, setCopiedId] = useState(false)

  const reqSeq = useRef(0)

  // Debounce search (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Escape closes detail modal
  useEffect(() => {
    if (!selectedLog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedLog])

  const buildQueryParams = useCallback(
    (extra?: Record<string, string>) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (userId !== 'all') params.set('user_id', userId)
      if (menu !== 'all') params.set('menu', menu)
      if (action !== 'all') params.set('action', action)
      if (warehouse !== 'all') params.set('warehouse', warehouse)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (extra) {
        for (const [k, v] of Object.entries(extra)) params.set(k, v)
      }
      return params
    },
    [page, limit, debouncedSearch, userId, menu, action, warehouse, dateFrom, dateTo]
  )

  const fetchLogs = useCallback(
    async (silent = false) => {
      const seq = ++reqSeq.current
      if (!silent) setLoading(true)
      else setRefreshing(true)
      setErrorMsg(null)

      try {
        const params = buildQueryParams({ _t: String(Date.now()) })
        const res = await fetch(`/api/audit-logs?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (seq !== reqSeq.current) return
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'ไม่สามารถโหลดประวัติการใช้งานได้')
        }
        setLogs(data.logs || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
        setTableMissing(Boolean(data.table_missing))
        if (data.stats) setStats(data.stats)
        if (Array.isArray(data.users_list)) setUsersList(data.users_list)
      } catch (err: any) {
        if (seq !== reqSeq.current) return
        setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการโหลดประวัติการใช้งาน')
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [buildQueryParams]
  )

  useEffect(() => {
    fetchLogs(false)
  }, [fetchLogs])

  const hasActiveFilter =
    Boolean(search) ||
    userId !== 'all' ||
    menu !== 'all' ||
    action !== 'all' ||
    warehouse !== 'all' ||
    Boolean(dateFrom) ||
    Boolean(dateTo)

  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setUserId('all')
    setMenu('all')
    setAction('all')
    setWarehouse('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // Export Audit Logs เป็น CSV (สูงสุด 1,000 รายการตามเงื่อนไขที่กรอง)
  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      const params = buildQueryParams({ export: 'true', page: '1', _t: String(Date.now()) })
      const res = await fetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Export ไม่สำเร็จ')
      const data = await res.json()
      const rows: AuditLog[] = data.logs || []
      if (rows.length === 0) return

      const headers = [
        'วันที่',
        'เวลา',
        'ชื่อผู้ใช้งาน',
        'อีเมล',
        'Role',
        'เมนู',
        'กิจกรรม',
        'คลังสินค้า',
        'เป้าหมาย',
        'รายละเอียดสรุป',
        'IP Address',
        'อุปกรณ์/Browser',
      ]

      const esc = (v: unknown) => {
        const str = String(v ?? '').replace(/"/g, '""')
        return `"${str}"`
      }

      const lines = [
        headers.map(esc).join(','),
        ...rows.map((r) => {
          const dt = formatDateTimeTH(r.created_at)
          return [
            dt.date,
            dt.time,
            r.user_name,
            r.user_email,
            ROLE_LABELS[r.user_role]?.label || r.user_role,
            MENU_META[r.menu]?.label || r.menu,
            ACTION_META[r.action]?.label || r.action,
            r.warehouse || '-',
            r.target_name || '-',
            r.summary,
            r.ip_address || '-',
            parseDeviceSummary(r.user_agent),
          ]
            .map(esc)
            .join(',')
        }),
      ]

      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DEMS_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export audit logs CSV error:', err)
    } finally {
      setExportingCsv(false)
    }
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, page])

  const fromRecord = total === 0 ? 0 : (page - 1) * limit + 1
  const toRecord = Math.min(page * limit, total)

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards (Fixed min-height เพื่อป้องกัน Layout Shift / CLS = 0) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E1E6EF] px-5 py-4 shadow-sm flex items-center justify-between min-h-[88px]">
          <div>
            <p className="text-xs font-medium text-[#5B6B85]">กิจกรรมวันนี้ทั้งหมด</p>
            <p className="text-2xl font-bold text-[#16233D] mt-1 tabular-nums">
              {stats.today_total.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#EEF3FC] text-[#2E6FE0] flex items-center justify-center flex-shrink-0">
            <Activity size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E1E6EF] px-5 py-4 shadow-sm flex items-center justify-between min-h-[88px]">
          <div>
            <p className="text-xs font-medium text-[#5B6B85]">ผู้ใช้งานที่ทำรายการวันนี้</p>
            <p className="text-2xl font-bold text-[#2E9E5B] mt-1 tabular-nums">
              {stats.active_users_today.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E7F6ED] text-[#2E9E5B] flex items-center justify-center flex-shrink-0">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E1E6EF] px-5 py-4 shadow-sm flex items-center justify-between min-h-[88px]">
          <div>
            <p className="text-xs font-medium text-[#5B6B85]">ลบข้อมูล / แบล็กลิสต์วันนี้</p>
            <p className="text-2xl font-bold text-[#E5484D] mt-1 tabular-nums">
              {stats.critical_today.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FCE8E8] text-[#E5484D] flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E1E6EF] px-5 py-4 shadow-sm flex items-center justify-between min-h-[88px]">
          <div>
            <p className="text-xs font-medium text-[#5B6B85]">ล็อกอินไม่สำเร็จวันนี้</p>
            <p className="text-2xl font-bold text-[#B45F17] mt-1 tabular-nums">
              {stats.failed_logins_today.toLocaleString('th-TH')}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FEF3E2] text-[#F5A623] flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Warning banner if audit_logs table not yet created in Supabase */}
      {tableMissing && (
        <div className="bg-[#FEF3E2] border border-[#F5A623]/40 rounded-2xl p-4 flex items-start gap-3 text-[#B45F17]">
          <Database size={20} className="flex-shrink-0 mt-0.5 text-[#F5A623]" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-sm text-[#16233D] mb-1">
              ยังไม่ได้สร้างตาราง <code className="bg-white px-1.5 py-0.5 rounded border border-[#E1E6EF]">audit_logs</code> บน Supabase
            </p>
            <p>
              กรุณานำไฟล์ SQL <code className="bg-white px-1.5 py-0.5 rounded border border-[#E1E6EF]">supabase/add_audit_logs.sql</code> ไปรันใน Supabase SQL Editor เพื่อให้ระบบเริ่มเก็บประวัติการใช้งานและแสดงข้อมูลในหน้านี้ครับ
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar Card */}
      <div className="bg-white rounded-2xl border border-[#E1E6EF] p-4 shadow-sm space-y-3">
        {/* Row 1: Search + Action Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA5B8]" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ใช้งาน, อีเมล, รหัสพนักงาน (PO), รายละเอียดกิจกรรม หรือ IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] focus:bg-white border border-[#E1E6EF] rounded-xl text-xs text-[#16233D] placeholder-[#9AA5B8] focus:outline-none focus:ring-2 focus:ring-[#2E6FE0]/25 focus:border-[#2E6FE0] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#5B6B85] hover:text-[#E5484D] bg-white border border-[#E1E6EF] hover:border-[#E5484D]/40 hover:bg-[#FCE8E8]/40 transition-colors"
              >
                <RotateCcw size={14} />
                ล้างตัวกรอง
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#16233D] bg-white border border-[#E1E6EF] hover:bg-[#F4F6FA] transition-colors shadow-sm disabled:opacity-50"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin text-[#2E6FE0]')} />
              รีเฟรช
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv || total === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#2E6FE0] hover:bg-[#2558B8] active:bg-[#1D4490] transition-colors shadow-sm disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              {exportingCsv ? 'กำลัง Export...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Row 2: Dropdowns & Date Range */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#F4F6FA]">
          {/* User Filter */}
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value)
              setPage(1)
            }}
            className={cn(selectCls, 'min-w-[170px]')}
            title="กรองตามรายบุคคล"
          >
            <option value="all">ผู้ใช้งานทั้งหมด</option>
            {usersList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Payroll'})
              </option>
            ))}
          </select>

          {/* Menu Filter */}
          <select
            value={menu}
            onChange={(e) => {
              setMenu(e.target.value)
              setPage(1)
            }}
            className={cn(selectCls, 'min-w-[145px]')}
            title="กรองตามเมนู"
          >
            <option value="all">ทุกเมนู</option>
            <option value="auth">เข้าสู่ระบบ</option>
            <option value="employees">ข้อมูลพนักงาน</option>
            <option value="planning">จัดแพลนพนักงาน</option>
            <option value="namelist">Namelist</option>
            <option value="reports">รายงาน / ค่าจ้าง</option>
            <option value="dropdown">จัดการ Dropdown</option>
            <option value="users">จัดการผู้ใช้งาน</option>
          </select>

          {/* Action Filter */}
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
            className={cn(selectCls, 'min-w-[155px]')}
            title="กรองตามประเภทกิจกรรม"
          >
            <option value="all">ทุกประเภทกิจกรรม</option>
            <option value="LOGIN">เข้าสู่ระบบ</option>
            <option value="LOGIN_FAILED">ล็อกอินไม่สำเร็จ</option>
            <option value="LOGOUT">ออกจากระบบ</option>
            <option value="CREATE">เพิ่มข้อมูล</option>
            <option value="UPDATE">แก้ไขข้อมูล</option>
            <option value="DELETE">ลบข้อมูล</option>
            <option value="BLACKLIST">ติดแบล็กลิสต์</option>
            <option value="UNBLACKLIST">ปลดแบล็กลิสต์</option>
            <option value="SEND_NAMELIST">ส่งเข้า Namelist</option>
            <option value="EXPORT">Export ไฟล์</option>
          </select>

          {/* Warehouse Filter */}
          <WarehouseSelect
            value={warehouse}
            onChange={(val) => {
              setWarehouse(val)
              setPage(1)
            }}
            warehouses={warehouses}
            allLabel="ทุกคลังสินค้า"
          />

          {/* Date Range */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-semibold text-[#5B6B85]">ตั้งแต่</span>
            <DateInput
              value={dateFrom}
              onChange={(val) => {
                setDateFrom(val)
                setPage(1)
              }}
              clearable={true}
              placeholder="วว/ดด/ปปปป"
              title="วันที่เริ่มต้น"
            />
            <span className="text-[11px] font-semibold text-[#5B6B85]">ถึง</span>
            <DateInput
              value={dateTo}
              onChange={(val) => {
                setDateTo(val)
                setPage(1)
              }}
              clearable={true}
              placeholder="วว/ดด/ปปปป"
              title="วันที่สิ้นสุด"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-[#FCE8E8] border border-[#E5484D]/30 rounded-xl px-4 py-3 text-xs font-semibold text-[#E5484D]">
          {errorMsg}
        </div>
      )}

      {/* Main Audit Logs Table Card */}
      <div className="bg-white rounded-2xl border border-[#E1E6EF] shadow-sm overflow-hidden">
        {/* Subheader bar (fixed height to prevent CLS) */}
        <div className="px-6 py-3 bg-[#FAFBFD] border-b border-[#E1E6EF] flex items-center justify-between text-xs text-[#5B6B85] min-h-[44px]">
          <div className="font-medium">
            แสดง <span className="font-bold text-[#16233D]">{fromRecord}–{toRecord}</span> จากทั้งหมด{' '}
            <span className="font-bold text-[#16233D]">{total.toLocaleString('th-TH')}</span> รายการ
          </div>
          <div className="text-[11px] text-[#9AA5B8]">
            เรียงตามเวลาล่าสุดก่อน · คลิกแถวเพื่อดูรายละเอียดเชิงลึก (Before → After)
          </div>
        </div>

        <div className="overflow-x-auto min-h-[420px]">
          <table className="w-full border-collapse text-left min-w-[980px]">
            <thead>
              <tr className="border-b border-[#E1E6EF] bg-[#F8FAFC]">
                <th className="py-3 px-5 text-[11px] font-semibold text-[#5B6B85] w-[145px]">วันเวลา</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[#5B6B85] w-[220px]">ผู้ใช้งาน</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[#5B6B85] w-[155px]">เมนู / คลัง</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[#5B6B85] w-[145px]">กิจกรรม</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[#5B6B85]">รายละเอียด</th>
                <th className="py-3 px-4 text-[11px] font-semibold text-[#5B6B85] text-right w-[90px]">ตรวจสอบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6EF]">
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-5">
                      <div className="h-3.5 bg-gray-200 rounded w-20 mb-1.5" />
                      <div className="h-3 bg-gray-100 rounded w-14" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 bg-gray-200 rounded w-28" />
                          <div className="h-2.5 bg-gray-100 rounded w-36" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 bg-gray-100 rounded-full w-24" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-5 bg-gray-100 rounded-full w-24" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="h-3.5 bg-gray-200 rounded w-64" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="h-7 w-7 bg-gray-100 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF3FC] text-[#2E6FE0] flex items-center justify-center mx-auto mb-3">
                      <Activity size={22} />
                    </div>
                    <p className="text-sm font-bold text-[#16233D]">ไม่พบประวัติการใช้งานตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-[#5B6B85] mt-1">
                      {hasActiveFilter
                        ? 'ลองปรับเปลี่ยนช่วงวันที่หรือล้างตัวกรองเพื่อดูข้อมูลทั้งหมด'
                        : 'เมื่อมีการล็อกอินหรือทำรายการในระบบ ประวัติจะถูกบันทึกและแสดงที่นี่ทันที'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dt = formatDateTimeTH(log.created_at)
                  const menuInfo = MENU_META[log.menu] || {
                    label: log.menu,
                    badgeCls: 'bg-[#F4F6FA] text-[#5B6B85]',
                  }
                  const actionInfo = ACTION_META[log.action] || {
                    label: log.action,
                    badgeCls: 'bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]',
                    dotCls: 'bg-[#5B6B85]',
                  }
                  const roleInfo = ROLE_LABELS[log.user_role] || ROLE_LABELS.unknown
                  const changeCount = log.details?.changes?.length || 0

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-[#EEF3FC]/40 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-5 align-top whitespace-nowrap">
                        <div className="text-xs font-semibold text-[#16233D] tabular-nums">{dt.date}</div>
                        <div className="text-[11px] text-[#5B6B85] font-mono mt-0.5 tabular-nums">
                          {dt.time} น.
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm',
                              log.user_role === 'super_admin'
                                ? 'bg-[#7C3AED]'
                                : log.user_role === 'admin'
                                ? 'bg-[#2E6FE0]'
                                : log.user_role === 'payroll'
                                ? 'bg-[#F5A623]'
                                : 'bg-[#9AA5B8]'
                            )}
                          >
                            {getInitials(log.user_name || 'U')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[#16233D] truncate max-w-[130px]">
                                {log.user_name}
                              </span>
                              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md', roleInfo.cls)}>
                                {roleInfo.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#5B6B85] truncate max-w-[185px] mt-0.5">
                              {log.user_email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Menu / Warehouse */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                              menuInfo.badgeCls
                            )}
                          >
                            {menuInfo.label}
                          </span>
                          {log.warehouse && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]">
                              คลัง {log.warehouse}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
                            actionInfo.badgeCls
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', actionInfo.dotCls)} />
                          {actionInfo.label}
                        </span>
                      </td>

                      {/* Summary & Diff Badge */}
                      <td className="py-3.5 px-4 align-top">
                        <p className="text-xs font-medium text-[#16233D] leading-relaxed line-clamp-2">
                          {log.summary}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {log.target_name && (
                            <span className="text-[11px] text-[#5B6B85] bg-[#F4F6FA] px-2 py-0.5 rounded-md truncate max-w-[260px]">
                              เป้าหมาย: {log.target_name}
                            </span>
                          )}
                          {changeCount > 0 && (
                            <span className="text-[10px] font-semibold text-[#2558B8] bg-[#EEF3FC] px-2 py-0.5 rounded-md">
                              เปลี่ยนแปลง {changeCount} ช่อง
                            </span>
                          )}
                          {log.ip_address && (
                            <span className="text-[10px] font-mono text-[#9AA5B8]">
                              IP {log.ip_address}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#2E6FE0] bg-[#EEF3FC]/60 group-hover:bg-[#2E6FE0] group-hover:text-white transition-colors"
                          title="ดูรายละเอียดเชิงลึก"
                        >
                          <Eye size={13} />
                          ดู
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-3.5 border-t border-[#E1E6EF] bg-[#FAFBFD] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#5B6B85]">
            หน้า <span className="font-bold text-[#16233D]">{page}</span> จาก{' '}
            <span className="font-bold text-[#16233D]">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-2 rounded-lg bg-white border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#EEF3FC] hover:text-[#2558B8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>

            {pageNumbers.map((pn, i) =>
              typeof pn === 'string' ? (
                <span key={`dots-${i}`} className="px-2 text-xs text-[#9AA5B8]">
                  ...
                </span>
              ) : (
                <button
                  key={pn}
                  type="button"
                  onClick={() => setPage(pn)}
                  className={cn(
                    'min-w-[32px] h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors',
                    pn === page
                      ? 'bg-[#2E6FE0] text-white shadow-sm'
                      : 'bg-white border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#EEF3FC] hover:text-[#2558B8]'
                  )}
                >
                  {pn}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-lg bg-white border border-[#E1E6EF] text-[#5B6B85] hover:bg-[#EEF3FC] hover:text-[#2558B8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Inspector Modal (ดูประวัติเชิงลึก + Before → After Diff) */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-[#16233D]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl border border-[#E1E6EF] shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Blue Accent Bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[#2E6FE0] to-[#6FA3FF]" />

            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E1E6EF] flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                      ACTION_META[selectedLog.action]?.badgeCls || 'bg-[#F4F6FA] text-[#5B6B85]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        ACTION_META[selectedLog.action]?.dotCls || 'bg-[#5B6B85]'
                      )}
                    />
                    {ACTION_META[selectedLog.action]?.label || selectedLog.action}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
                      MENU_META[selectedLog.menu]?.badgeCls || 'bg-[#F4F6FA] text-[#5B6B85]'
                    )}
                  >
                    {MENU_META[selectedLog.menu]?.label || selectedLog.menu}
                  </span>
                  {selectedLog.warehouse && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F4F6FA] text-[#5B6B85] border border-[#E1E6EF]">
                      คลัง {selectedLog.warehouse}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-[#16233D] mt-2 leading-snug">
                  {selectedLog.summary}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-[#5B6B85] hover:text-[#16233D] hover:bg-[#F4F6FA] transition-colors flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Actor & Context Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] border border-[#E1E6EF] rounded-xl p-3.5">
                  <div className="text-[11px] font-semibold text-[#5B6B85] mb-1.5">ผู้ทำรายการ</div>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                        selectedLog.user_role === 'super_admin'
                          ? 'bg-[#7C3AED]'
                          : selectedLog.user_role === 'admin'
                          ? 'bg-[#2E6FE0]'
                          : 'bg-[#F5A623]'
                      )}
                    >
                      {getInitials(selectedLog.user_name || 'U')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#16233D] truncate">{selectedLog.user_name}</div>
                      <div className="text-[11px] text-[#5B6B85] truncate">{selectedLog.user_email}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E1E6EF] rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-[#16233D] font-semibold">
                    <Clock size={13} className="text-[#2E6FE0]" />
                    <span>
                      {formatDateTimeTH(selectedLog.created_at).date} เวลา{' '}
                      {formatDateTimeTH(selectedLog.created_at).time} น.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#5B6B85]">
                    <Globe size={13} className="text-[#9AA5B8]" />
                    <span className="font-mono">IP: {selectedLog.ip_address || 'ไม่ระบุ'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#5B6B85]">
                    <Monitor size={13} className="text-[#9AA5B8]" />
                    <span className="truncate">{parseDeviceSummary(selectedLog.user_agent)}</span>
                  </div>
                </div>
              </div>

              {/* Target Reference */}
              {(selectedLog.target_name || selectedLog.target_id) && (
                <div className="flex items-center justify-between bg-[#EEF3FC]/60 border border-[#D6E3FA] rounded-xl px-4 py-2.5 text-xs">
                  <div className="min-w-0">
                    <span className="text-[#5B6B85] font-medium">รายการอ้างอิง: </span>
                    <span className="font-bold text-[#16233D]">
                      {selectedLog.target_name || selectedLog.target_id}
                    </span>
                  </div>
                  {selectedLog.target_id && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedLog.target_id || '')
                        setCopiedId(true)
                        setTimeout(() => setCopiedId(false), 1800)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2558B8] hover:text-[#1D4490] ml-3 flex-shrink-0"
                    >
                      {copiedId ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId ? 'คัดลอก ID แล้ว' : 'คัดลอก ID'}
                    </button>
                  )}
                </div>
              )}

              {/* Before -> After Diff Table */}
              {selectedLog.details?.changes && selectedLog.details.changes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#16233D] mb-2.5 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-[#2E6FE0]" />
                    รายละเอียดข้อมูลที่เปลี่ยนแปลง ({selectedLog.details.changes.length} รายการ)
                  </h4>
                  <div className="border border-[#E1E6EF] rounded-xl overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E1E6EF] text-[11px] font-semibold text-[#5B6B85]">
                          <th className="py-2.5 px-3.5 text-left w-[30%]">ชื่อฟิลด์</th>
                          <th className="py-2.5 px-3.5 text-left w-[33%]">ค่าเดิม (ก่อนแก้)</th>
                          <th className="py-2.5 px-2 text-center w-[4%]"></th>
                          <th className="py-2.5 px-3.5 text-left w-[33%]">ค่าใหม่ (หลังแก้)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E1E6EF]">
                        {selectedLog.details.changes.map((c, i) => (
                          <tr key={`${c.field}-${i}`} className="bg-white">
                            <td className="py-2.5 px-3.5 font-semibold text-[#16233D] align-top">
                              {c.label}
                            </td>
                            <td className="py-2.5 px-3.5 align-top">
                              <span className="inline-block bg-[#FCE8E8]/70 text-[#E5484D] px-2 py-0.5 rounded-md break-all">
                                {c.before}
                              </span>
                            </td>
                            <td className="py-2.5 px-1 text-center text-[#9AA5B8] align-top">
                              <ArrowRight size={13} className="inline" />
                            </td>
                            <td className="py-2.5 px-3.5 align-top">
                              <span className="inline-block bg-[#E7F6ED] text-[#2E9E5B] font-semibold px-2 py-0.5 rounded-md break-all">
                                {c.after}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Additional Metadata */}
              {selectedLog.details?.meta && Object.keys(selectedLog.details.meta).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#16233D] mb-2">ข้อมูลเพิ่มเติม (Metadata)</h4>
                  <div className="bg-[#F8FAFC] border border-[#E1E6EF] rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {Object.entries(selectedLog.details.meta).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9AA5B8]">
                          {k}
                        </span>
                        <span className="text-xs font-medium text-[#16233D] break-words mt-0.5">
                          {Array.isArray(v)
                            ? v.length > 0
                              ? v.join(', ')
                              : '—'
                            : v === null || v === undefined || v === ''
                            ? '—'
                            : typeof v === 'boolean'
                            ? v
                              ? 'ใช่'
                              : 'ไม่'
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-[#E1E6EF] bg-[#FAFBFD] flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9AA5B8]">Log ID: {selectedLog.id}</span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#2E6FE0] hover:bg-[#2558B8] transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
