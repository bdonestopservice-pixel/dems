const fs = require('fs');
const path = require('path');
const { parseAll } = require('./parse-master-data');

function generateSql() {
  const { warehouses, allShifts, allDepartments } = parseAll();

  let sql = `-- ============================================================
-- DEMS Master Data Migration & Seed
-- คลัง, กะทำงาน, และแผนกตามข้อมูลจริงจาก Master Sheet
-- รันใน Supabase SQL Editor ได้หลายครั้งโดยไม่ซ้ำซ้อน (Idempotent)
-- ============================================================

-- 1. อัปเดต Constraint ของ shifts ให้รองรับ 'H' (Half Shift)
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_type_check;
ALTER TABLE shifts ADD CONSTRAINT shifts_type_check CHECK (type IN ('D', 'N', 'H'));

-- 2. เพิ่มคอลัมน์ type ให้ departments (ถ้ายังไม่มี)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS type TEXT;

-- 3. นำเข้าคลังสินค้า (Warehouses)
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

-- 5. เพิ่ม Unique Index เพื่อป้องกันข้อมูลกะและแผนกซ้ำซ้อน (ถ้ายังไม่มี)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_unique ON shifts (warehouse, start_time, end_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_unique ON departments (warehouse, name, shift_name);

-- 6. นำเข้ากะทำงาน (Shifts: ${allShifts.length} กะ)
INSERT INTO shifts (warehouse, start_time, end_time, type) VALUES
`;

  const shiftRows = allShifts.map((s) => 
    `  ('${s.warehouse}', '${s.start_time}', '${s.end_time}', '${s.type}')`
  );
  sql += shiftRows.join(',\n') + '\n';
  sql += `ON CONFLICT (warehouse, start_time, end_time) DO UPDATE SET type = EXCLUDED.type;\n\n`;

  sql += `-- 7. นำเข้าแผนก (Departments: ${allDepartments.length} แผนก)\n`;
  sql += `INSERT INTO departments (warehouse, type, name, shift_name) VALUES\n`;
  const deptRows = allDepartments.map((d) => {
    const escapedName = d.name.replace(/'/g, "''");
    const escapedShift = d.shift_name.replace(/'/g, "''");
    const escapedType = d.type.replace(/'/g, "''");
    return `  ('${d.warehouse}', '${escapedType}', '${escapedName}', '${escapedShift}')`;
  });
  sql += deptRows.join(',\n') + '\n';
  sql += `ON CONFLICT (warehouse, name, shift_name) DO UPDATE SET type = EXCLUDED.type;\n`;

  const outPath = path.join(__dirname, '..', 'supabase', 'seed_master_data.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');
  console.log(`✅ เขียนไฟล์ SQL เรียบร้อย: ${outPath} (${sql.length} bytes)`);
}

generateSql();

