-- ============================================================
-- DEMS: เพิ่ม oa_options table สำหรับ ต่างพื้นที่ (OA)
-- scope ตามคลัง เหมือน departments / shifts
-- ============================================================

CREATE TABLE IF NOT EXISTS oa_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse  TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ค่าเริ่มต้น OA ในแต่ละคลัง (seed)
-- INSERT INTO oa_options (warehouse, name) VALUES ('SOCE', 'OA') ON CONFLICT DO NOTHING;

-- RLS + GRANT
ALTER TABLE oa_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON oa_options FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON oa_options TO service_role;

-- ============================================================
-- work_statuses เป็น global (ใช้ร่วมทุกคลัง)
-- ยังไม่มี warehouse column — ถ้าอนาคตต้องการ scope ตามคลัง
-- ให้ ALTER TABLE work_statuses ADD COLUMN warehouse TEXT REFERENCES warehouses(id);
-- ============================================================
