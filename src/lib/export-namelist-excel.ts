import type { NamelistEntry } from '@/types'
import { employeeFullName, formatShiftRange } from '@/lib/namelist'

export interface ExportNamelistExcelOptions {
  date: string
  warehouse: string
  departmentName?: string | null
  shiftLabel?: string | null
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
 * ฟังก์ชันสร้างและดาวน์โหลดไฟล์ Excel สำหรับ Namelist ลูกค้า
 */
export async function exportNamelistToExcel(
  entries: NamelistEntry[],
  options: ExportNamelistExcelOptions
) {
  const XLSX = await import('xlsx')

  // แปลงรูปแบบวันที่ YYYY-MM-DD เป็น DD/MM/YYYY สำหรับแสดงผล
  const dateParts = options.date ? options.date.split('-') : []
  const displayDate =
    dateParts.length === 3
      ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
      : options.date || ''

  // หัวตารางคอลัมน์
  const headers = [
    'ลำดับ',
    'วันที่',
    'คลัง',
    'รหัสพนักงาน',
    'คำนำหน้า',
    'ชื่อ',
    'นามสกุล',
    'ชื่อ-นามสกุล',
    'แผนก',
    'กะเวลา',
    'ประเภทกะ',
    'ต่างพื้นที่',
    'Status การทำงาน',
    'หมายเหตุ',
  ]

  // แถวข้อมูลพนักงาน
  const rows = entries.map((entry, index) => {
    const shiftType = getShiftTypeThaiLabel(entry.shift_type, entry.shift_start)
    const shiftTime = formatShiftRange(entry.shift_start, entry.shift_end)

    return [
      index + 1,
      displayDate,
      entry.warehouse || (options.warehouse !== 'all' ? options.warehouse : '') || '',
      entry.po_id || '',
      entry.prefix || '',
      entry.first_name || '',
      entry.last_name || '',
      employeeFullName(entry),
      entry.department_name || '',
      shiftTime === '—' ? '' : shiftTime,
      shiftType,
      entry.oa_status || '-',
      entry.work_status || '',
      entry.note || '',
    ]
  })

  // สร้าง Worksheet จาก Array of Arrays
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // กำหนดความกว้างคอลัมน์ให้อ่านง่ายพอดีกับข้อมูล
  worksheet['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 14 }, // วันที่
    { wch: 12 }, // คลัง
    { wch: 16 }, // รหัสพนักงาน
    { wch: 10 }, // คำนำหน้า
    { wch: 16 }, // ชื่อ
    { wch: 18 }, // นามสกุล
    { wch: 24 }, // ชื่อ-นามสกุล
    { wch: 18 }, // แผนก
    { wch: 16 }, // กะเวลา
    { wch: 14 }, // ประเภทกะ
    { wch: 12 }, // ต่างพื้นที่
    { wch: 18 }, // Status การทำงาน
    { wch: 30 }, // หมายเหตุ
  ]

  // สร้าง Workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Namelist')

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

