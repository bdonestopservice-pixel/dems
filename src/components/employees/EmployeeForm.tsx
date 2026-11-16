'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Save, X, AlertCircle, Check, Calendar } from 'lucide-react'
import { cn, getInitials, validateThaiCitizenId, parseDobInput, formatDobInput } from '@/lib/utils'
import { broadcastRealtime } from '@/lib/realtime'
import { useRealtimeListener, useRealtimeSession } from '@/components/providers/RealtimeProvider'
import { useWarehouses } from '@/components/providers/WarehouseProvider'
import type { Employee, Warehouse, Bank, AuthSession } from '@/types'
import {
  OPS_CONTRACT_TYPES,
  OPS_DEPARTMENTS,
  OPS_HUBS,
  getDesignationsForDepartment,
} from '@/lib/ops-dropdown-data'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

interface EmployeeFormProps {
  initialData?: Employee
  mode: 'create' | 'edit'
  session?: AuthSession
}

// Convert YYYY-MM-DD to DD/MM/YYYY
function isoToThaiDisplayDate(isoStr?: string, isBuddhistYear = false): string {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length === 3) {
    let year = parseInt(parts[0], 10)
    // หากต้องการแสดงเป็น พ.ศ. ให้บวก 543 เฉพาะเมื่อปีเป็น ค.ศ. (<= 2400)
    if (isBuddhistYear && year <= 2400) {
      year += 543
    }
    return `${parts[2]}/${parts[1]}/${year}`
  }
  return isoStr
}

// Convert DD/MM/YYYY to YYYY-MM-DD
function thaiDisplayToIsoDate(displayStr?: string, isBuddhistYear = false): string {
  if (!displayStr) return ''
  // Allow DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
  if (displayStr.includes('-') && displayStr.split('-')[0].length === 4) {
    const [y, m, d] = displayStr.split('-')
    let year = parseInt(y, 10)
    if (isBuddhistYear && year > 2400) {
      year -= 543
    }
    return `${year}-${m}-${d}`
  }
  const clean = displayStr.replace(/[^0-9/]/g, '')
  const parts = clean.split('/')
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0')
    const m = parts[1].padStart(2, '0')
    let y = parseInt(parts[2], 10)
    if (isBuddhistYear && y > 2400) {
      year = y - 543
    }
    return `${y}-${m}-${d}`
  }
  return displayStr
}

function getTodayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayDisplayDate(isBuddhistYear = false): string {
  return isoToThaiDisplayDate(getTodayIsoDate(), isBuddhistYear)
}

