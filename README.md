# DEMS — Daily Employee Management System

**DEMS** (Daily Employee Management System) คือระบบบริหารจัดการพนักงานรายวัน แพลนงาน กะการทำงาน และบันทึกเวลาทำงาน (Namelist) แบบครบวงจร ออกแบบมาเพื่อรองรับศูนย์กระจายสินค้า (Sortation Center) และคลังสินค้า (Hub/Warehouse) ขนาดใหญ่ที่มีปริมาณพนักงานหมุนเวียนสูง

---

## 🌟 ฟีเจอร์และโมดูลหลักของระบบ (Core Modules)

### 1. 👥 ระบบจัดการข้อมูลพนักงาน (Employee Management)
- **ข้อมูลส่วนบุคคลครบถ้วน**: จัดการข้อมูลพนักงาน รหัส PO-id, ข้อมูลติดต่อ, เพศ, วันเกิด, วันที่เริ่มงาน
- **ตรวจสอบความถูกต้องอัตโนมัติ**: ตรวจสอบเลขบัตรประชาชน 13 หลักตามมาตรฐาน และตรวจสอบเบอร์โทรศัพท์
- **ระบบการเงิน & พร้อมเพย์**: บันทึกเลขที่บัญชี ตรวจสอบสถานะการยืนยันพร้อมเพย์ และธนาคาร
- **ข้อมูลสังกัด OPS Portal**: รองรับการระบุ Ops ID, ฮับ (Station/Hub), ประเภทสัญญา (Contract Type), หน่วยงาน (Department) และแผนก (Designation)
- **ระบบประวัติและการจำกัดสิทธิ์ (Blacklist)**: บันทึกสถานะการทำงานและประวัติกรณีติด Blacklist ป้องกันการดึงเข้าทำงานซ้ำซ้อน

### 2. 📅 ระบบจัดแพลนการทำงาน (Daily Planning & Rostering)
- วางแผนจัดสรรกำลังพลรายวันล่วงหน้า แยกตามคลัง กะการทำงาน และแผนก
- ตรวจสอบยอดพนักงานตามเป้าหมาย (Plan Target vs Actual Roster)
- Export ใบลงชื่อเข้าปฏิบัติงานประจำวันเป็นไฟล์ PDF (Attendance Sheet) พร้อมพิมพ์ใช้งานหน้างานทันที

### 3. 📋 ระบบบันทึกรายชื่อเข้างานประจำวัน (Namelist & Realtime Attendance)
- บันทึกและตรวจสอบรายชื่อพนักงานที่เข้าทำงานจริงในแต่ละวัน
- **Realtime Synchronization**: อัปเดตสถานะและข้อมูลข้ามเครื่องแบบทันที (Realtime Broadcast)
- **ตัวกรองกะอัจฉริยะ (Realtime Nearest Shift Filter)**: จัดเรียงกะการทำงานที่ใกล้เคียงกับเวลาปัจจุบันมากที่สุด ช่วยให้ค้นหาและจัดการกะสะดวกรวดเร็ว
- จัดการสถานะการทำงาน (Work Status), การเปลี่ยนกะ, การข้ามพื้นที่ (ต่างพื้นที่), และบันทึกหมายเหตุรายบุคคล

### 4. 📊 ระบบนำออกข้อมูลและรายงาน (Reporting & Exports)
- **Export Namelist ลูกค้า (Excel)**: สร้างไฟล์สรุปการเข้างานตามเทมเพลตมาตรฐานของลูกค้าแบบอัตโนมัติ
- **Export OPS ID (Excel)**: จัดทำไฟล์นำเข้าสำหรับ Agency Portal (Shopee / SPX Express) ตามโครงสร้างทางการ พร้อมจัดรูปแบบเบอร์โทรศัพท์และข้อมูลให้ตรงตามมาตรฐานระบบนำเข้า
- **Export ทะเบียนลูกค้า & รายงานค่าจ้าง (Excel / CSV)**: นำออกข้อมูลประวัติพนักงานและสรุปการทำงานเพื่อใช้ประมวลผลฝ่ายบุคคลและการจ่ายค่าตอบแทน

### 5. ⚙️ ระบบจัดการข้อมูลตัวเลือก Master Data (Dropdown Config)
- จัดการตัวเลือก Master Data ทั้งหมดของระบบแบบไดนามิก:
  - **คลังสินค้า (Warehouses)**
  - **กะการทำงาน (Shifts)**: กะกลางวัน (D), กะกลางคืน (N), กะพิเศษ (H)
  - **แผนก (Departments)**: กำหนดชื่อแผนกและ Shift Name ประจำแต่ละคลัง
  - **ธนาคาร (Banks)**: จัดการรายชื่อธนาคารและรหัสธนาคาร
  - **สถานะการทำงาน (Work Statuses)**: สถานะการปฏิบัติงาน
  - **ตัวเลือก OA (OA Options)**: ข้อมูลตัวเลือกสายการบังคับบัญชา

