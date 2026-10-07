// scripts/seed-lov.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const INITIAL_LOV_DATA = [
  // 1. CVN Requirements
  { category: 'CVN_REQUIREMENT', code: 'L_7_21J', label: 'L-7-21J (21°C ± 3°C)', value: 'L-7-21J (21°C ± 3°C)', sort_order: 10, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'L_10_27J', label: 'L-10-27J (21°C ± 3°C)', value: 'L-10-27J (21°C ± 3°C)', sort_order: 20, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'T_10_20J', label: 'T-10-20J (21°C ± 3°C)', value: 'T-10-20J (21°C ± 3°C)', sort_order: 30, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'L_7_43J', label: 'L-7-43J (0°C ± 3°C)', value: 'L-7-43J (0°C ± 3°C)', sort_order: 40, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'L_10_54J', label: 'L-10-54J (0°C ± 3°C)', value: 'L-10-54J (0°C ± 3°C)', sort_order: 50, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'T_10_27J', label: 'T-10-27J (0°C ± 3°C)', value: 'T-10-27J (0°C ± 3°C)', sort_order: 60, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'T_10_30J', label: 'T-10-30J (0°C ± 3°C)', value: 'T-10-30J (0°C ± 3°C)', sort_order: 70, is_system_default: true },
  { category: 'CVN_REQUIREMENT', code: 'T_10_32J', label: 'T-10-32J (0°C ± 3°C)', value: 'T-10-32J (0°C ± 3°C)', sort_order: 80, is_system_default: true },

  // 2. Defect Categories
  { category: 'DEFECT_CATEGORY', code: 'MPI_REJECTION', label: 'MPI Rejection', value: 'MPI Rejection', sort_order: 10, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'MATERIAL_FAULT', label: 'Material Fault (M.F.)', value: 'Material Fault (M.F.)', sort_order: 20, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'THREAD_MISMATCH', label: 'Thread Mismatch', value: 'Thread Mismatch', sort_order: 30, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'THREAD_STEP', label: 'Thread Step', value: 'Thread Step', sort_order: 40, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'LENGTH_UNDERSIZE', label: 'Total Length Undersize', value: 'Total Length Undersize', sort_order: 50, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'OD_UNDERSIZE', label: 'OD Undersize', value: 'OD Undersize', sort_order: 60, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'THREAD_FLAT', label: 'Thread Flat', value: 'Thread Flat', sort_order: 70, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'THREAD_CUT', label: 'Thread Cut', value: 'Thread Cut', sort_order: 80, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'THREAD_CUT_POWER_OFF', label: 'Thread Cut Due to Power off', value: 'Thread Cut Due to Power off', sort_order: 90, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'STANDOFF_ERROR', label: 'Standoff Undersize/Oversize', value: 'Standoff Undersize/Oversize', sort_order: 100, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'ID_OVERSIZE', label: 'ID Oversize', value: 'ID Oversize', sort_order: 110, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'CHATTER_MARK', label: 'Chatter Mark', value: 'Chatter Mark', sort_order: 120, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'BEARING_FACE_UNDERSIZE', label: 'Bearing Face Undersize', value: 'Bearing Face Undersize', sort_order: 130, is_system_default: true },
  { category: 'DEFECT_CATEGORY', code: 'SHORT_QTY', label: 'Short Qty', value: 'Short Qty', sort_order: 140, is_system_default: true },

  // 3. Disposition Actions
  { category: 'DISPOSITION_ACTION', code: 'SCRAP', label: 'Scrap', value: 'Scrap', sort_order: 10, is_system_default: true },
  { category: 'DISPOSITION_ACTION', code: 'DOWNGRADE', label: 'Down-grade', value: 'Down-grade', sort_order: 20, is_system_default: true },
  { category: 'DISPOSITION_ACTION', code: 'RECUT_SHORT', label: 'Recut Short', value: 'Recut Short', sort_order: 30, is_system_default: true },
  { category: 'DISPOSITION_ACTION', code: 'REWORK_THREAD', label: 'Rework Thread', value: 'Rework Thread', sort_order: 40, is_system_default: true },

  // 4. Process Stages
  { category: 'PROCESS_STAGE', code: 'CUTTING', label: 'Cutting (Band/Cold Saw)', value: 'Cutting', sort_order: 10, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'ID_ROUGHING', label: 'ID Roughing (Boring/Chamfer)', value: 'ID Roughing', sort_order: 20, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'OD_ROUGHING', label: 'OD Roughing (Turning & Facing)', value: 'OD Roughing', sort_order: 30, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'THREADING', label: 'CNC Threading', value: 'Threading', sort_order: 40, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'MPI', label: 'MPI (Magnetic Particle Inspection)', value: 'MPI', sort_order: 50, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'PHOSPHATING', label: 'Phosphating (Anti-galling coating)', value: 'Phosphating', sort_order: 60, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'PAINTING', label: 'Painting & Color Coding Band', value: 'Painting', sort_order: 70, is_system_default: true },
  { category: 'PROCESS_STAGE', code: 'PACKING', label: 'Packing & Protector Bundling', value: 'Packing', sort_order: 80, is_system_default: true },

  // 5. Pipe Statuses
  { category: 'PIPE_STATUS', code: 'AVAILABLE', label: 'Available', value: 'Available', sort_order: 10, is_system_default: true },
  { category: 'PIPE_STATUS', code: 'ALLOCATED', label: 'Allocated', value: 'Allocated', sort_order: 20, is_system_default: true },
  { category: 'PIPE_STATUS', code: 'CONSUMED', label: 'Consumed', value: 'Consumed', sort_order: 30, is_system_default: true },
  { category: 'PIPE_STATUS', code: 'SCRAPPED', label: 'Scrapped', value: 'Scrapped', sort_order: 40, is_system_default: true },

  // 6. Shifts
  { category: 'SHIFT', code: 'SHIFT_A', label: 'Shift A (06:00 - 14:00)', value: 'Shift A', sort_order: 10, is_system_default: true },
  { category: 'SHIFT', code: 'SHIFT_B', label: 'Shift B (14:00 - 22:00)', value: 'Shift B', sort_order: 20, is_system_default: true },
  { category: 'SHIFT', code: 'SHIFT_C', label: 'Shift C (22:00 - 06:00)', value: 'Shift C', sort_order: 30, is_system_default: true },

  // 7. Steel Grades
  { category: 'STEEL_GRADE', code: 'J55', label: 'API 5CT J55', value: 'J55', sort_order: 10, is_system_default: true },
  { category: 'STEEL_GRADE', code: 'K55', label: 'API 5CT K55', value: 'K55', sort_order: 20, is_system_default: true },
  { category: 'STEEL_GRADE', code: 'L80', label: 'API 5CT L80-1', value: 'L80', sort_order: 30, is_system_default: true },
  { category: 'STEEL_GRADE', code: 'N80', label: 'API 5CT N80-Q', value: 'N80', sort_order: 40, is_system_default: true },
  { category: 'STEEL_GRADE', code: 'P110', label: 'API 5CT P110', value: 'P110', sort_order: 50, is_system_default: true },
  { category: 'STEEL_GRADE', code: 'Q125', label: 'API 5CT Q125 High Strength', value: 'Q125', sort_order: 60, is_system_default: true },

  // 8. Thread Types
  { category: 'THREAD_TYPE', code: 'BTC', label: 'Buttress Thread Connection (BTC)', value: 'BTC', sort_order: 10, is_system_default: true },
  { category: 'THREAD_TYPE', code: 'LTC', label: 'Long Thread Connection (LTC)', value: 'LTC', sort_order: 20, is_system_default: true },
  { category: 'THREAD_TYPE', code: 'STC', label: 'Short Thread Connection (STC)', value: 'STC', sort_order: 30, is_system_default: true },
  { category: 'THREAD_TYPE', code: 'PREMIUM', label: 'Premium Gas-Tight Connection', value: 'Premium', sort_order: 40, is_system_default: true },
  { category: 'THREAD_TYPE', code: 'PLAIN_END', label: 'Plain End (PE)', value: 'Plain End', sort_order: 50, is_system_default: true },
];

export async function seedLov() {
  console.log('Seeding Dynamic List of Values (LOV)...');
  let upsertCount = 0;
  for (const item of INITIAL_LOV_DATA) {
    await prisma.listOfValue.upsert({
      where: {
        category_code: {
          category: item.category,
          code: item.code,
        },
      },
      update: {
        label: item.label,
        value: item.value,
        sort_order: item.sort_order,
        is_system_default: item.is_system_default,
      },
      create: {
        category: item.category,
        code: item.code,
        label: item.label,
        value: item.value,
        sort_order: item.sort_order,
        is_active: true,
        is_system_default: item.is_system_default,
      },
    });
    upsertCount++;
  }
  console.log(`✅ Successfully seeded/upserted ${upsertCount} LOV items.`);
}

if (process.argv[1] && process.argv[1].endsWith('seed-lov.mjs')) {
  seedLov()
    .catch((e) => {
      console.error('Error seeding LOV:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
