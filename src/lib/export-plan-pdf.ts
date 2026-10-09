import { formatThaiDate } from './utils'
import type { Plan, PlanEmployee } from '@/types'

export interface PlanExportData {
  plan: Plan
  roster: PlanEmployee[]
}

/**
 * Open a beautifully formatted A4 printable attendance sheet (ใบลงเวลาการทำงาน)
 * with complete Thai font support, crisp vector styling, signature lines,
 * and automatic print dialog for saving directly as PDF.
 */
export function exportPlanAttendanceSheet(data: PlanExportData) {
  const { plan, roster } = data

  const thaiDate = formatThaiDate(plan.date)
  const shiftText = plan.shift_start && plan.shift_end
    ? `${plan.shift_start} - ${plan.shift_end} (${plan.shift_type === 'N' ? 'กะดึก / Night' : 'กะกลางวัน / Day'})`
    : '—'
  const printTimestamp = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Rows to render: actual roster employees + optional blank rows if required_count > roster.length
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
      // Empty row for unfilled quota
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

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัปเพื่อพิมพ์/ดาวน์โหลดเอกสาร PDF')
    return
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
      <span style="font-weight: 600; color: #1e293b;">ตัวอย่างใบลงเวลาการทำงาน (A4)</span>
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
        <div style="font-weight: 600; color: #334155;">ผู้จัดทำแพลน / เจ้าหน้าที่หัวหน้างาน</div>
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
    // Automatically trigger print dialog on page load
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
