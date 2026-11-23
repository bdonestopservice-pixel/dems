import type { Employee, NamelistEntry } from '@/types'
import { employeeFullName, formatShiftRange, hhmm } from '@/lib/namelist'
import { formatCustomerNamelistDate } from '@/lib/export-namelist-excel'

export type RegistryExportable = NamelistEntry | Employee

interface ExportReportOptions {
  date: string
  warehouse: string
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
 * รวมที่อยู่ภาษาไทยแบบเต็ม
 */
export function getEmployeeAddress(entry: RegistryExportable): string {
  if (entry.address_full && entry.address_full.trim()) {
    return entry.address_full.trim()
  }
  const parts = [
    entry.address_no ? `เลขที่ ${entry.address_no}` : '',
    entry.address_moo ? `หมู่ ${entry.address_moo}` : '',
    entry.address_trok ? `ตรอก${entry.address_trok}` : '',
    entry.address_soi ? `ซอย${entry.address_soi}` : '',
    entry.address_road ? `ถนน${entry.address_road}` : '',
    entry.address_tambon ? `ต.${entry.address_tambon}` : '',
    entry.address_amphoe ? `อ.${entry.address_amphoe}` : '',
    entry.address_province ? `จ.${entry.address_province}` : '',
    entry.address_zipcode || '',
  ].filter(Boolean)

  return parts.join(' ')
}

/**
 * Helper สั่งดาวน์โหลด Workbook เป็นไฟล์ .xlsx
 */
async function downloadWorkbook(workbook: any, filename: string) {
  const XLSX = await import('xlsx')
  try {
    XLSX.writeFile(workbook, filename)
  } catch (err) {
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

/**
 * 1. Export Namelist ลูกค้า (4 คอลัมน์ ตาม Worksheet: ExportNamelistลูกค้า)
 * คอลัมน์: วันที่ | ค้นหา | เข้างาน | Shift Name
 */
export async function exportCustomerNamelistReport(
  entries: NamelistEntry[],
  options: ExportReportOptions
) {
  const XLSX = await import('xlsx')

  const headers = ['วันที่', 'ค้นหา', 'เข้างาน', 'Shift Name']

  const rows = entries.map((entry) => {
    // วันที่ทำงาน (รูปแบบ เช่น 23 Nov 26)
    const dateFormatted = formatCustomerNamelistDate(entry.date || options.date)
    // ค้นหา = ชื่อ นามสกุล
    const fullName = employeeFullName(entry)
    // เข้างาน = เวลาเริ่มต้นของกะ เช่น 09:00
    const checkIn = hhmm(entry.shift_start) || ''
    // Shift Name = ชื่อแผนก / Shift Name ของแผนก
    const shiftName = entry.department_shift_name || entry.department_name || ''

    return [dateFormatted, fullName, checkIn, shiftName]
  })

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  worksheet['!cols'] = [
    { wch: 14 }, // วันที่
    { wch: 28 }, // ค้นหา
    { wch: 14 }, // เข้างาน
    { wch: 24 }, // Shift Name
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ExportNamelistลูกค้า')

  const whClean = options.warehouse && options.warehouse !== 'all' ? options.warehouse : 'ทุกคลัง'
  const filename = `Namelist_ลูกค้า_${whClean}_${options.date}.xlsx`

  await downloadWorkbook(workbook, filename)
}

/**
 * 2. Export ทะเบียนพนักงานลูกค้า (13 คอลัมน์ ตาม Worksheet: ทะเบียนพนักงานลูกค้า)
 * คอลัมน์: วันที่เริ่มงาน | รหัสพนักงาน | ชื่อ | นามสกุล | เพศ | ชื่อเล่น | Name | Surname | รหัสบัตรประชาชน | เบอร์โทร | วันเดือนปีเกิด | ที่อยู่ตามบัตรประชาชน | OPS ID
 */
export async function exportCustomerRegistryReport(
  entries: RegistryExportable[],
  options: ExportReportOptions
) {
  const XLSX = await import('xlsx')

  const headers = [
    'วันที่เริ่มงาน',
    'รหัสพนักงาน',
    'ชื่อ',
    'นามสกุล',
    'เพศ',
    'ชื่อเล่น',
    'Name',
    'Surname',
    'รหัสบัตรประชาชน',
    'เบอร์โทร',
    'วันเดือนปีเกิด',
    'ที่อยู่ตามบัตรประชาชน',
    'OPS ID',
  ]

  const rows = entries.map((entry) => {
    const startDate = formatDisplayDate(entry.start_date)
    const dob = formatDisplayDate(entry.dob)
    const idCard = entry.id_card ? String(entry.id_card) : ''
    const phone = entry.phone ? String(entry.phone) : ''
    const fullAddress = getEmployeeAddress(entry)

    return [
      startDate,
      entry.po_id || '',
      entry.first_name || '',
      entry.last_name || '',
      entry.gender || '',
      '', // ชื่อเล่น (เราไม่มีแค่เอาหัวคอลัมน์ไว้ตามข้อกำหนด)
      entry.first_name_en || '',
      entry.last_name_en || '',
      idCard,
      phone,
      dob,
      fullAddress,
      entry.ops_id || '',
    ]
  })

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  worksheet['!cols'] = [
    { wch: 14 }, // วันที่เริ่มงาน
    { wch: 16 }, // รหัสพนักงาน
    { wch: 16 }, // ชื่อ
    { wch: 18 }, // นามสกุล
    { wch: 10 }, // เพศ
    { wch: 12 }, // ชื่อเล่น
    { wch: 16 }, // Name
    { wch: 18 }, // Surname
    { wch: 20 }, // รหัสบัตรประชาชน
    { wch: 16 }, // เบอร์โทร
    { wch: 16 }, // วันเดือนปีเกิด
    { wch: 45 }, // ที่อยู่ตามบัตรประชาชน
    { wch: 16 }, // OPS ID
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ทะเบียนพนักงานลูกค้า')

  const whClean = options.warehouse && options.warehouse !== 'all' ? options.warehouse : 'ทุกคลัง'
  const filename = `ทะเบียนพนักงานลูกค้า_${whClean}_${options.date}.xlsx`

  await downloadWorkbook(workbook, filename)
}

/**
 * 3. Export คำนวณค่าจ้าง PPO (9 คอลัมน์ ตาม Worksheet: Exportค่าจ้าง)
 * คอลัมน์: รหัสพนักงาน | วันที่ทำงาน | ชื่อ - นามสกุล | แผนก | Type | กะทำงาน | D/N/H | เข้างาน | ออกงาน
 */
export async function exportPpoWageReport(
  entries: NamelistEntry[],
  options: ExportReportOptions
) {
  const XLSX = await import('xlsx')

  const headers = [
    'รหัสพนักงาน',
    'วันที่ทำงาน',
    'ชื่อ - นามสกุล',
    'แผนก',
    'Type',
    'กะทำงาน',
    'D/N/H',
    'เข้างาน',
    'ออกงาน',
  ]

  const rows = entries.map((entry) => {
    const workDate = formatDisplayDate(entry.date || options.date)
    const fullName = employeeFullName(entry)
    // Type = warehouse หรือ department_type เช่น SOCE
    const typeVal = entry.department_type || entry.warehouse || (options.warehouse !== 'all' ? options.warehouse : '') || ''
    // กะทำงาน เช่น 08:00-17:00
    const shiftRange = formatShiftRange(entry.shift_start, entry.shift_end)
    // เข้างาน - ออกงาน
    const startTime = hhmm(entry.shift_start) || ''
    const endTime = hhmm(entry.shift_end) || ''

    return [
      entry.po_id || '',
      workDate,
      fullName,
      entry.department_name || '',
      typeVal,
      shiftRange === '—' ? '' : shiftRange,
      entry.shift_type || '',
      startTime,
      endTime,
    ]
  })

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  worksheet['!cols'] = [
    { wch: 16 }, // รหัสพนักงาน
    { wch: 14 }, // วันที่ทำงาน
    { wch: 26 }, // ชื่อ - นามสกุล
    { wch: 22 }, // แผนก
    { wch: 14 }, // Type
    { wch: 16 }, // กะทำงาน
    { wch: 10 }, // D/N/H
    { wch: 12 }, // เข้างาน
    { wch: 12 }, // ออกงาน
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Exportค่าจ้าง')

  const whClean = options.warehouse && options.warehouse !== 'all' ? options.warehouse : 'ทุกคลัง'
  const filename = `Exportค่าจ้าง_PPO_${whClean}_${options.date}.xlsx`

  await downloadWorkbook(workbook, filename)
}

