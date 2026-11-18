/**
 * ข้อมูล Dropdown สำหรับสังกัด OPS ID (อ้างอิงจาก dropdown_lists.xlsx)
 * ใช้สำหรับการกรอกข้อมูลพนักงานและ Export OPS ID ส่งให้ลูกค้า
 * หมายเหตุ: ไม่เกี่ยวกับแผนกภายในของระบบ DEMS (departments table)
 */

export const OPS_CONTRACT_TYPES = [
  "Hub agent subcon(Part-time)",
  "Hub agent subcon(Full-time)",
  "Agency Full-time",
  "Agency Part-time"
] as const

export type OpsContractType = typeof OPS_CONTRACT_TYPES[number]

export const OPS_DEPARTMENTS: string[] = [
  "SPX HR Ops",
  "Product_Live_Test",
  "Subcon MFM Tech",
  "Subcon MFM PSAdminM",
  "Subcon MFM PSAdminA",
  "Subcon MFM PSRW",
  "Subcon MFM PSMS",
  "Subcon MFM PS4PL",
  "Subcon MFM PSOB",
  "Subcon MFM PSSS",
  "Subcon MFM PSIB",
  "Subcon Translator",
  "Subcon MS x OBS 8hrs",
  "Subcon OBS x MS 8hrs",
  "Subcon CBS x OBS 8hrs",
  "Subcon OBS x CBS 8hrs",
  "Subcon IB x OBS 8hrs",
  "Subcon OBS x IB 8hrs",
  "Subcon M_Sack 8hrs",
  "SPX NERC-B HSE",
  "SPX SORC-B HSE",
  "SPX SORC-A HSE",
  "SPX NORC-B HSE",
  "SPX NORC-A HSE",
  "SPX FSOCW Senior",
  "SPX FSOCW Associate",
  "Ground Recruitment Support",
  "Ground Onsite Recruiter",
  "SPX Presort - Inbound",
  "SPX Cache Senior",
  "SPX Cache Junior",
  "SPX NORC-B Area",
  "SPX NORC-A Area",
  "SPX NERC-C Area",
  "SPX NERC-B Area",
  "SPX NERC-A Area",
  "SPX SORC-B Area",
  "SPX SORC-A Area",
  "SPX Asset Senior",
  "SPX Asset Junior",
  "SPX Admin Asset",
  "SPX Admin MPW",
  "SPX Presort - Sorting",
  "SPX Presort - Outbound",
  "SPX Presort Inbound",
  "Burmese Supervisor SS",
  "Burmese Supervisor OB",
  "Burmese Supervisor 4PL",
  "Burmese Supervisor OBC",
  "Burmese Supervisor OBI",
  "Burmese Supervisor Helper",
  "Burmese Supervisor FSOCN",
  "Burmese Supervisor RW",
  "Burmese Supervisor RT",
  "Burmese Supervisor OBD",
  "Burmese Supervisor OBS",
  "Burmese Supervisor MS",
  "Burmese Supervisor mCBS",
  "Burmese Supervisor CBS",
  "Burmese Supervisor IB",
  "Burmese Supervisor FSOCE",
  "SPX SORC-B Senior",
  "SPX FSOCE Maintenance Junior",
  "SPX FSOCW Maintenance Junior",
  "SPX FSOCW Outbound Senior",
  "SPX FSOCW Outbound Junior",
  "SPX FSOCW Sorting Junior",
  "SPX FSOCW Inbound Junior",
  "SPX FSOCW Inbound Senior",
  "SPX SORC-B Junior",
  "SPX SORC-A Senior",
  "SPX SORC-A Junior",
  "SPX NORC-B Junior",
  "SPX NORC-B Senior",
  "SPX NORC-A Senior",
  "SPX NORC-A Junior",
  "SPX NERC-C Senior",
  "SPX NERC-C Junior",
  "SPX NERC-B Senior",
  "SPX NERC-B Junior",
  "SPX NERC-A Junior",
  "SPX NERC-A Senior",
  "SPX Outbound Induction Senior",
  "SPX Cross Border Return Junior",
  "SPX SIP Junior",
  "SPX Sorting Senior",
  "SPX Outbound Senior",
  "SPX Line Haul Senior",
  "SPX Own Fleet Senior",
  "SPX Own Fleet Junior",
  "SPX Maintenance Senior",
  "SPX Maintenance Junior",
  "SPX Administration Senior",
  "SPX Administration Junior",
  "Subcon New Face",
  "SPX Cache",
  "SPX NORC-B Line Haul",
  "SPX NORC-B Maintenance",
  "SPX NORC-B",
  "SPX NORC-A Line Haul",
  "SPX NORC-A Maintenance",
  "SPX NORC-A",
  "SPX NERC-C Line Haul",
  "SPX NERC-C Maintenance",
  "SPX NERC-C",
  "SPX NERC-B Line Haul",
  "SPX NERC-B Maintenance",
  "SPX NERC-B",
  "SPX NERC-A Line Haul",
  "SPX NERC-A Maintenance",
  "SPX NERC-A",
  "SPX SORC-B Line Haul",
  "SPX SORC-B Maintenance",
  "SPX SORC-B",
  "SPX SORC-A Line Haul",
  "SPX SORC-A Maintenance",
  "SPX SORC-A",
  "SPX Sorting Junior",
  "SPX Outbound Junior",
  "SPX SIP Senior",
  "SPX Outbound Induction Junior",
  "SPX FSOCN Senior",
  "SPX FSOCN Junior",
  "SPX Cross Border Return Senior",
  "SPX 4PL Senior",
  "SPX 4PL Junior",
  "SPX Rework Senior",
  "SPX Rework Junior",
  "SPX Return Senior",
  "SPX Return Junior",
  "SPX Outbound Sort Senior",
  "SPX Outbound Sort Junior",
  "SPX Outbound Dispatch Senior",
  "SPX Outbound Dispatch Junior",
  "SPX Mini Crossbelt Sort Senior",
  "SPX Mini Crossbelt Sort Junior",
  "SPX Manual Sort Senior",
  "SPX Manual Sort Junior",
  "SPX Line Haul Junior",
  "SPX Inbound Senior",
  "SPX Inbound Junior",
  "SPX FSOCE Senior",
  "SPX FSOCE Junior",
  "SPX Crossbelt Sort Senior",
  "SPX Crossbelt Sort Junior",
  "Subcon Cache",
  "Subcon NORC-B Line Haul",
  "Subcon NORC-B",
  "Subcon NORC-A Line Haul",
  "Subcon NORC-A",
  "Subcon NERC-C Line Haul",
  "Subcon NERC-C",
  "Subcon NERC-B Line Haul",
  "Subcon NERC-B",
  "Subcon NERC-A Line Haul",
  "Subcon NERC-A",
  "Subcon SORC-B Line Haul",
  "Subcon SORC-B",
  "Subcon SORC-A Line Haul",
  "Subcon SORC-A",
  "Subcon OB 10hrs",
  "Subcon OB 8hrs",
  "Subcon SS 10hrs",
  "Subcon SS 8hrs",
  "Subcon 4PL 10hrs",
  "Subcon 4PL 8hrs",
  "Subcon CB 10hrs",
  "Subcon CB 8hrs",
  "Subcon FSOCN 10hrs",
  "Subcon FSOCN 8hrs",
  "Subcon OBC 10hrs",
  "Subcon OBC 8hrs",
  "Subcon OBI 10hrs",
  "Subcon OBI 8hrs",
  "Subcon SIP 10hrs",
  "Subcon SIP 8hrs",
  "Subcon AdminM 10hrs",
  "Subcon AdminM 8hrs",
  "Subcon AdminA 10hrs",
  "Subcon AdminA 8hrs",
  "Subcon AdminLH 10hrs",
  "Subcon AdminLH 8hrs",
  "Subcon CBS 10hrs",
  "Subcon CBS 8hrs",
  "Subcon FSOCE 10hrs",
  "Subcon FSOCE 8hrs",
  "Subcon Helper 10hrs",
  "Subcon Helper 8hrs",
  "Subcon HVL 10hrs",
  "Subcon HVL 8hrs",
  "Subcon IB 10hrs",
  "Subcon IB 8hrs",
  "Subcon mCBS 10hrs",
  "Subcon mCBS 8hrs",
  "Subcon MS 10hrs",
  "Subcon MS 8hrs",
  "Subcon MS-B 10hrs",
  "Subcon MS-B 8hrs",
  "Subcon OBD 10hrs",
  "Subcon OBD 8hrs",
  "Subcon OBS 10hrs",
  "Subcon OBS 8hrs",
  "Subcon RT 10hrs",
  "Subcon RT 8hrs",
  "Subcon RW 10hrs",
  "Subcon RW 8hrs",
  "Subcon Tech 10hrs",
  "Subcon Tech 8hrs",
  "Seller Agent (Part-time)",
  "Seller agent (Full-time)",
  "SOC agent",
  "Hub Agent (Part-time)",
  "Hub Agent (Full-time)",
  "RC agent",
  "RC Supervisor",
  "RC Senior Agent",
  "SOC Supervisor",
  "SOC Senior Agent",
  "Parcel Shop Area Manager",
  "Parcel Shop Lead",
  "Product Test",
  "FM Onsite",
  "MM (RC)",
  "Operator account",
  "CTO (Hubs)",
  "Subcon Agent",
  "Area Manager",
  "Hub Assistant Supervisor",
  "Onsite Supervisor",
  "Onsite Senior Agent",
  "Parcel Shop Agent",
  "Onsite Agent",
  "RC Ops",
  "SOC Ops",
  "Hub Agent",
  "Hub Senior Agent",
  "Hub Supervisor",
  "MM Ops",
  "MM Operation Support",
  "Last Mile"
]

