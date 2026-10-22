-- ============================================================
-- DEMS Database Schema (Unified Schema)
-- ระบบ DEMS (Daily Employee Management System)
-- รวม Schema ทั้งหมด: Warehouses, Users, Banks, Departments,
-- Shifts, OA Options, Work Statuses, Employees, Plans, Namelist
-- พร้อม RLS Policies และ Permissions ครบถ้วน
-- ============================================================

-- 0. เปิดใช้งาน Extension สำหรับสร้าง UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. คลังสินค้า (Warehouses) — ข้อมูลกลาง (Super Admin เท่านั้น)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ข้อมูลคลังเริ่มต้น
INSERT INTO warehouses (id, name) VALUES
  ('SOCE',    'SOCE - คลังตะวันออก'),
  ('SOCW',    'SOCW - คลังตะวันตก'),
  ('SOCN',    'SOCN - คลังเหนือ'),
  ('FSOCW',   'FSOCW - คลัง F ตะวันตก'),
  ('SCOM-SS', 'SCOM-SS - คลัง SS'),
  ('SCOM-WN', 'SCOM-WN - คลัง WN')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. ผู้ใช้งานระบบ (System Users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT    NOT NULL,
  email      TEXT    UNIQUE NOT NULL,
  password   TEXT    NOT NULL,
  role       TEXT    NOT NULL CHECK (role IN ('super_admin', 'admin', 'payroll')),
  warehouses TEXT[]  DEFAULT '{}',
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed: Super Admin เริ่มต้น
-- email: admin@dems.co.th | password: admin1234
-- (Hash นี้สร้างจาก bcrypt.hash('admin1234', 10) แนะนำเปลี่ยนรหัสผ่านหลังเข้าใช้งาน)
INSERT INTO users (name, email, password, role, warehouses)
VALUES (
  'Super Admin',
  'admin@dems.co.th',
  '$2a$10$/4HyBfCPpkRf1r0hZTN53egg.A/CR.hNNGKTZ9sIE6ovPUgD8x9oW',
  'super_admin',
  ARRAY['SOCE', 'SOCW', 'SOCN', 'FSOCW', 'SCOM-SS', 'SCOM-WN']
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- 3. ธนาคาร (Banks) — ข้อมูลกลาง (Super Admin เท่านั้น)
-- พร้อมกำหนดสิทธิ์คลังที่สามารถเลือกใช้งานธนาคารนั้นๆ ได้
-- ============================================================
CREATE TABLE IF NOT EXISTS banks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT UNIQUE NOT NULL,
  warehouses TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- เพิ่มคอลัมน์ warehouses กรณีที่มีตารางเดิมอยู่แล้ว
ALTER TABLE banks ADD COLUMN IF NOT EXISTS warehouses TEXT[] DEFAULT '{}';

INSERT INTO banks (name, code, warehouses) VALUES
  ('กสิกรไทย',                              '004',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ไทยพาณิชย์',                            '014',   ARRAY['SOCE', 'SOCW', 'SOCN']),
  ('กรุงเทพ',                               '002',   ARRAY['SOCE', 'SOCW']),
  ('กรุงไทย',                               '006',   ARRAY['SOCE', 'SCOM-SS', 'SCOM-WN']),
  ('กรุงศรีอยุธยา',                         '025',   ARRAY['SOCE', 'FSOCW']),
  ('ทหารไทยธนชาต',                         '011',   ARRAY['SOCW', 'SOCN']),
  ('ออมสิน',                                '030',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ธนาคารทิสโก้',                          '067',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', '034',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ธนาคารเกียรตินาคินภัทร',                 '069',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ธนาคารซีไอเอ็มบีไทย',                   '022',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ยูโอบี',                                '024',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ธนาคารอิสลามแห่งประเทศไทย',           '066',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN']),
  ('ธนาคารไอซีบีซี (ไทย)',                  '070',   ARRAY['SOCE', 'SOCW', 'FSOCW', 'SOCN', 'SCOM-SS', 'SCOM-WN'])
ON CONFLICT (code) DO UPDATE SET warehouses = EXCLUDED.warehouses;


-- ============================================================
-- 4. แผนก (Departments) — Scope ตามคลัง
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse   TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  shift_name  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 5. กะการทำงาน (Shifts) — Scope ตามคลัง
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse  TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('D', 'N')),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 6. ค่าต่างพื้นที่ / OA (OA Options) — Scope ตามคลัง
-- ============================================================
CREATE TABLE IF NOT EXISTS oa_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse  TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 7. Status การทำงาน (Work Statuses) — ข้อมูลกลาง
-- ============================================================
CREATE TABLE IF NOT EXISTS work_statuses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  sort_order INT  DEFAULT 0
);

INSERT INTO work_statuses (name, sort_order) VALUES
  ('CXDP',         1),
  ('Hold',          2),
  ('หนีหาย',       3),
  ('ทำ 0.5 วัน',   4),
  ('ไม่ทำจ่าย',    5),
  ('CXDP เงินสด',  6),
  ('CXDP 0.5 วัน', 7),
  ('CXDP+OT',      8)
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 8. พนักงาน (Employees) — Master Database ร่วมทุกคลัง
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS employees_po_id_seq START WITH 112840;

CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            TEXT UNIQUE DEFAULT ('PO' || nextval('employees_po_id_seq')),
  ops_id           TEXT,                   -- รหัส OPS
  -- ข้อมูลส่วนตัว
  id_card          TEXT UNIQUE NOT NULL,   -- เลขบัตรประชาชน 13 หลัก
  prefix           TEXT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  gender           TEXT,
  first_name_en    TEXT,
  last_name_en     TEXT,
  dob              DATE,
  -- ที่อยู่ตามทะเบียนบ้าน
  address_no       TEXT,
  address_moo      TEXT,
  address_trok     TEXT,                   -- ตรอก
  address_soi      TEXT,                   -- ซอย
  address_road     TEXT,
  address_tambon   TEXT,
  address_amphoe   TEXT,
  address_province TEXT,
  address_zipcode  TEXT,
  address_full     TEXT,                   -- ที่อยู่รวมแบบเต็ม
  -- ข้อมูลการทำงาน
  warehouse        TEXT REFERENCES warehouses(id),
  start_date       DATE,
  phone            TEXT,
  -- ข้อมูลธนาคาร
  bank_id          UUID REFERENCES banks(id),
  bank_account     TEXT,
  promptpay_status TEXT,                   -- ยืนยันพร้อมเพย์แล้วหรือยัง
  -- อื่นๆ
  note             TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 9. ประวัติการจองช่วงเลขรหัสพนักงาน (PO ID Reservations)
-- ============================================================
CREATE TABLE IF NOT EXISTS po_id_reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_po_id  TEXT UNIQUE NOT NULL,
  end_po_id    TEXT NOT NULL,
  total_count  INT NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO po_id_reservations (start_po_id, end_po_id, total_count, note)
VALUES ('PO108840', 'PO112839', 4000, 'จอง 4,000 เลข สำหรับข้อมูลนำเข้าภายนอก/Google Sheet')
ON CONFLICT (start_po_id) DO NOTHING;


-- ============================================================
-- 10. แพลนการทำงาน (Plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  warehouse      TEXT REFERENCES warehouses(id),
  shift_id       UUID REFERENCES shifts(id),
  department_id  UUID REFERENCES departments(id),
  required_count INT  NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 11. พนักงานในแพลน (Plan Roster)
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID REFERENCES plans(id) ON DELETE CASCADE,
  employee_id      UUID REFERENCES employees(id),
  sent_to_namelist BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, employee_id)
);


-- ============================================================
-- 12. Namelist (รายชื่อทำงานประจำวัน)
-- ============================================================
CREATE TABLE IF NOT EXISTS namelist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  employee_id   UUID REFERENCES employees(id),
  department_id UUID REFERENCES departments(id),
  shift_id      UUID REFERENCES shifts(id),
  work_status   TEXT DEFAULT NULL,   -- CXDP, Hold, หนีหาย ฯลฯ
  oa_status     TEXT DEFAULT '-',    -- '-' หรือชื่อ OA
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, employee_id)
);


