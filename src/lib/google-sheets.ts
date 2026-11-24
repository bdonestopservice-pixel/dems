import { google } from 'googleapis'
import type { Employee } from '@/types'

/**
 * หัวคอลัมน์มาตรฐานสำหรับ Google Sheets แท็บ MasterDEMS (A ถึง Y รวม 25 คอลัมน์)
 * อ้างอิงรูปแบบและการเรียงลำดับจากแท็บ Master_ข้อมูลพนักงาน_ค่าจ้าง
 */
export const GOOGLE_SHEET_EMPLOYEE_HEADERS = [
  'Timestamp',                                   // A
  'รหัสพนักงาน',                                  // B
  'วันที่เริ่มงาน (ค.ศ.)',                         // C
  'คำนำหน้า',                                    // D
  'ชื่อ',                                         // E
  'นามสกุล',                                     // F
  'เพศ(ชาย,หญิง)',                                // G
  'Name',                                        // H
  'Surname',                                     // I
  'เลขบัตรประชาชน',                              // J
  'เบอร์ติดต่อ (081xxxxxxx)',                     // K
  'วันเดือนปีเกิด (พ.ศ. ตัวอย่าง 24/12/2540)',     // L
  'เลขที่',                                       // M
  'หมู่',                                         // N
  'ตรอก',                                        // O
  'ซอย',                                         // P
  'ตำบล',                                        // Q
  'อำเภอ',                                       // R
  'ถนน',                                         // S
  'จังหวัด',                                      // T
  'ที่อยู่ตามบัตรประชาชน',                         // U
  'ธนาคาร',                                      // V
  'เลขที่บัญชี',                                  // W
  'ชื่อ-นามสกุล(รวม)',                            // X
  'คลัง',                                        // Y
]

export const DEFAULT_SHEET_TITLE = 'MasterDEMS'
let cachedSheetTitle: string | null = null
let headersEnsured = false

/**
 * ครอบชื่อแท็บด้วยเครื่องหมายคำพูดเดี่ยวเพื่อรองรับชื่อแท็บที่มีช่องว่างหรืออักขระพิเศษ
 */
function escapeSheetTitle(title: string): string {
  const cleanTitle = title.replace(/^'+|'+$/g, '')
  return `'${cleanTitle.replace(/'/g, "''")}'`
}

/**
 * แปลง ISO Timestamp เป็นรูปแบบเดียวกับ Master_ข้อมูลพนักงาน_ค่าจ้าง
 * เช่น "24/11/2026, 13:25:09" (เวลาไทย Asia/Bangkok)
 */
function formatSheetTimestamp(isoStr?: string | null): string {
  const date = isoStr ? new Date(isoStr) : new Date()
  if (isNaN(date.getTime())) return isoStr || ''

  // แปลงเป็นเวลาประเทศไทย (UTC+7)
  const bkk = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  const d = bkk.getUTCDate()
  const m = bkk.getUTCMonth() + 1
  const y = bkk.getUTCFullYear()
  const hh = bkk.getUTCHours()
  const mm = String(bkk.getUTCMinutes()).padStart(2, '0')
  const ss = String(bkk.getUTCSeconds()).padStart(2, '0')
  return `'${d}/${m}/${y}, ${hh}:${mm}:${ss}`
}

/**
 * แปลงวันที่เริ่มงานเป็นรูปแบบ D/M/YYYY (ค.ศ.) เช่น "1/10/2025"
 */
function formatStartDateAD(dateStr?: string | null): string {
  if (!dateStr) return ''
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim()
  const parts = clean.split(/[-/]/)
  if (parts.length === 3) {
    let year: number
    let month: number
    let day: number
    if (parts[0].length === 4 || parseInt(parts[0], 10) > 1900) {
      year = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
      day = parseInt(parts[2], 10)
    } else {
      day = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
      year = parseInt(parts[2], 10)
    }
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      if (year > 2400) year -= 543
      return `${day}/${month}/${year}`
    }
  }
  return clean
}

/**
 * แปลงวันเดือนปีเกิดเป็นรูปแบบ DD/MM/YYYY (พ.ศ.) เช่น "24/12/2540"
 * ใส่ ' นำหน้าเพื่อป้องกัน Google Sheets แปลงปี พ.ศ. หรือตัดเลข 0 นำหน้า
 */
function formatDobBE(dateStr?: string | null): string {
  if (!dateStr) return ''
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim()
  const parts = clean.split(/[-/]/)
  if (parts.length === 3) {
    let year: number
    let month: number
    let day: number
    if (parts[0].length === 4 || parseInt(parts[0], 10) > 1900) {
      year = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
      day = parseInt(parts[2], 10)
    } else {
      day = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10)
      year = parseInt(parts[2], 10)
    }
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      if (year < 2400) year += 543
      const dd = String(day).padStart(2, '0')
      const mm = String(month).padStart(2, '0')
      return `'${dd}/${mm}/${year}`
    }
  }
  return `'${clean}`
}

/**
 * แปลงชื่อธนาคารให้มีรหัสธนาคารนำหน้าเหมือน Master_ข้อมูลพนักงาน_ค่าจ้าง
 * เช่น "004 กสิกรไทย", "014 ไทยพาณิชย์"
 */
function formatBankDisplay(bankCode?: string | null, bankName?: string | null): string {
  const code = bankCode?.trim() || ''
  const name = bankName?.trim() || ''
  if (code && name) {
    return name.startsWith(code) ? name : `${code} ${name}`
  }
  return name || code
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
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    })
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
 * แปลง Employee Object เป็น Array แถวข้อมูลใน Google Sheet (25 คอลัมน์: A ถึง Y)
 */
