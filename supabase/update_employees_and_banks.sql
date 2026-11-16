-- ============================================================
-- DEMS Migration: เพิ่มเติมธนาคาร, ฟิลด์พนักงาน และ Sequence รหัส PO
-- ใช้รันใน Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. เพิ่ม Constraint UNIQUE ให้ banks (ถ้ายังไม่มี) และเพิ่มธนาคารใหม่
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'banks_code_key'
  ) THEN
    ALTER TABLE banks ADD CONSTRAINT banks_code_key UNIQUE (code);
  END IF;
END $$;

INSERT INTO banks (name, code) VALUES
  ('ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', 'BAAC'),
  ('ธนาคารเกียรตินาคินภัทร',               'KKP'),
  ('ธนาคารซีไอเอ็มบีไทย',                 'CIMBT'),
  ('ธนาคารยูโอบี',                        'UOB'),
  ('ธนาคารอิสลามแห่งประเทศไทย',         'IBANK'),
  ('ธนาคารไอซีบีซี (ไทย)',                'ICBC')
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 2. เพิ่มคอลัมน์ใหม่ในตาราง employees ให้ตรงกับ Mockup และไฟล์ Excel
-- ============================================================
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS address_trok     TEXT,       -- ตรอก
  ADD COLUMN IF NOT EXISTS address_soi      TEXT,       -- ซอย
  ADD COLUMN IF NOT EXISTS promptpay_status TEXT,       -- ยืนยันพร้อมเพย์แล้วหรือยัง
  ADD COLUMN IF NOT EXISTS address_full     TEXT;       -- ที่อยู่รวมแบบเต็ม (สำหรับแสดงผล/พิมพ์)


-- ============================================================
-- 3. สร้าง Sequence สำหรับรันรหัสพนักงานอัตโนมัติ (เริ่มที่ 112025)
--    รหัสเดิมสูงสุดคือ PO110024
--    ช่วงที่จองไว้คือ PO110025 - PO112024 (2,000 เลข)
--    พนักงานใหม่ที่จะกดเพิ่มจากหน้าเว็บ DEMS จะเริ่มที่ PO112025 ทันที
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS employees_po_id_seq START WITH 112025;


-- ============================================================
-- 4. ตั้งค่า Default ให้คอลัมน์ po_id 
-- ============================================================
ALTER TABLE employees 
  ALTER COLUMN po_id SET DEFAULT ('PO' || nextval('employees_po_id_seq'));


-- ============================================================
-- 5. ตารางประวัติการจองช่วงเลข (พร้อม RLS ครบถ้วน)
-- ============================================================
CREATE TABLE IF NOT EXISTS po_id_reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_po_id  TEXT NOT NULL,
  end_po_id    TEXT NOT NULL,
  total_count  INT NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO po_id_reservations (start_po_id, end_po_id, total_count, note)
VALUES ('PO110025', 'PO112024', 2000, 'จอง 2,000 เลข (PO110025 - PO112024) สำหรับข้อมูลนำเข้าภายนอก/Google Sheet')
ON CONFLICT DO NOTHING;

-- ตั้งค่าความปลอดภัย RLS ให้เหมือนกับตารางอื่นๆ ใน DEMS
ALTER TABLE po_id_reservations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'service_role_all' AND tablename = 'po_id_reservations'
  ) THEN
    CREATE POLICY "service_role_all" ON po_id_reservations 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE po_id_reservations TO service_role;