-- ============================================================
-- 13. ดัชนีเพิ่มความเร็วการค้นหา (Performance Indexes)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_warehouse   ON employees(warehouse);
CREATE INDEX IF NOT EXISTS idx_employees_is_active   ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_po_id       ON employees(po_id);
CREATE INDEX IF NOT EXISTS idx_plans_date_warehouse  ON plans(date, warehouse);
CREATE INDEX IF NOT EXISTS idx_plan_employees_plan   ON plan_employees(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_employees_emp    ON plan_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_namelist_date         ON namelist(date);
CREATE INDEX IF NOT EXISTS idx_namelist_employee     ON namelist(employee_id);
CREATE INDEX IF NOT EXISTS idx_departments_warehouse ON departments(warehouse);
CREATE INDEX IF NOT EXISTS idx_shifts_warehouse      ON shifts(warehouse);
CREATE INDEX IF NOT EXISTS idx_oa_options_warehouse  ON oa_options(warehouse);


-- ============================================================
-- Row Level Security (RLS)
-- ทุก Request ผ่าน Next.js API Routes ด้วย SUPABASE_SERVICE_ROLE_KEY
-- ป้องกันการเข้าถึงฐานข้อมูลโดยตรงจากภายนอก
-- ============================================================
ALTER TABLE warehouses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE oa_options         ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_statuses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_id_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_employees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE namelist           ENABLE ROW LEVEL SECURITY;

-- นโยบาย RLS: service_role มีสิทธิ์จัดการได้ครบทุกตาราง
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'warehouses') THEN
    CREATE POLICY "service_role_all" ON warehouses FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'users') THEN
    CREATE POLICY "service_role_all" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'banks') THEN
    CREATE POLICY "service_role_all" ON banks FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'departments') THEN
    CREATE POLICY "service_role_all" ON departments FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'shifts') THEN
    CREATE POLICY "service_role_all" ON shifts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'oa_options') THEN
    CREATE POLICY "service_role_all" ON oa_options FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'work_statuses') THEN
    CREATE POLICY "service_role_all" ON work_statuses FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'employees') THEN
    CREATE POLICY "service_role_all" ON employees FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'po_id_reservations') THEN
    CREATE POLICY "service_role_all" ON po_id_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'plans') THEN
    CREATE POLICY "service_role_all" ON plans FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'plan_employees') THEN
    CREATE POLICY "service_role_all" ON plan_employees FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all' AND tablename = 'namelist') THEN
    CREATE POLICY "service_role_all" ON namelist FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ============================================================
