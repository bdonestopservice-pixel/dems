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

/**
 * จัดรูปแบบวันที่ YYYY-MM-DD เป็น DD/MM/YYYY สำหรับแสดงผลใน Excel
 */
function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

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
    // 1. วันที่ทำงาน (DD/MM/YYYY)
    const dateFormatted = formatDisplayDate(entry.date || options.date)
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
