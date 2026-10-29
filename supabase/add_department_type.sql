-- ============================================================
-- เพิ่มคอลัมน์ type (ข้อความกรอกเอง) ให้ตาราง departments
-- รันใน Supabase SQL Editor ได้หลายครั้งโดยไม่เกิดข้อผิดพลาด
-- ============================================================
ALTER TABLE departments ADD COLUMN IF NOT EXISTS type TEXT;

-- ค่าเดิมที่เคยแสดงในคอลัมน์ TYPE คือรหัสคลัง -> คัดลอกมาเป็นค่าเริ่มต้นของแถวเก่า
UPDATE departments SET type = warehouse WHERE type IS NULL;

