import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatThaiDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-'
  try {
    // Treat YYYY-MM-DD as local date to prevent timezone shift
    let d: Date
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, day] = dateStr.split('-').map(Number)
      d = new Date(y, m - 1, day)
    } else {
      d = new Date(dateStr)
    }
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

/** วันที่วันนี้ตามเวลาเครื่อง (YYYY-MM-DD) — ไม่ใช้ toISOString เพราะเป็น UTC ทำให้ช่วงเช้าได้วันเมื่อวาน */
export function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * ตรวจสอบเลขบัตรประชาชน 13 หลัก ตามหลักการคำนวณ Checksum ของกรมการปกครอง (ประเทศไทย)
 * สูตร: ผลรวมของ (หลักที่ 1 ถึง 12 * (14 - ตำแหน่ง)) mod 11
 * หลักที่ 13 (Check digit) = (11 - mod) mod 10
 */
export function validateThaiCitizenId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false
  const clean = id.replace(/[^0-9]/g, '')
  if (clean.length !== 13) return false

  // ตัวเลขหลักแรกของบัตรประชาชนไทยจะไม่ขึ้นต้นด้วย 0
  if (clean[0] === '0') return false

  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean[i], 10) * (13 - i)
  }

  const checkDigit = (11 - (sum % 11)) % 10
  return checkDigit === parseInt(clean[12], 10)
}

export interface DobParseResult {
  birthDate: Date | null
  age: number | null
  isUnder18: boolean
  error?: string
}

/**
 * แปลงข้อความวันเดือนปีเกิด (ทั้ง พ.ศ., ค.ศ., มีขีด หรือ /) และคำนวณอายุจริงแบบอัตโนมัติ
 * พร้อมตรวจสอบเกณฑ์อายุต่ำกว่า 18 ปีบริบูรณ์
 */
export function parseDobInput(text?: string | null): DobParseResult {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { birthDate: null, age: null, isUnder18: false }
  }

  const clean = text.trim()
  let d = 0, m = 0, y = 0

  // 1. ตรวจสอบรูปแบบ ISO: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10)
    m = parseInt(isoMatch[2], 10)
    d = parseInt(isoMatch[3], 10)
  } else {
    // 2. ตรวจสอบรูปแบบ DD/MM/YYYY หรือ DD-MM-YYYY หรือ DD.MM.YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
    if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10)
      m = parseInt(dmyMatch[2], 10)
      y = parseInt(dmyMatch[3], 10)
    } else {
      // 3. ตรวจสอบรูปแบบคั่นด้วยช่องว่าง: "20 11 2540"
      const parts = clean.split(/[\s/-]+/)
      if (parts.length === 3) {
        d = parseInt(parts[0], 10)
        m = parseInt(parts[1], 10)
        y = parseInt(parts[2], 10)
      }
    }
  }

  if (!d || !m || !y) {
    return { birthDate: null, age: null, isUnder18: false }
  }

  // ปรับปี พ.ศ. เป็น ค.ศ. (กรณีปี > 2400 เช่น 2540 ให้ลบ 543)
  if (y > 2400) {
    y = y - 543
  } else if (y < 100) {
    // กรณีพิมพ์ 2 หลัก เช่น "40" สำหรับปี 2540
    if (y >= 30) {
      y = 2500 + y - 543
    } else {
      y = 2000 + y
    }
  }

  // ตรวจสอบช่วงวันที่และเดือน
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { birthDate: null, age: null, isUnder18: false, error: 'วันที่หรือเดือนไม่ถูกต้อง' }
  }

  const birthDate = new Date(y, m - 1, d)
  // ตรวจสอบว่าวันที่ถูกต้องจริง (เช่น 31 กุมภาพันธ์ จะถูกปัดเดือน)
  if (
    birthDate.getFullYear() !== y ||
    birthDate.getMonth() !== m - 1 ||
    birthDate.getDate() !== d
  ) {
    return { birthDate: null, age: null, isUnder18: false, error: 'วันที่ในปฏิทินไม่ถูกต้อง' }
  }

  const today = new Date()
  if (birthDate > today) {
    return { birthDate, age: 0, isUnder18: true, error: 'วันเดือนปีเกิดต้องไม่เกินวันปัจจุบัน' }
  }

  // คำนวณอายุเทียบกับวันปัจจุบันอย่างแม่นยำ (คำนวณวันเกิดปีปัจจุบัน)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return {
    birthDate,
    age,
    isUnder18: age < 18,
    error: age < 18 ? `อายุต่ำกว่า 18 ปีบริบูรณ์ (ปัจจุบันอายุ ${age} ปี)` : undefined,
  }
}

