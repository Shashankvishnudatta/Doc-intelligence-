# Demo Script - Document Intelligence RAG

## 1. Start The App

Backend:

```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

## 2. Demo Flow

### Step 1: Open The App

Start on the overview page and briefly explain that this is a Document Intelligence + Agentic RAG platform for parsing, classifying, indexing, and querying documents with citations.

### Step 2: Go To Upload

Open `/upload`.

### Step 3: Upload A PDF Document

Upload a PDF document and wait for it to reach the Ready / indexed state.

Say:

```text
The system stores the document, parses it, classifies it, and indexes it into the vector database.
```

### Step 4: Go To Chat

Click the Go to Chat button after the document is ready.

Ask:

```text
What is this PDF about?
```

### Step 5: Ask A Follow-Up

Ask:

```text
Highlight the projects mentioned in it.
```

Say:

```text
The assistant remembers the recent conversation and answers follow-up questions using the selected document.
```

### Step 6: Open The Knowledge Base

Open `/documents`, select the uploaded document, and show:

* document status
* page count
* file metadata
* classification fields
* page preview
* Ask in Chat handoff

### Step 7: Upload Or Select An Image Document

Upload or select an image / handwritten document such as `TEST.png`.

Ask:

```text
Look at this image and explain what you can understand from it.
```

Say:

```text
For image or handwritten documents, the system can use Gemini Vision instead of relying only on OCR text.
```

### Step 8: Show Citations

Show the citation card, page thumbnail, and source page preview.

Say:

```text
Each grounded answer includes source verification with document name, page number, and page preview.
```

### Step 9: Ask An Unrelated Question

With a document selected, ask:

```text
What is the capital of Japan?
```

Say:

```text
The assistant refuses unsupported selected-document questions instead of hallucinating.
```

## 3. Key Points To Mention

* FastAPI backend
* Next.js frontend
* SQLite metadata store
* Chroma vector store
* PDF, TXT, PNG, JPG, and JPEG ingestion
* OCR for scanned and image-heavy documents
* Gemini Vision for image / handwritten document understanding
* Structured document classification
* Selected-document RAG chat
* Conversational follow-up memory
* Citation-backed answers with page thumbnails
* Safe selected-document grounding and no-context refusal

## 4. Environment Note

Do not commit a real `.env` file.

Use `backend/.env.example` as the template for backend configuration.

For Gemini Vision image understanding, set:

```env
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-2.5-flash
RAG_USE_GEMINI_VISION=true
```

Restart the backend after editing `.env`.

## 5. Troubleshooting

* If Gemini Vision is not being used, confirm `GEMINI_API_KEY` and `RAG_USE_GEMINI_VISION=true`, then restart the backend.
* If an old document still gives weak OCR answers, reupload or reparse/reindex it so the latest OCR/indexing improvements are used.
* If PDF page previews fail, confirm Poppler is installed and available on `PATH`.
* If OCR fails, confirm Tesseract is installed and available on `PATH`.
* Check backend logs for Gemini Vision success messages when testing image documents.
