import type { Employee } from '@/types'

/**
 * Helper to download CSV file in browser with UTF-8 BOM
 * (ensures Thai characters render properly in Microsoft Excel)
 */
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Format date from YYYY-MM-DD to Thai DD/MM/YYYY
 */
function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}

/**
 * Export ทะเบียนลูกค้า
 */
export function exportCustomerRegistryCSV(employees: Employee[]) {
  const headers = [
    'รหัสพนักงาน (PO-id)',
    'คำนำหน้า',
    'ชื่อ',
    'นามสกุล',
    'Name (EN)',
    'Surname (EN)',
    'เพศ',
    'เลขบัตรประชาชน',
    'วันเดือนปีเกิด',
    'คลัง/สาขา',
    'วันที่เริ่มงาน',
    'เบอร์ติดต่อ',
    'ธนาคาร',
    'เลขที่บัญชี',
    'ยืนยันพร้อมเพย์',
    'ที่อยู่ตามบัตรประชาชน',
    'หมายเหตุ',
  ]

  const rows = employees.map((emp) => {
    // รวมที่อยู่ถ้าไม่มี address_full
    const fullAddress =
      emp.address_full ||
      [
        emp.address_no ? `เลขที่ ${emp.address_no}` : '',
        emp.address_moo ? `หมู่ ${emp.address_moo}` : '',
        emp.address_trok ? `ตรอก${emp.address_trok}` : '',
        emp.address_soi ? `ซอย${emp.address_soi}` : '',
        emp.address_road ? `ถนน${emp.address_road}` : '',
        emp.address_tambon ? `ต.${emp.address_tambon}` : '',
        emp.address_amphoe ? `อ.${emp.address_amphoe}` : '',
        emp.address_province ? `จ.${emp.address_province}` : '',
        emp.address_zipcode || '',
      ]
        .filter(Boolean)
        .join(' ')

    return [
      escapeCSV(emp.po_id || ''),
      escapeCSV(emp.prefix || ''),
      escapeCSV(emp.first_name || ''),
      escapeCSV(emp.last_name || ''),
      escapeCSV(emp.first_name_en || ''),
      escapeCSV(emp.last_name_en || ''),
      escapeCSV(emp.gender || ''),
      // ให้เลขบัตรมี string wrapper ไม่ให้ excel แปลงเป็น scientific notation
      escapeCSV(`'${emp.id_card}`),
      escapeCSV(formatDisplayDate(emp.dob)),
      escapeCSV(emp.warehouse_name || emp.warehouse || ''),
      escapeCSV(formatDisplayDate(emp.start_date)),
      // เบอร์โทรศัพท์ ใส่ quote ป้องกันเลข 0 หาย
      escapeCSV(`'${emp.phone || ''}`),
      escapeCSV(emp.bank_name || emp.bank_code || ''),
      escapeCSV(emp.bank_account ? `'${emp.bank_account}` : ''),
      escapeCSV(emp.promptpay_status || 'ยังไม่ยืนยัน'),
      escapeCSV(fullAddress),
      escapeCSV(emp.note || ''),
    ].join(',')
  })

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n')
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
  downloadCSV(`ทะเบียนลูกค้า_${dateStr}.csv`, csvContent)
}

/**
 * Export OPS (CSV)
 */
export function exportOpsCSV(employees: Employee[]) {
  const headers = [
    'รหัสพนักงาน (PO-id)',
    'ชื่อ-นามสกุล',
    'OPS ID',
    'คลัง/สาขา',
    'วันที่เริ่มงาน',
  ]

  const rows = employees.map((emp) => {
    const fullName = `${emp.prefix || ''} ${emp.first_name || ''} ${emp.last_name || ''}`.trim()
    const cleanOpsId = emp.ops_id ? emp.ops_id.trim().replace(/^0+/, '') : ''
    return [
      escapeCSV(emp.po_id || ''),
      escapeCSV(fullName),
      escapeCSV(cleanOpsId), // หากไม่มีให้เว้นว่างไว้ (ตัด 0 นำหน้าถ้ามี)
      escapeCSV(emp.warehouse_name || emp.warehouse || ''),
      escapeCSV(formatDisplayDate(emp.start_date)),
    ].join(',')
  })

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n')
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
  downloadCSV(`OPS_export_${dateStr}.csv`, csvContent)
}