-- สิทธิ์การเข้าถึง (GRANT PERMISSIONS)
-- ป้องกันข้อผิดพลาด "permission denied for table ..." บน Supabase
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;


-- ============================================================
-- 8. เปิดใช้งาน Supabase Realtime (CDC)
-- ช่วยให้การ Grant สิทธิ์คลัง, การสร้าง/แก้ไขแพลน, Namelist, และข้อมูลพนักงานอัปเดตแบบ Realtime ทุกหน้าจอ
-- ============================================================
-- ตั้งค่า REPLICA IDENTITY FULL เพื่อให้ส่งข้อมูลครบทุกฟิลด์เมื่อเกิดการ UPDATE/DELETE
ALTER TABLE users          REPLICA IDENTITY FULL;
ALTER TABLE employees      REPLICA IDENTITY FULL;
ALTER TABLE plans          REPLICA IDENTITY FULL;
ALTER TABLE plan_employees REPLICA IDENTITY FULL;
ALTER TABLE namelist       REPLICA IDENTITY FULL;
ALTER TABLE warehouses     REPLICA IDENTITY FULL;
ALTER TABLE departments    REPLICA IDENTITY FULL;
ALTER TABLE shifts         REPLICA IDENTITY FULL;
ALTER TABLE banks          REPLICA IDENTITY FULL;
ALTER TABLE oa_options     REPLICA IDENTITY FULL;
ALTER TABLE work_statuses  REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE employees;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'plans') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE plans;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'plan_employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE plan_employees;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'namelist') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE namelist;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'warehouses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE warehouses;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'departments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE departments;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shifts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shifts;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'banks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE banks;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'oa_options') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE oa_options;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_statuses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_statuses;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- กรณีฐานข้อมูลยังไม่มี publication supabase_realtime ให้ข้ามไปโดยไม่ติด error
    NULL;
END $$;


-- ============================================================
-- 9. Storage Bucket สำหรับเก็บภาพและโลโก้ (Images & Logos)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('images_logo', 'images_logo', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Public Access images_logo' 
      AND tablename = 'objects' 
      AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Public Access images_logo" 
    ON storage.objects FOR SELECT TO public 
    USING (bucket_id = 'images_logo');
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;