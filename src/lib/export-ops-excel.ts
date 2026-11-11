import type { Employee } from '@/types'

/**
 * คำแนะนำ 11 บรรทัดแรกตาม Template: Mass_add_agency_portal_ops_import
 */
const OPS_IMPORT_INSTRUCTIONS: (string | null)[][] = [
  ['Template Instruction:'],
  [
    '1. If you filled out Ops ID, the row will be considered as editing existing staff; if you leave the Ops ID field blank, the row will be considered as adding staff and all fields with "*" shall be filled out;',
  ],
  [
    '2. For editing staff profile, you only need to fill out "Ops ID" + any fields you would like to modify;',
  ],
  ['3. The "*" symbol indicates mandatory fields during creation.'],
  ['4. Entry format:'],
  ['- Name: free text'],
  ['- Gender: Male or Female, case insensitive'],
  [
    '- National ID & Passport ID: For one staff, please only input one type of IDs, otherwise upload will fail.',
  ],
  [
    '- Station: Fill in the Station Name(s). Please refer to Template>> Reference: Station List. If more than one, use "," to separate station Name',
  ],
  [
    '- Contract Type: Agency Full-time or Agency Part-time, case insensitive (Special logic only for BR: Part-time BPO, Diarista BPO, Temporário BPO)',
  ],
  ['- Department: Refer to the department list in single creation page'],
]

/**
 * หัวคอลัมน์ของ Template (บรรทัดที่ 12)
 */
const OPS_IMPORT_HEADERS: string[] = [
  'Ops ID',
  'First Name *',
  'Last Name *',
  'Middle Name',
  'Gender *',
  'National ID',
  'Passport ID',
  'Station *',
  'Contract Type *',
  'Department *',
  'Designation *',
  'Phone Number *',
  'Email',
  'Joined Date (YYYY-MM-DD) *',
]

/**
 * แปลงเพศเป็นภาษาอังกฤษตาม Template ('Male' หรือ 'Female')
 */
function formatOpsGender(gender?: string | null): string {
  if (!gender) return ''
  const g = gender.trim().toLowerCase()
  if (g === 'หญิง' || g === 'female' || g === 'f') return 'Female'
  if (g === 'ชาย' || g === 'male' || g === 'm') return 'Male'
  return gender
}

/**
 * แปลงวันที่เป็นรูปแบบ YYYY-MM-DD
 */
function formatOpsJoinedDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  // If DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/')
    let year = parseInt(y, 10)
    if (year > 2400) year -= 543
    return `${year}-${m}-${d}`
  }
  try {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  } catch {}
  return dateStr
}

/**
 * Helper สั่งดาวน์โหลด Workbook เป็นไฟล์ .xlsx
 */
async function downloadWorkbook(workbook: any, filename: string) {
  const XLSX = await import('xlsx')
  try {
    XLSX.writeFile(workbook, filename)
  } catch {
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
 * Export OPS ID เป็นไฟล์ Excel (.xlsx) ตามโครงสร้าง Template ลูกค้า
 * - บรรทัด 1-11: คำแนะนำ Template Instruction
 * - บรรทัด 12: หัวคอลัมน์
 * - บรรทัด 13+: รายการข้อมูลพนักงาน
 *
 * การเทียบฟิลด์:
 * - ฮับ = Station * (ops_hub || warehouse)
 * - ประเภทสัญญา = Contract Type * (ops_contract_type)
 * - หน่วยงาน = Department * (ops_department)
 * - แผนก = Designation * (ops_designation)
 */
export async function exportOpsExcel(employees: Employee[], customFilename?: string) {
  const XLSX = await import('xlsx')

  const rows: any[][] = []

  // 1. Instructions (Rows 1 - 11)
  for (const inst of OPS_IMPORT_INSTRUCTIONS) {
    rows.push(inst)
  }

  // 2. Header Row (Row 12)
  rows.push(OPS_IMPORT_HEADERS)

  // 3. Employee Rows (Row 13+)
  for (const emp of employees) {
    const cleanPhone = emp.phone ? emp.phone.replace(/[^0-9]/g, '') : ''
    const cleanIdCard = emp.id_card ? emp.id_card.replace(/[^0-9]/g, '') : ''

    const row = [
      emp.ops_id?.trim() || null,                             // Ops ID
      emp.first_name?.trim() || '',                           // First Name *
      emp.last_name?.trim() || '',                            // Last Name *
      null,                                                   // Middle Name
      formatOpsGender(emp.gender),                            // Gender *
      cleanIdCard || null,                                    // National ID
      null,                                                   // Passport ID
      emp.ops_hub?.trim() || emp.warehouse?.trim() || '',     // Station * (ฮับ)
      emp.ops_contract_type?.trim() || '',                    // Contract Type * (ประเภทสัญญา)
      emp.ops_department?.trim() || '',                       // Department * (หน่วยงาน)
      emp.ops_designation?.trim() || '',                      // Designation * (แผนก)
      cleanPhone || null,                                     // Phone Number *
      null,                                                   // Email
      formatOpsJoinedDate(emp.start_date),                    // Joined Date (YYYY-MM-DD) *
    ]

    rows.push(row)
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // ตั้งความกว้างคอลัมน์ให้อ่านง่าย
  ws['!cols'] = [
    { wch: 16 }, // Ops ID
    { wch: 18 }, // First Name *
    { wch: 18 }, // Last Name *
    { wch: 14 }, // Middle Name
    { wch: 12 }, // Gender *
    { wch: 18 }, // National ID
    { wch: 14 }, // Passport ID
    { wch: 16 }, // Station *
    { wch: 24 }, // Contract Type *
    { wch: 24 }, // Department *
    { wch: 22 }, // Designation *
    { wch: 16 }, // Phone Number *
    { wch: 22 }, // Email
    { wch: 26 }, // Joined Date (YYYY-MM-DD) *
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const defaultName = `Mass_add_agency_portal_ops_import_${y}${m}${d}.xlsx`

  await downloadWorkbook(wb, customFilename || defaultName)
}

