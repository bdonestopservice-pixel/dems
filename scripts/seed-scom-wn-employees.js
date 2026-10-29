const fs = require('fs');
const path = require('path');

// 1. อ่าน .env.local
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const env = envFile.split('\n').reduce((acc, line) => {
  const idx = line.indexOf('=');
  if (idx > -1) {
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    acc[k] = v;
  }
  return acc;
}, {});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// สุ่มเลขบัตรประชาชน 13 หลักที่ถูกต้องตามสูตร Mod 11
function generateValidThaiId(existingSet) {
  while (true) {
    const digits = [1]; // เริ่มต้นด้วย 1
    for (let i = 1; i < 12; i++) {
      digits.push(Math.floor(Math.random() * 10));
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    digits.push(checkDigit);
    const id = digits.join('');
    if (!existingSet.has(id)) {
      existingSet.add(id);
      return id;
    }
  }
}

// สุ่มเบอร์โทรศัพท์ 10 หลัก (08X, 09X, 06X)
function generatePhone() {
  const prefix = ['08', '09', '06'][Math.floor(Math.random() * 3)];
  let num = prefix;
  for (let i = 0; i < 8; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}

// สุ่มวันที่ในรูปแบบ YYYY-MM-DD
function randomDate(startYear, endYear) {
  const year = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const WANG_NOI_TAMBONS = [
  'วังน้อย',
  'ลำไทร',
  'พยอม',
  'สนับทึบ',
  'บ่อตาโล่',
  'ลำตาเสา',
  'ชะแมบ',
  'ข้าวงาม',
  'วังจุฬา',
  'หันตะเภา',
];

const ROADS = ['พหลโยธิน', 'โรจนะ', 'วงแหวนตะวันออก', 'เลียบคลองระพีพัฒน์'];

async function main() {
  const count = 80;
  console.log(`🚀 กำลังเตรียมสร้างข้อมูลพนักงานจำลอง ${count} คนสำหรับคลัง SCOM-WN...`);

  // ตรวจสอบคลัง SCOM-WN
  const whRes = await fetch(`${SUPABASE_URL}/rest/v1/warehouses?id=eq.SCOM-WN&select=*`, { headers });
  const whData = await whRes.json();
  if (!whData || whData.length === 0) {
    console.error('❌ ไม่พบคลังรหัส SCOM-WN ในฐานข้อมูล');
    process.exit(1);
  }
  console.log('✅ ตรวจพบคลัง:', whData[0]);

  // ดึงธนาคารทั้งหมด
  const bankRes = await fetch(`${SUPABASE_URL}/rest/v1/banks?select=id,name,code`, { headers });
  const banks = await bankRes.json();
  if (!banks || banks.length === 0) {
    console.warn('⚠️ ไม่พบข้อมูลธนาคาร จะใช้ค่าว่าง');
  }

  // ดึง PO-ID สูงสุดที่มีอยู่เดิม
  const poRes = await fetch(
    `${SUPABASE_URL}/rest/v1/employees?select=po_id&po_id=like.PO*&order=po_id.desc&limit=1`,
    { headers }
  );
  const poData = await poRes.json();
  let maxNum = 112843; // default fallback
  if (poData && poData.length > 0 && poData[0].po_id) {
    const parsed = parseInt(poData[0].po_id.replace(/^PO/i, ''), 10);
    if (!isNaN(parsed)) maxNum = Math.max(maxNum, parsed);
  }
  console.log(`📌 PO-ID ล่าสุดในระบบคือ PO${maxNum} -> จะเริ่มสร้างตั้งแต่ PO${maxNum + 1}`);

  // ดึงเลขบัตรประชาชนที่มีอยู่แล้วมากันซ้ำ
  const idRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=id_card`, { headers });
  const idData = await idRes.json();
  const existingIds = new Set(idData.map((e) => e.id_card).filter(Boolean));

  // สร้างพนักงาน 80 คน
  const employees = [];
  for (let i = 1; i <= count; i++) {
    const pad = String(i).padStart(2, '0');
    const isMale = i % 2 !== 0; // คี่เป็นชาย, คู่เป็นหญิง
    const prefix = isMale ? 'นาย' : 'น.ส.';
    const gender = isMale ? 'ชาย' : 'หญิง';
    const firstName = isMale ? `สมชาย ${pad}` : `สมหญิง ${pad}`;
    const lastName = 'วังน้อย';
    const firstNameEn = isMale ? `Somchai ${pad}` : `Somying ${pad}`;
    const lastNameEn = 'Wangnoi';

    const poId = `PO${maxNum + i}`;
    const opsId = `WN-${pad}`;
    const idCard = generateValidThaiId(existingIds);
    const phone = generatePhone();
    const dob = randomDate(1985, 2004);
    const startDate = randomDate(2025, 2026);

    const bank = banks.length > 0 ? banks[Math.floor(Math.random() * banks.length)] : null;
    const bankAccount = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const promptpayStatus = Math.random() > 0.15 ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน';

    const tambon = WANG_NOI_TAMBONS[Math.floor(Math.random() * WANG_NOI_TAMBONS.length)];
    const road = ROADS[Math.floor(Math.random() * ROADS.length)];
    const addressNo = `${Math.floor(Math.random() * 199) + 1}/${Math.floor(Math.random() * 20) + 1}`;
    const addressMoo = String(Math.floor(Math.random() * 9) + 1);
    const addressSoi = `ซอย ${Math.floor(Math.random() * 15) + 1}`;
    const addressAmphoe = 'วังน้อย';
    const addressProvince = 'พระนครศรีอยุธยา';
    const addressZipcode = '13170';
    const addressFull = `${addressNo} ม.${addressMoo} ${addressSoi} ถ.${road} ต.${tambon} อ.${addressAmphoe} จ.${addressProvince} ${addressZipcode}`;

    employees.push({
      po_id: poId,
      ops_id: opsId,
      id_card: idCard,
      prefix,
      first_name: firstName,
      last_name: lastName,
      gender,
      first_name_en: firstNameEn,
      last_name_en: lastNameEn,
      dob,
      start_date: startDate,
      warehouse: 'SCOM-WN',
      phone,
      bank_id: bank ? bank.id : null,
      bank_account: bankAccount,
      promptpay_status: promptpayStatus,
      address_no: addressNo,
      address_moo: addressMoo,
      address_soi: addressSoi,
      address_road: road,
      address_tambon: tambon,
      address_amphoe: addressAmphoe,
      address_province: addressProvince,
      address_zipcode: addressZipcode,
      address_full: addressFull,
      note: `พนักงานทดสอบ SCOM-WN ลำดับที่ ${pad}`,
      is_active: true,
    });
  }

  console.log(`📦 ตัวอย่างพนักงานที่จะเพิ่ม:`);
  console.log(`   - คนที่ 1: ${employees[0].po_id} ${employees[0].prefix} ${employees[0].first_name} ${employees[0].last_name} (${employees[0].id_card})`);
  console.log(`   - คนที่ 40: ${employees[39].po_id} ${employees[39].prefix} ${employees[39].first_name} ${employees[39].last_name} (${employees[39].id_card})`);
  console.log(`   - คนที่ 80: ${employees[79].po_id} ${employees[79].prefix} ${employees[79].first_name} ${employees[79].last_name} (${employees[79].id_card})`);

  // ทำการ Insert เข้าตาราง employees (แบ่งเป็น batch ละ 40 คน)
  console.log('⏳ กำลังบันทึกข้อมูลเข้าฐานข้อมูล Supabase...');
  const batchSize = 40;
  for (let b = 0; b < employees.length; b += batchSize) {
    const batch = employees.slice(b, b + batchSize);
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/employees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error(`❌ บันทึก batch ${b / batchSize + 1} ล้มเหลว:`, errText);
      process.exit(1);
    }
    console.log(`✅ บันทึกแล้วชุดที่ ${b / batchSize + 1} (${batch.length} คน)`);
  }

  console.log(`\n🎉 สำเร็จเรียบร้อย! เพิ่มพนักงานคลัง SCOM-WN ทั้งหมด ${employees.length} คนเรียบร้อยแล้ว`);
  console.log(`   ช่วงรหัส: ${employees[0].po_id} ถึง ${employees[employees.length - 1].po_id}`);
}

main().catch((err) => {
  console.error('❌ เกิดข้อผิดพลาด:', err);
  process.exit(1);
});