export function employeeToRow(emp: Employee): (string | number | null)[] {
  // รวมที่อยู่ตามบัตรประชาชน
  const addressFull =
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

  const fullName = [emp.first_name?.trim(), emp.last_name?.trim()].filter(Boolean).join(' ')

  return [
    formatSheetTimestamp(emp.updated_at || emp.created_at), // A: Timestamp
    emp.po_id || '',                                        // B: รหัสพนักงาน
    formatStartDateAD(emp.start_date),                      // C: วันที่เริ่มงาน (ค.ศ.)
    emp.prefix || '',                                       // D: คำนำหน้า
    emp.first_name || '',                                   // E: ชื่อ
    emp.last_name || '',                                    // F: นามสกุล
    emp.gender || '',                                       // G: เพศ(ชาย,หญิง)
    emp.first_name_en || '',                                // H: Name
    emp.last_name_en || '',                                 // I: Surname
    emp.id_card ? `'${emp.id_card}` : '',                   // J: เลขบัตรประชาชน
    emp.phone ? `'${emp.phone}` : '',                       // K: เบอร์ติดต่อ (081xxxxxxx)
    formatDobBE(emp.dob),                                   // L: วันเดือนปีเกิด (พ.ศ. ตัวอย่าง 24/12/2540)
    emp.address_no ? `'${emp.address_no}` : '',             // M: เลขที่
    emp.address_moo ? `'${emp.address_moo}` : '',           // N: หมู่
    emp.address_trok || '',                                 // O: ตรอก
    emp.address_soi || '',                                  // P: ซอย
    emp.address_tambon || '',                               // Q: ตำบล
    emp.address_amphoe || '',                               // R: อำเภอ
    emp.address_road || '',                                 // S: ถนน
    emp.address_province || '',                             // T: จังหวัด
    addressFull,                                            // U: ที่อยู่ตามบัตรประชาชน
    formatBankDisplay(emp.bank_code, emp.bank_name),        // V: ธนาคาร
    emp.bank_account ? `'${emp.bank_account}` : '',         // W: เลขที่บัญชี
    fullName,                                               // X: ชื่อ-นามสกุล(รวม)
    emp.warehouse_name || emp.warehouse || '',              // Y: คลัง
  ]
}

/**
 * ตรวจสอบและสร้างหัวตาราง (Header) หาก Sheet ยังว่างเปล่า
 * รองรับทั้งกรณีหัวตารางอยู่แถว 1 หรือแถว 2 (เช่น แถว 1 เป็นแถบหัวข้อ Importrange และแถว 2 เป็นชื่อคอลัมน์)
 */
async function ensureHeaders(sheets: any, spreadsheetId: string, sheetTitle: string) {
  if (headersEnsured) return
  try {
    const safeTitle = escapeSheetTitle(sheetTitle)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${safeTitle}!A1:Y2`,
    })

    const rows: string[][] = res.data.values || []
    const hasHeader = rows.some(
      (r) => r && (r[0]?.trim() === 'Timestamp' || r[1]?.trim() === 'รหัสพนักงาน')
    )
    if (!hasHeader && rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${safeTitle}!A1:Y1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [GOOGLE_SHEET_EMPLOYEE_HEADERS],
        },
      })
    }
    headersEnsured = true
  } catch (err) {
    console.warn('Google Sheets ensureHeaders warning:', err)
  }
}

/**
 * 1. เพิ่มพนักงานใหม่ 1 คนลง Google Sheet (Append Row)
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
      range: `${safeTitle}!A2:Y`,
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
 * ค้นหาแถวด้วย Column B (รหัสพนักงาน) หรือ Column J (เลขบัตรประชาชน)
 * หากพบจะเขียนทับเฉพาะแถวนั้น (A{row}:Y{row}) ถ้าไม่พบจะ append ต่อท้าย
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

    let targetRowIndex = -1 // 1-based index
    const targetPoId = emp.po_id?.trim()
    const cleanIdCard = emp.id_card?.replace(/[^0-9]/g, '')

    // 1. ค้นหาแถวด้วย Column B (รหัสพนักงาน / po_id) ก่อน (ดึงเฉพาะ 1 คอลัมน์ เร็วมาก)
    if (targetPoId) {
      const resB = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${safeTitle}!B:B`,
      })
      const rowsB: string[][] = resB.data.values || []
      for (let i = 1; i < rowsB.length; i++) {
        if (rowsB[i][0] && rowsB[i][0].trim() === targetPoId) {
          targetRowIndex = i + 1
          break
        }
      }
    }

    // 2. หากยังไม่พบด้วย po_id ให้ค้นหาด้วย Column J (เลขบัตรประชาชน / id_card)
    if (targetRowIndex === -1 && cleanIdCard) {
      const resJ = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${safeTitle}!J:J`,
      })
      const rowsJ: string[][] = resJ.data.values || []
      for (let i = 1; i < rowsJ.length; i++) {
        const rowIdCard = rowsJ[i][0]?.replace(/[^0-9]/g, '')
        if (rowIdCard && rowIdCard === cleanIdCard) {
          targetRowIndex = i + 1
          break
        }
      }
    }

    const rowData = employeeToRow(emp)

    if (targetRowIndex > 0) {
      // พบแถวเดิม -> เขียนทับเฉพาะแถวนั้น (A{row}:Y{row})
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${safeTitle}!A${targetRowIndex}:Y${targetRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      })
    } else {
      // ไม่พบแถวเดิม -> เพิ่มแถวใหม่ต่อท้าย
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${safeTitle}!A2:Y`,
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
        range: `${safeTitle}!A2:Y`,
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