### 6. 🔐 ระบบความปลอดภัยและการจัดการสิทธิ์ (Role-Based Access Control)
- กำหนดบทบาทผู้ใช้งาน (RBAC):
  - **Super Admin**: สิทธิ์ดูแลระบบทั้งหมด เข้าถึงและกำหนดค่าได้ทุกคลัง
  - **Admin**: สิทธิ์จัดการพนักงาน แพลนงาน และ Namelist ตามคลังที่ได้รับมอบหมาย
  - **Payroll**: สิทธิ์ตรวจสอบข้อมูลและนำออกรายงานเพื่อการคำนวณค่าจ้าง
- **Warehouse Scoping**: จำกัดขอบเขตการมองเห็นและจัดการข้อมูลตามคลังที่ผู้ใช้งานมีสิทธิ์เท่านั้น

### 7. ⚡ การปรับแต่งประสิทธิภาพระดับสูง (High Performance & Scalability)
- ออกแบบฐานข้อมูลรองรับข้อมูลพนักงานระดับหลายหมื่นรายการได้อย่างลื่นไหล
- ดัชนีค้นหาขั้นสูงด้วย PostgreSQL Trigram GIN Indexing สำหรับการค้นหาชื่อและเลขประจำตัวแบบเรียลไทม์
- ระบบ Pagination และ Caching ลดภาระการโหลดข้อมูลของเซิร์ฟเวอร์

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend & Application Framework**: [Next.js](https://nextjs.org/) (App Router), React, TypeScript
- **Styling & UI Components**: [Tailwind CSS](https://tailwindcss.com/), Lucide Icons
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL Database, Realtime Engine, Storage)
- **Authentication**: JWT (JSON Web Tokens) with Secure Cookie & Role Verification
- **Reporting & Document Generation**: [SheetJS (XLSX)](https://sheetjs.com/), [jsPDF](https://github.com/parallax/jsPDF)
- **Hosting & Infrastructure**: [Vercel](https://vercel.com/) (Production Deployment)

---

## 📈 สถานะการพัฒนาระบบ (System Status)

| โมดูลงาน (Module) | รายละเอียด | สถานะ |
|---|---|:---:|
| **0. Architecture & Database** | โครงสร้างฐานข้อมูล, Schema, Indexes และ Data Consistency | ✅ พร้อมใช้งานสมบูรณ์ |
| **1. Authentication & Security** | ระบบเข้าสู่ระบบ, JWT Session, RBAC และ Warehouse Scoping | ✅ พร้อมใช้งานสมบูรณ์ |
| **2. User Management** | จัดการผู้ใช้งานระบบ กำหนดสิทธิ์รายคลังและบทบาท | ✅ พร้อมใช้งานสมบูรณ์ |
| **3. Master Data & Dropdowns** | จัดการข้อมูลคลัง, กะ, แผนก, ธนาคาร, สถานะการทำงาน, ตัวเลือก OA | ✅ พร้อมใช้งานสมบูรณ์ |
| **4. Employee Registry** | ทะเบียนพนักงาน, ตรวจสอบบัตรประชาชน, บัญชี, สังกัด OPS, Blacklist | ✅ พร้อมใช้งานสมบูรณ์ |
| **5. Planning & Attendance PDF** | แพลนงานรายวัน, จัดสรรกำลังพล, Export ใบลงชื่อเข้าทำงาน PDF | ✅ พร้อมใช้งานสมบูรณ์ |
| **6. Namelist & Realtime Sync** | บันทึกรายชื่อรายวัน, Realtime Sync ข้ามเครื่อง, ตัวกรองกะตามเวลาจริง | ✅ พร้อมใช้งานสมบูรณ์ |
| **7. Reporting & Exports** | นำออก Excel Namelist ลูกค้า, Export OPS ID Portal, รายงานทะเบียนลูกค้า | ✅ พร้อมใช้งานสมบูรณ์ |
| **8. Performance & Optimization** | ปรับแต่งความเร็ว Trigram Indexing, Query Optimization, Dynamic Sorting | ✅ พร้อมใช้งานสมบูรณ์ |

> **สถานะปัจจุบัน**: ระบบพัฒนาเสร็จสมบูรณ์ครบถ้วน 100% พร้อมใช้งานจริงบน Production Environment
