-- ============================================================
-- DEMS Database Schema v1.2  (อัปเดต 1 ต.ค. 2569)
-- แก้ไขจาก v1.1:
--   ✅ แก้ password hash ของ Super Admin ให้ถูกต้อง (admin1234)
--   ✅ เพิ่ม GRANT statements — แก้ปัญหา "permission denied for table users"
--   ✅ po_id เป็น TEXT (รอยืนยัน format กับทีมก่อน)
--   ✅ ลบ po_id_reservations และ SEQUENCE ออก (เพิ่มทีหลังได้)
-- ============================================================


-- ============================================================
-- 1. คลัง (Warehouses) — ข้อมูลกลาง, Super Admin เท่านั้น
-- ============================================================
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
-- ⚠️  เปลี่ยนรหัสผ่านหลัง login ครั้งแรก
-- hash นี้ generate จาก bcrypt.hash('admin1234', 10) จริง
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
-- 3. ธนาคาร (Banks) — ข้อมูลกลาง, Super Admin เท่านั้น
-- ============================================================
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


-- ============================================================
-- 4. แผนก (Departments) — scope ตามคลัง
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse   TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  shift_name  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 5. กะ (Shifts) — scope ตามคลัง
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
-- 6. Status การทำงาน (Work Statuses) — ข้อมูลกลาง
-- ============================================================
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


-- ============================================================
-- 7. พนักงาน (Employees) — Master Database, ใช้ร่วมทุกคลัง
--
-- ⚠️  po_id เป็น TEXT รอยืนยัน format กับทีมก่อน
--     format ที่เป็นไปได้: "PO-00001", "10001", "00001" ฯลฯ
--
-- TODO (หลังยืนยัน format):
--   ถ้าเป็น TEXT format (เช่น PO-00001):
--     ไม่ต้องเปลี่ยนอะไร ใส่ค่าโดยตรงได้เลย
--   ถ้าต้องการ auto-generate:
--     CREATE SEQUENCE po_id_seq START [ตัวเลขต่อจากข้อมูลเก่า];
--     ALTER TABLE employees ALTER COLUMN po_id SET DEFAULT ...;
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            TEXT UNIQUE,            -- รอ format จากทีม
  ops_id           TEXT,
  -- ข้อมูลส่วนตัว
  id_card          TEXT UNIQUE NOT NULL,   -- เลขบัตรประชาชน 13 หลัก
  prefix           TEXT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  gender           TEXT,
  first_name_en    TEXT,
  last_name_en     TEXT,
  dob              DATE,
  -- ที่อยู่ตามทะเบียนบ้าน (ไม่บังคับ)
  address_no       TEXT,
  address_moo      TEXT,
  address_road     TEXT,
  address_tambon   TEXT,
  address_amphoe   TEXT,
  address_province TEXT,
  address_zipcode  TEXT,
  -- ข้อมูลการทำงาน
  warehouse        TEXT REFERENCES warehouses(id),
  start_date       DATE,
  phone            TEXT,
  -- ข้อมูลธนาคาร
  bank_id          UUID REFERENCES banks(id),
  bank_account     TEXT,
  -- อื่นๆ
  note             TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 8. แพลน (Plans)
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
-- 9. พนักงานในแพลน (Plan Roster)
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
-- 10. Namelist (รายชื่อประจำวัน)
-- ============================================================
CREATE TABLE IF NOT EXISTS namelist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  employee_id   UUID REFERENCES employees(id),
  department_id UUID REFERENCES departments(id),
  shift_id      UUID REFERENCES shifts(id),
  work_status   TEXT DEFAULT NULL,   -- CXDP, Hold, หนีหาย ฯลฯ
  oa_status     TEXT DEFAULT '-',    -- '-' หรือ 'OA'
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, employee_id)
);


-- ============================================================
-- Row Level Security (RLS)
-- Architecture: ทุก request ผ่าน Next.js API Routes
-- ใช้ SUPABASE_SERVICE_ROLE_KEY (Legacy JWT format: eyJ...)
-- anon/authenticated ไม่มีสิทธิ์เข้าถึงตรงๆ เลย
-- ============================================================
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

-- RLS Policy: service_role bypass ได้ทุกตาราง
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


-- ============================================================
-- ⚠️  GRANT — จำเป็นมาก! ถ้าขาดส่วนนี้จะเกิด:
--     "permission denied for table users"
--     แม้จะมี RLS policy และ service_role key ถูกต้องแล้ว
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;


-- ============================================================
-- หลัง Import ข้อมูลพนักงานจาก CSV (10,000 คน):
--
-- 1. ตรวจสอบ po_id format ของข้อมูลเก่า
-- 2. ถ้าต้องการ auto-generate po_id ต่อจากเก่า:
--    CREATE SEQUENCE po_id_seq START [max_po_id + 1];
--
-- ============================================================