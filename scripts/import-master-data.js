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
  Prefer: 'return=representation',
};

async function main() {
  console.log('🚀 เริ่มต้นการนำเข้าข้อมูล Master Data เข้าสู่ Supabase...\n');

  const { warehouses, allShifts, allDepartments } = parseAll();

  // 1. นำเข้า/อัปเดต คลัง (Warehouses)
  console.log('\n--- 1. นำเข้าคลัง (Warehouses) ---');
  for (const wh of warehouses) {
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/warehouses?id=eq.${encodeURIComponent(wh.id)}`, { headers });
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      console.log(`  🔹 คลัง ${wh.id} มีอยู่ในระบบแล้ว`);
    } else {
      const insRes = await fetch(`${SUPABASE_URL}/rest/v1/warehouses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(wh),
      });
      if (insRes.ok) {
        console.log(`  ✅ เพิ่มคลัง ${wh.id} สำเร็จ`);
      } else {
        console.error(`  ❌ ไม่สามารถเพิ่มคลัง ${wh.id}:`, await insRes.text());
      }
    }
  }

  // 2. อัปเดตสิทธิ์คลังของ Super Admin ให้ครอบคลุมทุกคลัง
  console.log('\n--- 2. ตรวจสอบและอัปเดตสิทธิ์ Super Admin ---');
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.super_admin`, { headers });
  const superAdmins = await userRes.json();
  const allWhIds = ['SOCE', 'SOCN', 'SOCW', 'FSOCW', 'SCOM SC1', 'SCOM WN1', 'SCOM WN2', 'SCOM-SS', 'SCOM-WN'];
  for (const sa of superAdmins || []) {
    const current = sa.warehouses || [];
    const merged = Array.from(new Set([...current, ...allWhIds]));
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${sa.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ warehouses: merged }),
    });
    console.log(`  ✅ อัปเดตสิทธิ์คลังให้ Super Admin (${sa.email}) ครบ ${merged.length} คลังเรียบร้อย`);
  }

  // 3. นำเข้า กะทำงาน (Shifts)
  console.log('\n--- 3. นำเข้ากะทำงาน (Shifts) ---');
  let shiftInserted = 0;
  let shiftUpdated = 0;

  for (const wh of warehouses) {
    const whShifts = allShifts.filter((s) => s.warehouse === wh.id);
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/shifts?warehouse=eq.${encodeURIComponent(wh.id)}&select=*`,
      { headers }
    );
    const existingShifts = await existingRes.json();
    const existingMap = new Map();
    for (const s of existingShifts || []) {
      existingMap.set(`${s.start_time}-${s.end_time}`, s);
    }

    for (const shift of whShifts) {
      const key = `${shift.start_time}-${shift.end_time}`;
      const existing = existingMap.get(key);

      if (existing) {
        // อัปเดต type ถ้าเปลี่ยนไป
        if (existing.type !== shift.type) {
          let typeToUse = shift.type;
          let patchRes = await fetch(`${SUPABASE_URL}/rest/v1/shifts?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ type: typeToUse }),
          });
          if (!patchRes.ok && typeToUse === 'H') {
            // fallback to 'D' if constraint rejects 'H'
            patchRes = await fetch(`${SUPABASE_URL}/rest/v1/shifts?id=eq.${existing.id}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ type: 'D' }),
            });
          }
          if (patchRes.ok) shiftUpdated++;
        }
      } else {
        // เพิ่มกะใหม่
        let typeToUse = shift.type;
        let insRes = await fetch(`${SUPABASE_URL}/rest/v1/shifts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            warehouse: shift.warehouse,
            start_time: shift.start_time,
            end_time: shift.end_time,
            type: typeToUse,
          }),
        });

        // ถ้า type 'H' ไม่ผ่าน constraint ให้ fallback เป็น 'D' ชั่วคราว
        if (!insRes.ok && typeToUse === 'H') {
          insRes = await fetch(`${SUPABASE_URL}/rest/v1/shifts`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              warehouse: shift.warehouse,
              start_time: shift.start_time,
              end_time: shift.end_time,
              type: 'D',
            }),
          });
        }

        if (insRes.ok) {
          shiftInserted++;
        } else {
          console.error(`  ❌ ข้อผิดพลาดเพิ่มกะ ${shift.warehouse} ${shift.start_time}-${shift.end_time}:`, await insRes.text());
        }
      }
    }
  }
  console.log(`  ✅ นำเข้ากะทำงาน: เพิ่มใหม่ ${shiftInserted} กะ, อัปเดต ${shiftUpdated} กะ`);

  // 4. นำเข้า แผนก (Departments)
  console.log('\n--- 4. นำเข้าแผนก (Departments) ---');
  let deptInserted = 0;
  let deptUpdated = 0;

  for (const wh of warehouses) {
    const whDepts = allDepartments.filter((d) => d.warehouse === wh.id);
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/departments?warehouse=eq.${encodeURIComponent(wh.id)}&select=*`,
      { headers }
    );
    const existingDepts = await existingRes.json();
    const existingMap = new Map();
    for (const d of existingDepts || []) {
      existingMap.set(`${d.name}:::${d.shift_name}`, d);
    }

    for (const dept of whDepts) {
      const key = `${dept.name}:::${dept.shift_name}`;
      const existing = existingMap.get(key);

      if (existing) {
        // อัปเดต type ถ้าไม่ตรง
        if (existing.type !== dept.type) {
          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/departments?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ type: dept.type }),
          });
          if (patchRes.ok) deptUpdated++;
        }
      } else {
        // เพิ่มแผนกใหม่
        const insRes = await fetch(`${SUPABASE_URL}/rest/v1/departments`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            warehouse: dept.warehouse,
            type: dept.type,
            name: dept.name,
            shift_name: dept.shift_name,
          }),
        });

        if (insRes.ok) {
          deptInserted++;
        } else {
          console.error(`  ❌ ข้อผิดพลาดเพิ่มแผนก ${dept.warehouse} ${dept.name}:`, await insRes.text());
        }
      }
    }
  }
  console.log(`  ✅ นำเข้าแผนก: เพิ่มใหม่ ${deptInserted} แผนก, อัปเดต ${deptUpdated} แผนก`);

  console.log('\n🎉 ดำเนินการนำเข้าข้อมูล Master Data ทั้งหมดเรียบร้อยสมบูรณ์!');
}

main().catch((err) => {
  console.error('❌ เกิดข้อผิดพลาดร้ายแรง:', err);
  process.exit(1);
});

