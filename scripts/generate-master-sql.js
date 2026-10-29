const fs = require('fs');
const path = require('path');
const { parseAll } = require('./parse-master-data');

function generateSql() {
  const { warehouses, allShifts, allDepartments } = parseAll();

  let sql = `-- ============================================================
-- DEMS Master Data Migration & Seed
-- คลัง, กะทำงาน, และแผนกตามข้อมูลจริงจาก Master Sheet
-- รันใน Supabase SQL Editor ได้อย่างปลอดภัย 100% ไม่ลบข้อมูลเดิม
-- ============================================================

-- 1. อัปเดต Constraint ของ shifts ให้รองรับ 'H' (Half Shift)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_type_check;
ALTER TABLE shifts ADD CONSTRAINT shifts_type_check CHECK (type IN ('D', 'N', 'H'));

-- 2. เพิ่มคอลัมน์ type ให้ departments (ถ้ายังไม่มี)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS type TEXT;

-- 3. นำเข้า/อัปเดต คลังสินค้า (Warehouses)
INSERT INTO warehouses (id, name) VALUES
  ('SOCE', 'SOCE'),
  ('SOCN', 'SOCN'),
  ('SOCW', 'SOCW'),
  ('FSOCW', 'FSOCW'),
  ('SCOM SC1', 'SCOM SC1'),
  ('SCOM WN1', 'SCOM WN1'),
  ('SCOM WN2', 'SCOM WN2'),
  ('SCOM-SS', 'SCOM-SS'),
  ('SCOM-WN', 'SCOM-WN')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 4. อัปเดตสิทธิ์ Super Admin ให้เข้าถึงทุกคลัง
UPDATE users
SET warehouses = ARRAY['SOCE', 'SOCN', 'SOCW', 'FSOCW', 'SCOM SC1', 'SCOM WN1', 'SCOM WN2', 'SCOM-SS', 'SCOM-WN']
WHERE role = 'super_admin';

-- 5. นำเข้ากะทำงาน (Shifts: ${allShifts.length} กะ)
-- เพิ่มเฉพาะกะที่ยังไม่มีในระบบ (ไม่ลบและไม่ทับข้อมูลเก่า)
INSERT INTO shifts (warehouse, start_time, end_time, type)
SELECT v.warehouse, v.start_time, v.end_time, v.type
FROM (VALUES
`;

  const shiftValues = allShifts.map(
    (s) => `  ('${s.warehouse}', '${s.start_time}', '${s.end_time}', '${s.type}')`
  );
  sql += shiftValues.join(',\n') + '\n';
  sql += `) AS v(warehouse, start_time, end_time, type)
WHERE NOT EXISTS (
  SELECT 1 FROM shifts s 
  WHERE s.warehouse = v.warehouse 
    AND s.start_time = v.start_time 
    AND s.end_time = v.end_time
);

-- อัปเดตประเภทกะ (D/N/H) ให้ตรงตามข้อมูลจริง
UPDATE shifts s
SET type = v.type
FROM (VALUES
`;
  sql += shiftValues.join(',\n') + '\n';
  sql += `) AS v(warehouse, start_time, end_time, type)
WHERE s.warehouse = v.warehouse 
  AND s.start_time = v.start_time 
  AND s.end_time = v.end_time
  AND s.type != v.type;

-- 6. นำเข้าแผนก (Departments: ${allDepartments.length} แผนก)
-- เพิ่มเฉพาะแผนกที่ยังไม่มีในระบบ (ไม่ลบและไม่ทับข้อมูลเก่า)
INSERT INTO departments (warehouse, type, name, shift_name)
SELECT v.warehouse, v.type, v.name, v.shift_name
FROM (VALUES
`;

  const deptValues = allDepartments.map((d) => {
    const escapedName = d.name.replace(/'/g, "''");
    const escapedShift = d.shift_name.replace(/'/g, "''");
    const escapedType = d.type.replace(/'/g, "''");
    return `  ('${d.warehouse}', '${escapedType}', '${escapedName}', '${escapedShift}')`;
  });
  sql += deptValues.join(',\n') + '\n';
  sql += `) AS v(warehouse, type, name, shift_name)
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.warehouse = v.warehouse
    AND d.name = v.name
    AND d.shift_name = v.shift_name
);

-- อัปเดตคอลัมน์ type ของแผนกเดิมให้ตรงตามข้อมูลจริง
UPDATE departments d
SET type = v.type
FROM (VALUES
`;
  sql += deptValues.join(',\n') + '\n';
  sql += `) AS v(warehouse, type, name, shift_name)
WHERE d.warehouse = v.warehouse
  AND d.name = v.name
  AND d.shift_name = v.shift_name
  AND (d.type IS NULL OR d.type != v.type);
`;

  const outPath = path.join(__dirname, '..', 'supabase', 'seed_master_data.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');
  console.log(`✅ เขียนไฟล์ SQL เรียบร้อย: ${outPath} (${sql.length} bytes)`);

  return { sql, shiftValues, deptValues };
}

generateSql();

module.exports = { generateSql };
