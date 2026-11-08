export type Role = 'super_admin' | 'admin' | 'payroll'

export interface SystemUser {
  id: string
  name: string
  email: string
  role: Role
  warehouses: string[]
  is_active: boolean
  plain_password?: string | null
  created_at: string
  updated_at: string
}

export interface AuthSession {
  userId: string
  name: string
  email: string
  role: Role
  warehouses: string[]
  rememberMe?: boolean
  pwSig?: string
}

export interface Warehouse {
  id: string
  name: string
}

export interface Bank {
  id: string
  name: string
  code: string
  warehouses?: string[]
}

export interface Department {
  id: string
  warehouse: string
  type?: string | null   // ข้อความกรอกเอง (แสดงในคอลัมน์ TYPE)
  name: string
  shift_name: string
}

export interface Shift {
  id: string
  warehouse: string
  start_time: string
  end_time: string
  type: 'D' | 'N' | 'H'
}

export interface WorkStatus {
  id: string
  name: string
  sort_order: number
}

export interface OaOption {
  id: string
  warehouse: string
  name: string
  created_at: string
}

export interface Employee {
  id: string
  po_id?: string        // TEXT (เช่น PO100001, PO112840)
  ops_id?: string       // TEXT (เช่น OPS-10234)
  id_card: string       // เลขบัตรประชาชน 13 หลัก
  prefix?: string       // นาย, นาง, นางสาว
  first_name: string
  last_name: string
  gender?: string       // ชาย, หญิง
  first_name_en?: string
  last_name_en?: string
  dob?: string          // YYYY-MM-DD (ค.ศ.)
  address_no?: string
  address_moo?: string
  address_trok?: string
  address_soi?: string
  address_road?: string
  address_tambon?: string
  address_amphoe?: string
  address_province?: string
  address_zipcode?: string
  address_full?: string
  warehouse: string
  start_date?: string   // YYYY-MM-DD
  phone?: string
  bank_id?: string
  bank_account?: string
  promptpay_status?: string // 'ยืนยันแล้ว' | 'ยังไม่ยืนยัน'
  note?: string
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  warehouse_name?: string
  bank_name?: string
  bank_code?: string
}

export interface Plan {
  id: string
  date: string
  warehouse: string
  shift_id: string
  department_id: string
  required_count: number
  created_by?: string
  created_at: string
  // joined
  warehouse_name?: string
  shift_start?: string
  shift_end?: string
  shift_type?: 'D' | 'N' | 'H'
  department_name?: string
  current_count?: number
}

export interface PlanEmployee {
  id: string
  plan_id: string
  employee_id: string
  sent_to_namelist: boolean
  created_at: string
  // joined
  po_id?: string
  ops_id?: string
  id_card?: string
  prefix?: string
  first_name?: string
  last_name?: string
  phone?: string
  position?: string
  warehouse?: string
}

export interface NamelistEntry {
  id: string
  date: string
  employee_id: string
  department_id?: string | null
  shift_id?: string | null
  work_status?: string | null
  oa_status: string
  note?: string | null
  created_at: string
  updated_at: string
  // joined
  po_id?: string
  prefix?: string
  first_name?: string
  last_name?: string
  department_name?: string
  shift_start?: string
  shift_end?: string
  shift_type?: 'D' | 'N' | 'H'
  /** คลังของรายการ (อนุมานจาก กะ → แผนก → คลังของพนักงาน) */
  warehouse?: string | null
  department_type?: string
  department_shift_name?: string
  first_name_en?: string
  last_name_en?: string
  gender?: string
  dob?: string
  phone?: string
  id_card?: string
  start_date?: string
  ops_id?: string
  address_full?: string
  address_no?: string
  address_moo?: string
  address_trok?: string
  address_soi?: string
  address_road?: string
  address_tambon?: string
  address_amphoe?: string
  address_province?: string
  address_zipcode?: string
}
