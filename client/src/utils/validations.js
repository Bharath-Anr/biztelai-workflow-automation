/**
 * Client-Side Validation Rules
 * Matches the backend logic for validating multiple rows and relaxed formats.
 * Returns an array of objects: { rowIdx: number, field: string, message: string }
 */
export function validateFormFields(extractedData, allUploads = [], currentUploadId = null) {
  const errors = [];
  
  if (!extractedData || !Array.isArray(extractedData.rows)) {
    return [{ field: 'general', message: 'No rows data to validate.' }];
  }

  const isEmpty = (val) => val === undefined || val === null || String(val).trim() === '';

  // 1. Validate each row in the table
  extractedData.rows.forEach((rowObj, rowIdx) => {
    const fields = {
      date: rowObj.date?.value !== undefined ? rowObj.date.value : rowObj.date,
      shift: rowObj.shift?.value !== undefined ? rowObj.shift.value : rowObj.shift,
      employeeNumber: rowObj.employeeNumber?.value !== undefined ? rowObj.employeeNumber.value : rowObj.employeeNumber,
      operationCode: rowObj.operationCode?.value !== undefined ? rowObj.operationCode.value : rowObj.operationCode,
      machineNumber: rowObj.machineNumber?.value !== undefined ? rowObj.machineNumber.value : rowObj.machineNumber,
      workOrderNumber: rowObj.workOrderNumber?.value !== undefined ? rowObj.workOrderNumber.value : rowObj.workOrderNumber,
      quantityProduced: rowObj.quantityProduced?.value !== undefined ? rowObj.quantityProduced.value : rowObj.quantityProduced,
      timeTaken: rowObj.timeTaken?.value !== undefined ? rowObj.timeTaken.value : rowObj.timeTaken
    };

    // Required fields check
    const requiredFields = [
      { key: 'date', label: 'Date' },
      { key: 'shift', label: 'Shift' },
      { key: 'employeeNumber', label: 'Employee Number' },
      { key: 'operationCode', label: 'Operation Code' },
      { key: 'machineNumber', label: 'Machine Number' },
      { key: 'workOrderNumber', label: 'Work Order Number' },
      { key: 'quantityProduced', label: 'Quantity Produced' },
      { key: 'timeTaken', label: 'Time Taken' }
    ];

    requiredFields.forEach(f => {
      if (isEmpty(fields[f.key])) {
        errors.push({ 
          rowIdx, 
          field: f.key, 
          message: `Row ${rowIdx + 1}: ${f.label} is a mandatory field.` 
        });
      }
    });

    // Validate Shift (I, II, III, Shift A, Shift B, Shift C, 1, 2, 3)
    if (!isEmpty(fields.shift)) {
      const validShifts = ['I', 'II', 'III', 'Shift I', 'Shift II', 'Shift III', 'Shift A', 'Shift B', 'Shift C', '1', '2', '3', 'A', 'B', 'C'];
      const val = String(fields.shift).trim().toUpperCase();
      const isValid = validShifts.some(s => s.toUpperCase() === val);
      if (!isValid) {
        errors.push({ 
          rowIdx, 
          field: 'shift', 
          message: `Row ${rowIdx + 1}: Invalid shift: "${fields.shift}". Expected Roman numeral (I, II, III) or shift letter/digit.` 
        });
      }
    }

    // Format validation for Machine Number (Alphanumeric, allowing dashes like ABC-T30, MC-840)
    if (!isEmpty(fields.machineNumber)) {
      const machineRegex = /^[A-Z0-9-]+$/i;
      if (!machineRegex.test(String(fields.machineNumber).trim())) {
        errors.push({ 
          rowIdx, 
          field: 'machineNumber', 
          message: `Row ${rowIdx + 1}: Invalid machine number: "${fields.machineNumber}". Must be alphanumeric.` 
        });
      }
    }

    // Format validation for Operation Code (Alphanumeric, like 54321, OP-105)
    if (!isEmpty(fields.operationCode)) {
      const opRegex = /^[A-Z0-9-]+$/i;
      if (!opRegex.test(String(fields.operationCode).trim())) {
        errors.push({ 
          rowIdx, 
          field: 'operationCode', 
          message: `Row ${rowIdx + 1}: Invalid operation code: "${fields.operationCode}". Must be alphanumeric.` 
        });
      }
    }

    // Format validation for Employee Number (Alphanumeric, like BT1234)
    if (!isEmpty(fields.employeeNumber)) {
      const empRegex = /^[A-Z0-9-]+$/i;
      if (!empRegex.test(String(fields.employeeNumber).trim())) {
        errors.push({ 
          rowIdx, 
          field: 'employeeNumber', 
          message: `Row ${rowIdx + 1}: Invalid employee number: "${fields.employeeNumber}". Must be alphanumeric.` 
        });
      }
    }

    // Quantity Produced check (allowing "-", "nil", "NIL", "0" as valid nil values)
    if (!isEmpty(fields.quantityProduced)) {
      const qtyStr = String(fields.quantityProduced).trim().toLowerCase();
      const isNilValue = qtyStr === '-' || qtyStr === 'nil' || qtyStr === '0';
      
      if (!isNilValue) {
        const qty = Number(fields.quantityProduced);
        if (isNaN(qty) || qty < 0) {
          errors.push({ 
            rowIdx, 
            field: 'quantityProduced', 
            message: `Row ${rowIdx + 1}: Quantity Produced must be a non-negative number, '-' or 'nil'.` 
          });
        } else if (qty > 10000) {
          errors.push({ 
            rowIdx, 
            field: 'quantityProduced', 
            message: `Row ${rowIdx + 1}: Suspiciously high Quantity Produced (>10,000).` 
          });
        }
      }
    }

    // Time Taken check
    if (!isEmpty(fields.timeTaken)) {
      const hrs = Number(fields.timeTaken);
      if (isNaN(hrs) || hrs <= 0) {
        errors.push({ 
          rowIdx, 
          field: 'timeTaken', 
          message: `Row ${rowIdx + 1}: Time Taken must be greater than zero.` 
        });
      } else if (hrs > 24) {
        errors.push({ 
          rowIdx, 
          field: 'timeTaken', 
          message: `Row ${rowIdx + 1}: Suspiciously long duration (>24 hours).` 
        });
      }
    }

    // Check duplicate Work Order numbers in *other* upload batches
    if (!isEmpty(fields.workOrderNumber) && allUploads) {
      const duplicate = allUploads.find(u => 
        u.id !== currentUploadId && 
        u.status !== 'Failed' &&
        u.extractedData && 
        Array.isArray(u.extractedData.rows) &&
        u.extractedData.rows.some(r => {
          const rWo = r.workOrderNumber?.value !== undefined ? r.workOrderNumber.value : r.workOrderNumber;
          return String(rWo).trim().toLowerCase() === String(fields.workOrderNumber).trim().toLowerCase();
        })
      );
      if (duplicate) {
        errors.push({ 
          rowIdx, 
          field: 'workOrderNumber', 
          message: `Row ${rowIdx + 1}: Duplicate Work Order "${fields.workOrderNumber}" already processed in File: ${duplicate.fileName}.` 
        });
      }
    }
  });

  // Cross-row duplicates within the current uploaded sheet
  const seenWorkOrders = new Set();
  extractedData.rows.forEach((rowObj, rowIdx) => {
    const woVal = rowObj.workOrderNumber?.value !== undefined ? rowObj.workOrderNumber.value : rowObj.workOrderNumber;
    if (!isEmpty(woVal)) {
      const wo = String(woVal).trim().toLowerCase();
      if (seenWorkOrders.has(wo)) {
        errors.push({
          rowIdx,
          field: 'workOrderNumber',
          message: `Row ${rowIdx + 1}: Work Order "${woVal}" is repeated within this log sheet.`
        });
      } else {
        seenWorkOrders.add(wo);
      }
    }
  });

  return errors;
}
