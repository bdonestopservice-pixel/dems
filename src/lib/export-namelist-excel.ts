import type { NamelistEntry } from '@/types'
import { employeeFullName, hhmm } from '@/lib/namelist'

export interface ExportNamelistExcelOptions {
  date: string
  warehouse: string
  departmentName?: string | null
  shiftLabel?: string | null
}

/**
 * กำหนดรหัสประเภทกะ (D / N / H) จาก shift_type หรือเวลาเริ่มกะ
 */
export function getShiftTypeCode(
  type?: string | null,
  start?: string | null
): string {
  if (type === 'D' || type === 'N' || type === 'H') return type
  if (start) {
    const h = parseInt(start.split(':')[0], 10)
    if (!isNaN(h)) {
      return h >= 6 && h < 18 ? 'D' : 'N'
    }
  }
  return type || 'D'
}

/**
 * กำหนดชื่อประเภทกะภาษาไทยจาก shift_type หรือเวลาเริ่มกะ
 */
export function getShiftTypeThaiLabel(
  type?: string | null,
  start?: string | null
): string {
  if (type === 'D') return 'กะกลางวัน'
  if (type === 'N') return 'กะกลางคืน'
  if (type === 'H') return 'กะพิเศษ'
  if (start) {
    const h = parseInt(start.split(':')[0], 10)
    if (!isNaN(h)) {
      return h >= 6 && h < 18 ? 'กะกลางวัน' : 'กะกลางคืน'
    }
  }
  return 'กะทั่วไป'
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * จัดรูปแบบวันที่สำหรับ Export Namelist ลูกค้า
 * เปลี่ยนจาก DD/MM/YYYY (เช่น 23/11/2026) เป็น DD Mon YY (เช่น 23 Nov 26)
 * ใช้อักษรภาษาอังกฤษย่อ 3 ตัวสำหรับทุกเดือน และปี ค.ศ. 2 หลัก
 */
export function formatCustomerNamelistDate(dateStr?: string | null): string {
  if (!dateStr) return ''

  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim()
  const parts = clean.split(/[-/]/)

  if (parts.length === 3) {
    let yearStr = parts[0]
    let monthStr = parts[1]
    let dayStr = parts[2]

    // กรณีส่งมาเป็น DD/MM/YYYY หรือ DD-MM-YYYY
    if (parts[2].length === 4 || parseInt(parts[2], 10) > 1900) {
      dayStr = parts[0]
      monthStr = parts[1]
      yearStr = parts[2]
    }

    const monthNum = parseInt(monthStr, 10)
    if (monthNum >= 1 && monthNum <= 12) {
      const monthAbbr = MONTH_ABBR[monthNum - 1]
      let yearNum = parseInt(yearStr, 10)
      if (yearNum > 2400) yearNum -= 543 // แปลง พ.ศ. เป็น ค.ศ.
      const yearShort = String(yearNum).slice(-2)
      return `${dayStr} ${monthAbbr} ${yearShort}`
    }
  }

  // Fallback กรณีรูปแบบอื่น ใช้ Date object
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0')
    const monthAbbr = MONTH_ABBR[d.getMonth()]
    const yearShort = String(d.getFullYear()).slice(-2)
    return `${day} ${monthAbbr} ${yearShort}`
  }

  return dateStr
}

// Alias เพื่อความเข้ากันได้
const formatDisplayDate = formatCustomerNamelistDate

/**
 * ฟังก์ชันสร้างและดาวน์โหลดไฟล์ Excel สำหรับ Namelist ลูกค้า
 * ปรับปรุงให้ตรงตาม Format ของโมดูลรายงาน (4 คอลัมน์: วันที่ | ค้นหา | เข้างาน | Shift Name)
 */
export async function exportNamelistToExcel(
  entries: NamelistEntry[],
  options: ExportNamelistExcelOptions
) {
  const XLSX = await import('xlsx')

  // หัวตาราง 4 คอลัมน์ตาม Worksheet: ExportNamelistลูกค้า (ตรงกับโมดูลรายงาน)
  const headers = ['วันที่', 'ค้นหา', 'เข้างาน', 'Shift Name']

  // แถวข้อมูลพนักงาน
  const rows = entries.map((entry) => {
    // 1. วันที่ทำงาน (รูปแบบ เช่น 23 Nov 26)
    const dateFormatted = formatCustomerNamelistDate(entry.date || options.date)
    // 2. ค้นหา = ชื่อ นามสกุล (ไม่รวมคำนำหน้า)
    const fullName = employeeFullName(entry)
    // 3. เข้างาน = เวลาเริ่มต้นของกะ เช่น 09:00 หรือ 06:00
    const checkIn = hhmm(entry.shift_start) || ''
    // 4. Shift Name = ชื่อแผนก / Shift Name ของแผนก
    const shiftName = entry.department_shift_name || entry.department_name || ''

    return [dateFormatted, fullName, checkIn, shiftName]
  })

  // สร้าง Worksheet จาก Array of Arrays
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // กำหนดความกว้างคอลัมน์ให้อ่านง่ายพอดีกับข้อมูล (ตรงกับโมดูลรายงาน)
  worksheet['!cols'] = [
    { wch: 14 }, // วันที่
    { wch: 28 }, // ค้นหา
    { wch: 14 }, // เข้างาน
    { wch: 24 }, // Shift Name
  ]

  // สร้าง Workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ExportNamelistลูกค้า')

  // ตั้งชื่อไฟล์ Excel ให้ชัดเจนตามเงื่อนไขที่เลือก
  const whPart =
    options.warehouse && options.warehouse !== 'all'
      ? options.warehouse
      : 'ทุกคลัง'
  const deptPart = options.departmentName
    ? `_${options.departmentName.replace(/[\s/\\:*?"<>|]/g, '-')}`
    : ''
  const shiftPart = options.shiftLabel
    ? `_${options.shiftLabel.replace(/[\s/\\:*?"<>|]/g, '-')}`
    : ''

  const filename = `Namelist_ลูกค้า_${whPart}_${options.date}${deptPart}${shiftPart}.xlsx`

  // สั่งดาวน์โหลดลงเครื่องผู้ใช้งาน
  try {
    XLSX.writeFile(workbook, filename)
  } catch (err) {
    // Fallback สำหรับเบราว์เซอร์ที่บล็อก XLSX.writeFile
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
