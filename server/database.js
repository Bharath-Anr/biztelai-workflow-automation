const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure database file and data directory exist
function init() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ uploads: [] }, null, 2));
  }
}

// Read database contents
function readDB() {
  init();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { uploads: [] };
  }
}

// Write database contents
function writeDB(data) {
  init();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}

// Database Actions
const db = {
  // Get all uploads (newest first)
  getAllUploads() {
    const data = readDB();
    return data.uploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  },

  // Get upload by ID
  getUploadById(id) {
    const data = readDB();
    return data.uploads.find(u => u.id === id);
  },

  // Insert a new upload entry
  insertUpload(upload) {
    const data = readDB();
    data.uploads.push(upload);
    writeDB(data);
    return upload;
  },

  // Update an existing upload entry
  updateUpload(id, updates) {
    const data = readDB();
    const index = data.uploads.findIndex(u => u.id === id);
    if (index !== -1) {
      data.uploads[index] = { ...data.uploads[index], ...updates };
      writeDB(data);
      return data.uploads[index];
    }
    return null;
  },

  // Get statistics for the dashboard
  getAnalytics() {
    const uploads = this.getAllUploads();
    
    // Filter to processed documents
    const processed = uploads.filter(u => u.status === 'Reviewed' || u.status === 'Pending Review');
    
    let totalQuantity = 0;
    let totalHours = 0;
    const shiftSummary = {};
    const machineSummary = {};
    let validationFailuresCount = 0;

    processed.forEach(u => {
      // If document validation failures are found, count it as a failing sheet
      if (u.validationErrors && u.validationErrors.length > 0) {
        validationFailuresCount++;
      }

      // Check if rows exist (multi-row layout)
      if (u.extractedData && Array.isArray(u.extractedData.rows)) {
        u.extractedData.rows.forEach(row => {
          const getVal = (field) => (field && field.value !== undefined) ? field.value : field;

          // Quantity Produced summary
          const qty = parseFloat(getVal(row.quantityProduced)) || 0;
          totalQuantity += qty;

          // Time Taken summary
          const hrs = parseFloat(getVal(row.timeTaken)) || 0;
          totalHours += hrs;

          // Shift summary (Normalize raw values into standard I, II, III labels)
          const rawShift = getVal(row.shift) || 'Unknown';
          let shift = 'Unknown';
          const normalizedShift = String(rawShift).trim().toUpperCase();
          
          if (normalizedShift === 'I' || normalizedShift === 'SHIFT A' || normalizedShift === 'SHIFT I' || normalizedShift === '1' || normalizedShift === 'A') {
            shift = 'I';
          } else if (normalizedShift === 'II' || normalizedShift === 'SHIFT B' || normalizedShift === 'SHIFT II' || normalizedShift === '2' || normalizedShift === 'B') {
            shift = 'II';
          } else if (normalizedShift === 'III' || normalizedShift === 'SHIFT C' || normalizedShift === 'SHIFT III' || normalizedShift === '3' || normalizedShift === 'C') {
            shift = 'III';
          } else {
            shift = rawShift;
          }

          if (!shiftSummary[shift]) {
            shiftSummary[shift] = { count: 0, quantity: 0 };
          }
          shiftSummary[shift].count++;
          shiftSummary[shift].quantity += qty;

          // Machine summary
          const machine = getVal(row.machineNumber) || 'Unknown';
          if (!machineSummary[machine]) {
            machineSummary[machine] = { count: 0, quantity: 0, hours: 0 };
          }
          machineSummary[machine].count++;
          machineSummary[machine].quantity += qty;
          machineSummary[machine].hours += hrs;
        });
      }
    });

    return {
      totalUploads: uploads.length,
      pendingReviews: uploads.filter(u => u.status === 'Pending Review').length,
      reviewedCount: uploads.filter(u => u.status === 'Reviewed').length,
      validationFailures: validationFailuresCount,
      totalQuantity,
      totalHours,
      shiftSummary,
      machineSummary
    };
  }
};

module.exports = db;
