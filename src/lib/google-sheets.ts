import { google } from 'googleapis'
import type { Employee } from '@/types'

/**
 * หัวคอลัมน์มาตรฐานสำหรับ Google Sheets (A ถึง Z)
 */
export const GOOGLE_SHEET_EMPLOYEE_HEADERS = [
  'รหัสพนักงาน (PO-id)',      // A
  'คำนำหน้า',                  // B
  'ชื่อ',                      // C
  'นามสกุล',                   // D
  'ชื่อภาษาอังกฤษ',             // E
  'นามสกุลภาษาอังกฤษ',          // F
  'เพศ',                       // G
  'เลขบัตรประชาชน',             // H
  'วันเกิด (YYYY-MM-DD)',      // I
  'เบอร์ติดต่อ',               // J
  'คลัง/สาขา',                 // K
  'วันที่เริ่มงาน',             // L
  'OPS ID',                    // M
  'ฮับ (Station)',             // N
  'ประเภทสัญญา',               // O
  'หน่วยงาน',                  // P
  'แผนก (Designation)',        // Q
  'สถานะการทำงาน',              // R
  'ติดแบล็กลิสต์',              // S
  'สาเหตุแบล็กลิสต์',           // T
  'สถานะพร้อมเพย์',             // U
  'ธนาคาร',                    // V
  'เลขที่บัญชี',                // W
  'ที่อยู่',                    // X
  'หมายเหตุ',                   // Y
  'อัปเดตล่าสุด',                // Z
]

export const DEFAULT_SHEET_TITLE = 'TEST API DEMS'
let cachedSheetTitle: string | null = null

/**
 * ครอบชื่อแท็บด้วยเครื่องหมายคำพูดเดี่ยวเพื่อรองรับชื่อแท็บที่มีช่องว่าง เช่น 'TEST API DEMS'
 */
function escapeSheetTitle(title: string): string {
  const cleanTitle = title.replace(/^'+|'+$/g, '')
  return `'${cleanTitle.replace(/'/g, "''")}'`
}

/**
 * สร้าง Google Sheets API Client โดยใช้ Service Account
 */
export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let key = process.env.GOOGLE_PRIVATE_KEY
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  if (!email || !key || !spreadsheetId) {
    return null
  }

  // แปลง escaped newlines เป็น newline จริง
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\n/g, '\n')

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  return { sheets, spreadsheetId }
}

/**
 * ค้นหาชื่อแท็บ (Tab Title) โดยอัตโนมัติ พร้อม Smart Match และ In-Memory Cache
 */
export async function resolveSheetTitle(
  sheets: any,
  spreadsheetId: string,
  requestedTitle?: string
): Promise<string> {
  const target = (requestedTitle || process.env.GOOGLE_SHEET_TAB_NAME || DEFAULT_SHEET_TITLE).trim()
  if (cachedSheetTitle) return cachedSheetTitle

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const allSheets: any[] = meta.data.sheets || []

    // ตรวจหาแท็บที่ตรงกับ target (แบบไม่สนเว้นวรรคหน้าหลังและพิมพ์เล็กใหญ่)
    const matched = allSheets.find(
      (s: any) => s.properties?.title?.trim().toLowerCase() === target.toLowerCase()
    )
    if (matched?.properties?.title) {
      cachedSheetTitle = matched.properties.title
      return matched.properties.title
    }

    const firstTitle = allSheets[0]?.properties?.title
    if (firstTitle) {
      cachedSheetTitle = firstTitle
      return firstTitle
    }
  } catch (err) {
    console.warn('Could not query spreadsheet sheet title, using fallback:', err)
  }

  cachedSheetTitle = target
  return target
}

/**
 * แปลง Employee Object เป็น Array แถวข้อมูลใน Google Sheet
 */
