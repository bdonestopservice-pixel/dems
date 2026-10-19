import { formatThaiDate } from './utils'
import type { Plan, PlanEmployee } from '@/types'

export interface PlanExportData {
  plan: Plan
  roster: PlanEmployee[]
  adminName?: string
}

/**
 * ส่งออกเอกสารลงเวลาการทำงาน (Attendance Sheet) เป็น PDF
 * - คลังที่ไม่ขึ้นต้นด้วย SCOM: ใช้ Template มาตรฐาน PeopleOne (A4 แนวนอน พร้อมโลโก้ PeopleOne, ตารางบันทึกเวลา, ตารางเหตุผล, สรุป และลายเซ็น)
 * - คลังที่ขึ้นต้นด้วย SCOM: ใช้ Template ของ SCOM (แบบแนวตั้งเดิม จนกว่าผู้ใช้จะส่ง Template ใหม่มาให้)
 */
export function exportPlanAttendanceSheet(data: PlanExportData) {
  const { plan } = data
  const isScom = (plan.warehouse || '').trim().toUpperCase().startsWith('SCOM')

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัปเพื่อพิมพ์/ดาวน์โหลดเอกสาร PDF')
    return
  }

  if (isScom) {
    renderScomAttendanceSheet(printWindow, data)
  } else {
    renderStandardPeopleOneAttendanceSheet(printWindow, data)
  }
}

/**
 * Template สำหรับคลังทั่วไป (ที่ไม่ขึ้นต้นด้วย SCOM):
 * - A4 แนวนอน (Landscape)
 * - โลโก้ PeopleOne ที่มุมขวาบน
 * - ตารางบันทึกเวลาและการทำงานล่วงเวลา (มีคอลัมน์พนักงานทดแทน, โอที, โอน/สลับการทำงาน)
 * - ตารางรหัสเหตุผล (01-11)
 * - กล่องสรุปจำนวนพนักงาน และ OT
 * - จุดลงลายมือชื่อ Checked by (Admin Sub, SPX Admin, SPX Supervisor)
 */
