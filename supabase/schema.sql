-- ============================================================
-- DEMS Database Schema — อัปเดตให้ตรงกับ Schemanotsetemp.sql
-- Version ที่ใช้งานจริงบน Supabase
-- ============================================================
-- อ้างอิงจาก: supabase/Schemanotsetemp.sql (v1.2)
-- ============================================================


-- 1. คลัง (Warehouses)
CREATE TABLE IF NOT EXISTS warehouses (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO warehouses (id, name) VALUES
  ('SOCE',    'SOCE - คลังตะวันออก'),
  ('SOCW',    'SOCW - คลังตะวันตก'),
  ('SOCN',    'SOCN - คลังเหนือ'),
  ('FSOCW',   'FSOCW - คลัง F ตะวันตก'),
  ('SCOM-SS', 'SCOM-SS - คลัง SS'),
  ('SCOM-WN', 'SCOM-WN - คลัง WN')
ON CONFLICT (id) DO NOTHING;


-- 2. System Users
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

-- Seed: admin@dems.co.th / admin1234
INSERT INTO users (name, email, password, role, warehouses)
VALUES (
  'Super Admin',
  'admin@dems.co.th',
  '$2a$10$/4HyBfCPpkRf1r0hZTN53egg.A/CR.hNNGKTZ9sIE6ovPUgD8x9oW',
  'super_admin',
  ARRAY['SOCE', 'SOCW', 'SOCN', 'FSOCW', 'SCOM-SS', 'SCOM-WN']
)
ON CONFLICT (email) DO NOTHING;


-- 3. Banks
CREATE TABLE IF NOT EXISTS banks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO banks (name, code) VALUES
  ('ธนาคารกรุงเทพ',       'BBL'),
  ('ธนาคารกสิกรไทย',      'KBANK'),
  ('ธนาคารไทยพาณิชย์',    'SCB'),
  ('ธนาคารกรุงไทย',       'KTB'),
  ('ธนาคารกรุงศรีอยุธยา', 'BAY'),
  ('ธนาคารออมสิน',        'GSB'),
  ('ธนาคาร ทีทีบี',       'TTB'),
  ('ธนาคารทิสโก้',        'TISCO')
ON CONFLICT DO NOTHING;


-- 4. Departments (scope per warehouse)
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse   TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  shift_name  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- 5. Shifts (scope per warehouse)
CREATE TABLE IF NOT EXISTS shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse  TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('D', 'N')),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- 6. Work Statuses
CREATE TABLE IF NOT EXISTS work_statuses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
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
ON CONFLICT DO NOTHING;


-- 7. Employees (Master — shared across all warehouses)
-- ⚠️  po_id = TEXT — format ยังรอยืนยันกับทีม
--     (เช่น "PO-00001", "10001", "00001" ฯลฯ)
-- TODO: หลังยืนยัน format → เพิ่ม SEQUENCE / trigger ถ้าต้องการ auto-generate
CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            TEXT UNIQUE,
  ops_id           TEXT,
  id_card          TEXT UNIQUE NOT NULL,
  prefix           TEXT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  gender           TEXT,
  first_name_en    TEXT,
  last_name_en     TEXT,
  dob              DATE,
  address_no       TEXT,
  address_moo      TEXT,
  address_road     TEXT,
  address_tambon   TEXT,
  address_amphoe   TEXT,
  address_province TEXT,
  address_zipcode  TEXT,
  warehouse        TEXT REFERENCES warehouses(id),
  start_date       DATE,
  phone            TEXT,
  bank_id          UUID REFERENCES banks(id),
  bank_account     TEXT,
  note             TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);


-- 8. Plans
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


-- 9. Plan Roster
CREATE TABLE IF NOT EXISTS plan_employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          UUID REFERENCES plans(id) ON DELETE CASCADE,
  employee_id      UUID REFERENCES employees(id),
  sent_to_namelist BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, employee_id)
);


-- 10. Namelist
CREATE TABLE IF NOT EXISTS namelist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  employee_id   UUID REFERENCES employees(id),
  department_id UUID REFERENCES departments(id),
  shift_id      UUID REFERENCES shifts(id),
  work_status   TEXT DEFAULT NULL,
  oa_status     TEXT DEFAULT '-',
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, employee_id, shift_id)
);


-- RLS
ALTER TABLE warehouses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_statuses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE namelist       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON warehouses     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON users          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON banks          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON departments    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON shifts         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON work_statuses  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON employees      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON plans          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON plan_employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON namelist       FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ⚠️ GRANT — จำเป็นมาก ถ้าขาดจะเกิด "permission denied for table users"
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;


-- ============================================================
-- หลัง Import ข้อมูลพนักงานจาก CSV:
-- 1. ตรวจสอบ po_id format ของข้อมูลเก่า
-- 2. ถ้าต้องการ auto-generate po_id ต่อจากเก่า:
--    CREATE SEQUENCE po_id_seq START [max_number + 1];
--    ALTER TABLE employees ALTER COLUMN po_id
--      SET DEFAULT 'PO-' || lpad(nextval('po_id_seq')::text, 5, '0');
-- ============================================================
