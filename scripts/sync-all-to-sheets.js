const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// 1. อ่าน .env.local
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const env = envFile.split('\n').reduce((acc, line) => {
  const idx = line.indexOf('=');
  if (idx > -1) {
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    acc[k] = v;
  }
  return acc;
}, {});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let key = env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = env.GOOGLE_SHEET_ID;

if (!SUPABASE_URL || !SERVICE_KEY || !email || !key || !spreadsheetId) {
  console.error('❌ ข้อมูล Environment ใน .env.local ไม่ครบถ้วน');
  process.exit(1);
}

key = key.replace(/\\n/g, '\n');

const HEADERS = [
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
];

function employeeToRow(emp) {
  const isBlacklistedText = emp.is_blacklisted ? 'ติดแบล็กลิสต์' : 'ปกติ';
  const workStatusText = emp.is_active ? 'ทำงานอยู่' : 'ลาออก/พักงาน';

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
      .join(' ');

  return [
    emp.po_id || '',
    emp.prefix || '',
    emp.first_name || '',
    emp.last_name || '',
    emp.first_name_en || '',
    emp.last_name_en || '',
    emp.gender || '',
    emp.id_card ? `'${emp.id_card}` : '',
    emp.dob || '',
    emp.phone ? `'${emp.phone}` : '',
    emp.warehouse_name || emp.warehouse || '',
    emp.start_date || '',
    emp.ops_id || '',
    emp.ops_hub || '',
    emp.ops_contract_type || '',
    emp.ops_department || '',
    emp.ops_designation || '',
    workStatusText,
    isBlacklistedText,
    emp.blacklist_reason || '',
    emp.promptpay_status || 'ยังไม่ยืนยัน',
    emp.bank_name || '',
    emp.bank_account ? `'${emp.bank_account}` : '',
    address,
    emp.note || '',
    emp.updated_at || new Date().toISOString(),
  ];
}

async function main() {
  console.log('🔄 กำลังเชื่อมต่อ Google Sheets API...');
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  // ตรวจจับชื่อแท็บ: ใช้ GOOGLE_SHEET_TAB_NAME หรือดึงแท็บแรกของ Sheet
  let sheetTitle = env.GOOGLE_SHEET_TAB_NAME;
  if (!sheetTitle) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      sheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Test api master';
    } catch {
      sheetTitle = 'Test api master';
    }
  }

  // 2. ดึงข้อมูลพนักงานทั้งหมดจาก Supabase
  console.log('🔄 กำลังดึงข้อมูลพนักงานทั้งหมดจาก Supabase Database...');
  
  // ดึง warehouses และ banks มา map
  const whRes = await fetch(`${SUPABASE_URL}/rest/v1/warehouses?select=id,name`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const warehouses = await whRes.json();
  const whMap = {};
  (warehouses || []).forEach(w => { whMap[w.id] = w.name; });

  const bankRes = await fetch(`${SUPABASE_URL}/rest/v1/banks?select=id,name,code`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const banks = await bankRes.json();
  const bankMap = {};
  (banks || []).forEach(b => { bankMap[b.id] = b.name; });

  // ดึงข้อมูล employees ทั้งหมด (paging ทีละ 1000)
  let allEmployees = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const empRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employees?select=*&order=po_id.asc`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Range: `${from}-${to}`,
        },
      }
    );
    const emps = await empRes.json();
    if (!Array.isArray(emps) || emps.length === 0) {
      hasMore = false;
    } else {
      allEmployees = allEmployees.concat(emps);
      console.log(`  - โหลดพนักงานแล้ว ${allEmployees.length} คน...`);
      if (emps.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  console.log(`✅ โหลดข้อมูลพนักงานจากฐานข้อมูลสำเร็จทั้งหมด ${allEmployees.length} คน`);

  // แปลงข้อมูลเป็นแถว
  const formattedEmployees = allEmployees.map(emp => ({
    ...emp,
    warehouse_name: whMap[emp.warehouse] || emp.warehouse,
    bank_name: bankMap[emp.bank_id] || emp.bank_name,
  }));

  const allRows = [HEADERS, ...formattedEmployees.map(employeeToRow)];
  console.log(`📊 กำลังเตรียมเขียนข้อมูลลงในแท็บ '${sheetTitle}' ทั้งหมด ${allRows.length} แถว (รวม Header)...`);

  // ล้างข้อมูลเดิมในแท็บ 'Test api master' และเขียนข้อมูลใหม่ทั้งหมด
  const safeRange = `'${sheetTitle}'!A1:Z${allRows.length}`;

  // ล้างเนื้อหาเดิมใน A1:Z ก่อน เพื่อลบ Importrange หรือสูตรเดิมที่ค้าง
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:Z10000`,
  });
  console.log(`🧹 เคลียร์แถวเดิมใน '${sheetTitle}' เรียบร้อย`);

  // เขียนข้อมูลทีละ chunk 1000 แถว
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    const startRow = i + 1;
    const endRow = i + chunk.length;
    const range = `'${sheetTitle}'!A${startRow}:Z${endRow}`;

    console.log(`  - กำลังเขียนแถว ${startRow} ถึง ${endRow}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: chunk,
      },
    });
  }

  console.log(`🎉 ซิงค์ข้อมูลพนักงานทั้งหมด ${allEmployees.length} คนลง Google Sheet เรียบร้อยแล้ว!`);
}

main().catch(err => {
  console.error('❌ เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
