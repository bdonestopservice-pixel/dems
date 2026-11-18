-- ============================================================
-- DEMS: Performance Optimization & Speed Booster
-- สำหรับรันใน Supabase Dashboard -> SQL Editor (โปรเจกต์ใหม่: qpclvvmxhfbfievzfgsy)
-- 
-- เพิ่มความเร็วการค้นหาและโหลดหน้าเว็บสำหรับพนักงาน 17,288+ คน:
-- 1. Trigram GIN Indexes (ค้นหาชื่อ นามสกุล บัตร ปชช. เบอร์โทร เร็วระดับ Millisecond)
-- 2. DESC NULLS LAST Composite Indexes (แก้ปัญหาการ Sort รหัสพนักงานล่าสุด PO DESC)
-- 3. Composite Indexes สำหรับ Namelist และ Planning
-- ============================================================

-- 1. เปิด Extension สำหรับ Full-text Trigram Search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. GIN Trigram Indexes สำหรับการค้นหาพนักงานด้วย ILIKE %...%
-- ช่วยลดเวลาการค้นหาจากสแกนทั้งตาราง 17,288 แถว เหลือไม่กี่ Millisecond
CREATE INDEX IF NOT EXISTS idx_employees_first_name_trgm ON employees USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_last_name_trgm  ON employees USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_id_card_trgm    ON employees USING gin (id_card gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_phone_trgm      ON employees USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_po_id_trgm      ON employees USING gin (po_id gin_trgm_ops);

-- 3. B-Tree Indexes สำหรับการ Sort รหัสล่าสุด PO ID แบบ DESC NULLS LAST
-- รองรับโค้ด .order('po_id', { ascending: false, nullsFirst: false }) โดยตรง
CREATE INDEX IF NOT EXISTS idx_employees_po_id_desc         ON employees (po_id DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_employees_wh_active_po_desc  ON employees (warehouse, is_active, po_id DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_employees_active_po_desc     ON employees (is_active, po_id DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_employees_wh_active          ON employees (warehouse, is_active);

-- 4. Indexes สำหรับความเร็วในหน้า Namelist
CREATE INDEX IF NOT EXISTS idx_namelist_date_dept ON namelist (date, department_id);
CREATE INDEX IF NOT EXISTS idx_namelist_dept_date ON namelist (department_id, date);
CREATE INDEX IF NOT EXISTS idx_namelist_emp_date  ON namelist (employee_id, date);

-- 5. Indexes สำหรับความเร็วในหน้า Planning (จัดแพลนพนักงาน)
CREATE INDEX IF NOT EXISTS idx_plans_wh_date            ON plans (warehouse, date);
CREATE INDEX IF NOT EXISTS idx_plans_dept_id            ON plans (department_id);
CREATE INDEX IF NOT EXISTS idx_plan_employees_plan_sent ON plan_employees (plan_id, sent_to_namelist);
CREATE INDEX IF NOT EXISTS idx_plan_employees_sent      ON plan_employees (sent_to_namelist, employee_id);

-- 6. รัน ANALYZE เพื่อให้ PostgreSQL อัปเดตสถิติและ Query Planner ใช้ Index ทันที
ANALYZE employees;
ANALYZE namelist;
ANALYZE plans;
ANALYZE plan_employees;