export function employeeToRow(emp: Employee): (string | number | null)[] {
  const isBlacklistedText = emp.is_blacklisted ? 'ติดแบล็กลิสต์' : 'ปกติ'
  const workStatusText = emp.is_active ? 'ทำงานอยู่' : 'ลาออก/พักงาน'

  // รวมที่อยู่
  const address =
    emp.address_full ||
    [
      emp.address_no ? `เลขที่ ${emp.address_no}` : '',
      emp.address_moo ? `หมู่ ${emp.address_moo}` : '',
      emp.address_trok ? `ตรอก ${emp.address_trok}` : '',
      emp.address_soi ? `ซอย ${emp.address_soi}` : '',
      emp.address_road ? `ถนน ${emp.address_road}` : '',
      emp.address_tambon ? `ต.${emp.address_tambon}` : '',
      emp.address_amphoe ? `อ.${emp.address_amphoe}` : '',
      emp.address_province ? `จ.${emp.address_province}` : '',
      emp.address_zipcode || '',
    ]
      .filter(Boolean)
      .join(' ')

  return [
    emp.po_id || '',                                // A: รหัสพนักงาน
    emp.prefix || '',                              // B: คำนำหน้า
    emp.first_name || '',                          // C: ชื่อ
    emp.last_name || '',                           // D: นามสกุล
    emp.first_name_en || '',                       // E: ชื่อ (EN)
    emp.last_name_en || '',                        // F: นามสกุล (EN)
    emp.gender || '',                              // G: เพศ
    emp.id_card ? `'${emp.id_card}` : '',          // H: เลขบัตรประชาชน (ใส่ ' นำหน้าป้องกัน Sheet ตัด 0)
    emp.dob || '',                                 // I: วันเกิด
    emp.phone ? `'${emp.phone}` : '',              // J: เบอร์ติดต่อ
    emp.warehouse_name || emp.warehouse || '',     // K: คลังสินค้า
    emp.start_date || '',                          // L: วันที่เริ่มงาน
    emp.ops_id || '',                              // M: OPS ID
    emp.ops_hub || '',                             // N: ฮับ (Station)
    emp.ops_contract_type || '',                   // O: ประเภทสัญญา
    emp.ops_department || '',                      // P: หน่วยงาน
    emp.ops_designation || '',                     // Q: แผนก
    workStatusText,                                // R: สถานะการทำงาน
    isBlacklistedText,                             // S: ติดแบล็กลิสต์
    emp.blacklist_reason || '',                    // T: สาเหตุแบล็กลิสต์
    emp.promptpay_status || 'ยังไม่ยืนยัน',          // U: สถานะพร้อมเพย์
    emp.bank_name || '',                           // V: ธนาคาร
    emp.bank_account ? `'${emp.bank_account}` : '',// W: เลขที่บัญชี
    address,                                       // X: ที่อยู่
    emp.note || '',                                // Y: หมายเหตุ
    emp.updated_at || new Date().toISOString(),    // Z: อัปเดตล่าสุด
  ]
}

/**
 * ตรวจสอบและสร้างหัวตาราง (Header) หาก Sheet ยังว่างเปล่า
 */
