-- ============================================================
-- DEMS Migration: Add pg_trgm Extension & GIN Indexes
-- เร่งความเร็วการค้นหาพนักงานในฐานข้อมูลขนาดใหญ่ (16,000+ รายการ)
-- ============================================================

-- 1. เปิดใช้งาน Extension pg_trgm
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. สร้าง GIN Trigram Indexes บนคอลัมน์ที่ถูกค้นหาในหน้าข้อมูลพนักงาน
CREATE INDEX IF NOT EXISTS idx_employees_first_name_trgm ON employees USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_last_name_trgm  ON employees USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_id_card_trgm    ON employees USING gin (id_card gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_phone_trgm      ON employees USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_po_id_trgm      ON employees USING gin (po_id gin_trgm_ops);

