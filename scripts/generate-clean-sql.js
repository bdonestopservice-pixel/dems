const fs = require('fs');
const path = require('path');
const { parseAll } = require('./parse-master-data');

function generateCleanSql() {
  const { warehouses, allShifts, allDepartments } = parseAll();

  const shiftValues = allShifts.map(
    (s) => `    ('${s.warehouse}', '${s.start_time}', '${s.end_time}')`
  ).join(',\n');

  const deptValues = allDepartments.map((d) => {
    const escapedName = d.name.replace(/'/g, "''");
    const escapedShift = d.shift_name.replace(/'/g, "''");
    return `    ('${d.warehouse}', '${escapedName}', '${escapedShift}')`;
  }).join(',\n');

  const sql = `-- ============================================================
-- DEMS Clean Obsolete Data Script
-- สคริปต์สำหรับลบข้อมูลเก่าที่ไม่ตรงกับ Master Data ชุดใหม่
-- (เช่น แผนกทดสอบเดิม 'asds', 'testing' หรือกะเก่าที่ไม่ได้ใช้งาน)
-- ============================================================
-- ⚠️ คำเตือน: รันใน Supabase SQL Editor เมื่อต้องการล้างข้อมูลเก่าที่ไม่ตรงกับชีทใหม่
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ลบรายการใน Plans และ Namelist ที่ผูกอยู่กับ กะ/แผนก เก่าที่กำลังจะลบ
-- (เพื่อไม่ให้ติด Foreign Key Constraint)
-- ------------------------------------------------------------

-- 1.1 ลบ Namelist ที่ผูกกับแผนกเก่าที่ไม่ตรงกับ Master
DELETE FROM namelist
WHERE department_id IN (
  SELECT d.id FROM departments d
  LEFT JOIN (VALUES
${deptValues}
  ) AS v(warehouse, name, shift_name)
    ON d.warehouse = v.warehouse AND d.name = v.name AND d.shift_name = v.shift_name
  WHERE v.name IS NULL
);

-- 1.2 ลบ Namelist ที่ผูกกับกะเก่าที่ไม่ตรงกับ Master
DELETE FROM namelist
WHERE shift_id IN (
  SELECT s.id FROM shifts s
  LEFT JOIN (VALUES
${shiftValues}
  ) AS v(warehouse, start_time, end_time)
    ON s.warehouse = v.warehouse AND s.start_time = v.start_time AND s.end_time = v.end_time
  WHERE v.start_time IS NULL
);

-- 1.3 ลบ Plan Employees ของแพลนเก่าที่กำลังจะถูกลบ
DELETE FROM plan_employees
WHERE plan_id IN (
  SELECT p.id FROM plans p
  LEFT JOIN (VALUES
${deptValues}
  ) AS vd(warehouse, name, shift_name)
    ON p.warehouse = vd.warehouse AND p.department_id = (SELECT id FROM departments d WHERE d.warehouse = vd.warehouse AND d.name = vd.name AND d.shift_name = vd.shift_name LIMIT 1)
  LEFT JOIN (VALUES
${shiftValues}
  ) AS vs(warehouse, start_time, end_time)
    ON p.warehouse = vs.warehouse AND p.shift_id = (SELECT id FROM shifts s WHERE s.warehouse = vs.warehouse AND s.start_time = vs.start_time AND s.end_time = vs.end_time LIMIT 1)
  WHERE vd.name IS NULL OR vs.start_time IS NULL
);

-- 1.4 ลบ Plans ที่ผูกกับแผนกหรือกะเก่าที่ไม่ตรงกับ Master
DELETE FROM plans
WHERE department_id IN (
  SELECT d.id FROM departments d
  LEFT JOIN (VALUES
${deptValues}
  ) AS v(warehouse, name, shift_name)
    ON d.warehouse = v.warehouse AND d.name = v.name AND d.shift_name = v.shift_name
  WHERE v.name IS NULL
)
OR shift_id IN (
  SELECT s.id FROM shifts s
  LEFT JOIN (VALUES
${shiftValues}
  ) AS v(warehouse, start_time, end_time)
    ON s.warehouse = v.warehouse AND s.start_time = v.start_time AND s.end_time = v.end_time
  WHERE v.start_time IS NULL
);


-- ------------------------------------------------------------
-- 2. ลบ แผนก (Departments) เก่าที่ไม่ตรงกับ Master Data ชุดใหม่
-- ------------------------------------------------------------
DELETE FROM departments
WHERE id IN (
  SELECT d.id FROM departments d
  LEFT JOIN (VALUES
${deptValues}
  ) AS v(warehouse, name, shift_name)
    ON d.warehouse = v.warehouse AND d.name = v.name AND d.shift_name = v.shift_name
  WHERE v.name IS NULL
);


-- ------------------------------------------------------------
-- 3. ลบ กะทำงาน (Shifts) เก่าที่ไม่ตรงกับ Master Data ชุดใหม่
-- ------------------------------------------------------------
DELETE FROM shifts
WHERE id IN (
  SELECT s.id FROM shifts s
  LEFT JOIN (VALUES
${shiftValues}
  ) AS v(warehouse, start_time, end_time)
    ON s.warehouse = v.warehouse AND s.start_time = v.start_time AND s.end_time = v.end_time
  WHERE v.start_time IS NULL
);


-- ------------------------------------------------------------
-- 4. จัดการคลังเก่าที่ไม่ได้อยู่ใน Master Sheet (ถ้ามี)
-- หมายเหตุ: คลัง SCOM-WN และ SCOM-SS หากยังมีพนักงานผูกอยู่จะไม่ถูกลบ
-- ------------------------------------------------------------
DELETE FROM warehouses
WHERE id NOT IN ('SOCE', 'SOCN', 'SOCW', 'FSOCW', 'SCOM SC1', 'SCOM WN1', 'SCOM WN2')
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.warehouse = warehouses.id)
  AND NOT EXISTS (SELECT 1 FROM plans p WHERE p.warehouse = warehouses.id);

COMMIT;

-- สรุปผลหลังการลบ
SELECT 
  (SELECT count(*) FROM warehouses) AS total_warehouses,
  (SELECT count(*) FROM shifts) AS total_shifts,
  (SELECT count(*) FROM departments) AS total_departments;
`;

  const outPath = path.join(__dirname, '..', 'supabase', 'clean_obsolete_data.sql');
  fs.writeFileSync(outPath, sql, 'utf-8');
  console.log(`✅ เขียนไฟล์ SQL ลบข้อมูลเก่าเรียบร้อย: ${outPath} (${sql.length} bytes)`);
}

generateCleanSql();

module.exports = { generateCleanSql };