async function ensureHeaders(sheets: any, spreadsheetId: string, sheetTitle: string) {
  try {
    const safeTitle = escapeSheetTitle(sheetTitle)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${safeTitle}!A1:Z1`,
    })

    const existingHeaders = res.data.values?.[0]
    if (!existingHeaders || existingHeaders.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${safeTitle}!A1:Z1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [GOOGLE_SHEET_EMPLOYEE_HEADERS],
        },
      })
    }
  } catch (err) {
    console.warn('Google Sheets ensureHeaders warning:', err)
  }
}

/**
 * 1. เพิ่มพนักงานใหม่ 1 คนลง Google Sheet (Append Row)
 * ทำงานในเบื้องหลัง (Non-blocking)
 */
export async function appendEmployeeToSheet(emp: Employee, requestedTitle?: string) {
  try {
    const client = getSheetsClient()
    if (!client) {
      console.warn('Google Sheets sync skipped: missing env credentials')
      return
    }

    const { sheets, spreadsheetId } = client
    const sheetTitle = await resolveSheetTitle(sheets, spreadsheetId, requestedTitle)
    await ensureHeaders(sheets, spreadsheetId, sheetTitle)

    const rowData = employeeToRow(emp)
    const safeTitle = escapeSheetTitle(sheetTitle)

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${safeTitle}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    })
  } catch (err: any) {
    console.error('Google Sheets appendEmployeeToSheet error:', err?.message || err)
  }
}

/**
 * 2. อัปเดตข้อมูลพนักงานใน Google Sheet (Update Specific Row)
 * ค้นหาแถวด้วย po_id หรือ id_card หากพบจะเขียนทับเฉพาะแถวนั้น ถ้าไม่พบจะ append ต่อท้าย
 */
export async function updateEmployeeInSheet(emp: Employee, requestedTitle?: string) {
  try {
    const client = getSheetsClient()
    if (!client) {
      console.warn('Google Sheets sync skipped: missing env credentials')
      return
    }

    const { sheets, spreadsheetId } = client
    const sheetTitle = await resolveSheetTitle(sheets, spreadsheetId, requestedTitle)
    await ensureHeaders(sheets, spreadsheetId, sheetTitle)

    const safeTitle = escapeSheetTitle(sheetTitle)

    // ดึง Column A (po_id) และ Column H (id_card) ทั้งหมดเพื่อค้นหาตำแหน่งแถว
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${safeTitle}!A:H`,
    })

    const rows: string[][] = res.data.values || []
    let targetRowIndex = -1 // 1-based index

    const cleanIdCard = emp.id_card?.replace(/[^0-9]/g, '')
    const targetPoId = emp.po_id?.trim()

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rowPoId = row[0]?.trim()
      const rowIdCard = row[7]?.replace(/[^0-9]/g, '')

      if (
        (targetPoId && rowPoId && targetPoId === rowPoId) ||
        (cleanIdCard && rowIdCard && cleanIdCard === rowIdCard)
      ) {
        targetRowIndex = i + 1 // +1 เพราะ Google Sheet แถวแรกคือ 1
        break
      }
    }

    const rowData = employeeToRow(emp)

    if (targetRowIndex > 0) {
      // พบแถวเดิม -> เขียนทับเฉพาะแถวนั้น (A{row}:Z{row})
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${safeTitle}!A${targetRowIndex}:Z${targetRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      })
    } else {
      // ไม่พบแถวเดิม -> เพิ่มแถวใหม่ต่อท้าย
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${safeTitle}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowData],
        },
      })
    }
  } catch (err: any) {
    console.error('Google Sheets updateEmployeeInSheet error:', err?.message || err)
  }
}

/**
 * 3. Sync พนักงานเป็นชุด (Batch Sync / Full Initial Sync)
 */
export async function syncBatchEmployeesToSheet(
  employees: Employee[],
  requestedTitle?: string
) {
  try {
    const client = getSheetsClient()
    if (!client) {
      throw new Error('Google Sheets credentials are not configured in environment')
    }

    const { sheets, spreadsheetId } = client
    const sheetTitle = await resolveSheetTitle(sheets, spreadsheetId, requestedTitle)
    await ensureHeaders(sheets, spreadsheetId, sheetTitle)

    if (employees.length === 0) return { count: 0 }

    const safeTitle = escapeSheetTitle(sheetTitle)
    const rowsData = employees.map(employeeToRow)

    // แบ่ง chunk ทีละ 500 เพื่อความเสถียรของ network payload
    const CHUNK_SIZE = 500
    for (let i = 0; i < rowsData.length; i += CHUNK_SIZE) {
      const chunk = rowsData.slice(i, i + CHUNK_SIZE)
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${safeTitle}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: chunk,
        },
      })
    }

    return { count: employees.length }
  } catch (err: any) {
    console.error('Google Sheets syncBatchEmployeesToSheet error:', err)
    throw err
  }
}
