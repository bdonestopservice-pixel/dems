const rawData = [
  {
    warehouse: 'SOCE',
    content: `06:00-15:00,D,,SOCE,4PL,4PL
07:00-16:00,D,,SOCE,Admin Asset(SOC),Admin Asset
08:00-17:00,D,,SOCE,Admin MPW(SOC),Admin MPW
08:30-17:30,D,,SOCE,Crossbelt Sort,Crossbelt Sort
09:00-18:00,D,,SOCE,Helper,Helper
09:30-18:30,D,,SOCE,Inbound,Inbound
10:00-19:00,D,,SOCE,Manual Sort,Manual Sort
10:30-19:30,D,,SOCE,Mini Crossbelt Sort,Mini Crossbelt Sort
11:00-20:00,D,,SOCE,Outbound Dispatch,Outbound Dispatch
12:00-21:00,D,,SOCE,Outbound Sort,Outbound Sort
13:00-22:00,N,,SOCE,Return,Return
14:00-23:00,N,,SOCE,Rework,Rework
15:00-24:00,N,,SOCE,Technician(SOC),Technician
16:00-01:00,N,,SOCE,Asset,Asset
17:00-02:00,N,,FSOCE,FSOCE,FSOCE
18:00-03:00,N,,FSOCE,Admin Asset(FSOC),Admin Asset
19:00-04:00,N,,FSOCE,Admin MPW(FSOC),Admin MPW
20:00-05:00,N,,FSOCE,Technician(FSOC),Technician
20:30-05:30,N,,SOCE,HIGHVALUE,HIGHVALUE
21:00-06:00,N,,SOCE,MS x OBS,MS x OBS
22:00-07:00,N,,SOCE,OBS X MS,OBS X MS
23:00-08:00,N,,SOCE,IB X OBS,IB X OBS
24:00-09:00,N,,SOCE,OBS X CBS,OBS X CBS
01:00-10:00,N,,SOCE,SIP,SIP
02:00-11:00,N,,SOCE,OBS X IB,OBS X IB
03:00-12:00,N,,SOCE,TF_WH,TF_WH
04:00-13:00,N,,SOCE,TF_SOC,TF_SOC
05:00-14:00,N,,,,`
  },
  {
    warehouse: 'SOCN',
    content: `06:00-15:00,D,,SOCN,4PL,4PL
07:00-16:00,D,,SOCN,Admin Asset(SOCN),Admin Asset
08:00-17:00,D,,SOCN,Admin MPW(SOCN),Admin MPW
08:30-17:30,D,,SOCN,Crossbelt Sort,Crossbelt Sort
09:00-18:00,D,,SOCN,Helper,Helper
09:30-18:30,D,,SOCN,Inbound,Inbound
10:00-19:00,D,,SOCN,Manual Sort,Manual Sort
10:30-19:30,D,,SOCN,Mini Crossbelt Sort,Mini Crossbelt Sort
11:00-20:00,D,,SOCN,MS-B,MS-B
12:00-21:00,D,,SOCN,OBS x OBD,OBS x OBD
13:00-17:00,H,,SOCN,Outbound Conveyor,Outbound Conveyor
13:00-22:00,N,,SOCN,Outbound Dispatch,Outbound Dispatch
13:00-23:00,N,,SOCN,Outbound Induction,Outbound Induction
14:00-23:00,N,,SOCN,Outbound Sort,Outbound Sort
15:00-24:00,N,,SOCN,Outbound Sort X Outbound Dispatch,OBS x OBD
16:00-01:00,N,,SOCN,Return,Return
17:00-02:00,N,,SOCN,Rework,Rework
18:00-03:00,N,,SOCN,Technician(SOCN),Techinician
19:00-04:00,N,,SOCN,Asset,Asset
20:00-05:00,N,,FSOCN,Admin Asset(FSOCN),Admin Asset
20:30-05:30,N,,FSOCN,Admin MPW(FSOCN),Admin MPW
21:00-06:00,N,,FSOCN,FSOCN,FSOCN
22:00-07:00,N,,FSOCN,Technician(FSOCN),Techinician
23:00-08:00,N,,SOCN,M Sack,M Sack
24:00-09:00,N,,SOCN,CB,CB
01:00-10:00,N,,SOCN,TF WH,TF WH
02:00-11:00,N,,,,
03:00-12:00,N,,,,
04:00-13:00,N,,,,
05:00-14:00,N,,,,`
  },
  {
    warehouse: 'SOCW',
    content: `06:00-15:00,D,,SOCW,Admin Asset(SOCW),Admin Asset
07:00-16:00,D,,SOCW,Asset,Asset
08:00-17:00,D,,SOCW,Helper,Helper
08:30-17:30,D,,SOCW,Inbound,Inbound
09:00-18:00,D,,SOCW,Manual Sort,Manual Sort
09:30-18:30,D,,SOCW,MS-B,MS-B
10:00-19:00,D,,SOCW,Outbound,Outbound
10:30-19:30,D,,SOCW,Return,Return
11:00-20:00,D,,SOCW,Rework,Rework
12:00-21:00,D,,SOCW,Small Sort,Small Sort
,H,,SOCW,Technician(SOCW),Technician
13:00-22:00,N,,SOCW,High value lane,High value lane
,,,SOCW,CB Liquidated,CB Liquidated
14:00-23:00,N,,,,
15:00-24:00,N,,,,
16:00-01:00,N,,,,
17:00-02:00,N,,,,
18:00-03:00,N,,,,
19:00-04:00,N,,,,
20:00-05:00,N,,,,
20:30-05:30,N,,,,
21:00-06:00,N,,,,
22:00-07:00,N,,,,
23:00-08:00,N,,,,
24:00-09:00,N,,,,
01:00-10:00,N,,,,
02:00-11:00,N,,,,
03:00-12:00,N,,,,
04:00-13:00,N,,,,
05:00-14:00,N,,,,
17:00-02:00,N,,,,
20:00-05:00,N,,,,
21:00-06:00,N,,,,
22:00-09:00,N,,,,`
  },
  {
    warehouse: 'FSOCW',
    content: `06:00-15:00,D,,FSOCW,Admin Asset(FSOCW),Admin Asset
07:00-16:00,D,,FSOCW,PS 4PL,PS4PL
08:00-17:00,D,,FSOCW,PS Inbound,PSIB
08:30-17:30,D,,FSOCW,PS MS,PSMS
09:00-18:00,D,,FSOCW,PS Outbound,PSOB
09:30-18:30,D,,FSOCW,PS Rework,PSRW
10:00-19:00,D,,FSOCW,PS Sort,PSSS
10:30-19:30,D,,FSOCW,Technician(FSOCW),Technician
11:00-20:00,D,,,,
12:00-21:00,D,,,,
13:00-17:00,H,,,,
13:00-22:00,N,,,,
,,,,,
14:00-23:00,N,,,,
15:00-24:00,N,,,,
16:00-01:00,N,,,,
17:00-02:00,N,,,,
18:00-03:00,N,,,,
19:00-04:00,N,,,,
20:00-05:00,N,,,,
20:30-05:30,N,,,,
21:00-06:00,N,,,,
22:00-07:00,N,,,,
23:00-08:00,N,,,,
24:00-09:00,N,,,,
01:00-10:00,N,,,,
02:00-11:00,N,,,,
03:00-12:00,N,,,,
04:00-13:00,N,,,,
05:00-14:00,N,,,,`
  },
  {
    warehouse: 'SCOM SC1',
    content: `06:00-15:00,D,,SCOM,Leader Inbound,Leader Inbound
06:00-15:00,D,,,,
07:00-16:00,D,,SCOM,Inbound,Inbound
08:00-17:00,D,,SCOM,Inbound CB,Inbound CB
08:30-17:30,D,,SCOM,Put Away,Put Away
09:00-18:00,D,,SCOM,Forklift - Put Away,Forklift - Put Away
09:30-18:30,D,,SCOM,Power Pallet - Put Away,Power Pallet - Put Away
10:00-19:00,D,,SCOM,Reach truck - Put Away,Reach truck - Put Away
10:30-19:30,D,,SCOM,VAS CB,VAS CB
11:00-20:00,D,,SCOM,VAS Local,VAS Local
12:00-21:00,D,,SCOM,Leader Inventory,Leader Inventory
14:30-23:30,N,,SCOM,Cycle count,Cycle count
13:00-22:00,N,,SCOM,Damage & Surplus,Damage & Surplus
11:30-20:30,D,,SCOM,Troubleshoot,Troubleshoot
14:00-23:00,N,,SCOM,Replenish,Replenish
15:00-24:00,N,,SCOM,Forklift - Inventory,Forklift - Inventory
16:00-01:00,N,,SCOM,Power Pallet - Inventory,Power Pallet - Inventory
17:00-02:00,N,,SCOM,Reach truck - Inventory,Reach truck - Inventory
17:30-02:30,N,,SCOM,Leader Outbound,Leader Outbound
18:00-03:00,N,,SCOM,SPX Sorting,SPX Sorting
19:00-04:00,N,,SCOM,Packing,Packing
20:00-05:00,N,,SCOM,Picking,Picking
20:30-05:30,N,,SCOM,Sorting,Sorting
21:00-06:00,N,,SCOM,Shipping,Shipping
22:00-07:00,N,,SCOM,Power Pallet - Pick,Power Pallet - Pick
23:00-08:00,N,,SCOM,Power Pallet - Pack,Power Pallet - Pack
24:00-09:00,N,,SCOM,Leader Returns,Leader Returns
01:00-10:00,N,,SCOM,Returns-WH,Returns-WH
02:00-11:00,N,,SCOM,Returns-NON WH CB,Returns-NON WH CB
03:00-12:00,N,,SCOM,Inbound CB chargeback,Inbound CB chargeback
04:00-13:00,N,,SCOM,Outbound/ RTS,Outbound/ RTS
13:30-22:30,N,,SCOM,Migration Put Away,Migration Put Away
15:30-24:30,N,,SCOM,Migration - Outbound,Migration - Outbound
14:30-23:30,N,,SCOM,Migration - Forklift,Migration - Forklift
06:30-15:30,D,,SCOM,Forklift - Consumable,Forklift - Consumable
12:30-21:30,D,,SCOM,Power Pallet - Consumable,Power Pallet - Consumable
,,,SCOM,Reach truck - Consumable,Reach truck - Consumable
,,,SCOM,Facility,Facility
,,,SCOM,5S,5S
,,,SCOM,Same Day,Same Day`
  },
  {
    warehouse: 'SCOM WN1',
    content: `06:00-15:00,D,,SCOM,Leader Inbound,Leader Inbound
07:00-16:00,D,,SCOM,Inbound,Inbound
08:00-17:00,D,,SCOM,Inbound CB,Inbound CB
08:30-17:30,D,,SCOM,Put Away,Put Away
09:00-18:00,D,,SCOM,Forklift - Put Away,Forklift - Put Away
09:30-18:30,D,,SCOM,Power Pallet - Put Away,Power Pallet - Put Away
10:00-19:00,D,,SCOM,Reach truck - Put Away,Reach truck - Put Away
10:30-19:30,D,,SCOM,VAS CB,VAS CB
11:00-20:00,D,,SCOM,VAS Local,VAS Local
12:00-21:00,D,,SCOM,Leader Inventory,Leader Inventory
13:00-17:00,H,,SCOM,Cycle count,Cycle count
13:00-22:00,N,,SCOM,Damage & Surplus,Damage & Surplus
14:00-23:00,N,,SCOM,Troubleshoot,Troubleshoot
15:00-24:00,N,,SCOM,Replenish,Replenish
16:00-01:00,N,,SCOM,Forklift - Inventory,Forklift - Inventory
17:00-02:00,N,,SCOM,Power Pallet - Inventory,Power Pallet - Inventory
18:00-03:00,N,,SCOM,Reach truck - Inventory,Reach truck - Inventory
19:00-04:00,N,,SCOM,Leader Outbound,Leader Outbound
20:00-05:00,N,,SCOM,SPX Sorting,SPX Sorting
20:30-05:30,N,,SCOM,Packing,Packing
21:00-06:00,N,,SCOM,Picking,Picking
21:30-06:30,N,,SCOM,Sorting,Sorting
22:00-07:00,N,,SCOM,Shipping,Shipping
23:00-08:00,N,,SCOM,Power Pallet - Pick,Power Pallet - Pick
24:00-09:00,N,,SCOM,Power Pallet - Pack,Power Pallet - Pack
01:00-10:00,N,,SCOM,Leader Returns,Leader Returns
02:00-11:00,N,,SCOM,Returns,Returns
03:00-12:00,N,,SCOM,Returns-NON WH CB,Returns-NON WH CB
04:00-13:00,N,,SCOM,Inbound CB chargeback,Inbound CB chargeback
05:00-14:00,N,,SCOM,Outbound/ RTS,Outbound/ RTS
07:30-16:30,D,,SCOM,Migration Put Away,Migration Put Away
,,,SCOM,Migration - Outbound,Migration - Outbound
,,,SCOM,Migration - Forklift,Migration - Forklift
,,,SCOM,Forklift - Consumable,Forklift - Consumable
,,,SCOM,Power Pallet - Consumable,Power Pallet - Consumable
,,,SCOM,Reach truck - Consumable,Reach truck - Consumable
,,,SCOM,Maintenance,Maintenance
,,,SCOM,5S,5S
,,,SCOM,Admin-SWP,Admin-SWP
,,,SCOM,Returns Non-WH,Returns Non-WH`
  },
  {
    warehouse: 'SCOM WN2',
    content: `06:00-15:00,D,,SCOM,Leader Inbound,Leader Inbound
07:00-16:00,D,,SCOM,Inbound,Inbound
08:00-17:00,D,,SCOM,Inbound CB,Inbound CB
08:30-17:30,D,,SCOM,Put Away,Put Away
09:00-18:00,D,,SCOM,Forklift - Put Away,Forklift - Put Away
09:30-18:30,D,,SCOM,Power Pallet - Put Away,Power Pallet - Put Away
10:00-19:00,D,,SCOM,Reach truck - Put Away,Reach truck - Put Away
10:30-19:30,D,,SCOM,VAS CB,VAS CB
11:00-20:00,D,,SCOM,VAS Local,VAS Local
12:00-21:00,D,,SCOM,Leader Inventory,Leader Inventory
13:00-17:00,H,,SCOM,Cycle count,Cycle count
13:00-22:00,N,,SCOM,Damage & Surplus,Damage & Surplus
14:00-23:00,N,,SCOM,Troubleshoot,Troubleshoot
15:00-24:00,N,,SCOM,Replenish,Replenish
16:00-01:00,N,,SCOM,Forklift - Inventory,Forklift - Inventory
17:00-02:00,N,,SCOM,Power Pallet - Inventory,Power Pallet - Inventory
18:00-03:00,N,,SCOM,Reach truck - Inventory,Reach truck - Inventory
19:00-04:00,N,,SCOM,Leader Outbound,Leader Outbound
20:00-05:00,N,,SCOM,SPX Sorting,SPX Sorting
20:30-05:30,N,,SCOM,Packing,Packing
21:00-06:00,N,,SCOM,Picking,Picking
21:30-06:30,N,,SCOM,Sorting,Sorting
22:00-07:00,N,,SCOM,Shipping,Shipping
23:00-08:00,N,,SCOM,Power Pallet - Pick,Power Pallet - Pick
24:00-09:00,N,,SCOM,Power Pallet - Pack,Power Pallet - Pack
01:00-10:00,N,,SCOM,Leader Returns,Leader Returns
02:00-11:00,N,,SCOM,Returns,Returns
03:00-12:00,N,,SCOM,Returns-NON WH CB,Returns-NON WH CB
04:00-13:00,N,,SCOM,Inbound CB chargeback,Inbound CB chargeback
05:00-14:00,N,,SCOM,Outbound/ RTS,Outbound/ RTS
07:30-16:30,D,,SCOM,Migration Put Away,Migration Put Away
,,,SCOM,Migration - Outbound,Migration - Outbound
,,,SCOM,Migration - Forklift,Migration - Forklift
,,,SCOM,Forklift - Consumable,Forklift - Consumable
,,,SCOM,Power Pallet - Consumable,Power Pallet - Consumable
,,,SCOM,Reach truck - Consumable,Reach truck - Consumable
,,,SCOM,Maintenance,Maintenance
,,,SCOM,5S,5S
,,,SCOM,Admin-SWP,Admin-SWP`
  }
];

