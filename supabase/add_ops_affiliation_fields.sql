-- ============================================================
-- Migration: เพิ่มคอลัมน์ข้อมูลสังกัดสำหรับ Export OPS ID ในตาราง employees
-- ============================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_hub TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_contract_type TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_department TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_designation TEXT;

COMMENT ON COLUMN employees.ops_hub IS 'ฮับ/สถานี (Station) สำหรับ Export OPS ID';
COMMENT ON COLUMN employees.ops_contract_type IS 'ประเภทสัญญา (Contract Type) สำหรับ Export OPS ID';
COMMENT ON COLUMN employees.ops_department IS 'หน่วยงาน (Department) สำหรับ Export OPS ID';
COMMENT ON COLUMN employees.ops_designation IS 'แผนก/ตำแหน่ง (Designation) สำหรับ Export OPS ID';

