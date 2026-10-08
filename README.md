# DEMS — Daily Employee Management System

ระบบจัดการพนักงานรายวัน กะการทำงาน และ Namelist รายวันได้ในที่เดียว ครบทุกคลัง

## Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Custom JWT (jose)
- **Deployment**: Vercel

---

## 🚀 Setup Guide

### 1. ติดตั้ง Node.js
ดาวน์โหลดจาก https://nodejs.org (LTS version)

### 2. ติดตั้ง dependencies
```bash
npm install
```

### 3. ตั้งค่า Supabase
1. ไปที่ https://supabase.com → สร้าง project ใหม่
2. ไปที่ **SQL Editor** → วาง SQL จากไฟล์ `supabase/schema.sql` → Run
3. ไปที่ **Project Settings → API** → copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key

### 4. ตั้งค่า Environment Variables
```bash
cp .env.example .env.local
```
แล้วแก้ไข `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
JWT_SECRET=your-super-secret-key-minimum-32-characters
```

### 5. Run development server
```bash
npm run dev
```
เปิด http://localhost:3000

### 6. Login ครั้งแรก
- Email: `admin@dems.co.th`
- Password: `admin1234`

> **⚠️ เปลี่ยนรหัสผ่านทันทีหลัง login ครั้งแรก!**

---

## 📥 นำเข้าพนักงาน 10,000 คนจาก Google Sheet

### วิธีที่ 1: Supabase Table Editor (สะดวกสุด)
1. Export Google Sheet → CSV
2. Map headers ตาม schema
3. Supabase Dashboard → Table Editor → `employees` → Import Data → เลือกไฟล์ CSV

### วิธีที่ 2: SQL INSERT bulk
```sql
-- หลัง import แล้ว sync sequence
SELECT setval('employees_po_id_seq', (SELECT MAX(po_id) FROM employees) + 1);
```

---

## 📋 Phase Status
| Phase | ชื่อ | สถานะ |
|-------|------|--------|
| 0 | Project Setup + Supabase Schema | ✅ Done |
| 1 | Auth + Login | ✅ Done |
| 2 | จัดการผู้ใช้งาน | ✅ Done |
| 3 | จัดการข้อมูล Dropdown | ✅ Done  |
| 4 | ข้อมูลพนักงาน | ✅ Done |
| 5 | จัดแพลนพนักงาน | ⏳ Planned |
| 6 | Namelist | ⏳ Planned |
| 7 | Export CSV | ⏳ Planned |
