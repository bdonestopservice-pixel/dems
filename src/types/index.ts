export type Role = 'super_admin' | 'admin' | 'payroll'

export interface SystemUser {
  id: string
  name: string
  email: string
  role: Role
  warehouses: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthSession {
  userId: string
  name: string
  email: string
  role: Role
  warehouses: string[]
}

export interface Warehouse {
  id: string
  name: string
}

export interface Bank {
  id: string
  name: string
  code: string
}

export interface Department {
  id: string
  warehouse: string
  name: string
  shift_name: string
}

export interface Shift {
  id: string
  warehouse: string
  start_time: string
  end_time: string
  type: 'D' | 'N'
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
  po_id?: string        // TEXT — format ยังรอยืนยันกับทีม (เช่น PO-00001 / 10001)
  ops_id?: string
  id_card: string
  prefix?: string
  first_name: string
  last_name: string
  gender?: string
  first_name_en?: string
  last_name_en?: string
  dob?: string
  address_no?: string
  address_moo?: string
  address_road?: string
  address_tambon?: string
  address_amphoe?: string
  address_province?: string
  address_zipcode?: string
  warehouse: string
  start_date?: string
  phone?: string
  bank_id?: string
  bank_account?: string
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
  shift_type?: 'D' | 'N'
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
  first_name?: string
  last_name?: string
  phone?: string
}

export interface NamelistEntry {
  id: string
  date: string
  employee_id: string
  department_id?: string
  shift_id?: string
  work_status?: string
  oa_status: string
  note?: string
  created_at: string
  updated_at: string
  // joined
  po_id?: string
  first_name?: string
  last_name?: string
  department_name?: string
  shift_start?: string
  shift_end?: string
  shift_type?: 'D' | 'N'
}
