-- ============================================================
-- DEMS Database Schema (Unified Schema)
-- ระบบ DEMS (Daily Employee Management System)
-- รวม Schema ทั้งหมด: Warehouses, Users, Banks, Departments,
-- Shifts, OA Options, Work Statuses, Employees, Plans, Namelist
-- พร้อม RLS Policies และ Permissions ครบถ้วน
-- ============================================================

-- 0. เปิดใช้งาน Extension สำหรับสร้าง UUID และ Trigram Index ค้นหาข้อความ
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


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
  ('SOCE',    'SOCE'),
  ('SOCW',    'SOCW'),
  ('SOCN',    'SOCN'),
  ('FSOCW',   'FSOCW'),
  ('SCOM SC1', 'SCOM SC1'),
  ('SCOM WN1', 'SCOM WN1'),
  ('SCOM WN2', 'SCOM WN2'),
  ('SCOM-SS', 'SCOM-SS'),
  ('SCOM-WN', 'SCOM-WN')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- ============================================================
-- 2. ผู้ใช้งานระบบ (System Users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT    NOT NULL,
  email          TEXT    UNIQUE NOT NULL,
  password       TEXT    NOT NULL,
  plain_password TEXT,
  role           TEXT    NOT NULL CHECK (role IN ('super_admin', 'admin', 'payroll')),
  warehouses     TEXT[]  DEFAULT '{}',
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- อัปเดตโครงสร้างสำหรับฐานข้อมูลเดิม (กรณีสร้าง table ไปแล้ว)
ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- Seed: Super Admin เริ่มต้น
-- email: admin@dems.co.th | password: PPODEMSsuperadmin@!#$%2026
INSERT INTO users (name, email, password, plain_password, role, warehouses)
VALUES (
  'Super Admin',
  'admin@dems.co.th',
  '$2a$10$.2IBc6tYAwrgnKLhOjzDjOsiuL0PqNhLcbm.eeMk2gWLNuFtYV7Hu',
  'PPODEMSsuperadmin@!#$%2026',
  'super_admin',
  ARRAY['SOCE', 'SOCW', 'SOCN', 'FSOCW', 'SCOM SC1', 'SCOM WN1', 'SCOM WN2', 'SCOM-SS', 'SCOM-WN']
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  plain_password = EXCLUDED.plain_password,
  role = EXCLUDED.role,
  warehouses = EXCLUDED.warehouses;


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
  type        TEXT,
  name        TEXT NOT NULL,
  shift_name  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- อัปเดตโครงสร้างกรณีมีตารางเดิมอยู่แล้ว
ALTER TABLE departments ADD COLUMN IF NOT EXISTS type TEXT;
UPDATE departments SET type = warehouse WHERE type IS NULL;


-- ============================================================
-- 5. กะการทำงาน (Shifts) — Scope ตามคลัง
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse  TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('D', 'N', 'H')),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================


-- ============================================================
-- Seed Master Shifts & Departments
-- ข้อมูลกะทำงาน (212 กะ) และแผนก (192 แผนก) ตามจริง
-- ============================================================

-- Seed Master Shifts
INSERT INTO shifts (warehouse, start_time, end_time, type)
SELECT v.warehouse, v.start_time, v.end_time, v.type
FROM (VALUES
  ('SOCE', '06:00', '15:00', 'D'),
  ('SOCE', '07:00', '16:00', 'D'),
  ('SOCE', '08:00', '17:00', 'D'),
  ('SOCE', '08:30', '17:30', 'D'),
  ('SOCE', '09:00', '18:00', 'D'),
  ('SOCE', '09:30', '18:30', 'D'),
  ('SOCE', '10:00', '19:00', 'D'),
  ('SOCE', '10:30', '19:30', 'D'),
  ('SOCE', '11:00', '20:00', 'D'),
  ('SOCE', '12:00', '21:00', 'D'),
  ('SOCE', '13:00', '22:00', 'N'),
  ('SOCE', '14:00', '23:00', 'N'),
  ('SOCE', '15:00', '24:00', 'N'),
  ('SOCE', '16:00', '01:00', 'N'),
  ('SOCE', '17:00', '02:00', 'N'),
  ('SOCE', '18:00', '03:00', 'N'),
  ('SOCE', '19:00', '04:00', 'N'),
  ('SOCE', '20:00', '05:00', 'N'),
  ('SOCE', '20:30', '05:30', 'N'),
  ('SOCE', '21:00', '06:00', 'N'),
  ('SOCE', '22:00', '07:00', 'N'),
  ('SOCE', '23:00', '08:00', 'N'),
  ('SOCE', '24:00', '09:00', 'N'),
  ('SOCE', '01:00', '10:00', 'N'),
  ('SOCE', '02:00', '11:00', 'N'),
  ('SOCE', '03:00', '12:00', 'N'),
  ('SOCE', '04:00', '13:00', 'N'),
  ('SOCE', '05:00', '14:00', 'N'),
  ('SOCN', '06:00', '15:00', 'D'),
  ('SOCN', '07:00', '16:00', 'D'),
  ('SOCN', '08:00', '17:00', 'D'),
  ('SOCN', '08:30', '17:30', 'D'),
  ('SOCN', '09:00', '18:00', 'D'),
  ('SOCN', '09:30', '18:30', 'D'),
  ('SOCN', '10:00', '19:00', 'D'),
  ('SOCN', '10:30', '19:30', 'D'),
  ('SOCN', '11:00', '20:00', 'D'),
  ('SOCN', '12:00', '21:00', 'D'),
  ('SOCN', '13:00', '17:00', 'H'),
  ('SOCN', '13:00', '22:00', 'N'),
  ('SOCN', '13:00', '23:00', 'N'),
  ('SOCN', '14:00', '23:00', 'N'),
  ('SOCN', '15:00', '24:00', 'N'),
  ('SOCN', '16:00', '01:00', 'N'),
  ('SOCN', '17:00', '02:00', 'N'),
  ('SOCN', '18:00', '03:00', 'N'),
  ('SOCN', '19:00', '04:00', 'N'),
  ('SOCN', '20:00', '05:00', 'N'),
  ('SOCN', '20:30', '05:30', 'N'),
  ('SOCN', '21:00', '06:00', 'N'),
  ('SOCN', '22:00', '07:00', 'N'),
  ('SOCN', '23:00', '08:00', 'N'),
  ('SOCN', '24:00', '09:00', 'N'),
  ('SOCN', '01:00', '10:00', 'N'),
  ('SOCN', '02:00', '11:00', 'N'),
  ('SOCN', '03:00', '12:00', 'N'),
  ('SOCN', '04:00', '13:00', 'N'),
  ('SOCN', '05:00', '14:00', 'N'),
  ('SOCW', '06:00', '15:00', 'D'),
  ('SOCW', '07:00', '16:00', 'D'),
  ('SOCW', '08:00', '17:00', 'D'),
  ('SOCW', '08:30', '17:30', 'D'),
  ('SOCW', '09:00', '18:00', 'D'),
  ('SOCW', '09:30', '18:30', 'D'),
  ('SOCW', '10:00', '19:00', 'D'),
  ('SOCW', '10:30', '19:30', 'D'),
  ('SOCW', '11:00', '20:00', 'D'),
  ('SOCW', '12:00', '21:00', 'D'),
  ('SOCW', '13:00', '22:00', 'N'),
  ('SOCW', '14:00', '23:00', 'N'),
  ('SOCW', '15:00', '24:00', 'N'),
  ('SOCW', '16:00', '01:00', 'N'),
  ('SOCW', '17:00', '02:00', 'N'),
  ('SOCW', '18:00', '03:00', 'N'),
  ('SOCW', '19:00', '04:00', 'N'),
  ('SOCW', '20:00', '05:00', 'N'),
  ('SOCW', '20:30', '05:30', 'N'),
  ('SOCW', '21:00', '06:00', 'N'),
  ('SOCW', '22:00', '07:00', 'N'),
  ('SOCW', '23:00', '08:00', 'N'),
  ('SOCW', '24:00', '09:00', 'N'),
  ('SOCW', '01:00', '10:00', 'N'),
  ('SOCW', '02:00', '11:00', 'N'),
  ('SOCW', '03:00', '12:00', 'N'),
  ('SOCW', '04:00', '13:00', 'N'),
  ('SOCW', '05:00', '14:00', 'N'),
  ('SOCW', '22:00', '09:00', 'N'),
  ('FSOCW', '06:00', '15:00', 'D'),
  ('FSOCW', '07:00', '16:00', 'D'),
  ('FSOCW', '08:00', '17:00', 'D'),
  ('FSOCW', '08:30', '17:30', 'D'),
  ('FSOCW', '09:00', '18:00', 'D'),
  ('FSOCW', '09:30', '18:30', 'D'),
  ('FSOCW', '10:00', '19:00', 'D'),
  ('FSOCW', '10:30', '19:30', 'D'),
  ('FSOCW', '11:00', '20:00', 'D'),
  ('FSOCW', '12:00', '21:00', 'D'),
  ('FSOCW', '13:00', '17:00', 'H'),
  ('FSOCW', '13:00', '22:00', 'N'),
  ('FSOCW', '14:00', '23:00', 'N'),
  ('FSOCW', '15:00', '24:00', 'N'),
  ('FSOCW', '16:00', '01:00', 'N'),
  ('FSOCW', '17:00', '02:00', 'N'),
  ('FSOCW', '18:00', '03:00', 'N'),
  ('FSOCW', '19:00', '04:00', 'N'),
  ('FSOCW', '20:00', '05:00', 'N'),
  ('FSOCW', '20:30', '05:30', 'N'),
  ('FSOCW', '21:00', '06:00', 'N'),
  ('FSOCW', '22:00', '07:00', 'N'),
  ('FSOCW', '23:00', '08:00', 'N'),
  ('FSOCW', '24:00', '09:00', 'N'),
  ('FSOCW', '01:00', '10:00', 'N'),
  ('FSOCW', '02:00', '11:00', 'N'),
  ('FSOCW', '03:00', '12:00', 'N'),
  ('FSOCW', '04:00', '13:00', 'N'),
  ('FSOCW', '05:00', '14:00', 'N'),
  ('SCOM SC1', '06:00', '15:00', 'D'),
  ('SCOM SC1', '07:00', '16:00', 'D'),
  ('SCOM SC1', '08:00', '17:00', 'D'),
  ('SCOM SC1', '08:30', '17:30', 'D'),
  ('SCOM SC1', '09:00', '18:00', 'D'),
  ('SCOM SC1', '09:30', '18:30', 'D'),
  ('SCOM SC1', '10:00', '19:00', 'D'),
  ('SCOM SC1', '10:30', '19:30', 'D'),
  ('SCOM SC1', '11:00', '20:00', 'D'),
  ('SCOM SC1', '12:00', '21:00', 'D'),
  ('SCOM SC1', '14:30', '23:30', 'N'),
  ('SCOM SC1', '13:00', '22:00', 'N'),
  ('SCOM SC1', '11:30', '20:30', 'D'),
  ('SCOM SC1', '14:00', '23:00', 'N'),
  ('SCOM SC1', '15:00', '24:00', 'N'),
  ('SCOM SC1', '16:00', '01:00', 'N'),
  ('SCOM SC1', '17:00', '02:00', 'N'),
  ('SCOM SC1', '17:30', '02:30', 'N'),
  ('SCOM SC1', '18:00', '03:00', 'N'),
  ('SCOM SC1', '19:00', '04:00', 'N'),
  ('SCOM SC1', '20:00', '05:00', 'N'),
  ('SCOM SC1', '20:30', '05:30', 'N'),
  ('SCOM SC1', '21:00', '06:00', 'N'),
  ('SCOM SC1', '22:00', '07:00', 'N'),
  ('SCOM SC1', '23:00', '08:00', 'N'),
  ('SCOM SC1', '24:00', '09:00', 'N'),
  ('SCOM SC1', '01:00', '10:00', 'N'),
  ('SCOM SC1', '02:00', '11:00', 'N'),
  ('SCOM SC1', '03:00', '12:00', 'N'),
  ('SCOM SC1', '04:00', '13:00', 'N'),
  ('SCOM SC1', '13:30', '22:30', 'N'),
  ('SCOM SC1', '15:30', '24:30', 'N'),
  ('SCOM SC1', '06:30', '15:30', 'D'),
  ('SCOM SC1', '12:30', '21:30', 'D'),
  ('SCOM WN1', '06:00', '15:00', 'D'),
  ('SCOM WN1', '07:00', '16:00', 'D'),
  ('SCOM WN1', '08:00', '17:00', 'D'),
  ('SCOM WN1', '08:30', '17:30', 'D'),
  ('SCOM WN1', '09:00', '18:00', 'D'),
  ('SCOM WN1', '09:30', '18:30', 'D'),
  ('SCOM WN1', '10:00', '19:00', 'D'),
  ('SCOM WN1', '10:30', '19:30', 'D'),
  ('SCOM WN1', '11:00', '20:00', 'D'),
  ('SCOM WN1', '12:00', '21:00', 'D'),
  ('SCOM WN1', '13:00', '17:00', 'H'),
  ('SCOM WN1', '13:00', '22:00', 'N'),
  ('SCOM WN1', '14:00', '23:00', 'N'),
  ('SCOM WN1', '15:00', '24:00', 'N'),
  ('SCOM WN1', '16:00', '01:00', 'N'),
  ('SCOM WN1', '17:00', '02:00', 'N'),
  ('SCOM WN1', '18:00', '03:00', 'N'),
  ('SCOM WN1', '19:00', '04:00', 'N'),
  ('SCOM WN1', '20:00', '05:00', 'N'),
  ('SCOM WN1', '20:30', '05:30', 'N'),
  ('SCOM WN1', '21:00', '06:00', 'N'),
  ('SCOM WN1', '21:30', '06:30', 'N'),
  ('SCOM WN1', '22:00', '07:00', 'N'),
  ('SCOM WN1', '23:00', '08:00', 'N'),
  ('SCOM WN1', '24:00', '09:00', 'N'),
  ('SCOM WN1', '01:00', '10:00', 'N'),
  ('SCOM WN1', '02:00', '11:00', 'N'),
  ('SCOM WN1', '03:00', '12:00', 'N'),
  ('SCOM WN1', '04:00', '13:00', 'N'),
  ('SCOM WN1', '05:00', '14:00', 'N'),
  ('SCOM WN1', '07:30', '16:30', 'D'),
  ('SCOM WN2', '06:00', '15:00', 'D'),
  ('SCOM WN2', '07:00', '16:00', 'D'),
  ('SCOM WN2', '08:00', '17:00', 'D'),
  ('SCOM WN2', '08:30', '17:30', 'D'),
  ('SCOM WN2', '09:00', '18:00', 'D'),
  ('SCOM WN2', '09:30', '18:30', 'D'),
  ('SCOM WN2', '10:00', '19:00', 'D'),
  ('SCOM WN2', '10:30', '19:30', 'D'),
  ('SCOM WN2', '11:00', '20:00', 'D'),
  ('SCOM WN2', '12:00', '21:00', 'D'),
  ('SCOM WN2', '13:00', '17:00', 'H'),
  ('SCOM WN2', '13:00', '22:00', 'N'),
  ('SCOM WN2', '14:00', '23:00', 'N'),
  ('SCOM WN2', '15:00', '24:00', 'N'),
  ('SCOM WN2', '16:00', '01:00', 'N'),
  ('SCOM WN2', '17:00', '02:00', 'N'),
  ('SCOM WN2', '18:00', '03:00', 'N'),
  ('SCOM WN2', '19:00', '04:00', 'N'),
  ('SCOM WN2', '20:00', '05:00', 'N'),
  ('SCOM WN2', '20:30', '05:30', 'N'),
  ('SCOM WN2', '21:00', '06:00', 'N'),
  ('SCOM WN2', '21:30', '06:30', 'N'),
  ('SCOM WN2', '22:00', '07:00', 'N'),
  ('SCOM WN2', '23:00', '08:00', 'N'),
  ('SCOM WN2', '24:00', '09:00', 'N'),
  ('SCOM WN2', '01:00', '10:00', 'N'),
  ('SCOM WN2', '02:00', '11:00', 'N'),
  ('SCOM WN2', '03:00', '12:00', 'N'),
  ('SCOM WN2', '04:00', '13:00', 'N'),
  ('SCOM WN2', '05:00', '14:00', 'N'),
  ('SCOM WN2', '07:30', '16:30', 'D')
) AS v(warehouse, start_time, end_time, type)
WHERE NOT EXISTS (
  SELECT 1 FROM shifts s 
  WHERE s.warehouse = v.warehouse 
    AND s.start_time = v.start_time 
    AND s.end_time = v.end_time
);

-- Seed Master Departments
INSERT INTO departments (warehouse, type, name, shift_name)
SELECT v.warehouse, v.type, v.name, v.shift_name
FROM (VALUES
  ('SOCE', 'SOCE', '4PL', '4PL'),
  ('SOCE', 'SOCE', 'Admin Asset(SOC)', 'Admin Asset'),
  ('SOCE', 'SOCE', 'Admin MPW(SOC)', 'Admin MPW'),
  ('SOCE', 'SOCE', 'Crossbelt Sort', 'Crossbelt Sort'),
  ('SOCE', 'SOCE', 'Helper', 'Helper'),
  ('SOCE', 'SOCE', 'Inbound', 'Inbound'),
  ('SOCE', 'SOCE', 'Manual Sort', 'Manual Sort'),
  ('SOCE', 'SOCE', 'Mini Crossbelt Sort', 'Mini Crossbelt Sort'),
  ('SOCE', 'SOCE', 'Outbound Dispatch', 'Outbound Dispatch'),
  ('SOCE', 'SOCE', 'Outbound Sort', 'Outbound Sort'),
  ('SOCE', 'SOCE', 'Return', 'Return'),
  ('SOCE', 'SOCE', 'Rework', 'Rework'),
  ('SOCE', 'SOCE', 'Technician(SOC)', 'Technician'),
  ('SOCE', 'SOCE', 'Asset', 'Asset'),
  ('SOCE', 'FSOCE', 'FSOCE', 'FSOCE'),
  ('SOCE', 'FSOCE', 'Admin Asset(FSOC)', 'Admin Asset'),
  ('SOCE', 'FSOCE', 'Admin MPW(FSOC)', 'Admin MPW'),
  ('SOCE', 'FSOCE', 'Technician(FSOC)', 'Technician'),
  ('SOCE', 'SOCE', 'HIGHVALUE', 'HIGHVALUE'),
  ('SOCE', 'SOCE', 'MS x OBS', 'MS x OBS'),
  ('SOCE', 'SOCE', 'OBS X MS', 'OBS X MS'),
  ('SOCE', 'SOCE', 'IB X OBS', 'IB X OBS'),
  ('SOCE', 'SOCE', 'OBS X CBS', 'OBS X CBS'),
  ('SOCE', 'SOCE', 'SIP', 'SIP'),
  ('SOCE', 'SOCE', 'OBS X IB', 'OBS X IB'),
  ('SOCE', 'SOCE', 'TF_WH', 'TF_WH'),
  ('SOCE', 'SOCE', 'TF_SOC', 'TF_SOC'),
  ('SOCN', 'SOCN', '4PL', '4PL'),
  ('SOCN', 'SOCN', 'Admin Asset(SOCN)', 'Admin Asset'),
  ('SOCN', 'SOCN', 'Admin MPW(SOCN)', 'Admin MPW'),
  ('SOCN', 'SOCN', 'Crossbelt Sort', 'Crossbelt Sort'),
  ('SOCN', 'SOCN', 'Helper', 'Helper'),
  ('SOCN', 'SOCN', 'Inbound', 'Inbound'),
  ('SOCN', 'SOCN', 'Manual Sort', 'Manual Sort'),
  ('SOCN', 'SOCN', 'Mini Crossbelt Sort', 'Mini Crossbelt Sort'),
  ('SOCN', 'SOCN', 'MS-B', 'MS-B'),
  ('SOCN', 'SOCN', 'OBS x OBD', 'OBS x OBD'),
  ('SOCN', 'SOCN', 'Outbound Conveyor', 'Outbound Conveyor'),
  ('SOCN', 'SOCN', 'Outbound Dispatch', 'Outbound Dispatch'),
  ('SOCN', 'SOCN', 'Outbound Induction', 'Outbound Induction'),
  ('SOCN', 'SOCN', 'Outbound Sort', 'Outbound Sort'),
  ('SOCN', 'SOCN', 'Outbound Sort X Outbound Dispatch', 'OBS x OBD'),
  ('SOCN', 'SOCN', 'Return', 'Return'),
  ('SOCN', 'SOCN', 'Rework', 'Rework'),
  ('SOCN', 'SOCN', 'Technician(SOCN)', 'Techinician'),
  ('SOCN', 'SOCN', 'Asset', 'Asset'),
  ('SOCN', 'FSOCN', 'Admin Asset(FSOCN)', 'Admin Asset'),
  ('SOCN', 'FSOCN', 'Admin MPW(FSOCN)', 'Admin MPW'),
  ('SOCN', 'FSOCN', 'FSOCN', 'FSOCN'),
  ('SOCN', 'FSOCN', 'Technician(FSOCN)', 'Techinician'),
  ('SOCN', 'SOCN', 'M Sack', 'M Sack'),
  ('SOCN', 'SOCN', 'CB', 'CB'),
  ('SOCN', 'SOCN', 'TF WH', 'TF WH'),
  ('SOCW', 'SOCW', 'Admin Asset(SOCW)', 'Admin Asset'),
  ('SOCW', 'SOCW', 'Asset', 'Asset'),
  ('SOCW', 'SOCW', 'Helper', 'Helper'),
  ('SOCW', 'SOCW', 'Inbound', 'Inbound'),
  ('SOCW', 'SOCW', 'Manual Sort', 'Manual Sort'),
  ('SOCW', 'SOCW', 'MS-B', 'MS-B'),
  ('SOCW', 'SOCW', 'Outbound', 'Outbound'),
  ('SOCW', 'SOCW', 'Return', 'Return'),
  ('SOCW', 'SOCW', 'Rework', 'Rework'),
  ('SOCW', 'SOCW', 'Small Sort', 'Small Sort'),
  ('SOCW', 'SOCW', 'Technician(SOCW)', 'Technician'),
  ('SOCW', 'SOCW', 'High value lane', 'High value lane'),
  ('SOCW', 'SOCW', 'CB Liquidated', 'CB Liquidated'),
  ('FSOCW', 'FSOCW', 'Admin Asset(FSOCW)', 'Admin Asset'),
  ('FSOCW', 'FSOCW', 'PS 4PL', 'PS4PL'),
  ('FSOCW', 'FSOCW', 'PS Inbound', 'PSIB'),
  ('FSOCW', 'FSOCW', 'PS MS', 'PSMS'),
  ('FSOCW', 'FSOCW', 'PS Outbound', 'PSOB'),
  ('FSOCW', 'FSOCW', 'PS Rework', 'PSRW'),
  ('FSOCW', 'FSOCW', 'PS Sort', 'PSSS'),
  ('FSOCW', 'FSOCW', 'Technician(FSOCW)', 'Technician'),
  ('SCOM SC1', 'SCOM', 'Leader Inbound', 'Leader Inbound'),
  ('SCOM SC1', 'SCOM', 'Inbound', 'Inbound'),
  ('SCOM SC1', 'SCOM', 'Inbound CB', 'Inbound CB'),
  ('SCOM SC1', 'SCOM', 'Put Away', 'Put Away'),
  ('SCOM SC1', 'SCOM', 'Forklift - Put Away', 'Forklift - Put Away'),
  ('SCOM SC1', 'SCOM', 'Power Pallet - Put Away', 'Power Pallet - Put Away'),
  ('SCOM SC1', 'SCOM', 'Reach truck - Put Away', 'Reach truck - Put Away'),
  ('SCOM SC1', 'SCOM', 'VAS CB', 'VAS CB'),
  ('SCOM SC1', 'SCOM', 'VAS Local', 'VAS Local'),
  ('SCOM SC1', 'SCOM', 'Leader Inventory', 'Leader Inventory'),
  ('SCOM SC1', 'SCOM', 'Cycle count', 'Cycle count'),
  ('SCOM SC1', 'SCOM', 'Damage & Surplus', 'Damage & Surplus'),
  ('SCOM SC1', 'SCOM', 'Troubleshoot', 'Troubleshoot'),
  ('SCOM SC1', 'SCOM', 'Replenish', 'Replenish'),
  ('SCOM SC1', 'SCOM', 'Forklift - Inventory', 'Forklift - Inventory'),
  ('SCOM SC1', 'SCOM', 'Power Pallet - Inventory', 'Power Pallet - Inventory'),
  ('SCOM SC1', 'SCOM', 'Reach truck - Inventory', 'Reach truck - Inventory'),
  ('SCOM SC1', 'SCOM', 'Leader Outbound', 'Leader Outbound'),
  ('SCOM SC1', 'SCOM', 'SPX Sorting', 'SPX Sorting'),
  ('SCOM SC1', 'SCOM', 'Packing', 'Packing'),
  ('SCOM SC1', 'SCOM', 'Picking', 'Picking'),
  ('SCOM SC1', 'SCOM', 'Sorting', 'Sorting'),
  ('SCOM SC1', 'SCOM', 'Shipping', 'Shipping'),
  ('SCOM SC1', 'SCOM', 'Power Pallet - Pick', 'Power Pallet - Pick'),
  ('SCOM SC1', 'SCOM', 'Power Pallet - Pack', 'Power Pallet - Pack'),
  ('SCOM SC1', 'SCOM', 'Leader Returns', 'Leader Returns'),
  ('SCOM SC1', 'SCOM', 'Returns-WH', 'Returns-WH'),
  ('SCOM SC1', 'SCOM', 'Returns-NON WH CB', 'Returns-NON WH CB'),
  ('SCOM SC1', 'SCOM', 'Inbound CB chargeback', 'Inbound CB chargeback'),
  ('SCOM SC1', 'SCOM', 'Outbound/ RTS', 'Outbound/ RTS'),
  ('SCOM SC1', 'SCOM', 'Migration Put Away', 'Migration Put Away'),
  ('SCOM SC1', 'SCOM', 'Migration - Outbound', 'Migration - Outbound'),
  ('SCOM SC1', 'SCOM', 'Migration - Forklift', 'Migration - Forklift'),
  ('SCOM SC1', 'SCOM', 'Forklift - Consumable', 'Forklift - Consumable'),
  ('SCOM SC1', 'SCOM', 'Power Pallet - Consumable', 'Power Pallet - Consumable'),
  ('SCOM SC1', 'SCOM', 'Reach truck - Consumable', 'Reach truck - Consumable'),
  ('SCOM SC1', 'SCOM', 'Facility', 'Facility'),
  ('SCOM SC1', 'SCOM', '5S', '5S'),
  ('SCOM SC1', 'SCOM', 'Same Day', 'Same Day'),
  ('SCOM WN1', 'SCOM', 'Leader Inbound', 'Leader Inbound'),
  ('SCOM WN1', 'SCOM', 'Inbound', 'Inbound'),
  ('SCOM WN1', 'SCOM', 'Inbound CB', 'Inbound CB'),
  ('SCOM WN1', 'SCOM', 'Put Away', 'Put Away'),
  ('SCOM WN1', 'SCOM', 'Forklift - Put Away', 'Forklift - Put Away'),
  ('SCOM WN1', 'SCOM', 'Power Pallet - Put Away', 'Power Pallet - Put Away'),
  ('SCOM WN1', 'SCOM', 'Reach truck - Put Away', 'Reach truck - Put Away'),
  ('SCOM WN1', 'SCOM', 'VAS CB', 'VAS CB'),
  ('SCOM WN1', 'SCOM', 'VAS Local', 'VAS Local'),
  ('SCOM WN1', 'SCOM', 'Leader Inventory', 'Leader Inventory'),
  ('SCOM WN1', 'SCOM', 'Cycle count', 'Cycle count'),
  ('SCOM WN1', 'SCOM', 'Damage & Surplus', 'Damage & Surplus'),
  ('SCOM WN1', 'SCOM', 'Troubleshoot', 'Troubleshoot'),
  ('SCOM WN1', 'SCOM', 'Replenish', 'Replenish'),
  ('SCOM WN1', 'SCOM', 'Forklift - Inventory', 'Forklift - Inventory'),
  ('SCOM WN1', 'SCOM', 'Power Pallet - Inventory', 'Power Pallet - Inventory'),
  ('SCOM WN1', 'SCOM', 'Reach truck - Inventory', 'Reach truck - Inventory'),
  ('SCOM WN1', 'SCOM', 'Leader Outbound', 'Leader Outbound'),
  ('SCOM WN1', 'SCOM', 'SPX Sorting', 'SPX Sorting'),
  ('SCOM WN1', 'SCOM', 'Packing', 'Packing'),
  ('SCOM WN1', 'SCOM', 'Picking', 'Picking'),
  ('SCOM WN1', 'SCOM', 'Sorting', 'Sorting'),
  ('SCOM WN1', 'SCOM', 'Shipping', 'Shipping'),
  ('SCOM WN1', 'SCOM', 'Power Pallet - Pick', 'Power Pallet - Pick'),
  ('SCOM WN1', 'SCOM', 'Power Pallet - Pack', 'Power Pallet - Pack'),
  ('SCOM WN1', 'SCOM', 'Leader Returns', 'Leader Returns'),
  ('SCOM WN1', 'SCOM', 'Returns', 'Returns'),
  ('SCOM WN1', 'SCOM', 'Returns-NON WH CB', 'Returns-NON WH CB'),
  ('SCOM WN1', 'SCOM', 'Inbound CB chargeback', 'Inbound CB chargeback'),
  ('SCOM WN1', 'SCOM', 'Outbound/ RTS', 'Outbound/ RTS'),
  ('SCOM WN1', 'SCOM', 'Migration Put Away', 'Migration Put Away'),
  ('SCOM WN1', 'SCOM', 'Migration - Outbound', 'Migration - Outbound'),
  ('SCOM WN1', 'SCOM', 'Migration - Forklift', 'Migration - Forklift'),
  ('SCOM WN1', 'SCOM', 'Forklift - Consumable', 'Forklift - Consumable'),
  ('SCOM WN1', 'SCOM', 'Power Pallet - Consumable', 'Power Pallet - Consumable'),
  ('SCOM WN1', 'SCOM', 'Reach truck - Consumable', 'Reach truck - Consumable'),
  ('SCOM WN1', 'SCOM', 'Maintenance', 'Maintenance'),
  ('SCOM WN1', 'SCOM', '5S', '5S'),
  ('SCOM WN1', 'SCOM', 'Admin-SWP', 'Admin-SWP'),
  ('SCOM WN1', 'SCOM', 'Returns Non-WH', 'Returns Non-WH'),
  ('SCOM WN2', 'SCOM', 'Leader Inbound', 'Leader Inbound'),
  ('SCOM WN2', 'SCOM', 'Inbound', 'Inbound'),
  ('SCOM WN2', 'SCOM', 'Inbound CB', 'Inbound CB'),
  ('SCOM WN2', 'SCOM', 'Put Away', 'Put Away'),
  ('SCOM WN2', 'SCOM', 'Forklift - Put Away', 'Forklift - Put Away'),
  ('SCOM WN2', 'SCOM', 'Power Pallet - Put Away', 'Power Pallet - Put Away'),
  ('SCOM WN2', 'SCOM', 'Reach truck - Put Away', 'Reach truck - Put Away'),
  ('SCOM WN2', 'SCOM', 'VAS CB', 'VAS CB'),
  ('SCOM WN2', 'SCOM', 'VAS Local', 'VAS Local'),
  ('SCOM WN2', 'SCOM', 'Leader Inventory', 'Leader Inventory'),
  ('SCOM WN2', 'SCOM', 'Cycle count', 'Cycle count'),
  ('SCOM WN2', 'SCOM', 'Damage & Surplus', 'Damage & Surplus'),
  ('SCOM WN2', 'SCOM', 'Troubleshoot', 'Troubleshoot'),
  ('SCOM WN2', 'SCOM', 'Replenish', 'Replenish'),
  ('SCOM WN2', 'SCOM', 'Forklift - Inventory', 'Forklift - Inventory'),
  ('SCOM WN2', 'SCOM', 'Power Pallet - Inventory', 'Power Pallet - Inventory'),
  ('SCOM WN2', 'SCOM', 'Reach truck - Inventory', 'Reach truck - Inventory'),
  ('SCOM WN2', 'SCOM', 'Leader Outbound', 'Leader Outbound'),
  ('SCOM WN2', 'SCOM', 'SPX Sorting', 'SPX Sorting'),
  ('SCOM WN2', 'SCOM', 'Packing', 'Packing'),
  ('SCOM WN2', 'SCOM', 'Picking', 'Picking'),
  ('SCOM WN2', 'SCOM', 'Sorting', 'Sorting'),
  ('SCOM WN2', 'SCOM', 'Shipping', 'Shipping'),
  ('SCOM WN2', 'SCOM', 'Power Pallet - Pick', 'Power Pallet - Pick'),
  ('SCOM WN2', 'SCOM', 'Power Pallet - Pack', 'Power Pallet - Pack'),
  ('SCOM WN2', 'SCOM', 'Leader Returns', 'Leader Returns'),
  ('SCOM WN2', 'SCOM', 'Returns', 'Returns'),
  ('SCOM WN2', 'SCOM', 'Returns-NON WH CB', 'Returns-NON WH CB'),
  ('SCOM WN2', 'SCOM', 'Inbound CB chargeback', 'Inbound CB chargeback'),
  ('SCOM WN2', 'SCOM', 'Outbound/ RTS', 'Outbound/ RTS'),
  ('SCOM WN2', 'SCOM', 'Migration Put Away', 'Migration Put Away'),
  ('SCOM WN2', 'SCOM', 'Migration - Outbound', 'Migration - Outbound'),
  ('SCOM WN2', 'SCOM', 'Migration - Forklift', 'Migration - Forklift'),
  ('SCOM WN2', 'SCOM', 'Forklift - Consumable', 'Forklift - Consumable'),
  ('SCOM WN2', 'SCOM', 'Power Pallet - Consumable', 'Power Pallet - Consumable'),
  ('SCOM WN2', 'SCOM', 'Reach truck - Consumable', 'Reach truck - Consumable'),
  ('SCOM WN2', 'SCOM', 'Maintenance', 'Maintenance'),
  ('SCOM WN2', 'SCOM', '5S', '5S'),
  ('SCOM WN2', 'SCOM', 'Admin-SWP', 'Admin-SWP')
) AS v(warehouse, type, name, shift_name)
WHERE NOT EXISTS (
  SELECT 1 FROM departments d
  WHERE d.warehouse = v.warehouse
    AND d.name = v.name
    AND d.shift_name = v.shift_name
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
  -- ข้อมูลสังกัดสำหรับ Export OPS ID
  ops_hub          TEXT,                   -- ฮับ (Station)
  ops_contract_type TEXT,                  -- ประเภทสัญญา (Contract Type)
  ops_department   TEXT,                   -- หน่วยงาน (Department)
  ops_designation  TEXT,                   -- แผนก (Designation)
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

-- อัปเดตโครงสร้างสำหรับตาราง employees กรณีมีตารางเดิมอยู่แล้ว
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_id            TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_hub           TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_contract_type TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_department   TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ops_designation  TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_trok     TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_soi      TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_full     TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS promptpay_status TEXT;


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
  UNIQUE(date, employee_id, shift_id)
);

-- ปรับ Unique constraint ให้รองรับการทำงานคนละกะในวันเดียวกัน (กรณีมีตารางเดิม)
ALTER TABLE namelist DROP CONSTRAINT IF EXISTS namelist_date_employee_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS namelist_date_employee_shift_key
  ON namelist (date, employee_id, shift_id);


-- ============================================================
-- 13. ดัชนีเพิ่มความเร็วการค้นหา (Performance Indexes)
-- ปรับแต่งรองรับฐานข้อมูลขนาดใหญ่ (Employees 16,000+ รายการ & Namelist)
-- ============================================================

-- 13.1 ดัชนีเดี่ยวพื้นฐาน (Single-column Indexes)
CREATE INDEX IF NOT EXISTS idx_employees_warehouse   ON employees(warehouse);
CREATE INDEX IF NOT EXISTS idx_employees_is_active   ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_po_id       ON employees(po_id);
CREATE INDEX IF NOT EXISTS idx_employees_bank_id     ON employees(bank_id);
CREATE INDEX IF NOT EXISTS idx_plans_date_warehouse  ON plans(date, warehouse);
CREATE INDEX IF NOT EXISTS idx_plans_dept_id         ON plans(department_id);
CREATE INDEX IF NOT EXISTS idx_plan_employees_plan   ON plan_employees(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_employees_emp    ON plan_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_namelist_date         ON namelist(date);
CREATE INDEX IF NOT EXISTS idx_namelist_employee     ON namelist(employee_id);
CREATE INDEX IF NOT EXISTS idx_departments_warehouse ON departments(warehouse);
CREATE INDEX IF NOT EXISTS idx_shifts_warehouse      ON shifts(warehouse);
CREATE INDEX IF NOT EXISTS idx_oa_options_warehouse  ON oa_options(warehouse);

-- 13.2 ดัชนีผสมประสิทธิภาพสูง (High-Performance Composite Indexes)
-- ป้องกัน Full Table Scan และ BitmapAnd Memory Overhead ในการค้นหาจริง
CREATE INDEX IF NOT EXISTS idx_employees_wh_active_po ON employees(warehouse, is_active, po_id);
CREATE INDEX IF NOT EXISTS idx_employees_active_po    ON employees(is_active, po_id);
CREATE INDEX IF NOT EXISTS idx_namelist_dept_date     ON namelist(department_id, date);
CREATE INDEX IF NOT EXISTS idx_namelist_date_dept     ON namelist(date, department_id);
CREATE INDEX IF NOT EXISTS idx_namelist_emp_date      ON namelist(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_plans_wh_date          ON plans(warehouse, date);
CREATE INDEX IF NOT EXISTS idx_plan_employees_plan_sent ON plan_employees(plan_id, sent_to_namelist);
CREATE INDEX IF NOT EXISTS idx_plan_employees_sent    ON plan_employees(sent_to_namelist, employee_id);

-- 13.3 GIN Trigram Indexes สำหรับเร่งความเร็วการค้นหาข้อความและตัวเลข (ILIKE '%คำค้น%')
CREATE INDEX IF NOT EXISTS idx_employees_first_name_trgm ON employees USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_last_name_trgm  ON employees USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_id_card_trgm    ON employees USING gin (id_card gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_phone_trgm      ON employees USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_po_id_trgm      ON employees USING gin (po_id gin_trgm_ops);


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


-- ============================================================
-- 10. ฟังก์ชันและ Stored Procedures (Performance RPCs)
-- ============================================================

-- ฟังก์ชันสำหรับรวมยอดจำนวน Dropdown ทั้งหมดในคำสั่งเดียว (Single Query / 1 DB Roundtrip)
CREATE OR REPLACE FUNCTION get_dropdown_counts(p_warehouse text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_depts int := 0;
  v_shifts int := 0;
  v_oa int := 0;
  v_statuses int := 0;
  v_banks int := 0;
  v_warehouses int := 0;
BEGIN
  IF p_warehouse IS NOT NULL AND p_warehouse <> '' AND p_warehouse <> 'all' THEN
    SELECT count(*) INTO v_depts FROM departments WHERE warehouse = p_warehouse;
    SELECT count(*) INTO v_shifts FROM shifts WHERE warehouse = p_warehouse;
    SELECT count(*) INTO v_oa FROM oa_options WHERE warehouse = p_warehouse;
  END IF;

  SELECT count(*) INTO v_statuses FROM work_statuses;
  SELECT count(*) INTO v_banks FROM banks;
  SELECT count(*) INTO v_warehouses FROM warehouses;

  RETURN json_build_object(
    'departments', v_depts,
    'shifts', v_shifts,
    'oa_options', v_oa,
    'work_statuses', v_statuses,
    'banks', v_banks,
    'warehouses', v_warehouses
  );
END;
$$;

-- กำหนดสิทธิ์ให้เรียกใช้งานฟังก์ชัน RPC ได้
GRANT EXECUTE ON FUNCTION get_dropdown_counts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dropdown_counts(text) TO anon;
GRANT EXECUTE ON FUNCTION get_dropdown_counts(text) TO service_role;
