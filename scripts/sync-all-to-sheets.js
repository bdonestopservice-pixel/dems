const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
];

function formatSheetTimestamp(isoStr) {
  const date = isoStr ? new Date(isoStr) : new Date();
  if (isNaN(date.getTime())) return isoStr || '';
  const bkk = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const d = bkk.getUTCDate();
  const m = bkk.getUTCMonth() + 1;
  const y = bkk.getUTCFullYear();
  const hh = bkk.getUTCHours();
  const mm = String(bkk.getUTCMinutes()).padStart(2, '0');
  const ss = String(bkk.getUTCSeconds()).padStart(2, '0');
  return `'${d}/${m}/${y}, ${hh}:${mm}:${ss}`;
}

function formatStartDateAD(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4 || parseInt(parts[0], 10) > 1900) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      if (year > 2400) year -= 543;
      return `${day}/${month}/${year}`;
    }
  }
  return clean;
}

function formatDobBE(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4 || parseInt(parts[0], 10) > 1900) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      if (year < 2400) year += 543;
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `'${dd}/${mm}/${year}`;
    }
  }
  return `'${clean}`;
}

function formatBankDisplay(bankCode, bankName) {
  const code = (bankCode || '').trim();
  const name = (bankName || '').trim();
  if (code && name) {
    return name.startsWith(code) ? name : `${code} ${name}`;
  }
  return name || code;
}

function employeeToRow(emp) {
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
      .join(' ');

  const fullName = [emp.first_name?.trim(), emp.last_name?.trim()].filter(Boolean).join(' ');

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
  ];
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = sign.sign(key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsigned}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Google OAuth error: ' + JSON.stringify(data));
  return data.access_token;
}

async function main() {
  console.log('🔄 กำลังเชื่อมต่อ Google Sheets API...');
  const token = await getGoogleAccessToken();
  const gHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ตรวจจับชื่อแท็บ: ใช้ GOOGLE_SHEET_TAB_NAME หรือ Smart Match กับแท็บจริงในเอกสาร
  const targetName = (env.GOOGLE_SHEET_TAB_NAME || 'MasterDEMS').trim().toLowerCase();
  let sheetTitle = env.GOOGLE_SHEET_TAB_NAME || 'MasterDEMS';
  let targetSheetIdNum = null;
  let currentRowCount = 0;

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties)`,
    { headers: gHeaders }
  );
  const meta = await metaRes.json();
  const allSheets = meta.sheets || [];
  const matched = allSheets.find(s => s.properties?.title?.trim().toLowerCase() === targetName);
  if (matched) {
    sheetTitle = matched.properties.title;
    targetSheetIdNum = matched.properties.sheetId;
    currentRowCount = matched.properties.gridProperties?.rowCount || 0;
  } else {
    throw new Error(`ไม่พบแท็บ "${env.GOOGLE_SHEET_TAB_NAME || 'MasterDEMS'}" ใน Google Sheet`);
  }

  const safeSheet = `'${sheetTitle.replace(/'/g, "''")}'`;
  console.log(`📌 กำลังใช้งานแท็บ: "${sheetTitle}" (sheetId: ${targetSheetIdNum}, rows: ${currentRowCount})`);

  // ตรวจสอบว่าหัวตารางอยู่แถว 2 หรือแถว 1 (หากแถว 1 เป็นแถบหัวข้อ Importrange ให้คงแถว 1 ไว้ และเริ่มข้อมูลที่แถว 3)
  const checkRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${safeSheet}!A1:Y2`)}`,
    { headers: gHeaders }
  );
  const checkData = await checkRes.json();
  const topRows = checkData.values || [];
  const headerIsRow2 =
    topRows[1] && (topRows[1][0]?.trim() === 'Timestamp' || topRows[1][1]?.trim() === 'รหัสพนักงาน') ||
    (topRows[0] && topRows[0][0]?.trim() === 'Importrange');
  const headerRowNum = headerIsRow2 ? 2 : 1;
  const dataStartRow = headerRowNum + 1;
  console.log(`📋 ตำแหน่งหัวตาราง: แถวที่ ${headerRowNum}, เริ่มเขียนข้อมูลพนักงานที่แถวที่ ${dataStartRow}`);

  // 2. ดึงข้อมูลพนักงานทั้งหมดจาก Supabase
  console.log('🔄 กำลังดึงข้อมูลพนักงานทั้งหมดจาก Supabase Database...');

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
  (banks || []).forEach(b => { bankMap[b.id] = { name: b.name, code: b.code }; });

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

  const formattedEmployees = allEmployees.map(emp => ({
    ...emp,
    warehouse_name: whMap[emp.warehouse] || emp.warehouse,
    bank_name: bankMap[emp.bank_id]?.name || emp.bank_name,
    bank_code: bankMap[emp.bank_id]?.code || emp.bank_code,
  }));

  const dataRows = formattedEmployees.map(employeeToRow);
  const totalNeededRows = dataStartRow + dataRows.length + 500;

  // ขยายขนาด Grid ของ Sheet หากยังไม่พอ
  if (targetSheetIdNum !== null && currentRowCount < totalNeededRows) {
    console.log(`📐 กำลังขยายตารางเป็น ${totalNeededRows} แถว...`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: gHeaders,
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: targetSheetIdNum,
                gridProperties: { rowCount: totalNeededRows, columnCount: 25 },
              },
              fields: 'gridProperties(rowCount,columnCount)',
            },
          },
        ],
      }),
    });
  }

  // อัปเดตหัวตารางที่แถว headerRowNum (คงแถว 1 Importrange ไว้ตามเดิม)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${safeSheet}!A${headerRowNum}:Y${headerRowNum}`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: gHeaders,
      body: JSON.stringify({ values: [HEADERS] }),
    }
  );

  // ล้างข้อมูลเดิมตั้งแต่แถว dataStartRow เป็นต้นไป (รวมถึงล้าง ARRAYFORMULA เดิมใน X3 เพื่อไม่ให้ชนกัน)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${safeSheet}!A${dataStartRow}:Y`)}:clear`,
    { method: 'POST', headers: gHeaders }
  );
  console.log(`🧹 เคลียร์ข้อมูลเดิมตั้งแต่แถวที่ ${dataStartRow} ใน '${sheetTitle}' เรียบร้อย`);

  // เขียนข้อมูลทีละ chunk 1000 แถว
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
    const chunk = dataRows.slice(i, i + CHUNK_SIZE);
    const startRow = dataStartRow + i;
    const endRow = startRow + chunk.length - 1;
    const range = `${safeSheet}!A${startRow}:Y${endRow}`;

    console.log(`  - กำลังเขียนแถว ${startRow} ถึง ${endRow}...`);
    const updRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: gHeaders,
        body: JSON.stringify({ values: chunk }),
      }
    );
    if (!updRes.ok) {
      const errTxt = await updRes.text();
      throw new Error(`Google Sheets update failed at rows ${startRow}-${endRow}: ${errTxt}`);
    }
  }

  console.log(`🎉 ซิงค์ข้อมูลพนักงานทั้งหมด ${allEmployees.length} คนลงแท็บ '${sheetTitle}' (รูปแบบ 25 คอลัมน์ A-Y) เรียบร้อยแล้ว!`);
}

main().catch(err => {
  console.error('❌ เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