function renderStandardPeopleOneAttendanceSheet(printWindow: Window, data: PlanExportData) {
  const { plan, roster, adminName } = data

  const thaiDate = formatThaiDate(plan.date)
  const shiftText = plan.shift_start && plan.shift_end
    ? `${plan.shift_start} - ${plan.shift_end} (${plan.shift_type === 'N' ? 'กะดึก / Night' : 'กะกลางวัน / Day'})`
    : (plan.shift_start || plan.shift_end || '—')

  const PEOPLEONE_LOGO_URL = 'https://mjwrehbozsbbqfzdpjhu.supabase.co/storage/v1/object/public/images_logo/PeopleOne.png'

  // แถวที่แสดง: พนักงานในแพลนจริง + แถวว่างให้ครบโควต้า หรืออย่างน้อย 15 แถวเพื่อให้มีพื้นที่เขียนพนักงานทดแทน
  const totalRowsCount = Math.max(roster.length, plan.required_count || 0, 15)
  const rowsHtml: string[] = []

  for (let i = 0; i < totalRowsCount; i++) {
    const emp = roster[i]
    if (emp) {
      const fullName = `${emp.prefix ? emp.prefix + ' ' : ''}${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'
      const opsId = emp.ops_id && emp.ops_id !== '—' ? emp.ops_id : ''
      const poId = emp.po_id && emp.po_id !== '—' ? emp.po_id : ''
      const phone = emp.phone && emp.phone !== '—' ? emp.phone : ''

      rowsHtml.push(`
        <tr>
          <td class="text-center font-bold">${i + 1}</td>
          <td class="text-center font-mono">${opsId}</td>
          <td class="text-center font-mono font-bold">${poId}</td>
          <td class="pl-2 text-left emp-name">${fullName}</td>
          <td class="text-center">${phone}</td>
          <!-- ส่วนพนักงานทดแทน (เว้นว่างไว้เขียนมือ) -->
          <td class="text-center"></td>
          <td class="text-center"></td>
          <td class="text-center"></td>
          <!-- ลงชื่อ -->
          <td></td>
          <td></td>
          <!-- ทำงานล่วงเวลา เริ่ม / สิ้นสุด -->
          <td></td>
          <td></td>
          <!-- ชม. 1.5, 2, 3 -->
          <td></td>
          <td></td>
          <td></td>
          <!-- โอน/สลับงาน 3 ช่อง -->
          <td></td>
          <td></td>
          <td></td>
          <!-- ผู้ตรวจสอบ -->
          <td></td>
        </tr>
      `)
    } else {
      // แถวว่างสำหรับโควต้าที่เหลือ หรือเขียนพนักงานทดแทน
      rowsHtml.push(`
        <tr class="empty-row">
          <td class="text-center text-gray-500 font-bold">${i + 1}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `)
    }
  }

  printWindow.document.write(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>เอกสารบันทึกเวลาการทำงาน_${plan.warehouse}_${plan.department_name || ''}_${plan.date}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 8mm 6mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .print-actions {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .btn {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
    }
    .btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #fff;
      border-color: #cbd5e1;
      color: #475569;
    }
    @media print {
      .print-actions {
        display: none !important;
      }
    }

    .sheet-wrapper {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }

    /* Header Bar */
    .header-layout {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }
    .doc-main-title {
      font-size: 14px;
      font-weight: 700;
      color: #000;
      margin-bottom: 6px;
    }
    .peopleone-logo {
      height: 38px;
      max-width: 170px;
      object-fit: contain;
    }

    /* Metadata Table */
    .meta-table {
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 6px;
    }
    .meta-table td {
      border: 1px solid #000;
      padding: 2.5px 8px;
      height: 20px;
    }
    .meta-label {
      font-weight: 700;
      text-align: center;
      width: 60px;
      background: #f8fafc;
    }
    .meta-val {
      text-align: center;
      min-width: 170px;
      font-weight: 500;
    }
    .meta-blank-col {
      width: 70px;
      background: #fff;
    }

    /* Main Attendance Table */
    .main-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 8px;
    }
    .main-table th, .main-table td {
      border: 1px solid #000;
      padding: 3px 2px;
      vertical-align: middle;
      height: 18px;
    }
    .main-table th {
      background: #fff;
      font-weight: 700;
      text-align: center;
      line-height: 1.15;
    }
    .main-table td.emp-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }
    .main-table tr.empty-row td {
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: monospace; font-size: 8.5px; }
    .pl-2 { padding-left: 5px !important; }

    /* Footer layout */
    .footer-layout {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-top: 6px;
      page-break-inside: avoid;
    }

    /* Left: Signatures */
    .sig-section {
      flex: 1.35;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 4px;
    }
    .sig-row {
      font-size: 10px;
    }
    .sig-line-text {
      white-space: nowrap;
    }
    .sig-role {
      font-weight: 700;
      text-align: center;
      margin-top: 4px;
      width: 85%;
    }
    .admin-name-red {
      color: #dc2626;
      font-weight: 700;
    }

    /* Center: Reason Code Table */
    .reason-section {
      flex: 1.45;
    }
    .reason-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
    }
    .reason-table th, .reason-table td {
      border: 1px solid #000;
      padding: 1.5px 3px;
      height: 14px;
      line-height: 1.15;
    }
    .reason-table th {
      background: #f1f5f9;
      font-weight: 700;
      text-align: center;
    }

    /* Right: Summary Tables */
    .summary-section {
      flex: 1.15;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
    }
    .summary-table th, .summary-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      height: 16px;
    }
    .summary-table th {
      background: #FCE4D6;
      color: #000;
      font-weight: 700;
      text-align: center;
      font-size: 8.5px;
      line-height: 1.15;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <div>
      <span style="font-weight: 700; color: #1e293b;">เอกสารบันทึกเวลาการทำงาน (PeopleOne Template · A4 แนวนอน)</span>
      <span style="color: #64748b; font-size: 11px; margin-left: 10px;">สามารถคลิกปุ่มเพื่อพิมพ์ หรือเลือก 'Save as PDF' ในหน้าต่างสั่งพิมพ์</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <!-- Header Layout -->
    <div class="header-layout">
      <div>
        <div class="doc-main-title">เอกสารบันทึกเวลาการทำงาน และการทำงานล่วงเวลา</div>
        <table class="meta-table">
          <tr>
            <td class="meta-label">วันที่</td>
            <td class="meta-val">${thaiDate}</td>
            <td class="meta-blank-col" rowspan="3"></td>
          </tr>
          <tr>
            <td class="meta-label">แผนก</td>
            <td class="meta-val">${plan.department_name || '—'}</td>
          </tr>
          <tr>
            <td class="meta-label">กะ</td>
            <td class="meta-val">${shiftText}</td>
          </tr>
        </table>
      </div>

      <div>
        <img src="${PEOPLEONE_LOGO_URL}" alt="People One" class="peopleone-logo" />
      </div>
    </div>

    <!-- Main Attendance Table -->
    <table class="main-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 26px;">ลำดับ</th>
          <th rowspan="2" style="width: 48px;">OPSID</th>
          <th rowspan="2" style="width: 62px;">รหัสพนักงาน</th>
          <th rowspan="2" style="width: 125px;">ชื่อ - นามสกุล</th>
          <th rowspan="2" style="width: 68px;">โทร</th>
          <th rowspan="2" style="width: 48px;">OPSID<br/>พนักงาน<br/>ทดแทน</th>
          <th rowspan="2" style="width: 62px;">รหัสพนักงาน<br/>ทดแทน</th>
          <th rowspan="2" style="width: 120px;">ชื่อ - นามสกุล<br/>(พนักงานทดแทน)</th>
          <th rowspan="2" style="width: 60px;">ลงชื่อ<br/>เข้างาน</th>
          <th rowspan="2" style="width: 60px;">ลงชื่อ<br/>เลิกงาน</th>
          <th colspan="2">ทำงานล่วงเวลา</th>
          <th colspan="3">รวมเวลาทำงาน<br/>ช่วงเวลา (ชม.)</th>
          <th colspan="3">โอนการทำงาน/สลับการทำงาน<br/>(โปรดทำเครื่องหมาย)</th>
          <th rowspan="2" style="width: 62px;">ลงชื่อ<br/>ผู้ตรวจสอบ<br/>เพื่อนร่วมงาน</th>
        </tr>
        <tr>
          <th style="width: 36px;">เริ่ม</th>
          <th style="width: 36px;">สิ้นสุด</th>
          <th style="width: 32px;">1.5 เท่า</th>
          <th style="width: 30px;">2 เท่า</th>
          <th style="width: 30px;">3 เท่า</th>
          <th style="width: 22px;"></th>
          <th style="width: 22px;"></th>
          <th style="width: 22px;"></th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml.join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="12" style="text-align: right; font-weight: 700; font-size: 9px; padding-right: 6px;">Total</td>
          <td></td>
          <td></td>
          <td></td>
          <td colspan="3"></td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <!-- Footer Section -->
    <div class="footer-layout">
      <!-- Section 1: Signatures -->
      <div class="sig-section">
        <div class="sig-row">
          <div class="sig-line-text">Checked by : .............................................................. Date ...................................</div>
          <div class="sig-role">Admin Sub (<span class="admin-name-red">${adminName || 'ชื่อAdmin'}</span>)</div>
        </div>
        <div class="sig-row">
          <div class="sig-line-text">Checked by : .............................................................. Date ...................................</div>
          <div class="sig-role">SPX Admin</div>
        </div>
        <div class="sig-row">
          <div class="sig-line-text">Checked by : .............................................................. Date ...................................</div>
          <div class="sig-role">SPX Supervisor</div>
        </div>
      </div>

      <!-- Section 2: Reason Code Table -->
      <div class="reason-section">
        <table class="reason-table">
          <thead>
            <tr>
              <th style="width: 22px;">[✓]</th>
              <th style="width: 28px;">Code</th>
              <th>Reason (TH)</th>
              <th>Reason (EN)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td class="text-center"></td><td class="text-center font-mono">01</td><td>OT วันหยุด</td><td>Holiday</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">02</td><td>ปริมาณงานเกินคาดหมาย</td><td>Over forecast</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">03</td><td>พนักงานขาด</td><td>MPW shortage</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">04</td><td>รถมาล่าช้า หรือจำนวนรถไม่เพียงพอ</td><td>Truck late / Truck shortage</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">05</td><td>ซัพพอร์ตงานแผนกอื่น</td><td>Support other team</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">06</td><td>เคลียร์งานตกค้าง</td><td>Clear backlog</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">07</td><td>เลื่อนเวลาปิดงาน / รอบปล่อยงาน</td><td>Cut off late / Last truck late</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">08</td><td>เพิ่มวิธีการทำงาน</td><td>Special process</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">09</td><td>ระบบ FMS มีปัญหา</td><td>FMS issued</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">10</td><td>ASM มีปัญหา</td><td>Machine issued</td></tr>
            <tr><td class="text-center"></td><td class="text-center font-mono">11</td><td>อื่นๆ</td><td>Other</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Section 3: Summary Boxes -->
      <div class="summary-section">
        <!-- Staff Summary -->
        <table class="summary-table">
          <thead>
            <tr>
              <th colspan="2">สรุปจำนวนพนักงาน (Summary of Staff)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="width: 145px;">จำนวนพนักงานประจำ</td>
              <td style="width: 45px; text-align: center; font-weight: 700;">${roster.length}</td>
            </tr>
            <tr>
              <td>จำนวนพนักงานที่มาทำงานตรงตามเวลาทำงาน</td>
              <td style="text-align: center;"></td>
            </tr>
            <tr>
              <td>จำนวนพนักงานที่ไม่ได้เริ่มงานในแพลน</td>
              <td style="text-align: center;"></td>
            </tr>
            <tr>
              <td style="font-weight: 700;">สรุปจำนวนพนักงานทั้งหมด</td>
              <td style="text-align: center; font-weight: 700;">${plan.required_count || roster.length}</td>
            </tr>
          </tbody>
        </table>

        <!-- OT Summary -->
        <table class="summary-table">
          <thead>
            <tr>
              <th colspan="2">สรุปจำนวน OT (Summary of OT)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="width: 145px;">จำนวนพนักงานที่ทำ OT</td>
              <td style="width: 45px; text-align: center;"></td>
            </tr>
            <tr>
              <td>จำนวน OT ทั้งหมด</td>
              <td style="text-align: center;"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `)
  printWindow.document.close()
}

/**
 * Template สำหรับคลังที่ขึ้นต้นด้วย SCOM (ใช้แบบเดิมแนวตั้งชั่วคราว จนกว่าผู้ใช้จะส่ง Template เฉพาะมาให้)
 */
function renderScomAttendanceSheet(printWindow: Window, data: PlanExportData) {
  const { plan, roster, adminName } = data

  const thaiDate = formatThaiDate(plan.date)
  const shiftText = plan.shift_start && plan.shift_end
    ? `${plan.shift_start} - ${plan.shift_end} (${plan.shift_type === 'N' ? 'กะดึก / Night' : 'กะกลางวัน / Day'})`
    : '—'
  const printTimestamp = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const totalRowsCount = Math.max(roster.length, plan.required_count || 0)
  const rowsHtml: string[] = []

  for (let i = 0; i < totalRowsCount; i++) {
    const emp = roster[i]
    if (emp) {
      const fullName = `${emp.prefix ? emp.prefix + ' ' : ''}${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'
      rowsHtml.push(`
        <tr>
          <td class="text-center font-bold text-gray-500">${i + 1}</td>
          <td class="text-center font-mono font-medium">${emp.po_id || '—'}</td>
          <td class="font-medium">${fullName}</td>
          <td class="text-center">${emp.position || plan.department_name || '—'}</td>
          <td class="text-center">${emp.phone || '—'}</td>
          <td class="text-center sign-col"></td>
          <td class="text-center sign-col"></td>
          <td class="text-center sign-col"></td>
          <td></td>
        </tr>
      `)
    } else {
      rowsHtml.push(`
        <tr class="empty-row">
          <td class="text-center text-gray-400">${i + 1}</td>
          <td class="text-center text-gray-300">—</td>
          <td class="text-gray-300 italic">(ว่าง / รอจัดสรร)</td>
          <td class="text-center text-gray-300">${plan.department_name || '—'}</td>
          <td class="text-center text-gray-300">—</td>
          <td class="sign-col"></td>
          <td class="sign-col"></td>
          <td class="sign-col"></td>
          <td></td>
        </tr>
      `)
    }
  }

  printWindow.document.write(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ใบลงเวลาการทำงาน_${plan.warehouse}_${plan.department_name}_${plan.date}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #1a1a1a;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .print-actions {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
    }
    .btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #fff;
      border-color: #cbd5e1;
      color: #475569;
    }
    @media print {
      .print-actions {
        display: none !important;
      }
    }
    .sheet-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .doc-title {
      font-size: 20px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0 0 3px 0;
    }
    .doc-subtitle {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 16px;
      font-size: 13px;
    }
    .meta-item {
      display: flex;
      gap: 6px;
    }
    .meta-label {
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 500;
    }
    .attendance-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .attendance-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      padding: 7px 6px;
      text-align: center;
      vertical-align: middle;
    }
    .attendance-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      vertical-align: middle;
      color: #1e293b;
    }
    .empty-row td {
      background: #fafafa;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .font-mono { font-family: monospace; }
    .sign-col {
      width: 80px;
      min-width: 80px;
    }
    .sign-section {
      margin-top: 30px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px;
      font-size: 12px;
      page-break-inside: avoid;
    }
    .sign-box {
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 14px 20px;
      text-align: center;
      background: #fafafa;
    }
    .sign-line {
      margin: 30px auto 10px auto;
      border-bottom: 1px solid #64748b;
      width: 70%;
    }
    .footer-note {
      margin-top: 20px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <div>
      <span style="font-weight: 600; color: #1e293b;">ตัวอย่างใบลงเวลาการทำงานคลัง SCOM (A4 แนวตั้ง)</span>
      <span style="color: #64748b; font-size: 12px; margin-left: 10px;">สามารถคลิกปุ่มเพื่อพิมพ์ หรือเลือก 'Save as PDF' ในหน้าต่างสั่งพิมพ์</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>
  </div>

  <div class="sheet-container">
    <table class="header-table">
      <tr>
        <td>
          <h1 class="doc-title">ใบลงเวลาปฏิบัติงานประจำวัน (Daily Attendance Sheet)</h1>
          <p class="doc-subtitle">ระบบบริหารจัดการพนักงานรายวัน (DEMS) · Daily Employee Management System</p>
        </td>
        <td class="text-right" style="vertical-align: top;">
          <span style="display: inline-block; padding: 4px 10px; background: #eff6ff; color: #1d4ed8; font-weight: 700; border-radius: 6px; font-size: 12px;">
            คลัง: ${plan.warehouse}
          </span>
        </td>
      </tr>
    </table>

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">วันที่ทำงาน:</span>
        <span class="meta-val">${thaiDate}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">คลัง/สาขา:</span>
        <span class="meta-val">${plan.warehouse_name || plan.warehouse}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">แผนก:</span>
        <span class="meta-val font-bold" style="color: #1e40af;">${plan.department_name || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">กะการทำงาน:</span>
        <span class="meta-val">${shiftText}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">จำนวนตามแพลน:</span>
        <span class="meta-val font-bold">${plan.required_count} คน</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">จำนวนในรายชื่อ:</span>
        <span class="meta-val font-bold" style="color: ${roster.length >= plan.required_count ? '#16a34a' : '#d97706'};">
          ${roster.length} คน ${roster.length >= plan.required_count ? '(ครบตามแพลน)' : `(ขาด ${plan.required_count - roster.length} คน)`}
        </span>
      </div>
    </div>

    <table class="attendance-table">
      <thead>
        <tr>
          <th style="width: 38px;">ลำดับ</th>
          <th style="width: 85px;">รหัสพนักงาน</th>
          <th>ชื่อ - นามสกุล</th>
          <th style="width: 95px;">แผนก / หน้าที่</th>
          <th style="width: 95px;">เบอร์โทรศัพท์</th>
          <th style="width: 65px;">เวลาเข้า</th>
          <th style="width: 65px;">เวลาออก</th>
          <th style="width: 100px;">ลายมือชื่อ</th>
          <th style="width: 80px;">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml.join('')}
      </tbody>
    </table>

    <div class="sign-section">
      <div class="sign-box">
        <div style="font-weight: 600; color: #334155;">ผู้จัดทำแพลน / Admin Sub (${adminName || 'Admin'})</div>
        <div class="sign-line"></div>
        <div>(.......................................................................)</div>
        <div style="margin-top: 6px; color: #64748b;">วันที่ ..... / ..... / .........</div>
      </div>
      <div class="sign-box">
        <div style="font-weight: 600; color: #334155;">ผู้ตรวจสอบ / ผู้รับรองการปฏิบัติงาน</div>
        <div class="sign-line"></div>
        <div>(.......................................................................)</div>
        <div style="margin-top: 6px; color: #64748b;">วันที่ ..... / ..... / .........</div>
      </div>
    </div>

    <div class="footer-note">
      <span>DEMS System · ออกรายงานเมื่อ: ${printTimestamp}</span>
      <span>* สำหรับพิมพ์และให้พนักงานลงลายมือชื่อก่อนส่งเข้า Namelist ประจำวัน</span>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>
  `)
  printWindow.document.close()
}
