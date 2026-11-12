-- ============================================================
-- DEMS Migration: Create Stored Procedure get_dropdown_counts
-- รวม 6 Queries การนับจำนวนหมวดหมู่ใน Dropdown Management ให้เหลือเพียง 1 คำสั่งเดียว
-- ลด PostgREST HTTP Connections จาก 6 Connections เหลือ 1 Connection
--
-- วิธีรัน: คัดลอกคำสั่งทั้งหมดไปวางและกด RUN ใน Supabase Dashboard -> SQL Editor
-- ============================================================

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

-- ให้สิทธิ์ authenticated และ anon และ service_role เรียกใช้งาน RPC นี้ได้
GRANT EXECUTE ON FUNCTION get_dropdown_counts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dropdown_counts(text) TO anon;
GRANT EXECUTE ON FUNCTION get_dropdown_counts(text) TO service_role;

