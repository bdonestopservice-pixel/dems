-- ============================================================
-- Namelist: ห้ามซ้ำเฉพาะ "วันที่ + กะ + พนักงาน" เดียวกัน
-- (เดิมห้ามซ้ำแค่ วันที่ + พนักงาน → ทำให้ใส่คนเดิมต่างกะในวันเดียวกันไม่ได้)
-- รันใน Supabase SQL Editor ได้หลายครั้งโดยไม่เกิดข้อผิดพลาด
-- ============================================================
ALTER TABLE namelist DROP CONSTRAINT IF EXISTS namelist_date_employee_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS namelist_date_employee_shift_key
  ON namelist (date, employee_id, shift_id);

