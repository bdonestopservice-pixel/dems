-- ============================================================
-- DEMS Migration: Add High-Performance Composite Indexes
-- เร่งความเร็วการค้นหาและลด Latency สำหรับตาราง Employees (16,000+ รายการ), Namelist, และ Plans
-- 
-- วิธีรัน: คัดลอกคำสั่งทั้งหมดไปวางและกด RUN ใน Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Composite Indexes สำหรับตาราง employees (ช่วยหน้าพนักงาน และหน้าค้นหาคนเข้าแพลน)
-- รองรับการกรอง warehouse + is_active = true + order by po_id
CREATE INDEX IF NOT EXISTS idx_employees_wh_active_po ON employees (warehouse, is_active, po_id);

-- รองรับการกรองทุกคลัง (all warehouses) + is_active = true + order by po_id
CREATE INDEX IF NOT EXISTS idx_employees_active_po ON employees (is_active, po_id);

-- เชื่อมโยงรหัสธนาคาร
CREATE INDEX IF NOT EXISTS idx_employees_bank_id ON employees (bank_id);


-- 2. Composite Indexes สำหรับตาราง namelist (ช่วยหน้าบันทึกเวลา และการดึงประวัติ Recently Used)
-- รองรับการกรองตามแผนกและวันที่
CREATE INDEX IF NOT EXISTS idx_namelist_dept_date ON namelist (department_id, date);

-- รองรับการกรองตามวันที่และแผนก
CREATE INDEX IF NOT EXISTS idx_namelist_date_dept ON namelist (date, department_id);

-- รองรับการค้นหาประวัติพนักงานรายวัน
CREATE INDEX IF NOT EXISTS idx_namelist_emp_date ON namelist (employee_id, date);


-- 3. Composite Indexes สำหรับตาราง plans (ช่วยหน้าภาพรวมแพลน)
-- รองรับการกรองตามคลังและวันที่
CREATE INDEX IF NOT EXISTS idx_plans_wh_date ON plans (warehouse, date);

-- รองรับการ Join และเชื่อมโยงแผนก
CREATE INDEX IF NOT EXISTS idx_plans_dept_id ON plans (department_id);


-- 4. Composite Indexes สำหรับตาราง plan_employees (ช่วยหน้าตรวจสอบพนักงานในแพลน)
CREATE INDEX IF NOT EXISTS idx_plan_employees_plan_sent ON plan_employees (plan_id, sent_to_namelist);
CREATE INDEX IF NOT EXISTS idx_plan_employees_sent ON plan_employees (sent_to_namelist, employee_id);

