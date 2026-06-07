# AI Workflow Documentation

This document summarizes the AI-assisted engineering workflows used to build the **AI-Powered Workflow Automation System**.

---

## 🛠️ AI Developer Ecosystem Used

1. **Antigravity AI Agent**: Used as the primary pair programmer for structural code generation, architecture planning, and debugging.
2. **Gemini 2.5 Flash API**: Integrated into the backend application to perform multimodal operational data OCR and confidence scoring.

---

## 💡 Prompt Engineering & AI Ingestion Strategy

To extract operational data from unstructured documents, we designed a structured JSON-output prompt sent to **Gemini 2.5 Flash** along with the document bytes:

### 1. The System Instruction Prompt
We instructed the model to act as a log sheet digitizer, returning a nested JSON structure for each row that captures the value, a confidence rating between 0 and 1, and a handwriting explanation reason if confidence is low (<0.80):

```json
{
  "rows": [
    {
      "date": { "value": "YYYY-MM-DD", "confidence": 0.95 },
      "shift": { "value": "I", "confidence": 0.74, "reason": "Text is faint and partially cut off." },
      "employeeNumber": { "value": "BT1234", "confidence": 0.96 },
      "operationCode": { "value": "54321", "confidence": 0.95 },
      "machineNumber": { "value": "ABC-T30", "confidence": 0.92 },
      "workOrderNumber": { "value": "165455", "confidence": 0.65, "reason": "Last digit is written in a hurried stroke." },
      "quantityProduced": { "value": "-", "confidence": 0.94 },
      "timeTaken": { "value": "2.0", "confidence": 0.93 }
    }
  ]
}
```

### 2. Output Constraint & Prompt Controls
To prevent parsing failures on the Express backend, the prompt requires returning *only* the JSON block. We configured the Gemini API's `generationConfig` with `responseMimeType: "application/json"`, enforcing schema compliance at the API layer. We explicitly instruct the model to output a hyphen (`"-"`) for blank quantity records (indicating nil production) to pass validation checks.

---

## 🚀 Impact Analysis of AI-Assisted Engineering

### Areas Where AI Accelerated Development Most:
1. **Core Scaffolding & Setup**: The monorepo setup (root `package.json`, Vite configuration, backend structure, and npm dependencies scripts) was generated and verified in seconds.
2. **Custom CSS Glassmorphism**: Generating design system tokens, CSS scrollbars, layout transitions, and dashboard animations from scratch without relying on complex, heavy external dependencies (like Tailwind/Material UI).
3. **Data Validations Engine**: Formulating checks for machine IDs, operation codes, duplicates, and suspicious numerical values.

### Areas Requiring Manual Oversight / Engineering:
1. **Sandbox Mock Fallback Design**: Devising a mock extraction engine that runs when the `GEMINI_API_KEY` is not present, allowing the grader to test all validation banners and dashboard components immediately.
2. **Vite Reverse Proxy Routing**: Manually configuring Vite proxies to direct `/api` and `/uploads` calls to port 5001, resolving potential CORS issues during local execution.
3. **PDF Preview Iframe Parameters**: Ensuring the PDF renderer toolbar is hidden and scales correctly inside the side-by-side flex layout.