export const OPS_DESIGNATIONS_MAP: Record<string, string[]> = {
  "SPX HR Ops": [
    "SPX HR Ops"
  ],
  "Product_Live_Test": [
    "Product Test"
  ],
  "Subcon MFM Tech": [
    "Technician"
  ],
  "Subcon MFM PSAdminM": [
    "Presort Admin MPW"
  ],
  "Subcon MFM PSAdminA": [
    "Presort Admin Asset"
  ],
  "Subcon MFM PSRW": [
    "Presort Rework"
  ],
  "Subcon MFM PSMS": [
    "Presort MS"
  ],
  "Subcon MFM PS4PL": [
    "Presort 4PL"
  ],
  "Subcon MFM PSOB": [
    "Presort Outbound"
  ],
  "Subcon MFM PSSS": [
    "Presort Sort"
  ],
  "Subcon MFM PSIB": [
    "Presort Inbound"
  ],
  "Subcon Translator": [
    "Translator"
  ],
  "Subcon MS x OBS 8hrs": [
    "MS x OBS"
  ],
  "Subcon OBS x MS 8hrs": [
    "OBS x MS"
  ],
  "Subcon CBS x OBS 8hrs": [
    "CBS x OBS"
  ],
  "Subcon OBS x CBS 8hrs": [
    "OBS x CBS"
  ],
  "Subcon IB x OBS 8hrs": [
    "IB x OBS"
  ],
  "Subcon OBS x IB 8hrs": [
    "OBS x IB"
  ],
  "Subcon M_Sack 8hrs": [
    "M_Sack"
  ],
  "SPX NERC-B HSE": [
    "HSE"
  ],
  "SPX SORC-B HSE": [
    "HSE"
  ],
  "SPX SORC-A HSE": [
    "HSE"
  ],
  "SPX NORC-B HSE": [
    "HSE"
  ],
  "SPX NORC-A HSE": [
    "HSE"
  ],
  "SPX FSOCW Senior": [
    "FSOCW Senior"
  ],
  "SPX FSOCW Associate": [
    "FSOCW Associate"
  ],
  "Ground Recruitment Support": [
    "Ground Recruitment Support"
  ],
  "Ground Onsite Recruiter": [
    "Ground Onsite Recruiter"
  ],
  "SPX Presort - Inbound": [
    "Presort - Inbound"
  ],
  "SPX Cache Senior": [
    "Cache"
  ],
  "SPX Cache Junior": [
    "Cache"
  ],
  "SPX NORC-B Area": [
    "NORC-B"
  ],
  "SPX NORC-A Area": [
    "NORC-A"
  ],
  "SPX NERC-C Area": [
    "NERC-C"
  ],
  "SPX NERC-B Area": [
    "NERC-B"
  ],
  "SPX NERC-A Area": [
    "NERC-A"
  ],
  "SPX SORC-B Area": [
    "SORC-B"
  ],
  "SPX SORC-A Area": [
    "SORC-A"
  ],
  "SPX Asset Senior": [
    "Asset"
  ],
  "SPX Asset Junior": [
    "Asset"
  ],
  "SPX Admin Asset": [
    "Administration"
  ],
  "SPX Admin MPW": [
    "Administration"
  ],
  "SPX Presort - Sorting": [
    "Presort - Sorting"
  ],
  "SPX Presort - Outbound": [
    "Presort - Outbound"
  ],
  "SPX Presort Inbound": [
    "Presort - Inbound"
  ],
  "Burmese Supervisor SS": [
    "Small Sort"
  ],
  "Burmese Supervisor OB": [
    "Outbound"
  ],
  "Burmese Supervisor 4PL": [
    "4PL"
  ],
  "Burmese Supervisor OBC": [
    "Outbound Conveyor"
  ],
  "Burmese Supervisor OBI": [
    "Outbound Induction"
  ],
  "Burmese Supervisor Helper": [
    "Helper"
  ],
  "Burmese Supervisor FSOCN": [
    "FSOCN"
  ],
  "Burmese Supervisor RW": [
    "Rework"
  ],
  "Burmese Supervisor RT": [
    "Return"
  ],
  "Burmese Supervisor OBD": [
    "Outbound Dispatch"
  ],
  "Burmese Supervisor OBS": [
    "Outbound Sort"
  ],
  "Burmese Supervisor MS": [
    "Manual Sort"
  ],
  "Burmese Supervisor mCBS": [
    "Mini Crossbelt Sort"
  ],
  "Burmese Supervisor CBS": [
    "Crossbelt Sort"
  ],
  "Burmese Supervisor IB": [
    "Inbound"
  ],
  "Burmese Supervisor FSOCE": [
    "FSOCE"
  ],
  "SPX SORC-B Senior": [
    "SORC-B"
  ],
  "SPX FSOCE Maintenance Junior": [
    "FSOCE Maintenance"
  ],
  "SPX FSOCW Maintenance Junior": [
    "FSOCW Maintenance"
  ],
  "SPX FSOCW Outbound Senior": [
    "FSOCW Outbound"
  ],
  "SPX FSOCW Outbound Junior": [
    "FSOCW Outbound"
  ],
  "SPX FSOCW Sorting Junior": [
    "FSOCW Sorting"
  ],
  "SPX FSOCW Inbound Junior": [
    "FSOCW Inbound"
  ],
  "SPX FSOCW Inbound Senior": [
    "FSOCW Inbound"
  ],
  "SPX SORC-B Junior": [
    "SORC-B"
  ],
  "SPX SORC-A Senior": [
    "SORC-A"
  ],
  "SPX SORC-A Junior": [
    "SORC-A"
  ],
  "SPX NORC-B Junior": [
    "NORC-B"
  ],
  "SPX NORC-B Senior": [
    "NORC-B"
  ],
  "SPX NORC-A Senior": [
    "NORC-A"
  ],
  "SPX NORC-A Junior": [
    "NORC-A"
  ],
  "SPX NERC-C Senior": [
    "NERC-C"
  ],
  "SPX NERC-C Junior": [
    "NERC-C"
  ],
  "SPX NERC-B Senior": [
    "NERC-B"
  ],
  "SPX NERC-B Junior": [
    "NERC-B"
  ],
  "SPX NERC-A Junior": [
    "NERC-A"
  ],
  "SPX NERC-A Senior": [
    "NERC-A"
  ],
  "SPX Outbound Induction Senior": [
    "Outbound Induction"
  ],
  "SPX Cross Border Return Junior": [
    "Cross Border Return"
  ],
  "SPX SIP Junior": [
    "SIP"
  ],
  "SPX Sorting Senior": [
    "Sorting"
  ],
  "SPX Outbound Senior": [
    "Outbound"
  ],
  "SPX Line Haul Senior": [
    "Line Haul"
  ],
  "SPX Own Fleet Senior": [
    "Own Fleet"
  ],
  "SPX Own Fleet Junior": [
    "Own Fleet"
  ],
  "SPX Maintenance Senior": [
    "Maintenance"
  ],
  "SPX Maintenance Junior": [
    "Maintenance"
  ],
  "SPX Administration Senior": [
    "Administration"
  ],
  "SPX Administration Junior": [
    "Administration"
  ],
  "Subcon New Face": [
    "Subcon New Face"
  ],
  "SPX Cache": [
    "Cache"
  ],
  "SPX NORC-B Line Haul": [
    "NORC-B",
    "Line Haul"
  ],
  "SPX NORC-B Maintenance": [
    "NORC-B",
    "Maintenance"
  ],
  "SPX NORC-B": [
    "NORC-B"
  ],
  "SPX NORC-A Line Haul": [
    "NORC-A",
    "Line Haul"
  ],
  "SPX NORC-A Maintenance": [
    "NORC-A",
    "Maintenance"
  ],
  "SPX NORC-A": [
    "NORC-A"
  ],
  "SPX NERC-C Line Haul": [
    "NERC-C",
    "Line Haul"
  ],
  "SPX NERC-C Maintenance": [
    "NERC-C",
    "Maintenance"
  ],
  "SPX NERC-C": [
    "NERC-C"
  ],
  "SPX NERC-B Line Haul": [
    "NERC-B",
    "Line Haul"
  ],
  "SPX NERC-B Maintenance": [
    "NERC-B",
    "Maintenance"
  ],
  "SPX NERC-B": [
    "NERC-B"
  ],
  "SPX NERC-A Line Haul": [
    "NERC-A",
    "Line Haul"
  ],
  "SPX NERC-A Maintenance": [
    "NERC-A",
    "Maintenance"
  ],
  "SPX NERC-A": [
    "NERC-A"
  ],
  "SPX SORC-B Line Haul": [
    "SORC-B",
    "Line Haul"
  ],
  "SPX SORC-B Maintenance": [
    "SORC-B",
    "Maintenance"
  ],
  "SPX SORC-B": [
    "SORC-B"
  ],
  "SPX SORC-A Line Haul": [
    "SORC-A",
    "Line Haul"
  ],
  "SPX SORC-A Maintenance": [
    "SORC-A",
    "Maintenance"
  ],
  "SPX SORC-A": [
    "SORC-A"
  ],
  "SPX Sorting Junior": [
    "Sorting"
  ],
  "SPX Outbound Junior": [
    "Outbound"
  ],
  "SPX SIP Senior": [
    "SIP"
  ],
  "SPX Outbound Induction Junior": [
    "Outbound Induction"
  ],
  "SPX FSOCN Senior": [
    "FSOCN"
  ],
  "SPX FSOCN Junior": [
    "FSOCN"
  ],
  "SPX Cross Border Return Senior": [
    "Cross Border Return"
  ],
  "SPX 4PL Senior": [
    "4PL"
  ],
  "SPX 4PL Junior": [
    "4PL"
  ],
  "SPX Rework Senior": [
    "Rework"
  ],
  "SPX Rework Junior": [
    "Rework"
  ],
  "SPX Return Senior": [
    "Return"
  ],
  "SPX Return Junior": [
    "Return"
  ],
  "SPX Outbound Sort Senior": [
    "Outbound Sort"
  ],
  "SPX Outbound Sort Junior": [
    "Outbound Sort"
  ],
  "SPX Outbound Dispatch Senior": [
    "Outbound Dispatch"
  ],
  "SPX Outbound Dispatch Junior": [
    "Outbound Dispatch"
  ],
  "SPX Mini Crossbelt Sort Senior": [
    "Mini Crossbelt Sort"
  ],
  "SPX Mini Crossbelt Sort Junior": [
    "Mini Crossbelt Sort"
  ],
  "SPX Manual Sort Senior": [
    "Manual Sort"
  ],
  "SPX Manual Sort Junior": [
    "Manual Sort"
  ],
  "SPX Line Haul Junior": [
    "Line Haul"
  ],
  "SPX Inbound Senior": [
    "Inbound"
  ],
  "SPX Inbound Junior": [
    "Inbound"
  ],
  "SPX FSOCE Senior": [
    "FSOCE"
  ],
  "SPX FSOCE Junior": [
    "FSOCE"
  ],
  "SPX Crossbelt Sort Senior": [
    "Crossbelt Sort"
  ],
  "SPX Crossbelt Sort Junior": [
    "Crossbelt Sort"
  ],
  "Subcon Cache": [
    "Cache"
  ],
  "Subcon NORC-B Line Haul": [
    "NORC-B"
  ],
  "Subcon NORC-B": [
    "NORC-B"
  ],
  "Subcon NORC-A Line Haul": [
    "NORC-A"
  ],
  "Subcon NORC-A": [
    "NORC-A"
  ],
  "Subcon NERC-C Line Haul": [
    "NERC-C"
  ],
  "Subcon NERC-C": [
    "NERC-C"
  ],
  "Subcon NERC-B Line Haul": [
    "NERC-B"
  ],
  "Subcon NERC-B": [
    "NERC-B"
  ],
  "Subcon NERC-A Line Haul": [
    "NERC-A"
  ],
  "Subcon NERC-A": [
    "NERC-A"
  ],
  "Subcon SORC-B Line Haul": [
    "SORC-B"
  ],
  "Subcon SORC-B": [
    "SORC-B"
  ],
  "Subcon SORC-A Line Haul": [
    "SORC-A"
  ],
  "Subcon SORC-A": [
    "SORC-A"
  ],
  "Subcon OB 10hrs": [
    "Outbound"
  ],
  "Subcon OB 8hrs": [
    "Outbound"
  ],
  "Subcon SS 10hrs": [
    "Small Sort"
  ],
  "Subcon SS 8hrs": [
    "Small Sort"
  ],
  "Subcon 4PL 10hrs": [
    "4PL"
  ],
  "Subcon 4PL 8hrs": [
    "4PL"
  ],
  "Subcon CB 10hrs": [
    "CB"
  ],
  "Subcon CB 8hrs": [
    "CB"
  ],
  "Subcon FSOCN 10hrs": [
    "FSOCN"
  ],
  "Subcon FSOCN 8hrs": [
    "FSOCN"
  ],
  "Subcon OBC 10hrs": [
    "Outbound Conveyor"
  ],
  "Subcon OBC 8hrs": [
    "Outbound Conveyor"
  ],
  "Subcon OBI 10hrs": [
    "Outbound Induction"
  ],
  "Subcon OBI 8hrs": [
    "Outbound Induction"
  ],
  "Subcon SIP 10hrs": [
    "SIP"
  ],
  "Subcon SIP 8hrs": [
    "SIP"
  ],
  "Subcon AdminM 10hrs": [
    "Admin MPW"
  ],
  "Subcon AdminM 8hrs": [
    "Admin MPW"
  ],
  "Subcon AdminA 10hrs": [
    "Admin Asset"
  ],
  "Subcon AdminA 8hrs": [
    "Admin Asset"
  ],
  "Subcon AdminLH 10hrs": [
    "Admin LH"
  ],
  "Subcon AdminLH 8hrs": [
    "Admin LH"
  ],
  "Subcon CBS 10hrs": [
    "Crossbelt Sort"
  ],
  "Subcon CBS 8hrs": [
    "Crossbelt Sort"
  ],
  "Subcon FSOCE 10hrs": [
    "FSOCE"
  ],
  "Subcon FSOCE 8hrs": [
    "FSOCE"
  ],
  "Subcon Helper 10hrs": [
    "Helper"
  ],
  "Subcon Helper 8hrs": [
    "Helper"
  ],
  "Subcon HVL 10hrs": [
    "HVL"
  ],
  "Subcon HVL 8hrs": [
    "HVL"
  ],
  "Subcon IB 10hrs": [
    "Inbound"
  ],
  "Subcon IB 8hrs": [
    "Inbound"
  ],
  "Subcon mCBS 10hrs": [
    "Mini Crossbelt Sort"
  ],
  "Subcon mCBS 8hrs": [
    "Mini Crossbelt Sort"
  ],
  "Subcon MS 10hrs": [
    "Manual Sort"
  ],
  "Subcon MS 8hrs": [
    "Manual Sort"
  ],
  "Subcon MS-B 10hrs": [
    "MS-B"
  ],
  "Subcon MS-B 8hrs": [
    "MS-B"
  ],
  "Subcon OBD 10hrs": [
    "Outbound Dispatch"
  ],
  "Subcon OBD 8hrs": [
    "Outbound Dispatch"
  ],
  "Subcon OBS 10hrs": [
    "Outbound Sort"
  ],
  "Subcon OBS 8hrs": [
    "Outbound Sort"
  ],
  "Subcon RT 10hrs": [
    "Return"
  ],
  "Subcon RT 8hrs": [
    "Return"
  ],
  "Subcon RW 10hrs": [
    "Rework"
  ],
  "Subcon RW 8hrs": [
    "Rework"
  ],
  "Subcon Tech 10hrs": [
    "Technician"
  ],
  "Subcon Tech 8hrs": [
    "Technician"
  ],
  "Seller Agent (Part-time)": [
    "Seller agent"
  ],
  "Seller agent (Full-time)": [
    "Seller agent"
  ],
  "SOC agent": [
    "SOC agent"
  ],
  "Hub Agent (Part-time)": [
    "Hub Agent"
  ],
  "Hub Agent (Full-time)": [
    "Hub Agent"
  ],
  "RC agent": [
    "RC agent"
  ],
  "Product Test": [
    "Product Test"
  ],
  "FM Onsite": [
    "Onsite Agent",
    "Onsite Senior Agent"
  ],
  "MM (RC)": [
    "RC Supervisor",
    "RC Senior Agent",
    "RC Agent",
    "RC Ops"
  ],
  "Operator account": [
    "SOC Supervisor",
    "SOC Senior agent",
    "SOC Agent",
    "SOC Ops"
  ],
  "CTO (Hubs)": [
    "Area Manager",
    "Hub Supervisor",
    "Hub Assistant Supervisor",
    "Hub Senior Agent",
    "Hub Agent"
  ],
  "Subcon Agent": [
    "Subcon Agent"
  ],
  "Area Manager": [
    "Area Manager"
  ],
  "Hub Assistant Supervisor": [
    "Hub Assistant Supervisor"
  ],
  "Parcel Shop Agent": [
    "Parcel Shop Agent"
  ],
  "Onsite Agent": [
    "Onsite Agent"
  ],
  "Hub Agent": [
    "Hub Agent"
  ],
  "Hub Senior Agent": [
    "Hub Senior Agent"
  ],
  "Hub Supervisor": [
    "Hub Supervisor"
  ],
  "RC Supervisor": [
    "RC Supervisor"
  ],
  "RC Senior Agent": [
    "RC Senior Agent"
  ],
  "SOC Supervisor": [
    "SOC Supervisor"
  ],
  "SOC Senior Agent": [
    "SOC Senior Agent"
  ],
  "Parcel Shop Area Manager": [
    "Parcel Shop Area Manager"
  ],
  "Parcel Shop Lead": [
    "Parcel Shop Lead"
  ],
  "Onsite Supervisor": [
    "Onsite Supervisor"
  ],
  "Onsite Senior Agent": [
    "Onsite Senior Agent"
  ],
  "RC Ops": [
    "RC Ops"
  ],
  "SOC Ops": [
    "SOC Ops"
  ],
  "MM Ops": [
    "MM Ops"
  ],
  "MM Operation Support": [
    "MM Operation Support"
  ],
  "Last Mile": [
    "Last Mile"
  ]
}

/**
 * รายการตัวเลือกฮับ (Station) อ้างอิงจากคลังและสถานีหลักในระบบ
 */
export const OPS_HUBS: string[] = [
  "SOCE",
  "SOCW",
  "SOCN",
  "FSOCW",
  "FSOCE",
  "SCOM SC1",
  "SCOM WN1",
  "SCOM WN2",
  "SCOM SORCA",
  "SCOM BN1",
  "SCOM-SS",
  "SCOM-WN",
  "SPX",
]

/**
 * ดึงรายการแผนก (Designations) ที่ผูกกับหน่วยงาน (Department) ที่เลือก
 */
export function getDesignationsForDepartment(department?: string | null): string[] {
  if (!department) return []
  const trimmed = department.trim()
  if (OPS_DESIGNATIONS_MAP[trimmed]) {
    return OPS_DESIGNATIONS_MAP[trimmed]
  }
  return []
}
