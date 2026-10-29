const fs = require('fs');
const path = require('path');
const { parseAll } = require('./parse-master-data');

// อ่าน .env.local
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
};

async function main() {
  console.log('🧹 กำลังตรวจสอบข้อมูลเก่าที่ไม่ตรงกับ Master Data ชุดใหม่...\n');

  const { allShifts, allDepartments, warehouses } = parseAll();

  const masterShiftKeys = new Set(
    allShifts.map((s) => `${s.warehouse}:::${s.start_time}:::${s.end_time}`)
  );
  const masterDeptKeys = new Set(
    allDepartments.map((d) => `${d.warehouse}:::${d.name}:::${d.shift_name}`)
  );

  // 1. ดึงข้อมูลปัจจุบัน
  const shiftsRes = await fetch(`${SUPABASE_URL}/rest/v1/shifts?select=*`, { headers });
  const dbShifts = await shiftsRes.json();

  const deptsRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?select=*`, { headers });
  const dbDepts = await deptsRes.json();

  const plansRes = await fetch(`${SUPABASE_URL}/rest/v1/plans?select=id,shift_id,department_id,warehouse`, { headers });
  const dbPlans = await plansRes.json();

  const namelistRes = await fetch(`${SUPABASE_URL}/rest/v1/namelist?select=id,shift_id,department_id`, { headers });
  const dbNamelist = await namelistRes.json();

  // 2. ระบุกะและแผนกเก่าที่ต้องลบ
  const obsoleteShifts = dbShifts.filter(
    (s) => !masterShiftKeys.has(`${s.warehouse}:::${s.start_time}:::${s.end_time}`)
  );
  const obsoleteShiftIds = new Set(obsoleteShifts.map((s) => s.id));

  const obsoleteDepts = dbDepts.filter(
    (d) => !masterDeptKeys.has(`${d.warehouse}:::${d.name}:::${d.shift_name}`)
  );
  const obsoleteDeptIds = new Set(obsoleteDepts.map((d) => d.id));

  console.log(`พบกะเก่าที่ไม่ตรงกับ Master: ${obsoleteShifts.length} กะ`);
  for (const s of obsoleteShifts) {
    console.log(`  - [Shift] ${s.warehouse} ${s.start_time}-${s.end_time} (${s.type}) ID: ${s.id}`);
  }

  console.log(`\nพบแผนกเก่าที่ไม่ตรงกับ Master: ${obsoleteDepts.length} แผนก`);
  for (const d of obsoleteDepts) {
    console.log(`  - [Dept] ${d.warehouse} ${d.name} (${d.shift_name}) ID: ${d.id}`);
  }

  if (obsoleteShifts.length === 0 && obsoleteDepts.length === 0) {
    console.log('\n✨ ฐานข้อมูลสะอาดอยู่แล้ว ไม่มีข้อมูลเก่าค้าง');
    return;
  }

  // 3. จัดการข้อมูลอ้างอิงเก่า (Plans และ Namelist) ที่ผูกอยู่กับกะ/แผนกเก่า
  const plansToDelete = dbPlans.filter(
    (p) => obsoleteShiftIds.has(p.shift_id) || obsoleteDeptIds.has(p.department_id)
  );
  if (plansToDelete.length > 0) {
    console.log(`\n🗑️ กำลังลบข้อมูลแพลนทดสอบเก่าที่ผูกกับกะ/แผนกเดิม (${plansToDelete.length} แพลน)...`);
    for (const p of plansToDelete) {
      await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${p.id}`, { method: 'DELETE', headers });
    }
  }

  const namelistToDelete = dbNamelist.filter(
    (n) => obsoleteShiftIds.has(n.shift_id) || obsoleteDeptIds.has(n.department_id)
  );
  if (namelistToDelete.length > 0) {
    console.log(`🗑️ กำลังลบข้อมูล Namelist ทดสอบเก่าที่ผูกกับกะ/แผนกเดิม (${namelistToDelete.length} รายการ)...`);
    for (const n of namelistToDelete) {
      await fetch(`${SUPABASE_URL}/rest/v1/namelist?id=eq.${n.id}`, { method: 'DELETE', headers });
    }
  }

  // 4. ลบแผนกเก่า
  console.log('\n🗑️ กำลังลบแผนกเก่า...');
  let deptDeleted = 0;
  for (const d of obsoleteDepts) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/departments?id=eq.${d.id}`, { method: 'DELETE', headers });
    if (res.ok) deptDeleted++;
  }
  console.log(`✅ ลบแผนกเก่าสำเร็จ ${deptDeleted} รายการ`);

  // 5. ลบกะเก่า
  console.log('🗑️ กำลังลบกะทำงานเก่า...');
  let shiftDeleted = 0;
  for (const s of obsoleteShifts) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/shifts?id=eq.${s.id}`, { method: 'DELETE', headers });
    if (res.ok) shiftDeleted++;
  }
  console.log(`✅ ลบกะเก่าสำเร็จ ${shiftDeleted} รายการ`);

  console.log('\n🎉 ล้างข้อมูลเก่าที่ไม่ตรงกับ Master Data ชุดใหม่เรียบร้อยสมบูรณ์!');
}

main().catch((err) => {
  console.error('❌ เกิดข้อผิดพลาด:', err);
  process.exit(1);
});

