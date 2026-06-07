---
title: BiztelAI Workflow Automation
emoji: 📈
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# BiztelAI Operational Workflow Automation System

An AI-native web application prototype designed to digitize handwritten, semi-structured operational manufacturing documents and convert them into reviewable operational records with business rule validations and real-time dashboard analytics.

---

## 🌟 Key Features

1. **Document Ingestion & Preview**: Support for uploading and previewing image files (PNG, JPG, JPEG) and PDF documents.
2. **Multimodal AI Extraction**: Uses the **Gemini 2.5 Flash API** to perform direct OCR and structured JSON extraction from logs, returning fields and corresponding confidence scores.
3. **Side-by-Side Review Workspace**: Dual-pane editor. The left side displays the document preview (PDF/Image) while the right side displays the editable form pre-filled by the AI.
4. **Operations Dashboard**: Real-time KPI indicator cards (Total Uploads, Error Rates, Quantity Produced, Total Hours) and visual analytics showing production output per shift and per machine.
5. **Business Rules Validation Engine**: Implements operational rules to flag warnings and errors:
   - Mandatory missing fields
   - Invalid shifts (valid shifts: Shift A, B, or C)
   - Invalid Machine/Operation code formats (valid formats: `MC-XXX` and `OP-XXX`)
   - Suspicious values (quantity > 10,000, time > 24 hours, or quantity is 0)
   - Duplicate Work Orders
6. **Search & Audit Logs**: Searchable record list filterable by shift and process status.
7. **Zero-API Key Sandbox Fallback**: If `GEMINI_API_KEY` is not provided, the application runs in a simulated sandbox mode with realistic mock OCR extraction, allowing complete evaluation of the dashboard, review workspace, and validation alerts without configuring any API keys.

---

## 🛠️ Architecture Overview

The application is structured as a client-server monorepo to make setup, running, and deployment fast and simple:

- **Frontend**: Built with **React** and **Vite**, featuring a responsive dark-theme layout, custom CSS glassmorphism, micro-animations, and custom SVG/Flex-based dashboard charts (eliminating external chart library weight).
- **Backend**: **Node.js** and **Express**, using `multer` for multipart uploads and routing API endpoints.
- **Database**: Custom JSON transactional database (`server/data/db.json`). This ensures 100% portability and zero binary compilation failures on different platforms (unlike native SQLite dependencies), while maintaining database logic (INSERT, UPDATE, stats aggregation).
- **AI Integration**: Direct HTTPS integration with the **Gemini Developer API** via native fetch (Node 18+), avoiding additional SDK dependency bloat.

---

## 🚀 Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (Version 18 or above recommended)

### 1. Clone & Navigate
Navigate into the project directory:
```bash
cd "/Users/ananth001gmail.com/untitled folder/biztelai-workflow-automation"
```

### 2. Install Dependencies
Install all root, backend, and frontend dependencies automatically:
```bash
npm run install-all
```

### 3. Configure API Key
1. Rename `server/.env.example` to `server/.env`.
2. Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```
*(Note: If left empty, the application runs in Sandbox Mode, using mock AI extraction for immediate testing).*

### 4. Run the Application
Start both the Express backend and the Vite React frontend concurrently:
```bash
npm run dev
```
Once started:
- Frontend runs at: `http://localhost:3000`
- Backend server runs at: `http://localhost:5001`

---

## 💡 Assumptions and Trade-offs

1. **JSON Database**: Instead of using standard SQLite, a JSON transactional file store was implemented. This allows the prototype to run out-of-the-box on any machine without compilation issues (`node-gyp` or version mismatches), which is ideal for a 48-hour submission.
2. **Gemini API Integration**: Native `fetch` is used instead of the `@google/generative-ai` package to eliminate dependency version friction and keep the bundle lightweight.
3. **Structured Formats**: Assumed standard machine formats (`MC-XXX`) and operation codes (`OP-XXX`) based on typical industrial standards, with custom regex validations.
