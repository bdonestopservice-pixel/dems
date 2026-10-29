import { formatThaiDate } from './utils'
import type { Plan, PlanEmployee } from '@/types'

export interface PlanExportData {
  plan: Plan
  roster: PlanEmployee[]
  adminName?: string
}

/**
 * ส่งออกเอกสารลงเวลาการทำงาน (Attendance Sheet) เป็น PDF
 * - คลังที่ไม่ขึ้นต้นด้วย SCOM: ใช้ Template มาตรฐาน PeopleOne (A4 แนวนอน 15 แถวต่อใบ)
 * - คลังที่ขึ้นต้นด้วย SCOM: ใช้ Template เฉพาะของ Scommerce (A4 แนวนอน 40 แถวต่อใบ ตามแบบฟอร์ม F-HSE-039)
 * - รองรับพนักงานไม่จำกัดจำนวน: หากพนักงานเกินขนาด 1 ใบ จะรันต่อเป็นใบที่ 2, 3... พร้อมรันเลขลำดับและรายชื่อต่อเนื่องอัตโนมัติ
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
 * - รองรับการแบ่งหน้าอัตโนมัติ (15 แถวต่อใบ)
 * - รันลำดับที่และรายชื่อพนักงานต่อเนื่อง (เช่น ใบที่ 1: ลำดับ 1-15, ใบที่ 2: ลำดับ 16-30)
 * - โลโก้ PeopleOne ที่มุมขวาบน พร้อมระบุเลขใบ (ใบที่ 1/2, ใบที่ 2/2)
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

  // กำหนดจำนวนแถวต่อ 1 ใบ (15 แถวพอดีกับ 1 หน้า A4 แนวนอน รวมหัว-ท้ายเอกสาร)
  const ROWS_PER_PAGE = 15
  const totalItems = Math.max(roster.length, plan.required_count || 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE))

  const sheetsHtml: string[] = []

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageStartIndex = pageIndex * ROWS_PER_PAGE
    const pageEndIndex = pageStartIndex + ROWS_PER_PAGE
    const pageRowsHtml: string[] = []

    for (let i = pageStartIndex; i < pageEndIndex; i++) {
      const emp = roster[i]
      if (emp) {
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || '—'
        const opsId = emp.ops_id && emp.ops_id !== '—' ? emp.ops_id : ''
        const poId = emp.po_id && emp.po_id !== '—' ? emp.po_id : ''
        const phone = emp.phone && emp.phone !== '—' ? emp.phone : ''

        pageRowsHtml.push(`
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
        pageRowsHtml.push(`
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

    sheetsHtml.push(`
      <div class="sheet-wrapper sheet-page">
        <!-- Header Layout -->
        <div class="header-layout">
          <div>
            <div class="doc-main-title">
              เอกสารบันทึกเวลาการทำงาน และการทำงานล่วงเวลา
              ${totalPages > 1 ? `<span class="page-indicator">(ใบที่ ${pageIndex + 1}/${totalPages})</span>` : ''}
            </div>
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

          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <img src="${PEOPLEONE_LOGO_URL}" alt="People One" class="peopleone-logo" />
            ${totalPages > 1 ? `<span class="page-badge">ใบที่ ${pageIndex + 1} จาก ${totalPages}</span>` : ''}
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
            ${pageRowsHtml.join('')}
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
    `)
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
    html, body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      background: #f1f5f9;
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
      margin-bottom: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
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

    /* Screen view container */
    .sheets-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 0 16px 40px 16px;
    }

    .sheet-wrapper {
      width: 100%;
      max-width: 1100px;
      background: #fff;
      padding: 16px 20px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      position: relative;
    }

    @media print {
      html, body {
        background: #fff !important;
      }
      .print-actions {
        display: none !important;
      }
      .sheets-container {
        display: block !important;
        padding: 0 !important;
        gap: 0 !important;
      }
      .sheet-wrapper {
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        max-width: 100% !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .sheet-wrapper:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
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
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .page-indicator {
      font-size: 12px;
      font-weight: 600;
      color: #2563eb;
    }
    .page-badge {
      font-size: 11px;
      font-weight: 700;
      color: #1e3a8a;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 2px 8px;
      border-radius: 4px;
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
      margin-bottom: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
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
      margin-top: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Left: Signatures */
    .sig-section {
      flex: 1.35;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 2px;
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
      margin-top: 3px;
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
      height: 13px;
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
      gap: 6px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
    }
    .summary-table th, .summary-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      height: 15px;
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
      <span style="font-weight: 700; color: #1e293b;">เอกสารบันทึกเวลาการทำงาน (PeopleOne Template · A4 แนวนอน${totalPages > 1 ? ` · ทั้งหมด ${totalPages} ใบ` : ''})</span>
      <span style="color: #64748b; font-size: 11px; margin-left: 10px;">
        ${totalPages > 1
          ? `จำนวนพนักงาน ${roster.length} คน (เกินขนาด 1 ใบ ระบบแบ่งเป็น ${totalPages} ใบให้อัตโนมัติ)`
          : `สามารถคลิกปุ่มเพื่อพิมพ์ หรือเลือก 'Save as PDF' ในหน้าต่างสั่งพิมพ์`}
      </span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        พิมพ์ / บันทึกเป็น PDF ${totalPages > 1 ? `(${totalPages} ใบ)` : ''}
      </button>
    </div>
  </div>

  <div class="sheets-container">
    ${sheetsHtml.join('')}
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
 * Template สำหรับคลังที่ขึ้นต้นด้วย SCOM (A4 แนวนอน ตามแบบฟอร์ม F-HSE-039 ของ Scommerce / PeopleOne)
 * - 40 ลำดับต่อใบ (ตามที่ผู้ใช้กำหนด)
 * - โลโก้ PeopleOne และ Scommerce คู่กันที่มุมบนซ้าย
 * - แบบฟอร์มการอบรมด้านความปลอดภัย ฯ และบันทึกการทำงาน (Safety Training and working time Record Form)
 * - กล่องควบคุมเอกสารด้านขวา (F-HSE-039 / วันที่บังคับใช้ / หน้าที่ / ครั้งที่แก้ไข)
 * - ช่องข้อความยินยอม PDPA และหมายเหตุโรคประจำตัว
 * - คอลัมน์แยก "ชื่อ" และ "สกุล", เลขบัตรประชาชน, โอที (ทำโอที, ชั่วโมงโอที)
 * - รองรับการรันลำดับต่อเนื่องหลายใบอัตโนมัติ (เช่น ใบที่ 1: 1-40, ใบที่ 2: 41-80)
 */
function renderScomAttendanceSheet(printWindow: Window, data: PlanExportData) {
  const { plan, roster } = data

  const thaiDate = formatThaiDate(plan.date)
  const shiftText = plan.shift_start && plan.shift_end
    ? `${plan.shift_start} - ${plan.shift_end} (${plan.shift_type === 'N' ? 'กะดึก / Night' : 'กะกลางวัน / Day'})`
    : (plan.shift_start || plan.shift_end || '—')

  const SCOMMERCE_LOGO_URL = 'https://mjwrehbozsbbqfzdpjhu.supabase.co/storage/v1/object/public/images_logo/Scommerce.png'
  const PEOPLEONE_LOGO_URL = 'https://mjwrehbozsbbqfzdpjhu.supabase.co/storage/v1/object/public/images_logo/PeopleOne.png'

  // ผู้ใช้กำหนด 40 ลำดับต่อแผ่น
  const SCOM_ROWS_PER_PAGE = 40
  const totalItems = Math.max(roster.length, plan.required_count || 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / SCOM_ROWS_PER_PAGE))

  const sheetsHtml: string[] = []

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageStartIndex = pageIndex * SCOM_ROWS_PER_PAGE
    const pageEndIndex = pageStartIndex + SCOM_ROWS_PER_PAGE
    const pageRowsHtml: string[] = []

    for (let i = pageStartIndex; i < pageEndIndex; i++) {
      const emp = roster[i]
      if (emp) {
        const poId = emp.po_id && emp.po_id !== '—' ? emp.po_id : ''
        const firstName = emp.first_name || ''
        const lastName = emp.last_name || ''
        const idCard = emp.id_card && emp.id_card !== '—' ? emp.id_card : ''

        pageRowsHtml.push(`
          <tr>
            <td class="text-center font-bold seq-cell">${i + 1}</td>
            <td class="text-center font-mono">${poId}</td>
            <td class="pl-1 text-left name-cell">${firstName}</td>
            <td class="pl-1 text-left name-cell">${lastName}</td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center font-mono id-card-cell">${idCard}</td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center"></td>
            <td class="text-center"></td>
          </tr>
        `)
      } else {
        pageRowsHtml.push(`
          <tr class="empty-row">
            <td class="text-center text-gray-500 font-bold seq-cell">${i + 1}</td>
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

    sheetsHtml.push(`
      <div class="scom-sheet-wrapper sheet-page">
        <!-- Top Box Header -->
        <table class="scom-header-table">
          <tr>
            <!-- Left: Logos -->
            <td class="logo-box">
              <div class="logos-container">
                <img src="${PEOPLEONE_LOGO_URL}" alt="PeopleOne" class="logo-peopleone" />
                <img src="${SCOMMERCE_LOGO_URL}" alt="Scommerce" class="logo-scommerce" />
              </div>
            </td>

            <!-- Middle: Form Title -->
            <td class="title-box">
              <div class="title-th">แบบฟอร์มการอบรมด้านความปลอดภัย ฯ และบันทึกการทำงาน</div>
              <div class="title-en">(Safety Training and working time Record Form)</div>
            </td>

            <!-- Right: Doc Control Box -->
            <td class="doc-control-box">
              <div class="doc-company">บริษัท เอสคอมเมิร์ซ (ประเทศไทย) จำกัด</div>
              <table class="doc-control-grid">
                <tr>
                  <td class="doc-grid-cell">รหัสเอกสาร : F-HSE-039</td>
                  <td class="doc-grid-cell">หน้าที่ : ${pageIndex + 1}/${totalPages}</td>
                </tr>
                <tr>
                  <td class="doc-grid-cell">วันที่บังคับใช้ : 30/05/2023</td>
                  <td class="doc-grid-cell">ครั้งที่แก้ไข : 01</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Metadata Section (Full width bordered box) -->
        <table class="scom-meta-table">
          <tr>
            <td colspan="2">
              <span class="meta-label">วันที่และเวลาในการอบรม (Date & Time) : </span>
              <span class="meta-val">${thaiDate}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <span class="meta-label">ชื่อผู้อบรม (Trainer name) : </span>
              <span class="meta-val"></span>
            </td>
          </tr>
          <tr>
            <td style="width: 70%; border-right: 1px solid #000;">
              <span class="meta-label">แผนก (Department) : </span>
              <span class="meta-val font-bold">${plan.department_name || '—'}</span>
            </td>
            <td style="width: 30%;">
              <span class="meta-label">ยอดขอ : </span>
              <span class="meta-val font-bold">${plan.required_count || roster.length || '—'}</span>
              <span style="margin-left: 6px;">คน</span>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <span class="meta-label">เวลาในการทำงาน : </span>
              <span class="meta-val font-bold">${shiftText}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="disclaimer-cell">
              *ข้าพเจ้ายินยอมให้บริษัท ช้อปปี้ (ประเทศไทย) จำกัด (บริษัทฯ) เก็บ รวบรวม ใช้ ประมวลผล และ/หรือ เปิดเผยให้กับบริษัทในเครือ ซึ่งข้อมูลที่ข้าพเจ้าได้ให้ไว้ในเอกสารนี้ เพื่อวัตถุประสงค์ที่เกี่ยวเนื่องกับกระบวนการสมัครงานและประกอบการพิจารณาสรรหาว่าจ้างงาน ทั้งนี้ ข้าพเจ้ารับทราบว่าการดำเนินการกับข้อมูลส่วนบุคคลของข้าพเจ้านั้นจะเป็นไป ตามนโยบายของบริษัทฯ และกฎหมายคุ้มครองข้อมูลส่วนบุคคลที่ใช้บังคับ
            </td>
          </tr>
          <tr>
            <td colspan="2" class="note-cell">
              <strong>หมายเหตุ : </strong>กรณีมีโรคประจำตัว เช่น โรคหัวใจ ความดันสูง เบาหวาน หรืออื่น ๆ โปรดแจ้งก่อนเริ่มงาน หากพบว่ามีความเสี่ยงต่อลักษณะงานที่ทำบริษัทฯสามารถแจ้งให้หยุดงานได้
            </td>
          </tr>
        </table>

        <!-- Legend Table (Checkmark instructions) -->
        <table class="scom-legend-table">
          <tr>
            <td class="legend-symbol">✓</td>
            <td class="legend-text">ระบุเครื่องหมายถูก กรณีปกติ</td>
            <td class="legend-symbol">✕</td>
            <td class="legend-text">ระบุเครื่องหมายผิด กรณีผิดปกติ</td>
          </tr>
        </table>

        <!-- Main Attendance Table (40 rows) -->
        <table class="scom-attendance-table">
          <thead>
            <!-- Group Header Tier 1 -->
            <tr class="group-row">
              <th colspan="4" class="group-name-col">Name</th>
              <th colspan="11" class="group-subcontract-col">Sub-contractor name</th>
            </tr>

            <!-- Column Header Tier 2 -->
            <tr class="header-col-row">
              <th rowspan="2" class="th-seq">ลำดับ</th>
              <th rowspan="2" class="th-po">รหัสพนักงาน</th>
              <th rowspan="2" class="th-fname">ชื่อ</th>
              <th rowspan="2" class="th-lname">สกุล</th>
              <th rowspan="2" class="th-time">เวลาเข้า</th>
              <th rowspan="2" class="th-time">เวลาออก</th>
              <th rowspan="2" class="th-sign">ลงชื่อเข้า</th>
              <th rowspan="2" class="th-sign">ลงชื่อออก</th>
              <th rowspan="2" class="th-idcard">เลขบัตร</th>
              <th colspan="2" class="th-ot-group">โอที (OT)</th>
              <th rowspan="2" class="th-rest">ไม่ได้ทำงานต่อ<br/>เนื่อง ≥ 8 ชม. ก่อน<br/>มาเริ่มงานที่<br/>Shopee</th>
              <th rowspan="2" class="th-disease">ไม่มีโรคประจำ<br/>ตัว</th>
              <th rowspan="2" class="th-consent">*ข้าพเจ้า<br/>ให้ความ<br/>ยินยอม</th>
              <th rowspan="2" class="th-wage">ค่าจ้าง</th>
            </tr>

            <!-- Column Header Tier 3 (OT Sub-cols) -->
            <tr class="header-sub-row">
              <th class="th-ot-sub">ทำโอที</th>
              <th class="th-ot-sub">ชั่วโมง<br/>โอที</th>
            </tr>
          </thead>
          <tbody>
            ${pageRowsHtml.join('')}
          </tbody>
        </table>

        <!-- Signatures Bottom Section -->
        <div class="scom-signatures">
          <div class="sig-col">
            <span class="dots">......................................................................</span>
            <span class="sig-title">หัวหน้างาน</span>
          </div>
          <div class="sig-col">
            <span class="dots">......................................................................</span>
            <span class="sig-title">ผู้ตรวจสอบ</span>
          </div>
          <div class="sig-col">
            <span class="dots">......................................................................</span>
            <span class="sig-title">Subcontractor Admin</span>
          </div>
        </div>
      </div>
    `)
  }

  printWindow.document.write(`
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>แบบฟอร์มการอบรมด้านความปลอดภัยและบันทึกการทำงาน_${plan.warehouse}_${plan.department_name || ''}_${plan.date}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 3mm 5mm 3mm 5mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 8px;
      line-height: 1.15;
      color: #000;
      background: #f1f5f9;
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
      margin-bottom: 14px;
      position: sticky;
      top: 0;
      z-index: 100;
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

    /* Screen view wrapper */
    .sheets-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      padding: 0 12px 30px 12px;
    }
    .scom-sheet-wrapper {
      width: 100%;
      max-width: 1120px;
      background: #fff;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      position: relative;
    }

    @media print {
      html, body {
        background: #fff !important;
      }
      .print-actions {
        display: none !important;
      }
      .sheets-container {
        display: block !important;
        padding: 0 !important;
        gap: 0 !important;
      }
      .scom-sheet-wrapper {
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .scom-sheet-wrapper:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }

    /* Top Box Header Table */
    .scom-header-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 2px;
    }
    .scom-header-table td {
      border: 1px solid #000;
      vertical-align: middle;
      padding: 2px 6px;
    }
    .logo-box {
      width: 25%;
    }
    .logos-container {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
    }
    .logo-peopleone {
      height: 26px;
      max-width: 110px;
      object-fit: contain;
    }
    .logo-scommerce {
      height: 24px;
      max-width: 120px;
      object-fit: contain;
    }
    .title-box {
      width: 45%;
      text-align: center;
      padding: 4px 6px !important;
    }
    .title-th {
      font-size: 11.5px;
      font-weight: 700;
      line-height: 1.25;
      color: #000;
    }
    .title-en {
      font-size: 9px;
      font-weight: 600;
      line-height: 1.2;
      color: #000;
    }
    .doc-control-box {
      width: 30%;
      padding: 0 !important;
    }
    .doc-company {
      font-size: 8px;
      font-weight: 700;
      text-align: center;
      padding: 2.5px 4px;
      border-bottom: 1px solid #000;
    }
    .doc-control-grid {
      width: 100%;
      border-collapse: collapse;
    }
    .doc-grid-cell {
      border: none !important;
      font-size: 7.5px;
      padding: 1.5px 4px !important;
      white-space: nowrap;
    }

    /* Metadata Table */
    .scom-meta-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      font-size: 7.8px;
      margin-bottom: 2px;
    }
    .scom-meta-table td {
      border-bottom: 1px solid #000;
      padding: 1.5px 5px;
      height: 14px;
      vertical-align: middle;
    }
    .scom-meta-table tr:last-child td {
      border-bottom: none;
    }
    .meta-label {
      font-weight: 700;
    }
    .meta-val {
      font-weight: 500;
    }
    .disclaimer-cell {
      font-size: 6.2px;
      line-height: 1.15;
      padding: 1.5px 5px !important;
      text-align: justify;
    }
    .note-cell {
      font-size: 6.8px;
      line-height: 1.2;
      padding: 1.5px 5px !important;
    }

    /* Legend Table */
    .scom-legend-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      font-size: 7.5px;
      margin-bottom: 2px;
    }
    .scom-legend-table td {
      border: 1px solid #000;
      padding: 1px 4px;
      height: 13px;
      vertical-align: middle;
    }
    .legend-symbol {
      width: 24px;
      text-align: center;
      font-weight: 700;
      font-size: 9px;
    }
    .legend-text {
      width: 48%;
      padding-left: 6px;
    }

    /* Main Attendance Table (40 Rows) */
    .scom-attendance-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      font-size: 7.5px;
      margin-bottom: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .scom-attendance-table th, .scom-attendance-table td {
      border: 1px solid #000;
      padding: 0.5px 1.5px;
      vertical-align: middle;
      height: 11.2px;
      line-height: 1.1;
    }
    .scom-attendance-table th {
      background: #fff;
      font-weight: 700;
      text-align: center;
    }
    .group-row th {
      background: #D9E1F2 !important;
      font-size: 8px;
      padding: 1.5px 0;
      font-weight: 700;
    }
    .header-col-row th {
      font-size: 7px;
      padding: 1px 0.5px;
    }
    .header-sub-row th {
      font-size: 6.8px;
      padding: 1px 0.5px;
    }

    /* Column Widths */
    .th-seq { width: 22px; }
    .th-po { width: 56px; }
    .th-fname { width: 72px; }
    .th-lname { width: 72px; }
    .th-time { width: 34px; }
    .th-sign { width: 48px; }
    .th-idcard { width: 82px; }
    .th-ot-group { width: 64px; }
    .th-ot-sub { width: 32px; }
    .th-rest { width: 74px; }
    .th-disease { width: 56px; }
    .th-consent { width: 56px; }
    .th-wage { width: 40px; }

    .seq-cell { font-size: 7.5px; }
    .name-cell {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 72px;
    }
    .id-card-cell {
      font-size: 7px;
      letter-spacing: -0.2px;
    }

    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: monospace; }
    .pl-1 { padding-left: 3px !important; }

    /* Signatures Bottom */
    .scom-signatures {
      width: 100%;
      display: flex;
      justify-content: space-around;
      align-items: center;
      margin-top: 6px;
      padding-top: 2px;
      font-size: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-col {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .dots {
      color: #000;
      font-size: 8px;
      letter-spacing: 0.5px;
    }
    .sig-title {
      font-weight: 700;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <div>
      <span style="font-weight: 700; color: #1e293b;">แบบฟอร์มการอบรมด้านความปลอดภัย ฯ และบันทึกการทำงาน (Scommerce Template · A4 แนวนอน${totalPages > 1 ? ` · ทั้งหมด ${totalPages} ใบ` : ''})</span>
      <span style="color: #64748b; font-size: 11px; margin-left: 10px;">
        ${totalPages > 1
          ? `จำนวนพนักงาน ${roster.length} คน (40 คนต่อแผ่น ระบบแบ่งเป็น ${totalPages} ใบให้อัตโนมัติ)`
          : `พิมพ์ 40 ลำดับต่อแผ่น ตามแบบฟอร์ม F-HSE-039`}
      </span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        พิมพ์ / บันทึกเป็น PDF ${totalPages > 1 ? `(${totalPages} ใบ)` : ''}
      </button>
    </div>
  </div>

  <div class="sheets-container">
    ${sheetsHtml.join('')}
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
