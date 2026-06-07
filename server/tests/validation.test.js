const validateRecord = require('../validator');

function runTests() {
  console.log('--- RUNNING NESTED MULTI-ROW VALIDATION RULES TESTS ---');
  let passCount = 0;
  let failCount = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      failCount++;
    }
  };

  const f = (val) => ({ value: val, confidence: 0.95 });

  // Mock list of database uploads for duplicates checks
  const mockUploads = [
    {
      id: 'upl_111',
      status: 'Reviewed',
      fileName: 'log_sheet_old.png',
      extractedData: {
        rows: [
          {
            workOrderNumber: f('165455'),
            shift: f('I')
          }
        ]
      }
    }
  ];

  // Test Case 1: Valid multi-row payload (matching the user's log sheet format)
  const validData = {
    rows: [
      {
        date: f('18/4/26'),
        shift: f('I'),
        employeeNumber: f('BT1234'),
        operationCode: f('54321'),
        machineNumber: f('ABC-T30'),
        workOrderNumber: f('889988'),
        quantityProduced: f('450'),
        timeTaken: f('2.0')
      },
      {
        date: f('18/4/26'),
        shift: f('II'),
        employeeNumber: f('BT4005'),
        operationCode: f('856432'),
        machineNumber: f('MC-840'),
        workOrderNumber: f('24686870'),
        quantityProduced: f('10'),
        timeTaken: f('6.0')
      }
    ]
  };
  const errors1 = validateRecord(validData, mockUploads, 'upl_222');
  assert(errors1.length === 0, 'Valid multi-row operational sheet should have 0 validation errors.');

  // Test Case 2: Missing mandatory fields in Row 1
  const missingData = {
    rows: [
      {
        date: f('18/4/26'),
        shift: f(''), // missing
        employeeNumber: f('BT1234'),
        operationCode: f('54321'),
        machineNumber: f('ABC-T30'),
        workOrderNumber: f('WO-9988'),
        quantityProduced: f('450'),
        timeTaken: f('') // missing
      }
    ]
  };
  const errors2 = validateRecord(missingData, mockUploads, 'upl_222');
  const errorFields = errors2.map(e => `${e.rowIdx}-${e.field}`);
  assert(errorFields.includes('0-shift'), 'Validator should flag missing shift in Row 1.');
  assert(errorFields.includes('0-timeTaken'), 'Validator should flag missing timeTaken in Row 1.');

  // Test Case 3: Roman numeral shift validation vs Invalid shift
  const shiftsData = {
    rows: [
      { ...validData.rows[0], shift: f('III') }, // Valid Roman shift III
      { ...validData.rows[1], shift: f('Shift IV') } // Invalid shift
    ]
  };
  const errors3 = validateRecord(shiftsData, mockUploads, 'upl_222');
  assert(errors3.length === 1, 'Should only flag 1 error for Shift IV.');
  assert(errors3[0].rowIdx === 1 && errors3[0].field === 'shift', 'Validator should flag Shift IV on Row 2.');

  // Test Case 4: Duplicate checks (Work Order present in another upload batch)
  const duplicateWOData = {
    rows: [
      { ...validData.rows[0], workOrderNumber: f('165455') } // Matches mockUploads[0].rows[0].workOrderNumber
    ]
  };
  const errors4 = validateRecord(duplicateWOData, mockUploads, 'upl_222');
  assert(errors4.some(e => e.field === 'workOrderNumber' && e.message.includes('Duplicate')), 'Validator should flag duplicate Work Order already processed.');

  // Test Case 5: Repeated Work Order numbers *within* the same sheet
  const repeatWOData = {
    rows: [
      { ...validData.rows[0], workOrderNumber: f('WO-999') },
      { ...validData.rows[1], workOrderNumber: f('WO-999') } // Repeated work order in same sheet
    ]
  };
  const errors5 = validateRecord(repeatWOData, mockUploads, 'upl_222');
  assert(errors5.some(e => e.rowIdx === 1 && e.field === 'workOrderNumber' && e.message.includes('repeated within this log sheet')), 'Validator should flag repeated work order inside current sheet.');

  // Test Case 6: Suspicious checks
  const suspiciousData = {
    rows: [
      { ...validData.rows[0], quantityProduced: f('12000') } // suspicious (>10000)
    ]
  };
  const errors6 = validateRecord(suspiciousData, mockUploads, 'upl_222');
  assert(errors6.some(e => e.field === 'quantityProduced' && e.message.includes('Suspiciously high')), 'Validator should warning flag suspicious quantity.');

  // Test Case 7: Nil values check
  const nilData = {
    rows: [
      { ...validData.rows[0], quantityProduced: f('-') },
      { ...validData.rows[1], quantityProduced: f('nil') }
    ]
  };
  const errors7 = validateRecord(nilData, mockUploads, 'upl_222');
  assert(errors7.length === 0, 'Validator should accept "-" or "nil" as valid quantityProduced values.');

  console.log(`\nTests Summary: ${passCount} Passed, ${failCount} Failed.`);
  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('All multi-row validation rules tests passed successfully!');
  }
}

runTests();