export function EmployeeForm({ initialData, mode, session: propSession }: EmployeeFormProps) {
  const router = useRouter()
  const { session: realtimeSession } = useRealtimeSession()
  const session = propSession || realtimeSession

  const startDatePickerRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [error, setError] = useState('')
  const { warehouses } = useWarehouses()
  const [banks, setBanks] = useState<Bank[]>([])

  // Form state
  const [formData, setFormData] = useState({
    ops_id: initialData?.ops_id || '',
    ops_hub: initialData?.ops_hub || '',
    ops_contract_type: initialData?.ops_contract_type || '',
    ops_department: initialData?.ops_department || '',
    ops_designation: initialData?.ops_designation || '',
    id_card: initialData?.id_card || '',
    prefix: initialData?.prefix || 'นาย',
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    gender: initialData?.gender || 'ชาย',
    first_name_en: initialData?.first_name_en || '',
    last_name_en: initialData?.last_name_en || '',
    dob: isoToThaiDisplayDate(initialData?.dob, true), // แสดงเป็น พ.ศ.
    address_no: initialData?.address_no || '',
    address_moo: initialData?.address_moo || '',
    address_trok: initialData?.address_trok || '',
    address_soi: initialData?.address_soi || '',
    address_road: initialData?.address_road || '',
    address_tambon: initialData?.address_tambon || '',
    address_amphoe: initialData?.address_amphoe || '',
    address_province: initialData?.address_province || '',
    address_zipcode: initialData?.address_zipcode || '',
    warehouse:
      initialData?.warehouse ||
      (session && session.role !== 'super_admin' && session.warehouses?.[0]) ||
      'SOCE',
    start_date: initialData?.start_date
      ? isoToThaiDisplayDate(initialData.start_date, false)
      : getTodayDisplayDate(false), // ค่าเริ่มต้นเป็นวันปัจจุบัน (ค.ศ.)
    phone: initialData?.phone ? initialData.phone.replace(/[^0-9]/g, '').slice(0, 10) : '',
    promptpay_status: initialData?.promptpay_status || 'ยืนยันแล้ว',
    bank_id: initialData?.bank_id || '',
    bank_account: initialData?.bank_account ? initialData.bank_account.replace(/[^0-9]/g, '') : '',
    note: initialData?.note || '',
  })

  // Load banks options
  useEffect(() => {
    fetch('/api/dropdown/banks')
      .then((r) => r.json())
      .then((d) => {
        if (d.banks) {
          setBanks(d.banks)
        }
      })
      .catch(() => {})
  }, [])

  // ฟัง Realtime event เมื่อ Super Admin มีการปรับปรุงข้อมูลธนาคารหรือสิทธิ์คลัง
  useRealtimeListener('dropdown-updated', () => {
    fetch('/api/dropdown/banks')
      .then((r) => r.json())
      .then((d) => {
        if (d.banks) setBanks(d.banks)
      })
      .catch(() => {})
  })

  // กรองคลังที่สามารถเลือกได้: Super Admin เห็นทุกคลัง ส่วน Admin/Payroll เห็นเฉพาะคลังที่ตนเองดูแล
  const availableWarehouses = useMemo(() => {
    if (!session || session.role === 'super_admin') {
      return warehouses
    }
    const permitted = session.warehouses || []
    return warehouses.filter((w) => permitted.includes(w.id))
  }, [warehouses, session])

  // ซิงค์ formData.warehouse ให้ตรงกับคลังที่ตนเองมีสิทธิ์
  useEffect(() => {
    if (availableWarehouses.length > 0) {
      const isValid = availableWarehouses.some((w) => w.id === formData.warehouse)
      if (!isValid) {
        setFormData((prev) => ({
          ...prev,
          warehouse: availableWarehouses[0].id,
        }))
      }
    }
  }, [availableWarehouses, formData.warehouse])

  // ตั้งค่าเริ่มต้นวันที่เริ่มงานเป็นวันปัจจุบัน (กรณีสร้างพนักงานใหม่ที่ยังไม่ได้กำหนดวันที่)
  useEffect(() => {
    if (mode === 'create' && !formData.start_date) {
      setFormData((prev) => ({
        ...prev,
        start_date: getTodayDisplayDate(false),
      }))
    }
  }, [mode])

  // กรองรายชื่อธนาคารตามคลังที่เลือก (formData.warehouse)
  const filteredBanks = useMemo(() => {
    if (!formData.warehouse) return banks

    return banks.filter((b) => {
      // ในโหมดแก้ไข: ถ้าพนักงานมีธนาคารเดิมที่เคยบันทึกไว้ ให้ยังคงแสดงในตัวเลือกเพื่อไม่ให้ข้อมูลตกหล่น
      if (mode === 'edit' && b.id === formData.bank_id) return true

      // ตรวจสอบว่าคลังนี้ได้รับสิทธิ์ในธนาคารนี้หรือไม่
      if (b.warehouses && Array.isArray(b.warehouses) && b.warehouses.length > 0) {
        return b.warehouses.includes(formData.warehouse)
      }
      // หากยังไม่ได้ระบุ warehouses (ค่าว่าง) ให้มองว่าใช้ได้ทุกคลัง (fallback)
      return true
    })
  }, [banks, formData.warehouse, formData.bank_id, mode])

  // ซิงค์ bank_id อัตโนมัติเมื่อคลังเปลี่ยนแล้วธนาคารเดิมไม่อยู่ในคลังใหม่
  useEffect(() => {
    if (!formData.warehouse || banks.length === 0) return

    const allowed = banks.filter((b) => {
      if (mode === 'edit' && b.id === formData.bank_id) return true
      if (b.warehouses && Array.isArray(b.warehouses) && b.warehouses.length > 0) {
        return b.warehouses.includes(formData.warehouse)
      }
      return true
    })

    if (formData.bank_id) {
      const stillValid = allowed.some((b) => b.id === formData.bank_id)
      if (!stillValid) {
        setFormData((prev) => ({
          ...prev,
          bank_id: allowed[0]?.id || '',
        }))
      }
    } else if (mode === 'create' && allowed.length > 0) {
      setFormData((prev) => ({
        ...prev,
        bank_id: allowed[0].id,
      }))
    }
  }, [formData.warehouse, banks, mode])

  // Real-time ID card validation & duplicate check state
  const [idCardChecking, setIdCardChecking] = useState(false)
  const [idCardDuplicate, setIdCardDuplicate] = useState(false)
  const [idCardDuplicateMsg, setIdCardDuplicateMsg] = useState('')
  const [idCardFormatError, setIdCardFormatError] = useState('')
  const [idCardValid, setIdCardValid] = useState(false)

  // ตรวจสอบความถูกต้องและซ้ำซ้อนของเลขบัตรประชาชนทันทีเมื่อกรอกครบ 13 หลัก
  useEffect(() => {
    if (mode !== 'create') return

    const clean = formData.id_card.replace(/[^0-9]/g, '')
    if (clean.length === 13) {
      // 1. ตรวจสอบ Checksum ตามมาตรฐานกรมการปกครอง (ประเทศไทย)
      if (!validateThaiCitizenId(clean)) {
        setIdCardFormatError('เลขบัตรประชาชนไม่ถูกต้องตามหลักการคำนวณ 13 หลักของกรมการปกครอง (Checksum ไม่ผ่าน)')
        setIdCardDuplicate(false)
        setIdCardDuplicateMsg('')
        setIdCardValid(false)
        setIdCardChecking(false)
        return
      }

      // Checksum ถูกต้อง -> เคลียร์ Format Error แล้วตรวจเช็คความซ้ำซ้อนในฐานข้อมูล
      setIdCardFormatError('')
      let isMounted = true
      setIdCardChecking(true)

      fetch(`/api/employees/check-id-card?id_card=${clean}`)
        .then((r) => r.json())
        .then((data) => {
          if (!isMounted) return
          setIdCardChecking(false)
          if (!data.valid && data.invalidChecksum) {
            setIdCardFormatError(data.message || 'เลขบัตรประชาชนไม่ถูกต้องตามหลักการคำนวณของกรมการปกครอง')
            setIdCardDuplicate(false)
            setIdCardValid(false)
          } else if (data.exists) {
            setIdCardDuplicate(true)
            setIdCardDuplicateMsg(
              `เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว (${data.employee?.name || ''} · รหัส ${data.employee?.po_id || '-'})`
            )
            setIdCardValid(false)
          } else {
            setIdCardDuplicate(false)
            setIdCardDuplicateMsg('')
            setIdCardValid(true)
          }
        })
        .catch(() => {
          if (isMounted) setIdCardChecking(false)
        })

      return () => {
        isMounted = false
      }
    } else {
      setIdCardChecking(false)
      setIdCardDuplicate(false)
      setIdCardDuplicateMsg('')
      setIdCardValid(false)
      setIdCardFormatError('')
    }
  }, [formData.id_card, mode])

  // คำนวณอายุและตรวจสอบเกณฑ์อายุต่ำกว่า 18 ปี แบบ Real-time
  const dobInfo = useMemo(() => parseDobInput(formData.dob), [formData.dob])

  // ดึงรายการฮับ (Station) อ้างอิงจากชีทหน่วยงาน (dropdown_lists.xlsx)
  const hubOptions = useMemo(() => {
    const list = [...OPS_HUBS]
    if (formData.ops_hub && !list.includes(formData.ops_hub)) {
      list.unshift(formData.ops_hub)
    }
    return list
  }, [formData.ops_hub])

  // ดึงรายการแผนก (Designation) ตามหน่วยงาน (Department) ที่เลือก
  const availableDesignations = useMemo(() => {
    return getDesignationsForDepartment(formData.ops_department)
  }, [formData.ops_department])

  const designationOptions = useMemo(() => {
    const list = [...availableDesignations]
    if (formData.ops_designation && !list.includes(formData.ops_designation)) {
      list.unshift(formData.ops_designation)
    }
    return list
  }, [availableDesignations, formData.ops_designation])

  function handleDepartmentChange(newDept: string) {
    const nextDesignations = getDesignationsForDepartment(newDept)
    setFormData((prev) => ({
      ...prev,
      ops_department: newDept,
      ops_designation:
        nextDesignations.includes(prev.ops_designation)
          ? prev.ops_designation
          : nextDesignations.length === 1
          ? nextDesignations[0]
          : '',
    }))
  }

  function handleChange(field: string, val: string) {
    setFormData((prev) => ({ ...prev, [field]: val }))
  }

  // จัดการการพิมพ์วันเดือนปีเกิดแบบ Pattern Masking (DD/MM/YYYY)
  function handleDobChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawVal = e.target.value
    const formatted = formatDobInput(rawVal, formData.dob)
    handleChange('dob', formatted)
  }

  // รองรับการกดปุ่ม Backspace เมื่ออยู่หลังเครื่องหมาย / ให้ลบตัวเลขก่อนหน้าได้อย่างเป็นธรรมชาติ
  function handleDobKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const input = e.currentTarget
      const val = input.value
      const selStart = input.selectionStart
      const selEnd = input.selectionEnd

      if (selStart === selEnd && selStart !== null && selStart > 0 && val[selStart - 1] === '/') {
        e.preventDefault()
        const newVal = val.slice(0, selStart - 2) + val.slice(selStart)
        handleChange('dob', newVal)
        setTimeout(() => {
          const nextPos = Math.max(0, selStart - 2)
          input.setSelectionRange(nextPos, nextPos)
        }, 0)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // ป้องกันการบันทึกถ้าเลขบัตรซ้ำ
    if (mode === 'create' && idCardDuplicate) {
      setError(idCardDuplicateMsg || 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบ')
      return
    }

    // กรณีไม่ยืนยันพร้อมเพย์ บังคับระบุธนาคารและเลขที่บัญชี (ตัวเลขเท่านั้น)
    const cleanBankAccount = formData.bank_account ? formData.bank_account.replace(/[^0-9]/g, '') : ''
    if (formData.promptpay_status === 'ยังไม่ยืนยัน') {
      if (!formData.bank_id) {
        setError('กรณีไม่ยืนยันพร้อมเพย์ กรุณาเลือกธนาคาร')
        return
      }
      if (!cleanBankAccount) {
        setError('กรณีไม่ยืนยันพร้อมเพย์ กรุณากรอกเลขที่บัญชีธนาคาร (เฉพาะตัวเลข ไม่ต้องมีขีด)')
        return
      }
    }

    setSaving(true)

    try {
      // Validate id_card (13 digits + Checksum + Duplicate)
      const cleanIdCard = formData.id_card.replace(/[^0-9]/g, '')
      if (mode === 'create') {
        if (cleanIdCard.length !== 13) {
          setError('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก')
          setSaving(false)
          return
        }
        if (!validateThaiCitizenId(cleanIdCard)) {
          setError('เลขบัตรประชาชนไม่ถูกต้องตามหลักการคำนวณ 13 หลักของกรมการปกครอง (Checksum ไม่ผ่าน)')
          setSaving(false)
          return
        }
        if (idCardDuplicate) {
          setError(idCardDuplicateMsg || 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว')
          setSaving(false)
          return
        }
      }

      // Validate age (ต้องมีอายุไม่ต่ำกว่า 18 ปีบริบูรณ์)
      if (dobInfo.isUnder18) {
        setError(`พนักงานต้องมีอายุไม่ต่ำกว่า 18 ปีบริบูรณ์ (ปัจจุบันอายุ ${dobInfo.age} ปี) ไม่สามารถบันทึกได้`)
        setSaving(false)
        return
      }
      if (dobInfo.error) {
        setError(dobInfo.error)
        setSaving(false)
        return
      }

      // Validate phone (exactly 10 digits, numeric only)
      const cleanPhone = formData.phone.replace(/[^0-9]/g, '')
      if (cleanPhone.length !== 10) {
        setError('เบอร์ติดต่อต้องเป็นตัวเลข 10 หลัก (เฉพาะตัวเลขเท่านั้น เช่น 0812345678)')
        setSaving(false)
        return
      }

      // Convert date strings
      const isoDob = thaiDisplayToIsoDate(formData.dob, true)
      const isoStartDate = thaiDisplayToIsoDate(formData.start_date, false)

      const payload = {
        ...formData,
        id_card: cleanIdCard,
        phone: cleanPhone,
        bank_account: cleanBankAccount || null,
        dob: isoDob,
        start_date: isoStartDate,
      }

      const endpoint = mode === 'create' ? '/api/employees' : `/api/employees/${initialData?.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
        setSaving(false)
        return
      }

      // Success -> broadcast realtime and show success popup
      broadcastRealtime('employee-updated', { employeeId: data.employee?.id })
      setSaving(false)
      setShowSuccessModal(true)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      setSaving(false)
    }
  }

  function handleAddNewAnother() {
    setFormData({
      ops_id: '',
      ops_hub: '',
      ops_contract_type: '',
      ops_department: '',
      ops_designation: '',
      id_card: '',
      prefix: 'นาย',
      first_name: '',
      last_name: '',
      gender: 'ชาย',
      first_name_en: '',
      last_name_en: '',
      dob: '',
      address_no: '',
      address_moo: '',
      address_trok: '',
      address_soi: '',
      address_road: '',
      address_tambon: '',
      address_amphoe: '',
      address_province: '',
      address_zipcode: '',
      warehouse: warehouses[0]?.id || 'SOCE',
      start_date: getTodayDisplayDate(false),
      phone: '',
      promptpay_status: 'ยืนยันแล้ว',
      bank_id: banks[0]?.id || '',
      bank_account: '',
      note: '',
    })
    setIdCardChecking(false)
    setIdCardDuplicate(false)
    setIdCardDuplicateMsg('')
    setIdCardValid(false)
    setError('')
    setShowSuccessModal(false)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleGoToEmployees() {
    setShowSuccessModal(false)
    router.push('/employees')
    router.refresh()
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 px-4 sm:px-6">
      {/* Top Navigation */}
      <div className="mb-6 pt-4">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B6B85] hover:text-[#2558B8] transition-colors mb-3 group"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          กลับไปหน้าข้อมูลพนักงาน
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#16233D] tracking-tight">
                {mode === 'create'
                  ? 'เพิ่มพนักงานใหม่'
                  : `${formData.first_name || initialData?.first_name || ''} ${formData.last_name || initialData?.last_name || ''}`}
              </h1>
              {mode === 'edit' && initialData?.po_id && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F4F6FA] text-[#16233D] border border-[#E1E6EF]">
                  {initialData.po_id}
                </span>
              )}
            </div>
            <p className="text-xs text-[#5B6B85] mt-1">
              {showSuccessModal
                ? 'บันทึกข้อมูลเรียบร้อย'
                : mode === 'create'
                ? 'กรอกข้อมูลให้ครบตามฟิลด์ที่มีเครื่องหมาย * ก่อนบันทึก'
                : 'แก้ไขข้อมูลพนักงานได้ทุกฟิลด์ ยกเว้น เลขบัตรประชาชน ซึ่งแก้ไขไม่ได้'}
            </p>
          </div>

          {session && (
            <div
              className="w-9 h-9 rounded-full bg-[#2E6FE0] text-white flex items-center justify-center text-xs font-bold shadow-sm"
              title={`${session.name} (${session.role})`}
            >
              {getInitials(session.name)}
            </div>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[#FCE8E8] border border-[#E5484D]/30 flex items-center gap-3 text-sm text-[#E5484D] animate-in fade-in">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============================================================ */}
        {/* CARD 1: OPS ID และข้อมูลสังกัด */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#C6DCFD]/70 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-bold text-sm text-[#16233D]">1</span>
            <span className="font-bold text-sm text-[#16233D]">OPS ID และข้อมูลสังกัด</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* กล่องซ้าย: OPS ID */}
            <div className="lg:col-span-5 bg-[#F8FAFC]/80 border border-[#E1E6EF] rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-[#16233D]">OPS ID</label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF3FC] text-[#2558B8] font-semibold">
                    เพิ่มภายหลัง
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.ops_id}
                  onChange={(e) => handleChange('ops_id', e.target.value)}
                  placeholder="ยังไม่มี OPS ID · เช่น OPS-10234"
                  className="input text-xs bg-white h-9"
                />
                <p className="text-[11px] text-[#5B6B85] mt-2.5 leading-relaxed">
                  ไม่อยู่ในขั้นตอนสมัคร กรอกทีหลังเมื่อผ่านกระบวนการ Operations แล้ว จำเป็นเฉพาะสังกัดที่มี OPS ID
                </p>
              </div>
            </div>

            {/* กล่องขวา: ข้อมูลสังกัด */}
            <div className="lg:col-span-7 bg-[#F8FAFC]/80 border border-[#E1E6EF] rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold text-[#16233D]">ข้อมูลสังกัด</span>
                <span className="text-[11px] text-[#5B6B85]">เลือกจาก Dropdown ที่ตั้งค่าไว้</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* ฮับ (Station) - อ้างอิงจากชีทหน่วยงาน พิมพ์ค้นหาได้ */}
                <div>
                  <label className="label text-xs mb-1">ฮับ</label>
                  <SearchableSelect
                    value={formData.ops_hub}
                    onChange={(val) => handleChange('ops_hub', val)}
                    options={hubOptions}
                    placeholder="เลือกฮับ"
                    searchPlaceholder="ค้นหาฮับ... เช่น SPX, FSOCE"
                  />
                </div>

                {/* ประเภทสัญญา (Contract Type) */}
                <div>
                  <label className="label text-xs mb-1">ประเภทสัญญา</label>
                  <select
                    value={formData.ops_contract_type}
                    onChange={(e) => handleChange('ops_contract_type', e.target.value)}
                    className="input text-xs bg-white h-9"
                  >
                    <option value="">เลือกประเภทสัญญา</option>
                    {OPS_CONTRACT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* หน่วยงาน (Department) - พิมพ์ค้นหาได้ */}
                <div>
                  <label className="label text-xs mb-1">หน่วยงาน</label>
                  <SearchableSelect
                    value={formData.ops_department}
                    onChange={(val) => handleDepartmentChange(val)}
                    options={OPS_DEPARTMENTS}
                    placeholder="เลือกหน่วยงาน"
                    searchPlaceholder="ค้นหาหน่วยงาน... เช่น MM, Subcon"
                  />
                </div>

                {/* แผนก (Designation) */}
                <div>
                  <label className="label text-xs mb-1">แผนก</label>
                  <select
                    value={formData.ops_designation}
                    onChange={(e) => handleChange('ops_designation', e.target.value)}
                    disabled={!formData.ops_department || designationOptions.length === 0}
                    className={cn(
                      'input text-xs bg-white h-9',
                      (!formData.ops_department || designationOptions.length === 0) &&
                        'bg-[#F4F6FA] text-[#8C9BAE] cursor-not-allowed'
                    )}
                  >
                    <option value="">
                      {formData.ops_department ? 'เลือกแผนก' : 'เลือกหน่วยงานก่อน'}
                    </option>
                    {designationOptions.map((desig) => (
                      <option key={desig} value={desig}>
                        {desig}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CARD 2: ข้อมูลส่วนตัว */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-bold text-sm text-[#16233D]">2</span>
            <span className="font-bold text-sm text-[#16233D]">ข้อมูลส่วนตัว</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* เลขบัตรประชาชน (13 หลัก) */}
            <div>
              <label className="label text-xs label-required">เลขบัตรประชาชน</label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={13}
                  value={formData.id_card}
                  onChange={(e) => handleChange('id_card', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="กรอกตัวเลข 13 หลัก"
                  disabled={mode === 'edit'}
                  className={cn(
                    'input text-sm transition-all',
                    mode === 'edit' && 'bg-[#F4F6FA] cursor-not-allowed text-[#5B6B85]',
                    (idCardDuplicate || idCardFormatError) &&
                      'border-[#E5484D] ring-2 ring-[#E5484D]/20 focus:border-[#E5484D] focus:ring-[#E5484D]/30 bg-[#FCE8E8]/10 text-[#E5484D]',
                    idCardValid && !idCardChecking && !idCardFormatError && 'border-[#2E9E5B] focus:border-[#2E9E5B] focus:ring-[#2E9E5B]/20 pr-8'
                  )}
                  required
                />
                {idCardChecking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6B85]">
                    <Loader2 size={15} className="animate-spin text-[#2E6FE0]" />
                  </div>
                )}
                {idCardValid && !idCardChecking && !idCardFormatError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2E9E5B]">
                    <Check size={16} />
                  </div>
                )}
              </div>

              {/* Format Error Message (กรอบแดง + ข้อความแจ้งเตือน Checksum) */}
              {idCardFormatError && (
                <div className="text-[11px] text-[#E5484D] font-medium mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  <span>{idCardFormatError}</span>
                </div>
              )}

              {/* Duplicate Error Message (กรอบแดง + ข้อความแจ้งเตือน) */}
              {idCardDuplicate && (
                <div className="text-[11px] text-[#E5484D] font-medium mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  <span>{idCardDuplicateMsg}</span>
                </div>
              )}

              {/* Checking spinner label */}
              {idCardChecking && (
                <div className="text-[11px] text-[#5B6B85] mt-1.5 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin text-[#2E6FE0]" />
                  <span>กำลังตรวจสอบเลขบัตรประชาชน...</span>
                </div>
              )}

              {/* Valid success message */}
              {idCardValid && !idCardChecking && !idCardFormatError && (
                <div className="text-[11px] text-[#2E9E5B] font-medium mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                  <Check size={13} className="flex-shrink-0" />
                  <span>เลขบัตรประชาชนนี้ถูกต้องและสามารถใช้งานได้</span>
                </div>
              )}

              {mode === 'edit' && (
                <span className="text-[10px] text-[#9AA5B8] mt-1 block">
                  * เลขบัตรประชาชนไม่อนุญาตให้แก้ไข
                </span>
              )}
            </div>

            {/* คำนำหน้า */}
            <div>
              <label className="label text-xs label-required">คำนำหน้า</label>
              <select
                value={formData.prefix}
                onChange={(e) => handleChange('prefix', e.target.value)}
                className="input text-sm"
                required
              >
                <option value="นาย">นาย</option>
                <option value="นาง">นาง</option>
                <option value="นางสาว">นางสาว</option>
              </select>
            </div>

            {/* ชื่อ (ไทย) */}
            <div>
              <label className="label text-xs label-required">ชื่อ</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="เช่น สมชาย"
                className="input text-sm"
                required
              />
            </div>

            {/* นามสกุล (ไทย) */}
            <div>
              <label className="label text-xs label-required">นามสกุล</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="เช่น ใจดี"
                className="input text-sm"
                required
              />
            </div>

            {/* เพศ */}
            <div>
              <label className="label text-xs label-required">เพศ</label>
              <select
                value={formData.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="input text-sm"
                required
              >
                <option value="ชาย">ชาย</option>
                <option value="หญิง">หญิง</option>
              </select>
            </div>

            {/* Name (อังกฤษ) */}
            <div>
              <label className="label text-xs label-required">Name (ภาษาอังกฤษ)</label>
              <input
                type="text"
                value={formData.first_name_en}
                onChange={(e) => handleChange('first_name_en', e.target.value)}
                placeholder="e.g. Somchai"
                className="input text-sm"
                required
              />
            </div>

            {/* Surname (อังกฤษ) */}
            <div>
              <label className="label text-xs label-required">Surname (ภาษาอังกฤษ)</label>
              <input
                type="text"
                value={formData.last_name_en}
                onChange={(e) => handleChange('last_name_en', e.target.value)}
                placeholder="e.g. Jaidee"
                className="input text-sm"
                required
              />
            </div>

            {/* วันเดือนปีเกิด (พ.ศ.) พร้อมคำนวณอายุและตรวจจับอายุต่ำกว่า 18 ปี */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs label-required mb-0">วันเดือนปีเกิด (พ.ศ.)</label>
                {dobInfo.age !== null && (
                  <span
                    className={cn(
                      'text-[11px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-all',
                      dobInfo.isUnder18
                        ? 'bg-[#FCE8E8] text-[#E5484D] border border-[#F87171]/30'
                        : 'bg-[#EBF7EE] text-[#2E9E5B] border border-[#2E9E5B]/20'
                    )}
                  >
                    อายุ {dobInfo.age} ปี {dobInfo.isUnder18 && '(ต่ำกว่า 18 ปี)'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.dob}
                onChange={handleDobChange}
                onKeyDown={handleDobKeyDown}
                maxLength={10}
                placeholder="วว/ดด/ปปปป (พ.ศ.) เช่น 20/11/2540"
                className={cn(
                  'input text-sm transition-all',
                  (dobInfo.isUnder18 || dobInfo.error) &&
                    'border-[#E5484D] ring-2 ring-[#E5484D]/20 focus:border-[#E5484D] focus:ring-[#E5484D]/30 bg-[#FCE8E8]/10 text-[#E5484D]',
                  dobInfo.age !== null && !dobInfo.isUnder18 && !dobInfo.error && 'border-[#2E9E5B]/50'
                )}
                required
              />
              {/* ข้อความแจ้งเตือนเมื่ออายุต่ำกว่า 18 ปี */}
              {dobInfo.isUnder18 && (
                <div className="text-[11px] text-[#E5484D] font-medium mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  <span>อายุต่ำกว่า 18 ปีบริบูรณ์ (อายุ {dobInfo.age} ปี) ไม่ผ่านเกณฑ์อายุการทำงาน</span>
                </div>
              )}
              {/* ข้อความแจ้งเตือนเมื่อรูปแบบวันที่ผิด */}
              {dobInfo.error && !dobInfo.isUnder18 && (
                <div className="text-[11px] text-[#E5484D] font-medium mt-1.5 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  <span>{dobInfo.error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CARD 3: ที่อยู่ตามทะเบียนบ้าน (ไม่บังคับ) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-bold text-sm text-[#16233D]">3</span>
            <span className="font-bold text-sm text-[#16233D]">ที่อยู่ตามทะเบียนบ้าน (ไม่บังคับ)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="label text-xs">เลขที่</label>
              <input
                type="text"
                value={formData.address_no}
                onChange={(e) => handleChange('address_no', e.target.value)}
                placeholder="เช่น 99/1"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">หมู่</label>
              <input
                type="text"
                value={formData.address_moo}
                onChange={(e) => handleChange('address_moo', e.target.value)}
                placeholder="เช่น 4"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">ตรอก</label>
              <input
                type="text"
                value={formData.address_trok}
                onChange={(e) => handleChange('address_trok', e.target.value)}
                placeholder=""
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">ซอย</label>
              <input
                type="text"
                value={formData.address_soi}
                onChange={(e) => handleChange('address_soi', e.target.value)}
                placeholder="เช่น รามคำแหง 24"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">ถนน</label>
              <input
                type="text"
                value={formData.address_road}
                onChange={(e) => handleChange('address_road', e.target.value)}
                placeholder="เช่น รามคำแหง"
                className="input text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">ตำบล / แขวง</label>
              <input
                type="text"
                value={formData.address_tambon}
                onChange={(e) => handleChange('address_tambon', e.target.value)}
                placeholder="เช่น หัวหมาก"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">อำเภอ / เขต</label>
              <input
                type="text"
                value={formData.address_amphoe}
                onChange={(e) => handleChange('address_amphoe', e.target.value)}
                placeholder="เช่น บางกะปิ"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">จังหวัด</label>
              <input
                type="text"
                value={formData.address_province}
                onChange={(e) => handleChange('address_province', e.target.value)}
                placeholder="เช่น กรุงเทพมหานคร"
                className="input text-sm"
              />
            </div>

            <div>
              <label className="label text-xs">รหัสไปรษณีย์</label>
              <input
                type="text"
                value={formData.address_zipcode}
                onChange={(e) => handleChange('address_zipcode', e.target.value)}
                placeholder="เช่น 10240"
                className="input text-sm"
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CARD 4: ข้อมูลการทำงาน */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-bold text-sm text-[#16233D]">4</span>
            <span className="font-bold text-sm text-[#16233D]">ข้อมูลการทำงาน</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* คลัง/สาขา */}
            <div>
              <label className="label text-xs label-required">คลัง/สาขา</label>
              <select
                value={formData.warehouse}
                onChange={(e) => handleChange('warehouse', e.target.value)}
                className="input text-sm"
                required
              >
                {availableWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.id}
                  </option>
                ))}
              </select>
              {availableWarehouses.length === 0 && (
                <p className="text-[11px] text-[#E5484D] mt-1">
                  ไม่พบคลังที่คุณมีสิทธิ์ดูแล กรุณาติดต่อ Super Admin เพื่อกำหนดสิทธิ์คลัง
                </p>
              )}
            </div>

            {/* วันที่เริ่มงาน (ค.ศ.) */}
            <div>
              <label className="label text-xs label-required">วันที่เริ่มงาน</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  placeholder="วว/ดด/ปปปป (ค.ศ.) เช่น 27/10/2026"
                  className="input text-sm pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    if (startDatePickerRef.current) {
                      try {
                        if ('showPicker' in HTMLInputElement.prototype) {
                          startDatePickerRef.current.showPicker()
                        } else {
                          startDatePickerRef.current.focus()
                        }
                      } catch {
                        startDatePickerRef.current.focus()
                      }
                    }
                  }}
                  className="absolute right-2.5 p-1 text-[#5B6B85] hover:text-[#2E6FE0] hover:bg-[#F4F6FA] rounded-lg transition-colors cursor-pointer"
                  title="เปิดปฏิทินเลือกวันที่เริ่มงาน"
                >
                  <Calendar size={16} />
                </button>
                <input
                  ref={startDatePickerRef}
                  type="date"
                  tabIndex={-1}
                  className="sr-only"
                  value={
                    formData.start_date && formData.start_date.split('/').length === 3
                      ? thaiDisplayToIsoDate(formData.start_date, false)
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      handleChange('start_date', isoToThaiDisplayDate(e.target.value, false))
                    }
                  }}
                />
              </div>
            </div>

            {/* เบอร์ติดต่อ */}
            <div>
              <label className="label text-xs label-required">เบอร์ติดต่อ (10 หลัก)</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="กรอกตัวเลข 10 หลัก เช่น 0812345678"
                className={cn(
                  'input text-sm',
                  formData.phone && formData.phone.length > 0 && formData.phone.length < 10 && 'border-[#E5484D]/60'
                )}
                required
              />
              {formData.phone && formData.phone.length > 0 && formData.phone.length < 10 && (
                <span className="text-[11px] text-[#E5484D] mt-1 block">
                  กรอกแล้ว {formData.phone.length}/10 หลัก (ต้องมี 10 หลัก)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CARD 5: ข้อมูลธนาคาร */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-bold text-sm text-[#16233D]">5</span>
            <span className="font-bold text-sm text-[#16233D]">ข้อมูลธนาคาร</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* ยืนยันพร้อมเพย์แล้วหรือยัง */}
            <div>
              <label className="label text-xs">ยืนยันพร้อมเพย์แล้วหรือยัง</label>
              <select
                value={formData.promptpay_status}
                onChange={(e) => handleChange('promptpay_status', e.target.value)}
                className="input text-sm"
              >
                <option value="ยืนยันแล้ว">ยืนยันแล้ว</option>
                <option value="ยังไม่ยืนยัน">ยังไม่ยืนยัน</option>
              </select>
            </div>

            {/* ธนาคาร */}
            <div>
              <label className={cn('label text-xs', formData.promptpay_status === 'ยังไม่ยืนยัน' && 'label-required')}>
                ธนาคาร
              </label>
              <select
                value={formData.bank_id}
                onChange={(e) => handleChange('bank_id', e.target.value)}
                className={cn(
                  'input text-sm',
                  formData.promptpay_status === 'ยังไม่ยืนยัน' && !formData.bank_id && 'border-[#E5484D]/60'
                )}
                required={formData.promptpay_status === 'ยังไม่ยืนยัน'}
              >
                <option value="">-- เลือกธนาคาร --</option>
                {filteredBanks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              {formData.warehouse && filteredBanks.length === 0 && (
                <p className="text-[11px] text-[#E5484D] mt-1 font-medium">
                  คลัง {formData.warehouse} ยังไม่มีธนาคารที่ได้รับสิทธิ์
                </p>
              )}
            </div>

            {/* เลขที่บัญชี */}
            <div>
              <label className={cn('label text-xs', formData.promptpay_status === 'ยังไม่ยืนยัน' && 'label-required')}>
                เลขที่บัญชี (เฉพาะตัวเลข)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.bank_account}
                onChange={(e) => handleChange('bank_account', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="กรอกเฉพาะตัวเลข (ไม่ต้องมีขีด) เช่น 1234567890"
                className={cn(
                  'input text-sm',
                  formData.promptpay_status === 'ยังไม่ยืนยัน' && !formData.bank_account && 'border-[#E5484D]/60'
                )}
                required={formData.promptpay_status === 'ยังไม่ยืนยัน'}
              />
            </div>
          </div>

          {formData.promptpay_status === 'ยังไม่ยืนยัน' && (
            <p className="text-[11px] text-[#B45F17] mt-3 bg-[#FEF3E2] px-3.5 py-2 rounded-xl flex items-center gap-1.5">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>เนื่องจากยังไม่ยืนยันพร้อมเพย์ จำเป็นต้องระบุธนาคารและเลขที่บัญชี</span>
            </p>
          )}
        </div>

        {/* ============================================================ */}
        {/* CARD 6: หมายเหตุ */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl border border-[#E1E6EF] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <span className="font-bold text-sm text-[#16233D]">6</span>
            <span className="font-bold text-sm text-[#16233D]">หมายเหตุ (ถ้ามี)</span>
          </div>

          <div>
            <textarea
              rows={3}
              value={formData.note}
              onChange={(e) => handleChange('note', e.target.value)}
              placeholder="ระบุข้อมูลเพิ่มเติมเกี่ยวกับพนักงานคนนี้ (ถ้ามี)"
              className="input text-sm resize-none"
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* Actions Footer */}
        {/* ============================================================ */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E6EF]">
          <Link
            href="/employees"
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={saving || (mode === 'create' && idCardDuplicate)}
            className="btn-primary px-6 py-2.5 text-sm shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save size={16} />
                {mode === 'create' ? 'บันทึกข้อมูล' : 'บันทึกการเปลี่ยนแปลง'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* ============================================================ */}
      {/* Success Popup Modal */}
      {/* ============================================================ */}
      {showSuccessModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowSuccessModal(false)}
        >
          <div
            className="bg-white rounded-3xl border border-[#E1E6EF] shadow-2xl max-w-[440px] w-full p-8 sm:p-10 text-center animate-in zoom-in-95 duration-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Green Success Icon Halo & Circle */}
            <div className="w-20 h-20 rounded-full bg-[#DEF7EC] flex items-center justify-center mx-auto mb-6">
              <div className="w-14 h-14 rounded-full bg-[#16A34A] flex items-center justify-center shadow-xs">
                <Check className="w-7 h-7 text-white stroke-[3]" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-bold text-[#16233D] tracking-tight mb-2">
              บันทึกข้อมูลพนักงานสำเร็จ
            </h3>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-[#5B6B85] mb-8">
              {mode === 'create'
                ? 'ข้อมูลพนักงานใหม่ถูกเพิ่มเข้าระบบเรียบร้อยแล้ว'
                : 'ข้อมูลพนักงานถูกอัปเดตเรียบร้อยแล้ว'}
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3.5 w-full">
              {mode === 'create' ? (
                <button
                  type="button"
                  onClick={handleAddNewAnother}
                  className="w-full py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border border-[#E1E6EF] text-[#16233D] bg-white hover:bg-[#F4F6FA] active:bg-[#EEF3FC] transition-colors"
                >
                  เพิ่มพนักงานอีกคน
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border border-[#E1E6EF] text-[#16233D] bg-white hover:bg-[#F4F6FA] active:bg-[#EEF3FC] transition-colors"
                >
                  แก้ไขข้อมูลต่อ
                </button>
              )}

              <button
                type="button"
                onClick={handleGoToEmployees}
                className="w-full py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#16A34A] hover:bg-[#15803D] active:bg-[#166534] transition-colors shadow-xs"
              >
                ไปหน้าข้อมูลพนักงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
