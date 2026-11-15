-- ============================================================
-- Migration: เพิ่มคอลัมน์ Blacklist สำหรับพนักงานในตาราง employees
-- ============================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS blacklisted_by TEXT;

-- Index เพื่อความรวดเร็วในการค้นหาหรือกรอง
CREATE INDEX IF NOT EXISTS idx_employees_is_blacklisted ON employees(is_blacklisted);

COMMENT ON COLUMN employees.is_blacklisted IS 'สถานะติดแบล็กลิสต์ (true/false)';
COMMENT ON COLUMN employees.blacklist_reason IS 'เหตุผลที่ติดแบล็กลิสต์';
COMMENT ON COLUMN employees.blacklisted_at IS 'วันเวลาที่บันทึกติดแบล็กลิสต์';
COMMENT ON COLUMN employees.blacklisted_by IS 'ชื่อ/อีเมลผู้ดำเนินการติดแบล็กลิสต์';
