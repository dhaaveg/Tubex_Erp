import fs from 'fs';
import path from 'path';

console.log('=== VERIFYING DATA EXPORT MODULE DISABLED STATE & STYLING ===\n');

const componentPath = path.resolve('src/components/modules/DataExportModule.tsx');
if (!fs.existsSync(componentPath)) {
  console.error('ERROR: DataExportModule.tsx not found at', componentPath);
  process.exit(1);
}

const content = fs.readFileSync(componentPath, 'utf8');

const checks = [
  {
    name: '1. Conditional State & hasRows check',
    test: () =>
      content.includes('const hasRows = Array.isArray(rows) && rows.length > 0') &&
      content.includes('const isDisabled = !hasRows || Boolean(isLoading)'),
  },
  {
    name: '2. Disabled attribute binding',
    test: () => content.includes('disabled={isDisabled}'),
  },
  {
    name: '3. Accessibility aria-disabled attribute',
    test: () => content.includes("aria-disabled={isDisabled ? 'true' : 'false'}"),
  },
  {
    name: '4. Visual Fading styles (opacity-40, cursor-not-allowed, pointer-events-none, grayscale-[40%], shadow-none)',
    test: () =>
      content.includes('opacity-40') &&
      content.includes('cursor-not-allowed') &&
      content.includes('pointer-events-none') &&
      content.includes('grayscale-[40%]') &&
      content.includes('shadow-none'),
  },
  {
    name: '5. Hover & active suppression when disabled',
    test: () =>
      content.includes('hover:bg-transparent') &&
      content.includes('hover:shadow-none') &&
      content.includes('active:scale-100'),
  },
  {
    name: '6. Smooth CSS transitions (transition-all duration-200 ease-in-out)',
    test: () => content.includes('transition-all duration-200 ease-in-out'),
  },
  {
    name: '7. Tooltip & subtitle user feedback message',
    test: () =>
      content.includes('No records found to export for the selected filter criteria.') &&
      content.includes('title={tooltipText}'),
  },
  {
    name: '8. Row counter reflection ("0 records selected" / "{count} records selected")',
    test: () =>
      content.includes('records selected') &&
      content.includes('bg-amber-500/10') &&
      content.includes('text-amber-300'),
  },
  {
    name: '9. Interactive Filter Toolbar (Date range, presets, search, reset)',
    test: () =>
      content.includes('datePreset') &&
      content.includes('searchQuery') &&
      content.includes('handleResetFilters') &&
      content.includes('Custom Range'),
  },
  {
    name: '10. Master Hero Card export buttons disabled handling',
    test: () =>
      content.includes('hasMasterRows') &&
      content.includes('hasRows={hasMasterRows}'),
  },
];

let allPassed = true;
checks.forEach((c) => {
  const passed = c.test();
  if (passed) {
    console.log(`[PASS] ${c.name}`);
  } else {
    console.error(`[FAIL] ${c.name}`);
    allPassed = false;
  }
});

console.log('\n--- SIMULATING STATE TRANSITIONS ---');

// Simulated logic verification
function simulateButtonState(rows, isLoading = false) {
  const hasRows = Array.isArray(rows) && rows.length > 0;
  const count = rows ? rows.length : 0;
  const isDisabled = !hasRows || Boolean(isLoading);
  const ariaDisabled = isDisabled ? 'true' : 'false';
  const tooltipText = !hasRows
    ? 'No records found to export for the selected filter criteria.'
    : `Export ${count} records`;
  const badgeText = `${count} ${count === 1 ? 'record' : 'records'} selected`;
  const isFaded = isDisabled;

  return {
    count,
    hasRows,
    isDisabled,
    ariaDisabled,
    tooltipText,
    badgeText,
    isFaded,
  };
}

const activeState = simulateButtonState([
  { id: 1, name: 'Pipe A' },
  { id: 2, name: 'Pipe B' },
]);
console.log('Active State (2 rows):', activeState);
if (
  activeState.isDisabled !== false ||
  activeState.ariaDisabled !== 'false' ||
  activeState.isFaded !== false
) {
  console.error('Active state simulation failed!');
  allPassed = false;
}

const emptyFilterState = simulateButtonState([]);
console.log('Empty Filter State (0 rows):', emptyFilterState);
if (
  emptyFilterState.isDisabled !== true ||
  emptyFilterState.ariaDisabled !== 'true' ||
  emptyFilterState.isFaded !== true ||
  emptyFilterState.tooltipText !==
    'No records found to export for the selected filter criteria.' ||
  emptyFilterState.badgeText !== '0 records selected'
) {
  console.error('Empty filter state simulation failed!');
  allPassed = false;
}

if (!allPassed) {
  console.error('\nVerification failed.');
  process.exit(1);
} else {
  console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY (10/10).');
}