function parseAll() {
  const warehouses = [];
  const allShifts = [];
  const allDepartments = [];

  for (const block of rawData) {
    const whId = block.warehouse;
    warehouses.push({ id: whId, name: whId });

    const lines = block.content.trim().split('\n');
    const seenShifts = new Set();
    const seenDepts = new Set();

    for (const line of lines) {
      const parts = line.split(',');
      const shiftTime = (parts[0] || '').trim();
      const shiftType = (parts[1] || '').trim().toUpperCase();
      const deptType = (parts[3] || '').trim();
      const deptName = (parts[4] || '').trim();
      const shiftName = (parts[5] || '').trim();

      // Process shift if valid time
      if (shiftTime && shiftTime.includes('-')) {
        const [start, end] = shiftTime.split('-').map((s) => s.trim());
        const shiftKey = `${start}-${end}-${shiftType}`;
        if (!seenShifts.has(shiftKey)) {
          seenShifts.add(shiftKey);
          allShifts.push({
            warehouse: whId,
            start_time: start,
            end_time: end,
            type: shiftType || 'D',
          });
        }
      }

      // Process department if valid name
      if (deptName) {
        const deptKey = `${deptType}-${deptName}-${shiftName}`;
        if (!seenDepts.has(deptKey)) {
          seenDepts.add(deptKey);
          allDepartments.push({
            warehouse: whId,
            type: deptType || whId,
            name: deptName,
            shift_name: shiftName || deptName,
          });
        }
      }
    }
  }

  console.log(`Parsed ${warehouses.length} warehouses:`, warehouses.map((w) => w.id));
  console.log(`Total Shifts: ${allShifts.length}`);
  console.log(`Total Departments: ${allDepartments.length}`);

  for (const w of warehouses) {
    const shiftsForWh = allShifts.filter((s) => s.warehouse === w.id);
    const deptsForWh = allDepartments.filter((d) => d.warehouse === w.id);
    console.log(`- ${w.id}: ${shiftsForWh.length} shifts, ${deptsForWh.length} departments`);
  }

  return { warehouses, allShifts, allDepartments };
}

if (require.main === module) {
  parseAll();
}

module.exports = { rawData, parseAll };

