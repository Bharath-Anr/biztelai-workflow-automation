require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('./database');
const { extractOperationalData, mockExtract } = require('./extractor');
const validateRecord = require('./validator');

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static uploaded files
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Helper to normalize extracted fields into object format { value, confidence, reason }
 */
function normalizeField(field) {
  if (field === undefined || field === null) {
    return { value: '', confidence: 1.0 };
  }
  if (typeof field !== 'object') {
    return { value: String(field).trim(), confidence: 1.0 };
  }
  const norm = {
    value: field.value !== undefined && field.value !== null ? String(field.value).trim() : '',
    confidence: typeof field.confidence === 'number' ? field.confidence : 1.0
  };
  if (field.reason) {
    norm.reason = String(field.reason).trim();
  }
  return norm;
}

/**
 * Helper to process AI extraction asynchronously
 */
async function processExtraction(uploadId, filePath, mimetype, originalName = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  const isSandbox = !apiKey || apiKey.trim() === '';

  try {
    // Call Gemini Extractor
    const extractedData = await extractOperationalData(filePath, mimetype, originalName);
    
    // Check if we extracted any rows
    if (!extractedData.rows || extractedData.rows.length === 0) {
      throw new Error('Unrelated document format or invalid table structure detected. No operational rows could be identified.');
    }

    // Normalize rows array from Gemini
    const normalizedRows = (extractedData.rows || []).map(row => ({
      date: normalizeField(row.date),
      shift: normalizeField(row.shift),
      employeeNumber: normalizeField(row.employeeNumber),
      operationCode: normalizeField(row.operationCode),
      machineNumber: normalizeField(row.machineNumber),
      workOrderNumber: normalizeField(row.workOrderNumber),
      quantityProduced: normalizeField(row.quantityProduced),
      timeTaken: normalizeField(row.timeTaken)
    }));

    const normalizedData = {
      rows: normalizedRows,
      isMock: extractedData.isMock || false
    };

    // Retrieve database uploads for duplicate checks
    const allUploads = db.getAllUploads();
    
    // Run Validation Engine
    const validationErrors = validateRecord(normalizedData, allUploads, uploadId);

    // Save success response to DB
    db.updateUpload(uploadId, {
      status: 'Pending Review',
      extractedData: normalizedData,
      validationErrors: validationErrors
    });

    console.log(`Successfully completed extraction for upload ID: ${uploadId}`);
  } catch (error) {
    console.error(`AI Extraction failed for upload ID: ${uploadId}.`, error);
    
    const isUnrelated = error.message.includes('Unrelated document format') || error.message.includes('invalid table structure');

    if (isSandbox && !isUnrelated) {
      // ONLY fall back to mock data in Sandbox Mode (no API key configured) and when it's not an unrelated document error
      console.log('Sandbox Mode active. Applying fallback mock data...');
      try {
        const mockData = mockExtract();
        const normalizedRows = (mockData.rows || []).map(row => ({
          date: normalizeField(row.date),
          shift: normalizeField(row.shift),
          employeeNumber: normalizeField(row.employeeNumber),
          operationCode: normalizeField(row.operationCode),
          machineNumber: normalizeField(row.machineNumber),
          workOrderNumber: normalizeField(row.workOrderNumber),
          quantityProduced: normalizeField(row.quantityProduced),
          timeTaken: normalizeField(row.timeTaken)
        }));

        const normalizedData = {
          rows: normalizedRows,
          isMock: true,
          fallbackDueToError: true
        };

        const allUploads = db.getAllUploads();
        const validationErrors = validateRecord(normalizedData, allUploads, uploadId);
        validationErrors.push({ field: 'general', message: 'Note: Live AI extraction failed (API limits/503). Showing simulated results.' });

        db.updateUpload(uploadId, {
          status: 'Pending Review',
          extractedData: normalizedData,
          validationErrors: validationErrors
        });
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
        db.updateUpload(uploadId, {
          status: 'Failed',
          validationErrors: [{ field: 'general', message: 'Failed to extract data. Both live and mock extraction failed.' }]
        });
      }
    } else {
      // If a real API key is configured or it is an unrelated document error in sandbox mode, fail hard and show a helpful error message
      const errMsg = error.message || 'AI extraction failed. Please verify the document format is correct and legible.';
      db.updateUpload(uploadId, {
        status: 'Failed',
        validationErrors: [{ 
          field: 'general', 
          message: errMsg.includes('API key') || errMsg.includes('key')
            ? 'API key validation failed. Please check your GEMINI_API_KEY environment variable.'
            : errMsg 
        }]
      });
    }
  }
}

// Routes

// 1. Get History of Uploads
app.get('/api/uploads', (req, res) => {
  try {
    const list = db.getAllUploads();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve uploads' });
  }
});

// 2. Upload a single document
app.post('/api/upload', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const newUpload = {
      id: 'upl_' + Math.random().toString(36).substr(2, 9),
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      status: 'Processing',
      uploadedAt: new Date().toISOString(),
      extractedData: null,
      validationErrors: []
    };

    db.insertUpload(newUpload);

    // Start extraction process asynchronously so request returns immediately
    processExtraction(newUpload.id, req.file.path, req.file.mimetype, req.file.originalname);

    res.status(202).json({
      message: 'File uploaded and queueing for data extraction.',
      record: newUpload
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// 3. Get single upload detail
app.get('/api/uploads/:id', (req, res) => {
  try {
    const record = db.getUploadById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Upload record not found' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Database search failed' });
  }
});

// 4. Update and Review a processed record
app.put('/api/uploads/:id', (req, res) => {
  try {
    const existing = db.getUploadById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Upload record not found' });
    }

    const { rows, markReviewed } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'Missing rows array payload' });
    }

    const mergedData = { ...existing.extractedData, rows };

    // Re-run validations
    const allUploads = db.getAllUploads();
    const validationErrors = validateRecord(mergedData, allUploads, req.params.id);

    const status = markReviewed ? 'Reviewed' : 'Pending Review';

    const updated = db.updateUpload(req.params.id, {
      status,
      extractedData: mergedData,
      validationErrors
    });

    res.json({
      message: status === 'Reviewed' ? 'Record reviewed and locked successfully.' : 'Record saved as draft.',
      record: updated
    });
  } catch (error) {
    console.error('Update record error:', error);
    res.status(500).json({ error: 'Failed to update record' });
  }
});

// 5. Dashboard Analytics
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = db.getAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Analytics query error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Internal Server Error' });
});

// Serve static client assets in production
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
