const fs = require('fs');

/**
 * Encodes a local file to base64
 */
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * Mock extractor returning exact sample data from the user's uploaded document
 */
function mockExtract() {
  console.log('--- Running MOCK Operational Sheet OCR Extraction ---');
  
  const score = (low = false) => {
    if (low) return parseFloat((0.55 + Math.random() * 0.22).toFixed(2));
    return parseFloat((0.85 + Math.random() * 0.13).toFixed(2));
  };

  return {
    rows: [
      {
        date: { value: '18/4/26', confidence: score() },
        shift: { value: 'I', confidence: score() },
        employeeNumber: { value: 'BT1234', confidence: score() },
        operationCode: { value: '54321', confidence: score() },
        machineNumber: { value: 'ABC-T30', confidence: score() },
        workOrderNumber: { value: '165455', confidence: score() },
        quantityProduced: { value: '-', confidence: score() },
        timeTaken: { value: '2.0', confidence: score(true), reason: 'Handwritten digit is slightly cut off at the top.' }
      },
      {
        date: { value: '18/4/26', confidence: score() },
        shift: { value: 'II', confidence: score() },
        employeeNumber: { value: 'BT4005', confidence: score() },
        operationCode: { value: '856432', confidence: score() },
        machineNumber: { value: 'MC-840', confidence: score() },
        workOrderNumber: { value: '24686870', confidence: score(true), reason: 'Ink is smudged near the third digit.' },
        quantityProduced: { value: '10', confidence: score() },
        timeTaken: { value: '6.0', confidence: score() }
      },
      {
        date: { value: '18/4/26', confidence: score() },
        shift: { value: 'III', confidence: score() },
        employeeNumber: { value: 'BT6025', confidence: score() },
        operationCode: { value: '856433', confidence: score() },
        machineNumber: { value: 'MC-850', confidence: score() },
        workOrderNumber: { value: '24686870', confidence: score() },
        quantityProduced: { value: '5', confidence: score() },
        timeTaken: { value: '3.5', confidence: score() }
      }
    ],
    isMock: true
  };
}

/**
 * Call Gemini Multimodal API to extract list of rows and confidence scores
 */
async function extractOperationalData(filePath, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    console.warn('GEMINI_API_KEY is not defined. Using mock data extraction fallback.');
    return mockExtract();
  }

  try {
    const base64Data = fileToBase64(filePath);
    
    const promptText = `
You are an expert AI system for digitizing handwritten operational log sheets from a manufacturing plant.
Locate the main table and extract all written rows of data. Do not extract empty rows.

For each row, extract the following fields: "date", "shift", "employeeNumber", "operationCode", "machineNumber", "workOrderNumber", "quantityProduced", "timeTaken".
If a field is empty, set value to "". If a field contains a dash/hyphen (like quantity produced is "-"), set value to "-" exactly. Do not convert a dash/hyphen to "".

For each field in a row, perform OCR and return an object structure containing:
1. "value": The extracted string value.
2. "confidence": A rating between 0.0 and 1.0 (0.0 means completely illegible/missing, 1.0 is extremely clear).
3. "reason": If the confidence is less than 0.8, write a short, clear description of the visual issue in the handwriting or text (e.g. "Last digit slightly smudged", "Handwriting is faint", "Overlap with border line"). Omit the "reason" field if confidence is 0.8 or higher.

Return the data STRICTLY in JSON format following this schema:
{
  "rows": [
    {
      "date": {
        "value": "2026-06-07",
        "confidence": 0.95
      },
      "shift": {
        "value": "I",
        "confidence": 0.74,
        "reason": "Text is faint and partially cut off."
      },
      "employeeNumber": {
        "value": "BT1234",
        "confidence": 0.96
      },
      "operationCode": {
        "value": "54321",
        "confidence": 0.95
      },
      "machineNumber": {
        "value": "ABC-T30",
        "confidence": 0.92
      },
      "workOrderNumber": {
        "value": "165455",
        "confidence": 0.65,
        "reason": "Last digit is written in a hurried stroke."
      },
      "quantityProduced": {
        "value": "-",
        "confidence": 0.94
      },
      "timeTaken": {
        "value": "2.0",
        "confidence": 0.93
      }
    }
  ]
}

Ensure the output is valid JSON. Return ONLY the JSON object. Do not include markdown code block syntax or additional explanation.
`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    console.log(`Sending file ${filePath} (${mimeType}) to Gemini API for multi-row OCR...`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    
    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error('No candidates returned from Gemini API.');
    }
    
    const candidate = responseData.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Candidate content is empty.');
    }

    const jsonText = candidate.content.parts[0].text;
    console.log('Gemini raw response text:', jsonText);

    const parsedData = JSON.parse(jsonText.trim());
    
    // Ensure rows array exists
    if (!parsedData.rows || !Array.isArray(parsedData.rows)) {
      throw new Error('Invalid JSON structure returned: missing "rows" array.');
    }

    return parsedData;

  } catch (error) {
    console.error('Error during Gemini API data extraction:', error);
    throw error;
  }
}

module.exports = {
  extractOperationalData,
  mockExtract
};
